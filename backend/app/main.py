"""Classroom attendance prototype API – Supabase edition.

Auth:  Supabase Auth (JWT verification via PyJWT + SUPABASE_JWT_SECRET).
DB:    Supabase PostgreSQL (via supabase-py service-role client).

This service validates classroom scene evidence without identifying people.
Uncertain images are held in private storage for review and are deleted after
the configured retention period; no face embeddings are created.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import csv
import io
import json
import os
import secrets
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from html import escape
from typing import Any, Optional
from typing import Literal

import jwt as pyjwt
from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_JWT_SECRET: str = os.environ["SUPABASE_JWT_SECRET"]

WS_TICKET_TTL_SECONDS = int(os.getenv("ATTENDANCE_WS_TICKET_TTL_SECONDS", "60"))
MAX_CAPTURE_BYTES = int(os.getenv("ATTENDANCE_MAX_CAPTURE_BYTES", "10485760"))
ATTENDANCE_STORAGE_BUCKET = os.getenv("ATTENDANCE_STORAGE_BUCKET", "attendance-submissions")
ATTENDANCE_MIN_VISIBLE_PEOPLE = int(os.getenv("ATTENDANCE_MIN_VISIBLE_PEOPLE", "2"))
ATTENDANCE_IMAGE_RETENTION_DAYS = int(os.getenv("ATTENDANCE_IMAGE_RETENTION_DAYS", "30"))
if not 1 <= ATTENDANCE_IMAGE_RETENTION_DAYS <= 3650:
    raise RuntimeError("ATTENDANCE_IMAGE_RETENTION_DAYS must be between 1 and 3650")
CORS_ORIGINS = [
    v.strip()
    for v in os.getenv(
        "ATTENDANCE_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:8081",
    ).split(",")
    if v.strip()
]

# ── Supabase clients ──────────────────────────────────────────────────────────
_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
_auth_client: Client = create_client(SUPABASE_URL, os.getenv("SUPABASE_ANON_KEY", SUPABASE_SERVICE_ROLE_KEY))


def supa() -> Client:
    """Return the shared Supabase service-role client."""
    _supabase.postgrest.auth(SUPABASE_SERVICE_ROLE_KEY)
    return _supabase


def auth_client() -> Client:
    """Return the client dedicated to user authentication."""
    return _auth_client


# ── WebSocket state ───────────────────────────────────────────────────────────
_ws_lock = threading.Lock()
_ws_tickets: dict[str, tuple[str, float]] = {}
_ws_clients: dict[str, set[WebSocket]] = {}
_ws_client_loops: dict[WebSocket, asyncio.AbstractEventLoop] = {}
_ws_client_queues: dict[WebSocket, asyncio.Queue[str]] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _verify_supabase_jwt(token: str) -> dict[str, Any]:
    """Cryptographically verify a Supabase-issued access token."""
    try:
        payload = pyjwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")


def current_user(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer access token required")
    token = authorization.split(" ", 1)[1].strip()
    uid: str = ""
    try:
        user_resp = supa().auth.get_user(token)
        if user_resp and user_resp.user:
            uid = user_resp.user.id
    except Exception:
        # Supabase may be temporarily unreachable; the local fallback still
        # verifies the signature, audience, and expiry rather than trusting
        # attacker-controlled JWT claims.
        payload = _verify_supabase_jwt(token)
        uid = payload.get("sub", "")

    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject")

    resp = supa().table("profiles").select("*").eq("id", uid).single().execute()
    if not resp.data:
        raise HTTPException(status_code=401, detail="User profile not found")
    return resp.data


def require_teacher(user: dict[str, Any]) -> None:
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher role required")


def require_controller(user: dict[str, Any]) -> None:
    if user.get("role") != "controller":
        raise HTTPException(status_code=403, detail="Controller role required")


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    password: str


class CreateSessionRequest(BaseModel):
    class_id: str  # UUID
    title: str = Field(default="Attendance session", min_length=1, max_length=120)
    opens_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    stage_region: Optional[dict[str, float]] = None
    minimum_people_visible: int = Field(default=2, ge=1, le=30)


class AttendanceUpdate(BaseModel):
    status: str = Field(pattern="^(present|absent|pending)$")
    note: Optional[str] = Field(default=None, max_length=500)


class FinalizeRequest(BaseModel):
    mark_pending_absent: bool


class SubmissionReviewRequest(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str = Field(min_length=1, max_length=500)


class ControllerClassRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    code: str = Field(min_length=1, max_length=40)
    teacher_id: str
    section: str = Field(default="", max_length=80)
    room_number: str = Field(default="", max_length=80)


def cleanup_expired_images(limit: int = 500) -> int:
    """Delete expired private image objects and clear their storage references."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ATTENDANCE_IMAGE_RETENTION_DAYS)).isoformat()
    expired = (
        supa().table("image_submissions")
        .select("id, storage_path, submitted_at")
        .lt("submitted_at", cutoff)
        .is_("image_purged_at", "null")
        .limit(limit)
        .execute()
    )
    removed = 0
    for item in expired.data or []:
        path = item.get("storage_path")
        # Keep the path and marker unchanged if storage deletion fails so a
        # later hourly pass retries the same object.
        if path:
            supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).remove([path])
        supa().table("image_submissions").update(
            {"storage_path": None, "image_sha256": None, "image_purged_at": utc_now()}
        ).eq("id", item["id"]).execute()
        removed += bool(path)
    return removed


async def _image_retention_clock() -> None:
    while True:
        try:
            await asyncio.to_thread(cleanup_expired_images)
        except Exception:
            # Retry on the next hourly pass; never delete attendance metadata.
            pass
        await asyncio.sleep(3600)


async def _session_clock() -> None:
    while True:
        try:
            due = (
                supa().table("sessions").select("id, status, opens_at, deadline_at, closed_at")
                .in_("status", ["scheduled", "open"]).execute()
            )
            for row in due.data or []:
                _sync_session_state(row)
        except Exception:
            # Session submissions independently enforce their own deadline.
            pass
        await asyncio.sleep(15)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_: FastAPI):
    # Verify Supabase connectivity on startup
    try:
        supa().table("profiles").select("id").limit(1).execute()
    except Exception as exc:
        raise RuntimeError(f"Cannot connect to Supabase: {exc}") from exc
    clock = asyncio.create_task(_session_clock())
    retention = asyncio.create_task(_image_retention_clock())
    try:
        yield
    finally:
        clock.cancel()
        retention.cancel()
        await asyncio.gather(clock, retention, return_exceptions=True)


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Classroom Attendance Prototype API",
    version="0.2.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Utility: session/class access guards ─────────────────────────────────────
