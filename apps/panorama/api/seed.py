#!/usr/bin/env python3
"""Seed demo data: 1 professor, 5 students, 1 course, enrollments, face embeddings.

Synthetic demo faces live in `seed_faces/` (generated portraits). Run:
    python seed.py
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import cv2  # noqa: E402

from app.db import SessionLocal, init_db  # noqa: E402
from app.models import Course, Enrollment, Role, User  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.vision import FaceEngine  # noqa: E402
from sqlalchemy import select  # noqa: E402

FACES = ROOT / "seed_faces"

# Demo passwords come from the environment or are generated per run — they are
# never published in the repo. Set PANORAMA_SEED_PROF_PASSWORD /
# PANORAMA_SEED_STUDENT_PASSWORD for deterministic credentials.
_prof_pw = os.getenv("PANORAMA_SEED_PROF_PASSWORD") or secrets.token_urlsafe(12)
_student_pw = os.getenv("PANORAMA_SEED_STUDENT_PASSWORD") or secrets.token_urlsafe(12)

PROFESSOR = dict(name="Prof. A. Verma", email="prof@demo.edu", password=_prof_pw, face="professor.png")
STUDENTS = [
    dict(name="Ananya Rao", email="student1@demo.edu", roll_no="CS101-01", password=_student_pw, face="student1.png"),
    dict(name="Rohan Iyer", email="student2@demo.edu", roll_no="CS101-02", password=_student_pw, face="student2.png"),
    dict(name="Mei Chen", email="student3@demo.edu", roll_no="CS101-03", password=_student_pw, face="student3.png"),
    dict(name="Kofi Mensah", email="student4@demo.edu", roll_no="CS101-04", password=_student_pw, face="student4.png"),
    dict(name="Lucia Torres", email="student5@demo.edu", roll_no="CS101-05", password=_student_pw, face="student5.png"),
]


def embed_face(engine: FaceEngine, path: Path) -> bytes:
    img = cv2.imread(str(path))
    if img is None:
        raise RuntimeError(f"cannot read {path}")
    return engine.embed_largest(img).astype("float32").tobytes()


def main() -> int:
    # --if-empty: launcher mode. Seed only a *fresh local* database — resolved
    # through app.config so .env is honored. Any existing user, or a non-SQLite
    # URL (Supabase/Postgres), means skip: re-seeding would resurrect deleted
    # face data, undo professor un-enrollments, or write demo accounts to
    # production. Checked BEFORE FaceEngine loads the models so the skip works
    # even where model files are absent.
    if "--if-empty" in sys.argv:
        from app.config import DATABASE_URL  # noqa: PLC0415

        if not DATABASE_URL.startswith("sqlite"):
            print("seed skipped: PANORAMA_DATABASE_URL points at an external database")
            return 0
        init_db()
        with SessionLocal() as probe:
            if probe.scalar(select(User.id).limit(1)) is not None:
                print("seed skipped: users already exist — existing data preserved")
                return 0

    init_db()
    engine = FaceEngine()
    db = SessionLocal()
    try:
        created: list[dict] = []
        prof = db.scalar(select(User).where(User.email == PROFESSOR["email"]))
        if prof is None:
            prof = User(
                role=Role.professor,
                name=PROFESSOR["name"],
                email=PROFESSOR["email"],
                password_hash=hash_password(PROFESSOR["password"]),
            )
            db.add(prof)
            db.flush()
            created.append({"label": "professor", **PROFESSOR})
        if prof.face_embedding is None:
            prof.face_embedding = embed_face(engine, FACES / PROFESSOR["face"])

        course = db.scalar(select(Course).where(Course.code == "CS-101"))
        if course is None:
            course = Course(code="CS-101", name="Computer Science 101", professor_id=prof.id)
            db.add(course)
            db.flush()

        for spec in STUDENTS:
            stu = db.scalar(select(User).where(User.email == spec["email"]))
            if stu is None:
                stu = User(
                    role=Role.student,
                    name=spec["name"],
                    email=spec["email"],
                    roll_no=spec["roll_no"],
                    password_hash=hash_password(spec["password"]),
                )
                db.add(stu)
                db.flush()
                created.append({"label": "student", **spec})
            if stu.face_embedding is None:
                stu.face_embedding = embed_face(engine, FACES / spec["face"])
            row = db.scalar(
                select(Enrollment).where(
                    Enrollment.student_id == stu.id,
                    Enrollment.course_id == course.id,
                    Enrollment.unenrolled_at.is_(None),
                )
            )
            if row is None:
                # Insert a fresh period row — earlier (possibly soft-deleted)
                # periods stay intact for historical rosters.
                db.add(Enrollment(student_id=stu.id, course_id=course.id))

        db.commit()
        print("Seeded:")
        if created:
            for s in created:
                roll = f"  (roll {s['roll_no']})" if s["label"] == "student" else ""
                print(f"  {s['label']:<10} {s['email']} / {s['password']}{roll}")
        else:
            print("  demo accounts already exist — credentials unchanged from first run")
        print(f"  course     CS-101 Computer Science 101 (all students enrolled)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
