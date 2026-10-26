"""Panorama attendance API — FastAPI entrypoint.

Students mark attendance by uploading a panorama selfie during a
professor-controlled time window; the server-side verification pipeline
(face match, neighbour, lecturer-in-frame, anti-spoof) decides the outcome.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, UPLOAD_DIR
from .db import init_db
from .routes import auth, sessions, submissions, uploads, users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Panorama Attendance API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")

app.include_router(uploads.router, prefix="/api")

# Uploads are served through the authenticated /api/uploads/... route only —
# face photos and panoramas are biometric data, never publicly reachable.
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
