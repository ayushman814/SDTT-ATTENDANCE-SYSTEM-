"""Profile, face enrollment, privacy deletion, and student history."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import imaging
from ..config import UPLOAD_DIR, cfg
from ..db import get_db
from ..models import (
    ClassSession,
    Course,
    Enrollment,
    Role,
    SessionStatus,
    Submission,
    SubmissionStatus,
    User,
)
from ..routes.auth import user_out
from ..schemas import HistoryCourseOut, StudentHistoryOut, UserOut
from ..security import current_user
from ..services import (
    as_utc,
    audit,
    latest_submissions,
    maybe_close,
    membership_overlaps,
    reason_text,
    submission_out,
)
from ..vision import get_engine

router = APIRouter(tags=["users"])

FACES_DIR = UPLOAD_DIR / "faces"


def _upload_path(url: str) -> Path:
    """Map a stored image URL (current or legacy /uploads form) to a file under UPLOAD_DIR."""
    parts = url.split("/")
    return UPLOAD_DIR / parts[-2] / parts[-1]


@router.post("/me/face", response_model=UserOut)
def enroll_face(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Enroll (or re-enroll) the reference face photo used for matching."""
    data = file.file.read(cfg()["upload"]["max_bytes"] + 1)
    if len(data) > cfg()["upload"]["max_bytes"]:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
    try:
        img = imaging.decode_image(data, max_pixels=cfg()["upload"]["max_pixels"])
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Not a readable image")
    try:
        embedding = get_engine().embed_largest(img)
    except ValueError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No face detected — retake the photo facing the camera",
        )
    FACES_DIR.mkdir(parents=True, exist_ok=True)
    path = FACES_DIR / f"user_{user.id}.jpg"
    path.write_bytes(imaging.strip_metadata(data))
    user.face_embedding = embedding.astype("float32").tobytes()
    user.face_photo_url = f"/api/uploads/faces/{path.name}"
    audit(db, "user.face_enrolled", "user", user.id, actor_id=user.id)
    db.commit()
    return user_out(user)


@router.delete("/me/face", status_code=204)
def delete_face_data(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Privacy: erase the stored embedding, reference photo, and captured selfies."""
    user.face_embedding = None
    if user.face_photo_url:
        p = _upload_path(user.face_photo_url)
        if p.exists():
            p.unlink()
    user.face_photo_url = None
    # Captured selfies are part of the user's face data — remove them too.
    for sub in db.scalars(select(Submission).where(Submission.student_id == user.id)).all():
        if sub.selfie_url:
            p = _upload_path(sub.selfie_url)
            if p.exists():
                p.unlink()
            sub.selfie_url = None
    audit(db, "user.face_deleted", "user", user.id, actor_id=user.id)
    db.commit()
    return None


@router.get("/student/sessions/active")
def student_active_sessions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Requires student role")
    rows = db.scalars(
        select(ClassSession)
        .join(Enrollment, Enrollment.course_id == ClassSession.course_id)
        .where(
            Enrollment.student_id == user.id,
            Enrollment.unenrolled_at.is_(None),
            ClassSession.status == SessionStatus.active,
        )
        .distinct()
        .order_by(ClassSession.end_time)
    ).all()
    out = []
    for s in rows:
        s = maybe_close(db, s)
        if s.status != SessionStatus.active:
            continue
        course = db.get(Course, s.course_id)
        mine = db.scalars(
            select(Submission)
            .where(Submission.session_id == s.id, Submission.student_id == user.id)
            .order_by(Submission.id.desc())
        ).first()
        out.append(
            {
                "public_id": s.public_id,
                "course_code": course.code,
                "course_name": course.name,
                "start_time": as_utc(s.start_time).isoformat(),
                "end_time": as_utc(s.end_time).isoformat(),
                "geo_enabled": s.geo_lat is not None,
                "my_status": mine.status.value if mine else None,
                "my_reason": reason_text(mine.reason) if mine else None,
            }
        )
    return {"sessions": out}


@router.get("/student/history", response_model=StudentHistoryOut)
def student_history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != Role.student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Requires student role")
    enrollments = db.scalars(
        select(Enrollment).where(Enrollment.student_id == user.id)
    ).all()
    # One row per course — a re-enrolled student has several period rows for
    # the same course, and each session counts once if any period overlaps it.
    periods_by_course: dict[int, list[Enrollment]] = {}
    for enr in enrollments:
        periods_by_course.setdefault(enr.course_id, []).append(enr)
    course_rows: list[HistoryCourseOut] = []
    for course_id, periods in periods_by_course.items():
        course = db.get(Course, course_id)
        sessions = db.scalars(
            select(ClassSession).where(ClassSession.course_id == course.id)
        ).all()
        total = attended = 0
        for s in sessions:
            s = maybe_close(db, s)
            if s.status != SessionStatus.closed:
                continue
            # Count only sessions the student could actually have attended —
            # the same membership-window overlap used for rosters/exports.
            if not any(
                membership_overlaps(
                    p.enrolled_at, p.unenrolled_at, s.start_time, s.end_time
                )
                for p in periods
            ):
                continue
            total += 1
            latest = [
                sub
                for sub in latest_submissions(db, s.id)
                if sub.student_id == user.id and sub.status == SubmissionStatus.present
            ]
            if latest:
                attended += 1
        pct = round(100.0 * attended / total, 1) if total else 0.0
        course_rows.append(
            HistoryCourseOut(
                course_code=course.code,
                course_name=course.name,
                sessions_attended=attended,
                sessions_total=total,
                pct=pct,
            )
        )
    subs = db.scalars(
        select(Submission).where(Submission.student_id == user.id).order_by(Submission.id.desc()).limit(100)
    ).all()
    return StudentHistoryOut(
        courses=course_rows,
        submissions=[submission_out(s, user) for s in subs],
    )
