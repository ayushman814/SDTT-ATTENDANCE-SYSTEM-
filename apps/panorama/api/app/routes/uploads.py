"""Authenticated access to uploaded images (reference faces, panoramas, selfies).

These files contain biometric data — they are never served anonymously.
Professors can read anything tied to their own sessions; students only their
own files.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import UPLOAD_DIR
from ..db import get_db
from ..models import ClassSession, Role, Submission, User
from ..security import current_user

router = APIRouter(tags=["uploads"])

_FACE_RE = re.compile(r"^user_(\d+)\.[a-zA-Z0-9]+$")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9_\-.]+$")


def _submission_for(kind: str, name: str, db: Session) -> Submission | None:
    col = Submission.selfie_url if kind == "selfies" else Submission.image_url
    return db.scalar(select(Submission).where(col.endswith(name)))


@router.get("/uploads/{kind}/{name}")
def get_upload(kind: str, name: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if kind not in ("faces", "submissions", "selfies") or not _SAFE_NAME.match(name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")

    if kind == "faces":
        m = _FACE_RE.match(name)
        if m is None or (user.role != Role.professor and user.id != int(m.group(1))):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your image")
    else:
        sub = _submission_for(kind, name, db)
        if sub is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")
        session = db.get(ClassSession, sub.session_id)
        if user.id != sub.student_id and (session is None or session.professor_id != user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your image")

    path = UPLOAD_DIR / kind / name
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")
    return FileResponse(path)
