"""Class sessions: create/start, close, live summary, history, CSV export."""
from __future__ import annotations

import csv
import io
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import cfg
from ..db import get_db
from ..models import (
    ClassSession,
    Course,
    Enrollment,
    SessionStatus,
    SubmissionStatus,
    User,
)
from ..schemas import SessionOut, SessionCreateIn, SessionSummaryOut
from ..security import require_professor
from ..services import (
    audit,
    enrolled_students,
    latest_submissions,
    maybe_close,
    new_public_id,
    reason_text,
    session_out,
    submission_out,
    utcnow,
)

router = APIRouter(tags=["sessions"])


@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(
    body: SessionCreateIn,
    prof: User = Depends(require_professor),
    db: Session = Depends(get_db),
):
    allowed = cfg()["attendance"]["allowed_window_minutes"]
    if body.window_minutes not in allowed:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"window_minutes must be one of {allowed}",
        )
    if body.course_id is not None:
        course = db.get(Course, body.course_id)
        if course is None or course.professor_id != prof.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Course not found")
    elif body.course_name:
        code = "".join(c for c in body.course_name.upper() if c.isalnum())[:8] or "COURSE"
        code = f"{code}-{new_public_id()[:4]}"
        course = Course(code=code, name=body.course_name.strip(), professor_id=prof.id)
        db.add(course)
        db.flush()
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="course_id or course_name required")

    now = utcnow()
    session = ClassSession(
        public_id=new_public_id(),
        course_id=course.id,
        professor_id=prof.id,
        start_time=now,
        end_time=now + timedelta(minutes=body.window_minutes),
        status=SessionStatus.active,
        geo_lat=body.geo_lat,
        geo_lng=body.geo_lng,
        geo_radius_m=body.geo_radius_m if body.geo_lat is not None else None,
    )
    db.add(session)
    db.flush()
    audit(db, "session.created", "session", session.public_id, actor_id=prof.id,
          detail={"course_id": course.id, "window_minutes": body.window_minutes})
    db.commit()
    db.refresh(session)
    return session_out(session, course, prof)


@router.get("/professor/sessions")
def professor_sessions(prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(ClassSession)
        .where(ClassSession.professor_id == prof.id)
        .order_by(ClassSession.id.desc())
        .limit(200)
    ).all()
    out = []
    for s in rows:
        s = maybe_close(db, s)
        course = db.get(Course, s.course_id)
        latest = latest_submissions(db, s.id)
        present = sum(1 for x in latest if x.status == SubmissionStatus.present)
        out.append(
            {
                **session_out(s, course, prof).model_dump(),
                "present_count": present,
                "submission_count": len(latest),
            }
        )
    return {"sessions": out}


@router.get("/professor/courses")
def professor_courses(prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    courses = db.scalars(select(Course).where(Course.professor_id == prof.id)).all()
    return {"courses": [{"id": c.id, "code": c.code, "name": c.name} for c in courses]}


def _get_owned_session(db: Session, public_id: str, prof: User) -> ClassSession:
    s = db.scalar(select(ClassSession).where(ClassSession.public_id == public_id))
    if s is None or s.professor_id != prof.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found")
    return maybe_close(db, s)


@router.post("/sessions/{public_id}/close", response_model=SessionOut)
def close_session(public_id: str, prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    s = _get_owned_session(db, public_id, prof)
    if s.status == SessionStatus.active:
        s.status = SessionStatus.closed
        s.end_time = utcnow()
        audit(db, "session.closed_early", "session", s.public_id, actor_id=prof.id)
        db.commit()
        db.refresh(s)
    return session_out(s, db.get(Course, s.course_id), prof)


@router.get("/sessions/{public_id}/summary", response_model=SessionSummaryOut)
def session_summary(public_id: str, prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    s = _get_owned_session(db, public_id, prof)
    course = db.get(Course, s.course_id)
    roster = enrolled_students(db, s.course_id)
    latest = latest_submissions(db, s.id)

    present, rejected, pending = [], [], []
    for sub in latest:
        student = db.get(User, sub.student_id)
        row = submission_out(sub, student)
        if sub.status == SubmissionStatus.present:
            present.append(row)
        elif sub.status == SubmissionStatus.pending_review:
            pending.append(row)
        else:
            rejected.append(row)

    present_count = len(present)
    total = len(roster)
    absent = max(total - present_count, 0)
    return SessionSummaryOut(
        session=session_out(s, course, prof),
        enrolled_count=total,
        present_count=present_count,
        absent_count=absent,
        rejected_count=len(rejected),
        pending_count=len(pending),
        present_pct=round(100.0 * present_count / total, 1) if total else 0.0,
        present=sorted(present, key=lambda r: r.submitted_at),
        rejected=sorted(rejected, key=lambda r: r.submitted_at),
        pending=sorted(pending, key=lambda r: r.submitted_at),
    )


@router.get("/sessions/{public_id}/export.csv")
def export_csv(public_id: str, prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    s = _get_owned_session(db, public_id, prof)
    roster = {u.id: u for u in enrolled_students(db, s.course_id)}
    latest = {sub.student_id: sub for sub in latest_submissions(db, s.id)}

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["session", s.public_id])
    w.writerow(["course", db.get(Course, s.course_id).name])
    w.writerow(["start", s.start_time.isoformat(), "end", s.end_time.isoformat()])
    w.writerow([])
    w.writerow(["student_name", "roll_no", "status", "submitted_at", "reason"])
    for uid, student in sorted(roster.items(), key=lambda kv: (kv[1].roll_no or "")):
        sub = latest.get(uid)
        if sub is None:
            w.writerow([student.name, student.roll_no or "", "absent", "", ""])
        else:
            w.writerow([
                student.name,
                student.roll_no or "",
                sub.status.value,
                sub.submitted_at.isoformat(),
                reason_text(sub.reason) or "",
            ])
    audit(db, "session.exported", "session", s.public_id, actor_id=prof.id)
    db.commit()
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="attendance_{s.public_id}.csv"'},
    )