def _get_class_or_404(class_id: str) -> dict[str, Any]:
    resp = supa().table("classes").select("*").eq("id", class_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Class not found")
    return resp.data


def _assert_class_access(cls: dict[str, Any], user: dict[str, Any]) -> None:
    if cls["teacher_id"] == user["id"]:
        return
    enr = (
        supa()
        .table("enrollments")
        .select("class_id")
        .eq("class_id", cls["id"])
        .eq("student_id", user["id"])
        .execute()
    )
    if not enr.data:
        raise HTTPException(status_code=403, detail="You do not have access to this class")


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _sync_session_state(row: dict[str, Any]) -> dict[str, Any]:
    """Derive the session state from server time; the client's clock is ignored."""
    if row.get("status") in {"closed", "finalized"}:
        return row
    now = datetime.now(timezone.utc)
    opens_at = _parse_datetime(row.get("opens_at"))
    deadline_at = _parse_datetime(row.get("deadline_at"))
    if deadline_at and now >= deadline_at:
        next_status = "closed"
    elif opens_at and now < opens_at:
        next_status = "scheduled"
    else:
        next_status = "open"
    if row.get("status") != next_status:
        changes = {"status": next_status}
        if next_status == "closed":
            changes["closed_at"] = utc_now()
        supa().table("sessions").update(changes).eq("id", row["id"]).execute()
        if next_status == "closed":
            row["closed_at"] = changes["closed_at"]
        row["status"] = next_status
    return row


def _get_session_or_404(session_id: str) -> dict[str, Any]:
    resp = (
        supa()
        .table("sessions")
        .select("*, classes(name, code, teacher_id)")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Session not found")
    row = resp.data
    # Flatten nested classes join
    if isinstance(row.get("classes"), dict):
        row["class_name"] = row["classes"]["name"]
        row["class_code"] = row["classes"]["code"]
        row["teacher_id"] = row["classes"]["teacher_id"]
    return _sync_session_state(row)


def _assert_session_access(
    row: dict[str, Any], user: dict[str, Any], teacher_only: bool = False
) -> None:
    if teacher_only or user["role"] == "teacher":
        if row.get("teacher_id") != user["id"]:
            raise HTTPException(status_code=403, detail="You do not have access to this session")
    else:
        enr = (
            supa()
            .table("enrollments")
            .select("class_id")
            .eq("class_id", row["class_id"])
            .eq("student_id", user["id"])
            .execute()
        )
        if not enr.data:
            raise HTTPException(status_code=403, detail="You do not have access to this session")


def _session_payload(row: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    teacher_id = row.get("teacher_id")
    professor_name = row.get("professor_name")
    if teacher_id and not professor_name:
        professor = supa().table("profiles").select("name").eq("id", teacher_id).limit(1).execute()
        if professor.data:
            professor_name = professor.data[0].get("name")
    result: dict[str, Any] = {
        "id": row["id"],
        "class_id": row["class_id"],
        "title": row.get("title", "Attendance session"),
        "class_name": row.get("class_name", ""),
        "class_code": row.get("class_code", ""),
        "professor_name": professor_name,
        "status": row["status"],
        "created_at": row["created_at"],
        "opens_at": row.get("opens_at"),
        "deadline_at": row.get("deadline_at"),
        "closed_at": row.get("closed_at"),
        "stage_region": row.get("stage_region"),
        "minimum_people_visible": row.get("minimum_people_visible", ATTENDANCE_MIN_VISIBLE_PEOPLE),
        "finalized_at": row.get("finalized_at"),
    }
    if user["role"] == "teacher":
        att = (
            supa()
            .table("attendance")
            .select("*, profiles!attendance_student_id_fkey(name, email, registration_id)")
            .eq("session_id", row["id"])
            .order("profiles!attendance_student_id_fkey(name)")
            .execute()
        )
        entries = []
        for e in att.data or []:
            flat = {**e}
            prof = e.get("profiles!attendance_student_id_fkey") or e.get("profiles")
            if isinstance(prof, dict):
                flat["name"] = prof["name"]
                flat["email"] = prof["email"]
                flat["registration_id"] = prof.get("registration_id")
                flat.pop("profiles", None)
            entries.append(flat)
        result["attendance"] = entries

        sugg = (
            supa()
            .table("suggestions")
            .select("*, profiles!suggestions_student_id_fkey(name)")
            .eq("session_id", row["id"])
            .order("id")
            .execute()
        )
        slist = []
        for s in sugg.data or []:
            flat = {**s}
            prof = s.get("profiles!suggestions_student_id_fkey") or s.get("profiles")
            if isinstance(prof, dict):
                flat["name"] = prof["name"]
                flat.pop("profiles!suggestions_student_id_fkey", None)
                flat.pop("profiles", None)
            slist.append(flat)
        result["suggestions"] = slist
    else:
        own = (
            supa()
            .table("attendance")
            .select("status, note, updated_at, verification_status, verification_source")
            .eq("session_id", row["id"])
            .eq("student_id", user["id"])
            .execute()
        )
        result["attendance"] = own.data or []
        submission_resp = (
            supa()
            .table("image_submissions")
            .select("id, status, submitted_at, explanation, review_decision, review_reason")
            .eq("session_id", row["id"])
            .eq("student_id", user["id"])
            .execute()
        )
        result["submission"] = (submission_resp.data or [None])[0]
    return result


def _audit(
    session_id: str | None,
    actor_id: str,
    action: str,
    note: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    supa().table("audit_log").insert(
        {
            "session_id": session_id,
            "action": action,
            "actor_id": actor_id,
            "timestamp": utc_now(),
            "note": note,
            "metadata_json": json.dumps(metadata or {}, separators=(",", ":")),
        }
    ).execute()


def event_payload(event_type: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"type": event_type, "data": data, "created_at": utc_now()}


def publish_event(loopless_event: dict[str, Any], user_ids: list[str]) -> None:
    event_payload_json = json.dumps(loopless_event)
    targets: list[tuple[asyncio.AbstractEventLoop, asyncio.Queue[str]]] = []
    with _ws_lock:
        for uid in user_ids:
            for ws in _ws_clients.get(uid, ()):
                loop = _ws_client_loops.get(ws)
                queue = _ws_client_queues.get(ws)
                if loop and loop.is_running() and queue is not None:
                    targets.append((loop, queue))
    for loop, queue in targets:
        try:
            loop.call_soon_threadsafe(queue.put_nowait, event_payload_json)
        except Exception:
            pass


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "attendrix-api"}


@app.get("/api/ready")
def readiness() -> dict[str, str]:
    """Readiness probe that checks the configured database connection."""
    try:
        supa().table("profiles").select("id").limit(1).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not ready") from exc
    return {"status": "ready", "service": "attendrix-api"}


@app.post("/api/auth/login")
def login(req: LoginRequest) -> dict[str, Any]:
    identifier = (req.identifier or req.email or "").strip()
    if not identifier:
        raise HTTPException(status_code=401, detail="Invalid ID/email or password")
    email = identifier.lower()
    try:
        if "@" not in email:
            profile = (
                supa().table("profiles").select("email")
                .eq("registration_id", identifier).limit(1).execute()
            )
            if not profile.data:
                raise ValueError("Unknown registration ID")
            email = str(profile.data[0]["email"]).strip().lower()
        auth_resp = auth_client().auth.sign_in_with_password({
            "email": email,
            "password": req.password,
        })
        user_id = auth_resp.user.id
        access_token = auth_resp.session.access_token

        prof = supa().table("profiles").select("*").eq("id", user_id).single().execute()
        if not prof.data:
            raise ValueError("Authenticated user has no provisioned application profile")
        user_data = prof.data
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_data,
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid ID/email or password")


@app.get("/api/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"], "registration_id": user.get("registration_id"), "face_enrolled": bool(user.get("face_embedding_encrypted"))}


@app.get("/api/registration")
def registration_status(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    response = supa().table("registration_windows").select("is_open, opened_at, closed_at").eq("id", True).limit(1).execute()
    state = (response.data or [{}])[0]
    return {"is_open": bool(state.get("is_open", False)), "eligible": user.get("role") == "student", "face_enrolled": bool(user.get("face_embedding_encrypted"))}


@app.post("/api/registration/{action}")
def update_registration(action: Literal["open", "close"], user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_controller(user)
    if action == "open":
        values = {"is_open": True, "opened_by": user["id"], "opened_at": utc_now(), "closed_at": None}
    else:
        values = {"is_open": False, "closed_at": utc_now()}
    saved = supa().table("registration_windows").upsert({"id": True, **values}).execute()
    _audit(None, user["id"], f"registration.{action}", note=f"Face registration window {action}ed.")
    return (saved.data or [{"is_open": action == "open"}])[0]


@app.post("/api/students/me/face-enrollment")
async def enroll_face_reference(photo: UploadFile = File(...), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student role required")
    registration = supa().table("registration_windows").select("is_open").eq("id", True).limit(1).execute()
    if not (registration.data or [{}])[0].get("is_open"):
        raise HTTPException(status_code=409, detail="Face registration is closed. Ask the controller to open the registration period.")
    if user.get("face_embedding_encrypted"):
        raise HTTPException(status_code=409, detail="Face enrollment already exists for this student.")
    if photo.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP face image")
    data = bytearray()
    while True:
        chunk = await photo.read(1024 * 1024)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > MAX_CAPTURE_BYTES:
            raise HTTPException(status_code=413, detail="Face image exceeds the configured size limit")
    if not data:
        raise HTTPException(status_code=400, detail="The face image is empty")
    from .verification import VerificationInputError, VerificationUnavailable, enroll_face
    try:
        encrypted = await asyncio.to_thread(enroll_face, bytes(data))
    except VerificationInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except VerificationUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    saved = supa().table("profiles").update({"face_embedding_encrypted": encrypted, "face_enrolled_at": utc_now()}).eq("id", user["id"]).is_("face_embedding_encrypted", "null").select("id, face_enrolled_at").execute()
    if not saved.data:
        raise HTTPException(status_code=409, detail="Enrollment was recorded concurrently or the student is no longer eligible.")
    _audit(None, user["id"], "face.enrolled", note="Encrypted face representation created; source image was not stored.")
    return {"status": "enrolled", "enrolled_at": saved.data[0].get("face_enrolled_at")}


@app.get("/api/controller/classes")
def controller_classes(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_controller(user)
    response = supa().table("classes").select("*").order("name").execute()
    result = []
    for item in response.data or []:
        count = supa().table("enrollments").select("student_id", count="exact").eq("class_id", item["id"]).execute()
        result.append({**item, "student_count": getattr(count, "count", None) or len(count.data or [])})
    return result


@app.get("/api/controller/students")
def controller_students(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_controller(user)
    response = supa().table("profiles").select("id, name, email, registration_id, face_enrolled_at").eq("role", "student").order("name").execute()
    return [{**item, "face_enrolled": bool(item.get("face_enrolled_at")), "registration_locked": bool(item.get("face_enrolled_at"))} for item in (response.data or [])]


@app.post("/api/controller/classes")
def controller_create_class(body: ControllerClassRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_controller(user)
    teacher = supa().table("profiles").select("id, role").eq("id", body.teacher_id).single().execute()
    if not teacher.data or teacher.data.get("role") != "teacher":
        raise HTTPException(status_code=422, detail="teacher_id must refer to an active teacher profile")
    saved = supa().table("classes").insert({"name": body.name.strip(), "code": body.code.strip(), "teacher_id": body.teacher_id, "section": body.section.strip(), "room_number": body.room_number.strip(), "created_at": utc_now()}).execute()
    if not saved.data:
        raise HTTPException(status_code=409, detail="Class code already exists or the class could not be created")
    _audit(None, user["id"], "controller.class_created", metadata={"class_id": saved.data[0]["id"]})
    return saved.data[0]


@app.post("/api/controller/students/import")
async def controller_import_students(file: UploadFile = File(...), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Validate an official CSV/XLSX roster and update only existing accounts."""
    require_controller(user)
    content = await file.read()
    if len(content) > MAX_CAPTURE_BYTES:
        raise HTTPException(status_code=413, detail="Roster file is too large")
    rows: list[dict[str, Any]] = []
    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".csv"):
            rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
        elif filename.endswith(".xlsx"):
            from openpyxl import load_workbook
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            sheet = workbook.active
            values = list(sheet.values)
            headers = [str(value or "").strip().lower() for value in (values[0] if values else [])]
            rows = [dict(zip(headers, values_row)) for values_row in values[1:]]
        else:
            raise ValueError("Upload a CSV or XLSX roster file")
    except (UnicodeDecodeError, ValueError, IndexError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    required = {"name", "email", "registration_id"}
    headers = {str(key).strip().lower() for row in rows for key in row.keys()}
    missing = sorted(required - headers)
    if missing:
        raise HTTPException(status_code=422, detail={"message": "Roster headers are missing", "missing": missing})
    seen_ids: set[str] = set()
    accepted: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for index, raw in enumerate(rows, start=2):
        item = {str(key).strip().lower(): value for key, value in raw.items()}
        name, email, registration_id = str(item.get("name") or "").strip(), str(item.get("email") or "").strip().lower(), str(item.get("registration_id") or "").strip()
        if not name or "@" not in email or not registration_id:
            errors.append({"row": index, "reason": "name, email, and registration_id are required"}); continue
        if registration_id in seen_ids:
            errors.append({"row": index, "reason": "duplicate registration_id in import", "registration_id": registration_id}); continue
        seen_ids.add(registration_id)
        profile = supa().table("profiles").select("id, role").eq("email", email).limit(1).execute()
        if not profile.data or profile.data[0].get("role") != "student":
            errors.append({"row": index, "reason": "student account is not provisioned", "email": email}); continue
        accepted.append({"profile_id": profile.data[0]["id"], "name": name, "email": email, "registration_id": registration_id})
    for item in accepted:
        supa().table("profiles").update({"name": item["name"], "registration_id": item["registration_id"]}).eq("id", item["profile_id"]).execute()
    _audit(None, user["id"], "controller.roster_imported", metadata={"accepted": len(accepted), "rejected": len(errors)})
    return {"accepted": len(accepted), "rejected": len(errors), "errors": errors}


@app.post("/api/controller/students/{student_id}/reset-face")
def controller_reset_face(student_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, str]:
    require_controller(user)
    target = supa().table("profiles").select("id, role").eq("id", student_id).single().execute()
    if not target.data or target.data.get("role") != "student":
        raise HTTPException(status_code=404, detail="Student profile not found")
    supa().table("profiles").update({"face_embedding_encrypted": None, "face_enrolled_at": None}).eq("id", student_id).execute()
    _audit(None, user["id"], "controller.face_reset", note="Student face enrollment reset by controller.", metadata={"student_id": student_id})
    return {"status": "reset"}


@app.post("/api/auth/ws-ticket")
def ws_ticket(user: dict[str, Any] = Depends(current_user)) -> dict[str, str]:
    ticket = secrets.token_urlsafe(32)
    now = time.time()
    with _ws_lock:
        expired = [k for k, v in _ws_tickets.items() if v[1] < now]
        for k in expired:
            _ws_tickets.pop(k, None)
        _ws_tickets[ticket] = (user["id"], now + WS_TICKET_TTL_SECONDS)
    return {"ticket": ticket}


@app.get("/api/classes")
def classes(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    if user["role"] == "teacher":
        resp = supa().table("classes").select("*").eq("teacher_id", user["id"]).order("name").execute()
    else:
        enr = supa().table("enrollments").select("class_id").eq("student_id", user["id"]).execute()
        class_ids = [e["class_id"] for e in (enr.data or [])]
        if not class_ids:
            return []
        resp = supa().table("classes").select("*").in_("id", class_ids).order("name").execute()
    return resp.data or []


@app.get("/api/classes/{class_id}/students")
def class_students(class_id: str, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_teacher(user)
    cls = _get_class_or_404(class_id)
    _assert_class_access(cls, user)
    resp = (
        supa()
        .table("enrollments")
        .select("profiles(id, name, email, role)")
        .eq("class_id", class_id)
        .execute()
    )
    return [e["profiles"] for e in (resp.data or []) if e.get("profiles")]


@app.get("/api/sessions")
def sessions(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    if user["role"] == "teacher":
        resp = (
            supa()
            .table("sessions")
            .select("*, classes(name, code, teacher_id)")
            .eq("classes.teacher_id", user["id"])
            .order("created_at", desc=True)
            .execute()
        )
    else:
        enr = supa().table("enrollments").select("class_id").eq("student_id", user["id"]).execute()
        class_ids = [e["class_id"] for e in (enr.data or [])]
        if not class_ids:
            return []
        resp = (
            supa()
            .table("sessions")
            .select("*, classes(name, code)")
            .in_("class_id", class_ids)
            .order("created_at", desc=True)
            .execute()
        )
    rows = []
    for r in resp.data or []:
        r = _sync_session_state(r)
        flat = {**r}
        if isinstance(r.get("classes"), dict):
            flat["class_name"] = r["classes"]["name"]
            flat["class_code"] = r["classes"]["code"]
            flat.pop("classes", None)
        rows.append(flat)
    return rows


@app.post("/api/sessions")
def create_session(
    body: CreateSessionRequest, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    require_teacher(user)
    cls = _get_class_or_404(body.class_id)
    _assert_class_access(cls, user)
    now_dt = datetime.now(timezone.utc)
    if body.opens_at is not None and body.opens_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="opens_at must include a timezone offset")
    if body.deadline_at is not None and body.deadline_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="deadline_at must include a timezone offset")
    opens_at = body.opens_at.astimezone(timezone.utc) if body.opens_at else now_dt
    deadline_at = body.deadline_at.astimezone(timezone.utc) if body.deadline_at else now_dt + timedelta(minutes=10)
    if opens_at >= deadline_at:
        raise HTTPException(status_code=422, detail="The deadline must be later than the opening time")
    if deadline_at <= now_dt:
        raise HTTPException(status_code=422, detail="The deadline must be in the future")
    stage_region = body.stage_region
    if stage_region is not None:
        try:
            x, y = float(stage_region["x"]), float(stage_region["y"])
            width, height = float(stage_region["width"]), float(stage_region["height"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(status_code=422, detail="stage_region must contain normalized x, y, width, and height values")
        if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > 1 or y + height > 1:
            raise HTTPException(status_code=422, detail="stage_region coordinates must form a non-empty rectangle within 0–1")
        stage_region = {"x": x, "y": y, "width": width, "height": height}
    now = now_dt.isoformat(timespec="seconds")
    session_status = "scheduled" if now_dt < opens_at else "open"
    sess_resp = (
        supa()
        .table("sessions")
        .insert(
            {
                "class_id": body.class_id,
                "title": body.title.strip(),
                "status": session_status,
                "opens_at": opens_at.isoformat(timespec="seconds"),
                "deadline_at": deadline_at.isoformat(timespec="seconds"),
                "stage_region": stage_region,
                "minimum_people_visible": body.minimum_people_visible,
                "created_by": user["id"],
                "created_at": now,
            }
        )
        .execute()
    )
    session_id: str = sess_resp.data[0]["id"]

    # Seed attendance rows for all enrolled students
    students = (
        supa().table("enrollments").select("student_id").eq("class_id", body.class_id).execute()
    )
    att_rows = [
        {
            "session_id": session_id,
            "student_id": s["student_id"],
            "status": "pending",
            "updated_by": user["id"],
            "updated_at": now,
        }
        for s in (students.data or [])
    ]
    if att_rows:
        supa().table("attendance").insert(att_rows).execute()

    _audit(session_id, user["id"], "session.created", metadata={"class_id": body.class_id, "opens_at": opens_at.isoformat(), "deadline_at": deadline_at.isoformat()})
    row = _get_session_or_404(session_id)
    payload = _session_payload(row, user)

    student_ids = [s["student_id"] for s in (students.data or [])]
    publish_event(
        event_payload("session.created", {"session_id": session_id, "class_id": body.class_id}),
        [user["id"], *student_ids],
    )
    return payload


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user)
    return _session_payload(row, user)


@app.post("/api/sessions/{session_id}/capture")
async def capture(
    session_id: str,
    photo: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    raise HTTPException(
        status_code=410,
        detail="The legacy synthetic capture endpoint is disabled. Students submit their own classroom photo through /api/sessions/{session_id}/submissions.",
    )


@app.post("/api/sessions/{session_id}/submissions")
async def submit_classroom_image(
    session_id: str,
    photo: UploadFile = File(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student role required")
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user)
    if row["status"] == "scheduled":
        raise HTTPException(status_code=409, detail=f"Attendance opens at {row.get('opens_at')}")
    if row["status"] != "open":
        raise HTTPException(status_code=409, detail="The attendance deadline has passed or the session is closed")
    if photo.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP classroom image")

    data = bytearray()
    while True:
        chunk = await photo.read(1024 * 1024)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > MAX_CAPTURE_BYTES:
            raise HTTPException(status_code=413, detail=f"Image exceeds {MAX_CAPTURE_BYTES} bytes")
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty")

    from .vision import analyze_classroom_image, strip_image_metadata

    analysis = await asyncio.to_thread(
        analyze_classroom_image,
        bytes(data),
        stage_region=row.get("stage_region"),
        minimum_people=int(row.get("minimum_people_visible") or ATTENDANCE_MIN_VISIBLE_PEOPLE),
    )
    previous_resp = (
        supa().table("image_submissions").select("id, status, storage_path, attempt_number")
        .eq("session_id", session_id).eq("student_id", user["id"]).execute()
    )
    previous = (previous_resp.data or [None])[0]
    if previous and previous.get("status") != "REJECTED":
        raise HTTPException(status_code=409, detail="A submission already exists for this attendance session")

    image_format = analysis.get("quality", {}).get("format")
    extension = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(image_format)
    stored_data = strip_image_metadata(bytes(data)) if extension else None
    if stored_data is not None and len(stored_data) > MAX_CAPTURE_BYTES:
        raise HTTPException(status_code=413, detail="Metadata-free image exceeds the configured storage limit")
    image_path = None
    if extension:
        image_path = f"{session_id}/{user['id']}/{uuid.uuid4().hex}.{extension}"
        try:
            supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).upload(
                image_path,
                stored_data,
                {"content-type": {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[image_format], "upsert": "false"},
            )
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Secure image storage is unavailable; attendance was not marked present") from exc

    now = utc_now()
    attempt_number = int(previous.get("attempt_number", 0)) + 1 if previous else 1
    submission_data = {
        "session_id": session_id,
        "student_id": user["id"],
        "attempt_number": attempt_number,
        "submitted_at": now,
        "status": analysis["status"],
        "explanation": analysis["explanation"],
        "quality_result": analysis["quality"],
        "detected_people": analysis.get("detected_people"),
        "nearby_people": analysis.get("nearby_people"),
        "stage_person_detected": analysis.get("stage_person_detected"),
        "analysis_json": analysis,
        "storage_path": image_path,
        "image_sha256": hashlib.sha256(stored_data if stored_data is not None else bytes(data)).hexdigest(),
        "review_decision": None,
        "review_reason": None,
        "reviewed_by": None,
        "reviewed_at": None,
    }
    try:
        if previous:
            saved = (
                supa().table("image_submissions").update(submission_data)
                .eq("id", previous["id"]).eq("status", "REJECTED").select("*").execute()
            )
            if not saved.data:
                raise HTTPException(status_code=409, detail="A submission was received concurrently; refresh and review its status")
            submission = saved.data[0]
            old_path = previous.get("storage_path")
            if old_path:
                try:
                    supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).remove([old_path])
                except Exception:
                    pass
        else:
            saved = supa().table("image_submissions").insert(submission_data).execute()
            submission = saved.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        if image_path:
            try:
                supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).remove([image_path])
            except Exception:
                pass
        raise HTTPException(status_code=409, detail="A submission already exists or could not be recorded") from exc

    attendance_values = {
        "verification_status": analysis["status"],
        "verification_source": "automatic" if analysis["status"] == "VERIFIED" else None,
        "updated_by": user["id"],
        "updated_at": now,
        "note": analysis["explanation"],
    }
    if analysis["status"] == "VERIFIED":
        attendance_values["status"] = "present"
        attendance_values["verification_source"] = "automatic"
    supa().table("attendance").update(attendance_values).eq("session_id", session_id).eq("student_id", user["id"]).execute()
    _audit(session_id, user["id"], "image.submitted", note=analysis["explanation"], metadata={"submission_id": submission["id"], "verification_status": analysis["status"], "attempt_number": attempt_number})
    publish_event(event_payload("submission.created", {"session_id": session_id, "submission_id": submission["id"], "status": analysis["status"]}), [user["id"], row.get("teacher_id", "")])
    return {"id": submission["id"], "session_id": session_id, "status": analysis["status"], "submitted_at": now, "explanation": analysis["explanation"], "quality": analysis["quality"], "detected_people": analysis.get("detected_people"), "nearby_people": analysis.get("nearby_people"), "stage_person_detected": analysis.get("stage_person_detected"), "attempt_number": attempt_number}


@app.post("/api/sessions/{session_id}/verification")
async def verify_attendance(
    session_id: str,
    classroom: UploadFile = File(...),
    face_frames: list[UploadFile] = File(default=[]),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Evaluate identity, guided liveness, and classroom context independently."""
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student role required")
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user)
    if row["status"] != "open":
        raise HTTPException(status_code=409, detail="The attendance session is not accepting verification")
    enrolled = user.get("face_embedding_encrypted")
    if not enrolled:
        raise HTTPException(status_code=409, detail="Complete face enrollment before starting attendance verification")
    if len(face_frames) < 4:
        raise HTTPException(status_code=422, detail="Capture the complete guided liveness sequence before submitting")
    if classroom.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP classroom image")

    frame_bytes: list[bytes] = []
    for frame in face_frames:
        if frame.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(status_code=415, detail="Every face frame must be a JPEG, PNG, or WebP image")
        content = await frame.read()
        if not content or len(content) > MAX_CAPTURE_BYTES:
            raise HTTPException(status_code=413, detail="A face frame is empty or exceeds the configured size limit")
        frame_bytes.append(content)
    classroom_bytes = await classroom.read()
    if not classroom_bytes or len(classroom_bytes) > MAX_CAPTURE_BYTES:
        raise HTTPException(status_code=413, detail="The classroom image is empty or exceeds the configured size limit")

    from .verification import VerificationInputError, VerificationUnavailable, compare_face, evaluate_liveness
    from .vision import analyze_classroom_image, strip_image_metadata

    liveness = await asyncio.to_thread(evaluate_liveness, frame_bytes)
    try:
        identity = await asyncio.to_thread(compare_face, frame_bytes[len(frame_bytes) // 2], enrolled)
    except VerificationInputError as exc:
        identity = {"status": "REJECTED", "reason": str(exc)}
    except VerificationUnavailable as exc:
        identity = {"status": "INCONCLUSIVE", "reason": str(exc)}
    classroom_result = await asyncio.to_thread(
        analyze_classroom_image,
        classroom_bytes,
        stage_region=row.get("stage_region"),
        minimum_people=int(row.get("minimum_people_visible") or ATTENDANCE_MIN_VISIBLE_PEOPLE),
    )
    classroom_status = "VERIFIED" if classroom_result.get("status") == "VERIFIED" else "REJECTED" if classroom_result.get("status") == "REJECTED" else "INCONCLUSIVE"
    statuses = [identity.get("status"), liveness.get("status"), classroom_status]
    final_status = "REJECTED" if "REJECTED" in statuses else "CONFIRMED" if all(value == "VERIFIED" for value in statuses) else "PENDING_REVIEW"
    reason = "; ".join(str(item.get("reason") or item.get("explanation") or "Evidence was inconclusive.") for item in (identity, liveness, classroom_result) if item.get("status") != "VERIFIED")
    if not reason:
        reason = "Identity, liveness, and classroom-context checks passed."

    stored_data: bytes | None = None
    image_format = classroom_result.get("quality", {}).get("format")
    if image_format:
        stored_data = strip_image_metadata(classroom_bytes)
    image_path = None
    if stored_data:
        extension = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(image_format)
        if extension:
            image_path = f"{session_id}/{user['id']}/{uuid.uuid4().hex}.{extension}"
            try:
                supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).upload(image_path, stored_data, {"content-type": {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[image_format], "upsert": "false"})
            except Exception as exc:
                raise HTTPException(status_code=503, detail="Secure classroom evidence storage is unavailable") from exc

    now = utc_now()
    attempt = {
        "session_id": session_id,
        "student_id": user["id"],
        "submitted_at": now,
        "identity_status": identity.get("status", "INCONCLUSIVE"),
        "liveness_status": liveness.get("status", "INCONCLUSIVE"),
        "classroom_status": classroom_status,
        "final_status": final_status,
        "identity_result": identity,
        "liveness_result": liveness,
        "classroom_result": classroom_result,
        "reason": reason,
    }
    try:
        saved_attempt = supa().table("verification_attempts").upsert(attempt, on_conflict="session_id,student_id").execute()
    except Exception as exc:
        if image_path:
            try:
                supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).remove([image_path])
            except Exception:
                pass
        raise HTTPException(status_code=409, detail="A verification attempt already exists or could not be recorded") from exc

    if image_path:
        submission_data = {
            "session_id": session_id, "student_id": user["id"], "attempt_number": 1,
            "submitted_at": now, "status": classroom_result.get("status", "NEEDS_REVIEW"),
            "explanation": reason, "quality_result": classroom_result.get("quality", {}),
            "analysis_json": classroom_result, "detected_people": classroom_result.get("detected_people"),
            "nearby_people": classroom_result.get("nearby_people"), "stage_person_detected": classroom_result.get("stage_person_detected"),
            "storage_path": image_path, "image_sha256": hashlib.sha256(stored_data).hexdigest(),
        }
        supa().table("image_submissions").upsert(submission_data, on_conflict="session_id,student_id").execute()
    attendance_values = {
        "status": "present" if final_status == "CONFIRMED" else "pending",
        "verification_status": "VERIFIED" if final_status == "CONFIRMED" else "REJECTED" if final_status == "REJECTED" else "NEEDS_REVIEW",
        "verification_source": "automatic" if final_status == "CONFIRMED" else None,
        "note": reason, "updated_by": user["id"], "updated_at": now,
    }
    supa().table("attendance").update(attendance_values).eq("session_id", session_id).eq("student_id", user["id"]).execute()
    _audit(session_id, user["id"], "verification.completed", note=reason, metadata={"attempt_id": (saved_attempt.data or [{}])[0].get("id"), "final_status": final_status})
    publish_event(event_payload("attendance.changed", {"session_id": session_id, "student_id": user["id"], "status": final_status}), [user["id"], row.get("teacher_id", "")])
    return {"status": final_status, "reason": reason, "identity": identity, "liveness": liveness, "classroom_context": classroom_result, "submitted_at": now}


@app.get("/api/sessions/{session_id}/submissions")
def list_submissions(session_id: str, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    response = (
        supa().table("image_submissions")
        .select("*, profiles!image_submissions_student_id_fkey(name, email, registration_id)")
        .eq("session_id", session_id).order("submitted_at", desc=True).execute()
    )
    output = []
    for item in response.data or []:
        entry = {**item}
        profile = entry.pop("profiles!image_submissions_student_id_fkey", None) or entry.pop("profiles", None)
        if isinstance(profile, dict):
            entry["student_name"] = profile.get("name")
            entry["student_email"] = profile.get("email")
            entry["student_id"] = profile.get("registration_id") or item.get("student_id")
        storage_path = entry.get("storage_path")
        entry["image_url"] = None
        if storage_path:
            try:
                signed = supa().storage.from_(ATTENDANCE_STORAGE_BUCKET).create_signed_url(storage_path, 600)
                entry["image_url"] = signed.get("signedURL") or signed.get("signedUrl")
            except Exception:
                entry["image_url"] = None
        output.append(entry)
    return output


@app.post("/api/sessions/{session_id}/submissions/{submission_id}/review")
def review_submission(
    session_id: str,
    submission_id: str,
    body: SubmissionReviewRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    if row["status"] == "finalized":
        raise HTTPException(status_code=409, detail="Finalized sessions cannot be changed")
    found = (
        supa().table("image_submissions").select("*")
        .eq("id", submission_id).eq("session_id", session_id).single().execute()
    )
    if not found.data:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission = found.data
    decision = body.decision.upper()
    now = utc_now()
    supa().table("image_submissions").update({"review_decision": decision, "review_reason": body.reason.strip(), "reviewed_by": user["id"], "reviewed_at": now}).eq("id", submission_id).execute()
    attendance_status = "present" if decision == "APPROVE" else "pending"
    verification_status = "MANUALLY_APPROVED" if decision == "APPROVE" else "MANUALLY_REJECTED"
    supa().table("attendance").update({"status": attendance_status, "verification_status": verification_status, "verification_source": "manual", "note": body.reason.strip(), "updated_by": user["id"], "updated_at": now}).eq("session_id", session_id).eq("student_id", submission["student_id"]).execute()
    _audit(session_id, user["id"], "submission.reviewed", note=body.reason.strip(), metadata={"submission_id": submission_id, "decision": decision})
    publish_event(event_payload("attendance.changed", {"session_id": session_id, "student_id": submission["student_id"], "verification_status": verification_status}), [user["id"], submission["student_id"]])
    return {"submission_id": submission_id, "decision": decision, "verification_status": verification_status, "attendance_status": attendance_status, "reviewed_at": now}


@app.post("/api/sessions/{session_id}/open")
def open_session(session_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    if row["status"] != "scheduled":
        raise HTTPException(status_code=409, detail="Only a scheduled session can be opened early")
    deadline_at = _parse_datetime(row.get("deadline_at"))
    if deadline_at is None or deadline_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="The session deadline has passed")
    now = utc_now()
    supa().table("sessions").update({"status": "open", "opens_at": now}).eq("id", session_id).execute()
    _audit(session_id, user["id"], "session.opened_early", note="Professor opened the scheduled attendance window early.")
    return {"session_id": session_id, "status": "open", "opens_at": now, "deadline_at": row.get("deadline_at")}


@app.post("/api/sessions/{session_id}/close")
def close_session(session_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    if row["status"] == "finalized":
        raise HTTPException(status_code=409, detail="Session is already finalized")
    if row["status"] == "closed":
        return {"session_id": session_id, "status": "closed", "closed_at": row.get("closed_at")}
    now = utc_now()
    supa().table("sessions").update({"status": "closed", "closed_at": now}).eq("id", session_id).execute()
    _audit(session_id, user["id"], "session.closed", note="Professor closed the attendance window.")
    return {"session_id": session_id, "status": "closed", "closed_at": now}


@app.patch("/api/sessions/{session_id}/attendance/{student_id}")
def update_attendance(
    session_id: str,
    student_id: str,
    body: AttendanceUpdate,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    if row["status"] in {"scheduled", "finalized"}:
        raise HTTPException(status_code=409, detail="Finalized sessions cannot be changed")

    enr = (
        supa()
        .table("enrollments")
        .select("class_id")
        .eq("class_id", row["class_id"])
        .eq("student_id", student_id)
        .execute()
    )
    if not enr.data:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this class")

    now = utc_now()
    verification_status = "MANUALLY_APPROVED" if body.status == "present" else "MANUALLY_REJECTED" if body.status == "absent" else "NEEDS_REVIEW"
    supa().table("attendance").update(
        {"status": body.status, "verification_status": verification_status, "verification_source": "manual", "note": body.note, "updated_by": user["id"], "updated_at": now}
    ).eq("session_id", session_id).eq("student_id", student_id).execute()

    _audit(session_id, user["id"], "attendance.changed",
           note=body.note,
           metadata={"student_id": student_id, "status": body.status})

    changed = (
        supa()
        .table("attendance")
        .select("student_id, status, note, updated_at, profiles!attendance_student_id_fkey(name)")
        .eq("session_id", session_id)
        .eq("student_id", student_id)
        .single()
        .execute()
    )
    result = {**changed.data}
    prof = result.pop("profiles!attendance_student_id_fkey", None) or result.pop("profiles", None)
    if isinstance(prof, dict):
        result["name"] = prof["name"]

    publish_event(
        event_payload("attendance.changed", {"session_id": session_id, "student_id": student_id, "status": body.status}),
        [user["id"]],
    )
    return result


@app.post("/api/sessions/{session_id}/finalize")
def finalize(
    session_id: str,
    body: FinalizeRequest,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    require_teacher(user)
    if body.mark_pending_absent is not True:
        raise HTTPException(status_code=400, detail="mark_pending_absent must be true for explicit finalization")

    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    if row["status"] != "closed":
        raise HTTPException(status_code=409, detail="Close the attendance window before finalizing the session")

    now = utc_now()
    pending_resp = (
        supa()
        .table("attendance")
        .select("student_id")
        .eq("session_id", session_id)
        .eq("status", "pending")
        .execute()
    )
    pending = pending_resp.data or []

    supa().table("attendance").update(
        {"status": "absent", "updated_by": user["id"], "updated_at": now}
    ).eq("session_id", session_id).eq("status", "pending").execute()

    for s in pending:
        _audit(session_id, user["id"], "attendance.changed",
               note="Pending attendance marked absent at finalization.",
               metadata={"student_id": s["student_id"], "status": "absent", "finalization": True})

    supa().table("sessions").update({"status": "finalized", "finalized_at": now}).eq("id", session_id).execute()
    _audit(session_id, user["id"], "session.finalized",
           note="Session finalized; pending records marked absent.",
           metadata={"pending_marked_absent": len(pending)})

    students_resp = (
        supa().table("enrollments").select("student_id").eq("class_id", row["class_id"]).execute()
    )
    students = students_resp.data or []
    notif_rows = [
        {
            "user_id": s["student_id"],
            "type": "attendance.finalized",
            "title": "Attendance updated",
            "body": "Your attendance record for a class session is available in the app.",
            "session_id": session_id,
            "created_at": now,
        }
        for s in students
    ]
    if notif_rows:
        supa().table("notifications").insert(notif_rows).execute()

    att_resp = supa().table("attendance").select("status").eq("session_id", session_id).execute()
    att_all = att_resp.data or []
    summary = {
        "present": sum(1 for a in att_all if a["status"] == "present"),
        "absent": sum(1 for a in att_all if a["status"] == "absent"),
        "pending": 0,
    }
    student_ids = [s["student_id"] for s in students]

    ev = event_payload("session.finalized", {"session_id": session_id, "summary": summary})
    publish_event(ev, [user["id"], *student_ids])
    for sid in student_ids:
        publish_event(event_payload("notification.created", {"session_id": session_id}), [sid])

    return {"session_id": session_id, "status": "finalized", "finalized_at": now, "summary": summary}


@app.get("/api/students/me/attendance")
def my_attendance(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="Student role required")

    resp = (
        supa()
        .table("attendance")
        .select("session_id, status, note, updated_at, sessions(created_at, finalized_at, class_id, classes(id, name, code))")
        .eq("student_id", user["id"])
        .order("sessions(created_at)", desc=True)
        .execute()
    )
    entries = []
    for r in resp.data or []:
        sess = r.get("sessions") or {}
        cls = sess.get("classes") or {}
        entries.append({
            "session_id": r["session_id"],
            "status": r["status"],
            "note": r.get("note"),
            "updated_at": r["updated_at"],
            "created_at": sess.get("created_at"),
            "finalized_at": sess.get("finalized_at"),
            "class_id": cls.get("id"),
            "class_name": cls.get("name"),
            "class_code": cls.get("code"),
        })

    present = sum(1 for e in entries if e["status"] == "present")
    absent = sum(1 for e in entries if e["status"] == "absent")
    pending = sum(1 for e in entries if e["status"] == "pending")
    total = present + absent
    return {
        "student": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
        "entries": entries,
        "summary": {
            "present": present,
            "absent": absent,
            "pending": pending,
            "total_finalized": total,
            "percentage": round((present / total) * 100, 1) if total else None,
        },
    }


@app.get("/api/reports/sessions/{session_id}")
def report(session_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)

    entries_resp = (
        supa()
        .table("attendance")
        .select("student_id, status, note, updated_at, verification_status, verification_source, profiles!attendance_student_id_fkey(name, email, registration_id)")
        .eq("session_id", session_id)
        .order("profiles!attendance_student_id_fkey(name)")
        .execute()
    )
    entries = []
    for e in entries_resp.data or []:
        flat = {**e}
        prof = flat.pop("profiles!attendance_student_id_fkey", None) or flat.pop("profiles", None)
        if isinstance(prof, dict):
            flat["name"] = prof["name"]
            flat["email"] = prof["email"]
            flat["registration_id"] = prof.get("registration_id")
        entries.append(flat)

    submission_resp = (
        supa().table("image_submissions")
        .select("student_id, submitted_at, status, review_decision")
        .eq("session_id", session_id).execute()
    )
    submission_by_student = {item["student_id"]: item for item in (submission_resp.data or [])}
    for entry in entries:
        submission = submission_by_student.get(entry["student_id"], {})
        entry["student_code"] = entry.pop("registration_id", None) or entry["student_id"]
        entry["submission_time"] = submission.get("submitted_at")
        entry["verification_status"] = entry.get("verification_status") or submission.get("status") or "NOT_SUBMITTED"
        entry["review_decision"] = submission.get("review_decision")

    summary = {
        "total_enrolled": len(entries),
        "automatically_verified_present": sum(1 for e in entries if e.get("verification_source") == "automatic" and e["status"] == "present"),
        "manually_approved_present": sum(1 for e in entries if e.get("verification_status") == "MANUALLY_APPROVED" and e["status"] == "present"),
        "rejected_submissions": sum(1 for s in submission_by_student.values() if s.get("status") == "REJECTED" or s.get("review_decision") == "REJECT"),
        "awaiting_review": sum(1 for s in submission_by_student.values() if s.get("status") == "NEEDS_REVIEW" and not s.get("review_decision")),
        "did_not_submit": max(0, len(entries) - len(submission_by_student)),
        "final_absent": sum(1 for e in entries if e["status"] == "absent"),
    }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["student_id", "student_name", "student_email", "submission_time", "verification_status", "review_decision", "final_attendance_status", "note", "updated_at"])
    for e in entries:
        writer.writerow([e.get("student_code", ""), e.get("name", ""), e.get("email", ""), e.get("submission_time") or "", e.get("verification_status", ""), e.get("review_decision") or "", e["status"], e.get("note") or "", e["updated_at"]])
    csv_data = output.getvalue()

    pdf_html = (
        "<!doctype html><html><head><meta charset='utf-8'><title>Attendance report</title></head><body><h1>"
        + escape(str(row.get("class_name", "")))
        + " attendance</h1><p>Session "
        + escape(str(session_id))
        + " · "
        + escape(str(row["created_at"]))
        + "</p><table><thead><tr><th>Student</th><th>Email</th><th>Status</th><th>Note</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td>{escape(str(e.get('name', '')))}</td><td>{escape(str(e.get('email', '')))}</td>"
            f"<td>{escape(str(e['status']))}</td><td>{escape(str(e.get('note') or ''))}</td></tr>"
            for e in entries
        )
        + "</tbody></table></body></html>"
    )
    return {
        "generated_at": utc_now(),
        "session": {
            "id": row["id"],
            "class_id": row["class_id"],
            "title": row.get("title", "Attendance session"),
            "class_name": row.get("class_name", ""),
            "class_code": row.get("class_code", ""),
            "status": row["status"],
            "created_at": row["created_at"],
            "opens_at": row.get("opens_at"),
            "deadline_at": row.get("deadline_at"),
            "finalized_at": row.get("finalized_at"),
        },
        "rows": entries,
        "summary": summary,
        "csv": csv_data,
        "pdf": pdf_html,
        "pdf_html": pdf_html,
        "pdf_note": "Print pdf_html from a trusted client to create a PDF; the API does not claim to be a PDF renderer.",
    }


@app.get("/api/reports/sessions/{session_id}/xlsx")
def report_xlsx(session_id: str, user: dict[str, Any] = Depends(current_user)) -> StreamingResponse:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)
    report_data = report(session_id, user)
    audit_items = get_audit(session_id, user)
    from .reports import build_attendance_workbook
    workbook = build_attendance_workbook(report_data, audit_items)
    filename = f"attendrix-{session_id}-attendance.xlsx"
    return StreamingResponse(
        workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/audit")
def get_audit(session_id: str = Query(...), user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_teacher(user)
    row = _get_session_or_404(session_id)
    _assert_session_access(row, user, teacher_only=True)

    resp = (
        supa()
        .table("audit_log")
        .select("*, profiles(id, name)")
        .eq("session_id", session_id)
        .order("id")
        .execute()
    )
    result = []
    for r in resp.data or []:
        item = {**r}
        if isinstance(r.get("profiles"), dict):
            item["actor_id"] = r["profiles"]["id"]
            item["actor_name"] = r["profiles"]["name"]
            item.pop("profiles", None)
        item["metadata"] = json.loads(item.pop("metadata_json") or "{}")
        result.append(item)
    return result


@app.get("/api/controller/audit")
def get_controller_audit(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    require_controller(user)
    response = (
        supa().table("audit_log")
        .select("*, profiles(id, name)")
        .is_("session_id", "null")
        .order("timestamp", desc=True)
        .limit(200)
        .execute()
    )
    result = []
    for row in response.data or []:
        item = {**row}
        profile = item.pop("profiles", None)
        if isinstance(profile, dict):
            item["actor_id"] = profile.get("id")
            item["actor_name"] = profile.get("name")
        item["metadata"] = json.loads(item.pop("metadata_json", "{}") or "{}")
        result.append(item)
    return result


@app.get("/api/notifications")
def notifications(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    resp = (
        supa()
        .table("notifications")
        .select("id, type, title, body, session_id, created_at, read_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    existing = (
        supa()
        .table("notifications")
        .select("id")
        .eq("id", notification_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    read_at = utc_now()
    supa().table("notifications").update({"read_at": read_at}).eq("id", notification_id).execute()
    return {"id": notification_id, "read_at": read_at}


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws")
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, ticket: str = Query(...)):
    now = time.time()
    with _ws_lock:
        record = _ws_tickets.pop(ticket, None)
    if not record or record[1] < now:
        await websocket.close(code=1008, reason="Invalid or expired single-use ticket")
        return
    user_id = record[0]
    await websocket.accept()
    event_queue: asyncio.Queue[str] = asyncio.Queue()
    with _ws_lock:
        _ws_clients.setdefault(user_id, set()).add(websocket)
        _ws_client_loops[websocket] = asyncio.get_running_loop()
        _ws_client_queues[websocket] = event_queue
    receive_task: Optional[asyncio.Task[Any]] = None
    event_task: Optional[asyncio.Task[str]] = None
    try:
        await websocket.send_json(event_payload("connected", {"user_id": user_id}))
        receive_task = asyncio.create_task(websocket.receive())
        event_task = asyncio.create_task(event_queue.get())
        while True:
            done, _ = await asyncio.wait({receive_task, event_task}, return_when=asyncio.FIRST_COMPLETED)
            if receive_task in done:
                try:
                    message = receive_task.result()
                except WebSocketDisconnect:
                    break
                if message.get("type") == "websocket.disconnect":
                    break
                receive_task = asyncio.create_task(websocket.receive())
            if event_task in done:
                try:
                    msg_text = event_task.result()
                    await websocket.send_text(msg_text)
                except (WebSocketDisconnect, RuntimeError):
                    break
                event_task = asyncio.create_task(event_queue.get())
    except WebSocketDisconnect:
        pass
    finally:
        for task in (receive_task, event_task):
            if task is not None and not task.done():
                task.cancel()
        if receive_task is not None or event_task is not None:
            await asyncio.gather(
                *(task for task in (receive_task, event_task) if task is not None),
                return_exceptions=True,
            )
        with _ws_lock:
            if user_id in _ws_clients:
                _ws_clients[user_id].discard(websocket)
                if not _ws_clients[user_id]:
                    _ws_clients.pop(user_id, None)
            _ws_client_loops.pop(websocket, None)
            _ws_client_queues.pop(websocket, None)
