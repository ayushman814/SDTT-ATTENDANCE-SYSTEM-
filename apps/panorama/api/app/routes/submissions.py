"""Panorama submissions: upload + verify, read status, professor override."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import imaging
from ..config import UPLOAD_DIR, cfg
from ..db import get_db
from ..models import (
    ClassSession,
    Enrollment,
    SessionStatus,
    Submission,
    SubmissionStatus,
    User,
)
from ..pipeline import verify_submission
from ..schemas import OverrideIn, SubmissionOut
from ..security import current_user, rate_limit, require_professor, require_student
from ..services import audit, maybe_close, submission_out
from ..vision import get_engine

router = APIRouter(tags=["submissions"])

SUBMISSIONS_DIR = UPLOAD_DIR / "submissions"
SELFIES_DIR = UPLOAD_DIR / "selfies"


def _embedding_of(user: User) -> np.ndarray | None:
    if user.face_embedding is None:
        return None
    return np.frombuffer(user.face_embedding, dtype=np.float32)


@router.post(
    "/sessions/{public_id}/submit",
    response_model=SubmissionOut,
    dependencies=[Depends(rate_limit("submit", "submit_per_minute"))],
)
def submit(
    public_id: str,
    selfie: UploadFile = File(...),
    frames: list[UploadFile] = File(...),
    geo_lat: float | None = Form(default=None),
    geo_lng: float | None = Form(default=None),
    student: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    session = db.scalar(select(ClassSession).where(ClassSession.public_id == public_id))
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found")
    session = maybe_close(db, session)

    # The server never accepts an upload outside the window — regardless of
    # what the client sent — because it checks against its own clock.
    if session.status != SessionStatus.active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="window_closed: the attendance window has ended"
        )

    enrolled = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student.id,
            Enrollment.course_id == session.course_id,
        )
    )
    if enrolled is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not enrolled in this course")

    # A retake is only blocked when the student's standing (latest) submission
    # is already present — approving an older row must not strand a newer
    # rejection with no way to resubmit.
    latest = db.scalars(
        select(Submission)
        .where(
            Submission.session_id == session.id,
            Submission.student_id == student.id,
        )
        .order_by(Submission.id.desc())
    ).first()
    if latest is not None and latest.status == SubmissionStatus.present:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Attendance already marked present")

    # Authoritative receipt time: used for both window checks so a submission
    # that arrives inside the window can't expire mid-processing.
    received_at = datetime.now(timezone.utc)

    def _read_image(up: UploadFile, what: str) -> bytes:
        ctype = (up.content_type or "").lower()
        if ctype not in cfg()["upload"]["allowed_content_types"]:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"{what}: JPEG/PNG/WebP only")
        b = up.file.read(cfg()["upload"]["max_bytes"] + 1)
        if len(b) > cfg()["upload"]["max_bytes"]:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"{what} too large")
        return b

    # Live capture only: front-cam selfie + back-cam sweep frames, stitched
    # server-side into the panorama. There is no manual photo upload path.
    if len(frames) < 2:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Too few sweep frames — sweep the camera across the room")
    if len(frames) > cfg()["upload"]["max_frames"]:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Too many frames")
    selfie_data = _read_image(selfie, "selfie")
    max_pixels = cfg()["upload"]["max_pixels"]
    try:
        selfie_img = imaging.decode_image(selfie_data, max_pixels=max_pixels)
    except ValueError as exc:
        detail = "Selfie is too large" if str(exc) == "image_too_large" else "Selfie is not a readable image"
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=detail)
    frame_datas, frame_imgs = [], []
    for i, f in enumerate(frames):
        try:
            fdata = _read_image(f, f"frame {i+1}")
            frame_imgs.append(imaging.decode_image(fdata, max_pixels=max_pixels))
            frame_datas.append(fdata)
        except HTTPException:
            raise
        except ValueError as exc:
            detail = (
                f"Sweep frame {i+1} is too large"
                if str(exc) == "image_too_large"
                else f"Sweep frame {i+1} is not a readable image"
            )
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=detail)
    pano = imaging.stitch_frames(frame_imgs)
    data = imaging.encode_jpeg(pano)
    img = pano

    # Save the panorama (metadata stripped); verification runs on the bytes.
    SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.jpg"
    try:
        (SUBMISSIONS_DIR / fname).write_bytes(imaging.strip_metadata(data))
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Not a readable image")

    prof = db.get(User, session.professor_id)
    prior_hashes = list(db.scalars(select(Submission.image_hash)).all())

    if img is None:
        status_v = SubmissionStatus.rejected
        reason = "invalid_image"
        scores = {"received_at": datetime.now(timezone.utc).isoformat()}
        phash = ""
    else:
        geo = (geo_lat, geo_lng) if geo_lat is not None and geo_lng is not None else None
        verdict = verify_submission(
            img,
            data,
            session=session,
            student_embedding=_embedding_of(student),
            professor_embedding=_embedding_of(prof),
            prior_hashes=prior_hashes,
            engine=get_engine(),
            cfg=cfg(),
            geo=geo,
            now=received_at,
            selfie_bgr=selfie_img,
            extra_raw_bytes=[selfie_data, *frame_datas],
        )
        status_v, reason, scores = verdict.status, verdict.reason, verdict.scores
        phash = scores.get("phash", "")

        # The session may have been closed (by the professor or the clock)
        # while we were processing — re-check before persisting a verdict.
        db.expire(session)
        session = maybe_close(db, session)
        if session.status != SessionStatus.active:
            status_v, reason = SubmissionStatus.rejected, "window_closed"

    sub = Submission(
        session_id=session.id,
        student_id=student.id,
        image_url=f"/api/uploads/submissions/{fname}",
        image_hash=phash,
        status=status_v,
        reason=reason,
        scores=scores,
    )
    db.add(sub)
    db.flush()

    # Store the captured selfie keyed by the submission for audit + privacy
    # (delete_face_data removes it together with the reference photo).
    SELFIES_DIR.mkdir(parents=True, exist_ok=True)
    selfie_name = f"selfie_{sub.id}.jpg"
    (SELFIES_DIR / selfie_name).write_bytes(imaging.encode_jpeg(selfie_img))
    sub.selfie_url = f"/api/uploads/selfies/{selfie_name}"
    audit(
        db, "submission.created", "submission", sub.id, actor_id=student.id,
        detail={"session": public_id, "status": status_v.value, "reason": reason},
    )
    db.commit()
    db.refresh(sub)
    return submission_out(sub, student)


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission(submission_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    session = db.get(ClassSession, sub.session_id)
    if user.id != sub.student_id and user.id != session.professor_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your submission")
    return submission_out(sub, db.get(User, sub.student_id))


@router.patch("/submissions/{submission_id}/override", response_model=SubmissionOut)
def override_submission(
    submission_id: int,
    body: OverrideIn,
    prof: User = Depends(require_professor),
    db: Session = Depends(get_db),
):
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    session = db.get(ClassSession, sub.session_id)
    if session.professor_id != prof.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your session")
    sub.status = SubmissionStatus(body.status)
    if body.reason:
        sub.reason = body.reason
    elif body.status == "present":
        sub.reason = "professor_override"
    sub.override_by = prof.id
    from ..services import utcnow as _now

    sub.override_at = _now()
    audit(
        db, "submission.override", "submission", sub.id, actor_id=prof.id,
        detail={"status": body.status, "reason": sub.reason},
    )
    db.commit()
    db.refresh(sub)
    return submission_out(sub, db.get(User, sub.student_id))
