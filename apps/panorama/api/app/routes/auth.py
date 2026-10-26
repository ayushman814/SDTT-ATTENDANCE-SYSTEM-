"""Role-aware registration and login."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import PROFESSOR_INVITE_CODE
from ..db import get_db
from ..models import Role, User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import (
    current_user,
    hash_password,
    issue_token,
    rate_limit,
    verify_password,
)
from ..services import audit

router = APIRouter(tags=["auth"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        role=user.role.value,
        name=user.name,
        email=user.email,
        roll_no=user.roll_no,
        face_enrolled=user.face_embedding is not None,
    )


@router.post("/auth/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not body.consent:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Consent to face-photo processing is required to use attendance",
        )
    role = Role(body.role)
    if role == Role.student and not body.roll_no:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="roll_no is required for students")
    # Professor accounts carry write access over attendance — self-registration
    # requires the deployment's invite code (PANORAMA_PROFESSOR_INVITE_CODE).
    if role == Role.professor:
        if not PROFESSOR_INVITE_CODE:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Professor registration is disabled (no invite code configured)",
            )
        if body.invite_code != PROFESSOR_INVITE_CODE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid professor invite code")
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        role=role,
        name=body.name.strip(),
        email=email,
        roll_no=body.roll_no,
        password_hash=hash_password(body.password),
        consent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    audit(db, "user.registered", "user", user.id, actor_id=user.id, detail={"role": role.value})
    db.commit()
    return TokenOut(access_token=issue_token(user), user=user_out(user))


@router.post("/auth/login", response_model=TokenOut, dependencies=[Depends(rate_limit("login", "login_per_minute"))])
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.role != Role(body.role):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=f"These credentials are not valid for the {body.role} sign-in",
        )
    audit(db, "user.login", "user", user.id, actor_id=user.id)
    db.commit()
    return TokenOut(access_token=issue_token(user), user=user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user_out(user)
