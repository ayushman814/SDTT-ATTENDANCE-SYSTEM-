#!/usr/bin/env python3
"""Seed demo data: 1 professor, 5 students, 1 course, enrollments, face embeddings.

Synthetic demo faces live in `seed_faces/` (generated portraits). Run:
    python seed.py
"""
from __future__ import annotations

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

PROFESSOR = dict(name="Prof. A. Verma", email="prof@demo.edu", password="prof12345", face="professor.png")
STUDENTS = [
    dict(name="Ananya Rao", email="student1@demo.edu", roll_no="CS101-01", password="student123", face="student1.png"),
    dict(name="Rohan Iyer", email="student2@demo.edu", roll_no="CS101-02", password="student123", face="student2.png"),
    dict(name="Mei Chen", email="student3@demo.edu", roll_no="CS101-03", password="student123", face="student3.png"),
    dict(name="Kofi Mensah", email="student4@demo.edu", roll_no="CS101-04", password="student123", face="student4.png"),
    dict(name="Lucia Torres", email="student5@demo.edu", roll_no="CS101-05", password="student123", face="student5.png"),
]


def embed_face(engine: FaceEngine, path: Path) -> bytes:
    img = cv2.imread(str(path))
    if img is None:
        raise RuntimeError(f"cannot read {path}")
    return engine.embed_largest(img).astype("float32").tobytes()


def main() -> int:
    init_db()
    engine = FaceEngine()
    db = SessionLocal()
    try:
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
            if stu.face_embedding is None:
                stu.face_embedding = embed_face(engine, FACES / spec["face"])
            if not db.scalar(
                select(Enrollment).where(
                    Enrollment.student_id == stu.id, Enrollment.course_id == course.id
                )
            ):
                db.add(Enrollment(student_id=stu.id, course_id=course.id))

        db.commit()
        print("Seeded:")
        print(f"  professor  {PROFESSOR['email']} / {PROFESSOR['password']}")
        for s in STUDENTS:
            print(f"  student    {s['email']} / {s['password']}  (roll {s['roll_no']})")
        print(f"  course     CS-101 Computer Science 101 (all students enrolled)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
