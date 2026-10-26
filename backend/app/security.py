"""Security, encryption, JWT auth, and rate limiting utilities."""
from __future__ import annotations

import base64
import hashlib
import time
from datetime import datetime, timezone
from typing import Any, Optional

import jwt as pyjwt
from cryptography.fernet import Fernet
from fastapi import HTTPException

import os
from app.config import (
    ATTENDANCE_ENV,
    ATTENDANCE_SECRET_KEY,
    ATTENDANCE_TOKEN_TTL_SECONDS,
    RATE_LIMIT_LOGIN_PER_MIN,
    RATE_LIMIT_SUBMIT_PER_MIN,
    SUPABASE_JWT_SECRET,
)

# ── Encryption for Biometric Face Embeddings ───────────────────────────────────
# Derive a valid 32-byte url-safe base64 Fernet key from ATTENDANCE_SECRET_KEY
_raw_key = hashlib.sha256(ATTENDANCE_SECRET_KEY.encode("utf-8")).digest()
_fernet_key = base64.urlsafe_b64encode(_raw_key)
_cipher = Fernet(_fernet_key)


def encrypt_face_embedding(embedding: Any) -> str:
    """Encrypt a 512-dimensional floating point embedding into an opaque string."""
    import numpy as np
    arr = np.asarray(embedding, dtype=np.float32).tobytes()
    encrypted = _cipher.encrypt(arr)
    return encrypted.decode("utf-8")


def decrypt_face_embedding(encrypted_str: str) -> Any:
    """Decrypt an encrypted embedding string back into a 512-dim float32 NumPy array."""
    import numpy as np
    decrypted_bytes = _cipher.decrypt(encrypted_str.encode("utf-8"))
    return np.frombuffer(decrypted_bytes, dtype=np.float32)


# ── JWT Authentication ────────────────────────────────────────────────────────
def create_access_token(user_id: str, email: str, role: str, name: str) -> str:
    """Generate a JWT token adhering to Supabase-compatible schema."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "user_metadata": {
            "name": name,
            "role": role,
        },
        "app_metadata": {
            "role": role,
        },
        "iat": now,
        "exp": now + ATTENDANCE_TOKEN_TTL_SECONDS,
    }
    return pyjwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")


def verify_jwt_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT signature and audience."""
    try:
        payload = pyjwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


# ── In-Memory Rate Limiting ───────────────────────────────────────────────────
_rate_limits: dict[str, list[float]] = {}


def reset_rate_limits() -> None:
    _rate_limits.clear()


def check_rate_limit(key: str, max_requests: int, window_seconds: float = 60.0) -> None:
    """Sliding-window rate limiter. Raises 429 if limit exceeded."""
    if os.getenv("ATTENDANCE_ENV", ATTENDANCE_ENV).lower() == "test" and not key.startswith("test_rate:"):
        return
    now = time.time()
    history = _rate_limits.setdefault(key, [])
    # Prune timestamps older than window
    _rate_limits[key] = [t for t in history if now - t < window_seconds]
    if len(_rate_limits[key]) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Please wait a moment before retrying."
        )
    _rate_limits[key].append(now)


def check_login_rate_limit(client_ip: str) -> None:
    check_rate_limit(f"login:{client_ip}", max_requests=RATE_LIMIT_LOGIN_PER_MIN, window_seconds=60.0)


def check_submit_rate_limit(student_id: str) -> None:
    check_rate_limit(f"submit:{student_id}", max_requests=RATE_LIMIT_SUBMIT_PER_MIN, window_seconds=60.0)
