import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi import UploadFile

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-that-is-at-least-32-characters-long")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import main


class FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.table_name = table
        self.operation = "select"
        self.payload = None
        self.filters = []
        self.limit_value = None

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def lt(self, key, value):
        self.filters.append(("lt", key, value))
        return self

    def is_(self, key, value):
        self.filters.append(("is", key, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        self.client.calls.append((self.table_name, self.operation, self.payload, self.filters))
        if self.table_name == "image_submissions" and self.operation == "select":
            return type("Response", (), {"data": self.client.expired_rows})()
        return type("Response", (), {"data": []})()


class FakeStorageBucket:
    def __init__(self, client):
        self.client = client

    def remove(self, paths):
        self.client.removed.extend(paths)
        return {"data": paths}


class FakeStorage:
    def __init__(self, client):
        self.client = client

    def from_(self, _bucket):
        return FakeStorageBucket(self.client)


class FakeSupabase:
    def __init__(self, expired_rows=None):
        self.expired_rows = expired_rows or []
        self.calls = []
        self.removed = []
        self.storage = FakeStorage(self)

    def table(self, name):
        return FakeQuery(self, name)


def test_create_session_contract_validates_window_and_stage_region():
    opening = datetime.now(timezone.utc) + timedelta(minutes=5)
    deadline = opening + timedelta(minutes=30)
    request = main.CreateSessionRequest(
        class_id="class-uuid",
        title="Lecture 8 attendance",
        opens_at=opening,
        deadline_at=deadline,
        stage_region={"x": 0.1, "y": 0.2, "width": 0.5, "height": 0.4},
        minimum_people_visible=3,
    )
    assert request.class_id == "class-uuid"
    assert request.minimum_people_visible == 3
    with pytest.raises(Exception):
        main.CreateSessionRequest(class_id="class-uuid", minimum_people_visible=31)


def test_server_clock_opens_and_closes_sessions(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(main, "supa", lambda: fake)
    now = datetime.now(timezone.utc)
    scheduled = {
        "id": "session-1",
        "status": "scheduled",
        "opens_at": (now - timedelta(minutes=1)).isoformat(),
        "deadline_at": (now + timedelta(minutes=10)).isoformat(),
    }
    opened = main._sync_session_state(scheduled)
    assert opened["status"] == "open"
    assert fake.calls[-1][2] == {"status": "open"}

    expired = {
        "id": "session-2",
        "status": "open",
        "opens_at": (now - timedelta(hours=1)).isoformat(),
        "deadline_at": (now - timedelta(seconds=1)).isoformat(),
    }
    closed = main._sync_session_state(expired)
    assert closed["status"] == "closed"
    assert closed.get("closed_at")
    assert fake.calls[-1][2]["status"] == "closed"


def test_image_retention_deletes_objects_and_marks_rows(monkeypatch):
    fake = FakeSupabase(expired_rows=[
        {"id": "submission-1", "storage_path": "s/student/one.jpg", "submitted_at": "old"},
        {"id": "submission-2", "storage_path": None, "submitted_at": "old"},
    ])
    monkeypatch.setattr(main, "supa", lambda: fake)
    assert main.cleanup_expired_images(limit=100) == 1
    assert fake.removed == ["s/student/one.jpg"]
    purge_updates = [call[2] for call in fake.calls if call[0] == "image_submissions" and call[1] == "update"]
    assert len(purge_updates) == 2
    assert all(update["image_purged_at"] for update in purge_updates)
    assert all(update["storage_path"] is None and update["image_sha256"] is None for update in purge_updates)


def test_legacy_synthetic_capture_is_gone():
    photo = UploadFile(filename="class.jpg", file=BytesIO(b"not an image"))
    with pytest.raises(HTTPException) as error:
        asyncio.run(main.capture("session-uuid", photo, {"id": "teacher", "role": "teacher"}))
    assert error.value.status_code == 410
    assert "disabled" in error.value.detail


def test_supabase_jwt_signature_and_audience_are_verified(monkeypatch):
    secret = "unit-test-signing-secret-at-least-32-characters-long"
    monkeypatch.setattr(main, "SUPABASE_JWT_SECRET", secret)
    token = main.pyjwt.encode(
        {"sub": "user-uuid", "aud": "authenticated", "exp": int(datetime.now(timezone.utc).timestamp()) + 60},
        secret,
        algorithm="HS256",
    )
    assert main._verify_supabase_jwt(token)["sub"] == "user-uuid"
    with pytest.raises(HTTPException):
        main._verify_supabase_jwt(token + "corrupt")
