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
from ..schemas import EnrollIn, SessionOut, SessionCreateIn, SessionSummaryOut
from ..security import require_professor
from ..services import (
    audit,
    enrolled_students,
    latest_submissions,
    maybe_close,
    new_public_id,
    reason_text,
    session_out,
    session_roster,
    submission_out,
    utcnow,
)
from ..models import Role


def _csv_cell(value: str | None) -> str:
    """Neutralize spreadsheet formula injection (=, +, -, @, tab, CR)."""
    s = value or ""
    if s and s[0] in "=+-@\t\r":
        return "'" + s
    return s

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
    # Geofencing is all-or-nothing: half a coordinate pair must not silently
    # create an unguarded session.
    if (body.geo_lat is None) != (body.geo_lng is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="geo_lat and geo_lng must be provided together",
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


# ── Enrollment management ────────────────────────────────────────────────────


def _owned_course(db: Session, course_id: int, prof: User) -> Course:
    course = db.get(Course, course_id)
    if course is None or course.professor_id != prof.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.get("/professor/students")
def list_students(prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    """Every registered student, so a professor can build a course roster."""
    students = db.scalars(select(User).where(User.role == Role.student).order_by(User.name)).all()
    return {
        "students": [
            {"id": s.id, "name": s.name, "email": s.email, "roll_no": s.roll_no}
            for s in students
        ]
    }


@router.get("/courses/{course_id}/students")
def course_students(course_id: int, prof: User = Depends(require_professor), db: Session = Depends(get_db)):
    course = _owned_course(db, course_id, prof)
    return {
        "students": [
            {"id": s.id, "name": s.name, "email": s.email, "roll_no": s.roll_no}
            for s in enrolled_students(db, course.id)
        ]
    }


@router.post("/courses/{course_id}/students", status_code=201)
def enroll_student(
    course_id: int,
    body: EnrollIn,
    prof: User = Depends(require_professor),
    db: Session = Depends(get_db),
):
    course = _owned_course(db, course_id, prof)
    student = db.scalar(
        select(User).where(User.email == body.email.strip().lower(), User.role == Role.student)
    )
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No student with that email")
    exists = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student.id, Enrollment.course_id == course.id
        )
    )
    if exists is not None and exists.unenrolled_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Student already enrolled")
    if exists is not None:
        # re-enroll: restart the membership period
        exists.enrolled_at = utcnow()
        exists.unenrolled_at = None
    else:
        db.add(Enrollment(student_id=student.id, course_id=course.id))
    audit(
        db, "course.enrolled", "course", course.id, actor_id=prof.id,
        detail={"student_id": student.id, "email": student.email},
    )
    db.commit()
    return {"id": student.id, "name": student.name, "email": student.email, "roll_no": student.roll_no}


@router.delete("/courses/{course_id}/students/{student_id}", status_code=204)
def unenroll_student(
    course_id: int,
    student_id: int,
    prof: User = Depends(require_professor),
    db: Session = Depends(get_db),
):
    course = _owned_course(db, course_id, prof)
    row = db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course.id,
            Enrollment.unenrolled_at.is_(None),
        )
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Student not enrolled")
    # Soft delete: attendance history must keep past roster membership intact.
    row.unenrolled_at = utcnow()
    audit(
        db, "course.unenrolled", "course", course.id, actor_id=prof.id,
        detail={"student_id": student_id},
    )
    db.commit()
    return None


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
    roster = session_roster(db, s)
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
    roster = {u.id: u for u in session_roster(db, s)}
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
            w.writerow([_csv_cell(student.name), _csv_cell(student.roll_no), "absent", "", ""])
        else:
            w.writerow([
                _csv_cell(student.name),
                _csv_cell(student.roll_no),
                sub.status.value,
                sub.submitted_at.isoformat(),
                _csv_cell(reason_text(sub.reason)),
            ])
    audit(db, "session.exported", "session", s.public_id, actor_id=prof.id)
    db.commit()
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="attendance_{s.public_id}.csv"'},
    )
