"""Shared service helpers: audit logging, session lifecycle, summary shaping."""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    AuditLog,
    ClassSession,
    Course,
    Enrollment,
    SessionStatus,
    Submission,
    SubmissionStatus,
    User,
)
from .pipeline import REASONS
from .schemas import SessionOut, SubmissionOut


def reason_text(reason: str | None) -> str | None:
    """Human-readable text for a stored reason code."""
    return REASONS.get(reason, reason) if reason else None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def audit(db: Session, action: str, entity: str, entity_id, actor_id=None, detail=None) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            detail=json.dumps(detail) if detail is not None else None,
        )
    )


def maybe_close(db: Session, session: ClassSession) -> ClassSession:
    """Server-side clock: a session past its end_time is closed."""
    end = session.end_time
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if session.status == SessionStatus.active and utcnow() > end:
        session.status = SessionStatus.closed
        audit(db, "session.auto_closed", "session", session.public_id)
        db.commit()
        db.refresh(session)
    return session


def session_out(session: ClassSession, course: Course, professor: User) -> SessionOut:
    return SessionOut(
        public_id=session.public_id,
        course_id=session.course_id,
        course_name=course.name,
        course_code=course.code,
        professor_name=professor.name,
        start_time=session.start_time,
        end_time=session.end_time,
        status=session.status.value,
        geo_enabled=session.geo_lat is not None and session.geo_lng is not None,
    )


def submission_out(sub: Submission, student: User) -> SubmissionOut:
    return SubmissionOut(
        id=sub.id,
        session_id=sub.session_id,
        student_id=sub.student_id,
        student_name=student.name,
        roll_no=student.roll_no,
        image_url=sub.image_url,
        submitted_at=sub.submitted_at,
        status=sub.status.value,
        reason=reason_text(sub.reason),
        reason_code=sub.reason,
        scores=sub.scores,
    )


def latest_submissions(db: Session, session_id: int) -> list[Submission]:
    """The standing submission per student — the newest row wins."""
    sub = (
        select(Submission.student_id, func.max(Submission.id).label("max_id"))
        .where(Submission.session_id == session_id)
        .group_by(Submission.student_id)
        .subquery()
    )
    return list(
        db.scalars(select(Submission).join(sub, Submission.id == sub.c.max_id)).all()
    )


def enrolled_students(db: Session, course_id: int) -> list[User]:
    ids = select(Enrollment.student_id).where(Enrollment.course_id == course_id)
    return list(db.scalars(select(User).where(User.id.in_(ids))).all())


def new_public_id() -> str:
    return secrets.token_hex(6)
