"""Password hashing, JWT issuing/verification, auth dependencies, rate limits."""
from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import JWT_ALG, JWT_SECRET, JWT_TTL_SECONDS, cfg
from .db import get_db
from .models import Role, User

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def issue_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "name": user.name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=JWT_TTL_SECONDS)).timestamp()),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}")


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    payload = decode_token(creds.credentials)
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return user


def require_role(role: Role):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=f"Requires {role.value} role")
        return user

    return dep


require_student = require_role(Role.student)
require_professor = require_role(Role.professor)


# ── Tiny in-memory sliding-window rate limiter ───────────────────────────────
class RateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, list[float]] = {}

    def check(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits.get(key, []) if now - t < window_seconds]
            if len(hits) >= limit:
                self._hits[key] = hits
                return False
            hits.append(now)
            self._hits[key] = hits
            return True


limiter = RateLimiter()


def rate_limit(bucket: str, limit_key: str):
    """FastAPI dependency: 429 when `limit_key` hits/min exceeded per client."""

    def dep(request: Request) -> None:
        limit = int(cfg()["rate_limits"][limit_key])
        client = request.client.host if request.client else "unknown"
        if not limiter.check(f"{bucket}:{client}", limit):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests, slow down")

    return dep
