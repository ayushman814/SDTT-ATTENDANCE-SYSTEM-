"""End-to-End simulation testing full device lifecycle and network workflows.

Simulates:
1. Role-locked authentication for Lecturer and Student.
2. Reference selfie enrollment with encrypted template storage for both.
3. Live session initialization with duration limits (10 min preset).
4. Continuous sweep capture submission with gyroscope headings and multi-frame payload.
5. 9-rule backend verification execution and audit logging.
6. Flagged attempt ingestion, review queue listing, and Lecturer decision with audit note.
7. Final session finalization and report generation (CSV & PDF).
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ["ATTENDANCE_ENV"] = "test"
os.environ["SUPABASE_JWT_SECRET"] = "test_jwt_secret_must_be_at_least_32_chars_long"
os.environ["ATTENDANCE_SECRET_KEY"] = "test_biometric_encryption_key_32_chars!"

from app import main
from app.db import reset_test_db, supa
from app.face_engine import FaceDetection, FakeFaceEngine, set_face_engine


def generate_structured_frame(w: int = 400, h: int = 300, grid_val: int = 140) -> bytes:
    """Create textured JPEG frame to meet Laplacian and luminance requirements."""
    img = np.full((h, w, 3), grid_val, dtype=np.uint8)
    for y in range(0, h, 20):
        cv2.line(img, (0, y), (w, y), (255, 255, 255), 2)
    for x in range(0, w, 20):
        cv2.line(img, (x, 0), (x, h), (0, 0, 0), 2)
    success, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes() if success else b"dummy"


@pytest.fixture
def sim_engine():
    engine = FakeFaceEngine()
    set_face_engine(engine)
    yield engine
    set_face_engine(None)


@pytest.fixture
def sim_client(sim_engine):
    reset_test_db()
    with main._ws_lock:
        main._ws_tickets.clear()
        main._ws_clients.clear()
        main._ws_client_loops.clear()
        main._ws_client_queues.clear()
    with TestClient(main.app) as tc:
        yield tc


def test_full_device_lifecycle_e2e_simulation(sim_client: TestClient, sim_engine: FakeFaceEngine):
    frame_bytes = generate_structured_frame()

    # Step 1: Lecturer Login with selected role
    lec_resp = sim_client.post(
        "/api/auth/login",
        json={"email": "teacher@demo.edu", "password": "any", "selected_role": "lecturer"},
    )
    assert lec_resp.status_code == 200
    lec_data = lec_resp.json()
    lec_token = lec_data["access_token"]
    assert lec_data["user"]["role"] == "teacher"
    lec_hdr = {"Authorization": f"Bearer {lec_token}"}

    # Step 2: Student 1 Login with selected role
    s1_resp = sim_client.post(
        "/api/auth/login",
        json={"email": "student1@demo.edu", "password": "any", "selected_role": "student"},
    )
    assert s1_resp.status_code == 200
    s1_data = s1_resp.json()
    s1_token = s1_data["access_token"]
    assert s1_data["user"]["role"] == "student"
    s1_hdr = {"Authorization": f"Bearer {s1_token}"}

    # Step 3: Reference selfie enrollments
    # Student 1 enrollment
    sim_engine.preset_detections = [
        FaceDetection(bbox_x=120, bbox_y=80, bbox_w=60, bbox_h=80, confidence=0.98, ipd_px=22.0)
    ]
    e1_resp = sim_client.post(
        "/api/auth/enroll",
        headers=s1_hdr,
        data={"consent": "true"},
        files={"photo": ("student1_selfie.jpg", frame_bytes, "image/jpeg")},
    )
    assert e1_resp.status_code == 200
    assert e1_resp.json()["status"] == "enrolled"

    # Lecturer enrollment
    sim_engine.preset_detections = [
        FaceDetection(bbox_x=150, bbox_y=50, bbox_w=100, bbox_h=120, confidence=0.95, ipd_px=38.0)
    ]
    e_lec_resp = sim_client.post(
        "/api/auth/enroll",
        headers=lec_hdr,
        data={"consent": "true"},
        files={"photo": ("lecturer_selfie.jpg", frame_bytes, "image/jpeg")},
    )
    assert e_lec_resp.status_code == 200

    # Step 4: Lecturer starts attendance session with 10-minute duration preset
    classes_resp = sim_client.get("/api/classes", headers=lec_hdr)
    assert classes_resp.status_code == 200
    class_id = classes_resp.json()[0]["id"]

    start_sess_resp = sim_client.post(
        "/api/sessions",
        headers=lec_hdr,
        json={"class_id": class_id, "duration_minutes": 10},
    )
    assert start_sess_resp.status_code == 200
    session = start_sess_resp.json()
    session_id = session["id"]
    assert session["status"] == "open"
    assert session["duration_minutes"] == 10
    assert session["ends_at"] is not None

    # Step 5: Student 1 checks active session
    active_sess = sim_client.get(f"/api/sessions/{session_id}", headers=s1_hdr).json()
    assert active_sess["id"] == session_id
    assert active_sess["status"] == "open"

    # Helper to construct multi-frame continuous sweep upload
    def build_sweep_payload(attempt_id: str, num_frames: int = 16, span: float = 180.0, duration: float = 6.0):
        meta = []
        files = []
        step_deg = span / max(1, num_frames - 1)
        step_time = duration / max(1, num_frames - 1)
        for i in range(num_frames):
            meta.append({
                "index": i,
                "heading_deg": round(i * step_deg, 1),
                "time_offset_s": round(i * step_time, 2),
            })
            files.append(("frames", (f"frame_{i:02d}.jpg", frame_bytes, "image/jpeg")))
        return {"attempt_id": attempt_id, "metadata": json.dumps(meta)}, files

    # Step 6: Student 1 executes continuous sweep capture (passes all 9 rules)
    sim_engine.preset_detections = [
        FaceDetection(bbox_x=120, bbox_y=80, bbox_w=60, bbox_h=80, confidence=0.98, ipd_px=22.0),
        FaceDetection(bbox_x=220, bbox_y=85, bbox_w=55, bbox_h=75, confidence=0.92, ipd_px=20.0),
        FaceDetection(bbox_x=150, bbox_y=50, bbox_w=100, bbox_h=120, confidence=0.95, ipd_px=38.0),
    ]
    data1, files1 = build_sweep_payload("att_stu1_001", num_frames=16, span=180.0, duration=6.5)
    chk1_resp = sim_client.post(
        f"/api/sessions/{session_id}/checkin",
        headers=s1_hdr,
        data=data1,
        files=files1,
    )
    assert chk1_resp.status_code == 200, chk1_resp.text
    chk1_result = chk1_resp.json()
    assert chk1_result["state"] == "verified"
    assert chk1_result["reason_code"] == "VERIFIED"

    # Step 7: Verify Student 1 is marked present
    sess_status = sim_client.get(f"/api/sessions/{session_id}", headers=lec_hdr).json()
    records = sess_status["attendance"]
    s1_rec = next(r for r in records if r["student_id"] == s1_data["user"]["id"])
    assert s1_rec["status"] == "present"
    assert sess_status["summary"]["present"] >= 1

    # Step 8: Student 2 logs in and submits sweep with missing neighbour (triggers FLAGGED for Lecturer Review)
    s2_resp = sim_client.post(
        "/api/auth/login",
        json={"email": "student2@demo.edu", "password": "any", "selected_role": "student"},
    )
    s2_data = s2_resp.json()
    s2_hdr = {"Authorization": f"Bearer {s2_data['access_token']}"}

    sim_engine.preset_detections = [
        FaceDetection(bbox_x=120, bbox_y=80, bbox_w=60, bbox_h=80, confidence=0.98, ipd_px=22.0)
    ]
    sim_client.post(
        "/api/auth/enroll",
        headers=s2_hdr,
        data={"consent": "true"},
        files={"photo": ("student2_selfie.jpg", frame_bytes, "image/jpeg")},
    )

    data2, files2 = build_sweep_payload("att_stu2_002", num_frames=16, span=180.0, duration=6.0)
    chk2_resp = sim_client.post(
        f"/api/sessions/{session_id}/checkin",
        headers=s2_hdr,
        data=data2,
        files=files2,
    )
    assert chk2_resp.status_code == 200
    chk2_result = chk2_resp.json()
    assert chk2_result["state"] == "flagged"

    # Step 9: Lecturer inspects review queue, views filmstrip and accepts flagged checkin
    queue_resp = sim_client.get(f"/api/sessions/{session_id}/review-queue", headers=lec_hdr)
    assert queue_resp.status_code == 200
    queue = queue_resp.json()
    assert len(queue) >= 1
    flagged_item = next(item for item in queue if item["attempt_id"] == "att_stu2_002")
    assert flagged_item["state"] == "flagged"
    assert len(flagged_item["filmstrip_urls"]) >= 1

    # Lecturer submits ACCEPT decision with required audit note
    review_resp = sim_client.post(
        f"/api/sessions/{session_id}/review/att_stu2_002",
        headers=lec_hdr,
        json={"decision": "accept", "note": "Verified student manually: seated in back corner"},
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["attendance_status"] == "present"

    # Step 10: Lecturer finalizes session and downloads audit reports
    fin_resp = sim_client.post(
        f"/api/sessions/{session_id}/finalize",
        headers=lec_hdr,
        json={"mark_pending_absent": True},
    )
    assert fin_resp.status_code == 200
    assert fin_resp.json()["status"] == "finalized"

    # Step 11: Export session report
    report_resp = sim_client.get(f"/api/sessions/{session_id}/report", headers=lec_hdr)
    assert report_resp.status_code == 200
    report = report_resp.json()
    assert "Student,Email,Status" in report["csv"]
    assert "Verified student manually: seated in back corner" in report["csv"]
    assert "<!doctype html>" in report["pdf_html"].lower()
    assert "Verified student manually" in report["pdf_html"]

    # Step 12: Verify Realtime WebSocket single-use ticket issuance
    ticket_resp = sim_client.post("/api/realtime/ticket", headers=lec_hdr)
    assert ticket_resp.status_code == 200
    assert "ticket" in ticket_resp.json()
    assert ticket_resp.json()["expires_in"] == 60
