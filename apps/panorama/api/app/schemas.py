"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    role: Literal["student", "professor"]
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    roll_no: Optional[str] = Field(default=None, max_length=40)
    consent: bool  # face-data consent is mandatory


class LoginIn(BaseModel):
    role: Literal["student", "professor"]
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    role: str
    name: str
    email: str
    roll_no: Optional[str] = None
    face_enrolled: bool


class SessionCreateIn(BaseModel):
    course_id: Optional[int] = None
    course_name: Optional[str] = None  # create a course on the fly when no id given
    window_minutes: int = Field(ge=1, le=120)
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    geo_radius_m: Optional[float] = None


class SessionOut(BaseModel):
    public_id: str
    course_id: int
    course_name: str
    course_code: str
    professor_name: str
    start_time: datetime
    end_time: datetime
    status: str
    geo_enabled: bool


class SubmissionOut(BaseModel):
    id: int
    session_id: int
    student_id: int
    student_name: str
    roll_no: Optional[str]
    image_url: str
    submitted_at: datetime
    status: str
    reason: Optional[str]
    reason_code: Optional[str] = None
    scores: Optional[dict[str, Any]]


class OverrideIn(BaseModel):
    status: Literal["present", "rejected"]
    reason: Optional[str] = Field(default=None, max_length=200)


class SessionSummaryOut(BaseModel):
    session: SessionOut
    enrolled_count: int
    present_count: int
    absent_count: int
    rejected_count: int
    pending_count: int
    present_pct: float
    present: list[SubmissionOut]
    rejected: list[SubmissionOut]
    pending: list[SubmissionOut]


class HistoryCourseOut(BaseModel):
    course_code: str
    course_name: str
    sessions_attended: int
    sessions_total: int
    pct: float


class StudentHistoryOut(BaseModel):
    courses: list[HistoryCourseOut]
    submissions: list[SubmissionOut]


TokenOut.model_rebuild()
