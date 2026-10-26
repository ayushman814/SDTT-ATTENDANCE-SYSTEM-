"""Integration tests: role-aware auth, RBAC, time-window rule, session flow."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

os.environ.setdefault("PANORAMA_JWT_SECRET", "test-secret")

from app.main import app  # noqa: E402

FACES = ROOT / "seed_faces"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _register(client, role, email, name="T", roll_no=None, password="password123"):
    return client.post(
        "/api/auth/register",
        json={
            "role": role,
            "email": email,
            "name": name,
            "password": password,
            "roll_no": roll_no,
            "consent": True,
        },
    )


def test_register_and_role_isolation(client):
    r = _register(client, "student", "s1@x.edu", roll_no="R1")
    assert r.status_code == 201, r.text
    token_student = r.json()["access_token"]

    r = _register(client, "professor", "p1@x.edu")
    assert r.status_code == 201, r.text
    token_prof = r.json()["access_token"]

    # student cannot log in through the professor flow and vice versa
    r = client.post("/api/auth/login", json={"role": "professor", "email": "s1@x.edu", "password": "password123"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"role": "student", "email": "p1@x.edu", "password": "password123"})
    assert r.status_code == 401

    # correct-role logins succeed
    r = client.post("/api/auth/login", json={"role": "student", "email": "s1@x.edu", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["user"]["face_enrolled"] is False

    # student cannot hit professor routes
    r = client.post(
        "/api/sessions",
        json={"course_name": "X", "window_minutes": 10},
        headers={"Authorization": f"Bearer {token_student}"},
    )
    assert r.status_code == 403

    # professor cannot hit student routes
    r = client.get("/api/student/sessions/active", headers={"Authorization": f"Bearer {token_prof}"})
    assert r.status_code == 403

    # no token → 401
    assert client.get("/api/me").status_code == 401


def test_registration_requires_consent(client):
    r = client.post(
        "/api/auth/register",
        json={
            "role": "student", "email": "noconsent@x.edu", "name": "N",
            "password": "password123", "roll_no": "R9", "consent": False,
        },
    )
    assert r.status_code == 422


def test_duplicate_email_rejected(client):
    _register(client, "student", "dup@x.edu", roll_no="R1")
    r = _register(client, "professor", "dup@x.edu")
    assert r.status_code == 409


def _enroll(client, token, face="student1.png"):
    with open(FACES / face, "rb") as fh:
        return client.post(
            "/api/me/face",
            files={"file": (face, fh, "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )


def test_session_window_and_submit(client, engine, make_panorama):
    prof = _register(client, "professor", "prof2@x.edu").json()
    stu = _register(client, "student", "stu2@x.edu", roll_no="R2").json()
    tp = prof["access_token"]
    ts = stu["access_token"]

    assert _enroll(client, tp, "professor.png").status_code == 200
    assert _enroll(client, ts, "student1.png").status_code == 200

    # professor creates course+session in one call (10-minute window)
    r = client.post(
        "/api/sessions",
        json={"course_name": "Biology 101", "window_minutes": 10},
        headers={"Authorization": f"Bearer {tp}"},
    )
    assert r.status_code == 201, r.text
    sess = r.json()
    assert sess["status"] == "active"

    # enroll the student in that course
    from app.db import SessionLocal
    from app.models import Enrollment, User

    db = SessionLocal()
    sid = db.query(User).filter_by(email="stu2@x.edu").one().id
    db.add(Enrollment(student_id=sid, course_id=sess["course_id"]))
    db.commit()
    db.close()

    # student sees the active session
    r = client.get("/api/student/sessions/active", headers={"Authorization": f"Bearer {ts}"})
    assert r.status_code == 200
    assert any(s["public_id"] == sess["public_id"] for s in r.json()["sessions"])

    # submit a real verified panorama inside the window
    pano = make_panorama(
        [("student1.png", 300, 280), ("student2.png", 1050, 280), ("professor.png", 1900, 300)]
    )
    import cv2
    ok, buf = cv2.imencode(".jpg", pano)
    assert ok
    r = client.post(
        f"/api/sessions/{sess['public_id']}/submit",
        files={"file": ("pano.jpg", buf.tobytes(), "image/jpeg")},
        headers={"Authorization": f"Bearer {ts}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "present", body

    # second submit → already present
    r = client.post(
        f"/api/sessions/{sess['public_id']}/submit",
        files={"file": ("pano.jpg", buf.tobytes(), "image/jpeg")},
        headers={"Authorization": f"Bearer {ts}"},
    )
    assert r.status_code == 409

    # professor summary shows the present student
    r = client.get(f"/api/sessions/{sess['public_id']}/summary", headers={"Authorization": f"Bearer {tp}"})
    assert r.status_code == 200
    summ = r.json()
    assert summ["present_count"] == 1
    assert summ["absent_count"] == 0

    # close the session → uploads now fail even inside an "unexpired" client claim
    r = client.post(f"/api/sessions/{sess['public_id']}/close", headers={"Authorization": f"Bearer {tp}"})
    assert r.status_code == 200
    stu3 = _register(client, "student", "stu3@x.edu", roll_no="R3").json()
    ts3 = stu3["access_token"]
    _enroll(client, ts3, "student3.png")
    db = SessionLocal()
    sid3 = db.query(User).filter_by(email="stu3@x.edu").one().id
    db.add(Enrollment(student_id=sid3, course_id=sess["course_id"]))
    db.commit()
    db.close()
    r = client.post(
        f"/api/sessions/{sess['public_id']}/submit",
        files={"file": ("pano.jpg", buf.tobytes(), "image/jpeg")},
        headers={"Authorization": f"Bearer {ts3}"},
    )
    assert r.status_code == 403
    assert "window_closed" in r.json()["detail"]

    # CSV export works for the professor
    r = client.get(f"/api/sessions/{sess['public_id']}/export.csv", headers={"Authorization": f"Bearer {tp}"})
    assert r.status_code == 200
    assert "Stu" not in r.text or "student_name" in r.text
    assert "present" in r.text

    # a different professor cannot read this session
    prof2 = _register(client, "professor", "prof3@x.edu").json()
    r = client.get(
        f"/api/sessions/{sess['public_id']}/summary",
        headers={"Authorization": f"Bearer {prof2['access_token']}"},
    )
    assert r.status_code == 404


def test_override(client, engine, make_panorama):
    prof = _register(client, "professor", "prof4@x.edu").json()
    stu = _register(client, "student", "stu4@x.edu", roll_no="R4").json()
    tp, ts = prof["access_token"], stu["access_token"]
    _enroll(client, tp, "professor.png")
    _enroll(client, ts, "student1.png")
    r = client.post(
        "/api/sessions",
        json={"course_name": "Chem", "window_minutes": 10},
        headers={"Authorization": f"Bearer {tp}"},
    )
    sess = r.json()
    from app.db import SessionLocal
    from app.models import Enrollment, User

    db = SessionLocal()
    sid = db.query(User).filter_by(email="stu4@x.edu").one().id
    db.add(Enrollment(student_id=sid, course_id=sess["course_id"]))
    db.commit()
    db.close()

    # panorama missing the lecturer → rejected with reason
    pano = make_panorama([("student1.png", 300, 280), ("student2.png", 1050, 280)])
    import cv2
    ok, buf = cv2.imencode(".jpg", pano)
    assert ok
    r = client.post(
        f"/api/sessions/{sess['public_id']}/submit",
        files={"file": ("p.jpg", buf.tobytes(), "image/jpeg")},
        headers={"Authorization": f"Bearer {ts}"},
    )
    assert r.json()["status"] == "rejected"
    assert r.json()["reason_code"] == "lecturer_not_found"
    assert r.json()["reason"] == "The lecturer was not found in the panorama."
    sub_id = r.json()["id"]

    # professor overrides to present
    r = client.patch(
        f"/api/submissions/{sub_id}/override",
        json={"status": "present"},
        headers={"Authorization": f"Bearer {tp}"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "present"
