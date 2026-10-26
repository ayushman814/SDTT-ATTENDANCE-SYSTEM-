"""Database engine/session helpers (SQLAlchemy 2.x).

SQLite is the development default; set PANORAMA_DATABASE_URL to a PostgreSQL
DSN for deployment — the same models work on both.
"""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)

if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_fk_on(dbapi_conn, _):  # pragma: no cover - trivial
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (register models)

    Base.metadata.create_all(engine)
    _apply_additive_migrations()


def _apply_additive_migrations() -> None:
    """Idempotent column additions/rewrites for older database revisions."""
    from datetime import datetime, timezone

    from sqlalchemy import inspect, text

    insp = inspect(engine)
    tables = insp.get_table_names()
    if "submissions" in tables:
        cols = {c["name"] for c in insp.get_columns("submissions")}
        with engine.begin() as conn:
            if "selfie_url" not in cols:
                conn.execute(text("ALTER TABLE submissions ADD COLUMN selfie_url VARCHAR(500)"))
            # image URLs are now served under the authenticated /api prefix
            conn.execute(
                text(
                    "UPDATE submissions SET image_url = '/api' || image_url"
                    " WHERE image_url LIKE '/uploads/%'"
                )
            )
    if "users" in tables:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE users SET face_photo_url = '/api' || face_photo_url"
                    " WHERE face_photo_url LIKE '/uploads/%'"
                )
            )
    if "enrollments" in tables:
        cols = {c["name"] for c in insp.get_columns("enrollments")}
        with engine.begin() as conn:
            if "enrolled_at" not in cols:
                conn.execute(text("ALTER TABLE enrollments ADD COLUMN enrolled_at DATETIME"))
                conn.execute(
                    text("UPDATE enrollments SET enrolled_at = :now WHERE enrolled_at IS NULL"),
                    {"now": datetime.now(timezone.utc)},
                )
            if "unenrolled_at" not in cols:
                conn.execute(text("ALTER TABLE enrollments ADD COLUMN unenrolled_at DATETIME"))
