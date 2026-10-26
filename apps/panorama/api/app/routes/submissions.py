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

    already = db.scalars(
        select(Submission).where(
            Submission.session_id == session.id,
            Submission.student_id == student.id,
            Submission.status == SubmissionStatus.present,
        )
    ).first()
    if already is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Attendance already marked present")

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
    try:
        selfie_img = imaging.decode_image(selfie_data)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Selfie is not a readable image")
    frame_imgs = []
    for i, f in enumerate(frames):
        try:
            frame_imgs.append(imaging.decode_image(_read_image(f, f"frame {i+1}")))
        except HTTPException:
            raise
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Sweep frame {i+1} is not a readable image")
    pano = imaging.stitch_frames(frame_imgs)
    data = imaging.encode_jpeg(pano)
    img = pano
    # Store the captured selfie alongside the panorama for audit.
    SELFIES_DIR.mkdir(parents=True, exist_ok=True)
    (SELFIES_DIR / f"{uuid.uuid4().hex}.jpg").write_bytes(imaging.encode_jpeg(selfie_img))

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
            selfie_bgr=selfie_img,
        )
        status_v, reason, scores = verdict.status, verdict.reason, verdict.scores
        phash = scores.get("phash", "")

    sub = Submission(
        session_id=session.id,
        student_id=student.id,
        image_url=f"/uploads/submissions/{fname}",
        image_hash=phash,
        status=status_v,
        reason=reason,
        scores=scores,
    )
    db.add(sub)
    db.flush()
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
