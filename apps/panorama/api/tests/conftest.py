"""Shared fixtures: real vision engine, synthetic panorama fixtures, test DB."""
from __future__ import annotations

import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_tmp = tempfile.mkdtemp(prefix="pano-test-")
os.environ.setdefault("PANORAMA_DATABASE_URL", f"sqlite:///{_tmp}/test.db")
os.environ.setdefault("PANORAMA_UPLOAD_DIR", f"{_tmp}/uploads")
os.environ.setdefault("PANORAMA_JWT_SECRET", "test-secret")

from app.config import cfg  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402
from app.models import ClassSession, Course, Enrollment, Role, SessionStatus, User  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.vision import FaceEngine  # noqa: E402

FACES = ROOT / "seed_faces"


@pytest.fixture(scope="session")
def engine() -> FaceEngine:
    return FaceEngine()


def _face_crop(engine: FaceEngine, path: Path, width: int) -> np.ndarray:
    img = cv2.imread(str(path))
    h, w = img.shape[:2]
    det = cv2.FaceDetectorYN_create(
        str(engine._det_path), "", (w, h), 0.6
    )
    _, faces = det.detect(img)
    assert faces is not None and len(faces), f"no face in {path}"
    face = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
    x, y, fw, fh = [int(v) for v in face[:4]]
    pad = int(fh * 0.9)
    x0, y0 = max(0, x - pad), max(0, y - pad)
    crop = img[y0:min(h, y + fh + pad), x0:min(w, x + fw + pad)]
    scale = width / crop.shape[1]
    return cv2.resize(crop, (width, max(1, int(crop.shape[0] * scale))))


@pytest.fixture(scope="session")
def make_panorama(engine):
    """Compose a synthetic 'panorama selfie' from seed portraits on a textured bg."""

    def build(entries: list[tuple[str, int, int]], size=(2400, 800)) -> np.ndarray:
        """entries: (face_png_name, x_px, face_width_px)."""
        w, h = size
        rng = np.random.default_rng(7)
        bg = rng.integers(110, 190, (h, w, 3), dtype=np.uint8)
        bg = cv2.GaussianBlur(bg, (31, 31), 0)
        # add mild texture so blur_variance clears the floor
        noise = rng.integers(-25, 25, (h, w, 3), dtype=np.int16)
        bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        for name, x, fw in entries:
            crop = _face_crop(engine, FACES / name, fw)
            y = h - crop.shape[0] - 80
            bg[y:y + crop.shape[0], x:x + crop.shape[1]] = crop
        return bg

    return build


@pytest.fixture(scope="session")
def make_frame(engine):
    """Compose one synthetic sweep frame: a face on a textured background."""

    def build(face_name: str | None, size=(800, 600), face_w=220, seed=11) -> np.ndarray:
        w, h = size
        rng = np.random.default_rng(seed)
        bg = rng.integers(110, 190, (h, w, 3), dtype=np.uint8)
        bg = cv2.GaussianBlur(bg, (21, 21), 0)
        noise = rng.integers(-25, 25, (h, w, 3), dtype=np.int16)
        bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        if face_name:
            crop = _face_crop(engine, FACES / face_name, face_w)
            x = (w - crop.shape[1]) // 2
            y = h - crop.shape[0] - 60
            bg[y:y + crop.shape[0], x:x + crop.shape[1]] = crop
        return bg

    return build


@pytest.fixture(scope="session")
def embeddings(engine) -> dict[str, np.ndarray]:
    out = {}
    for name in ["professor", "student1", "student2", "student3", "student4", "student5"]:
        img = cv2.imread(str(FACES / f"{name}.png"))
        out[name] = engine.embed_largest(img).astype(np.float32)
    return out


@pytest.fixture()
def cfg_obj():
    return cfg()


def make_session(**kw) -> ClassSession:
    now = datetime.now(timezone.utc)
    defaults = dict(
        public_id="sess123",
        course_id=1,
        professor_id=1,
        start_time=now - timedelta(minutes=1),
        end_time=now + timedelta(minutes=9),
        status=SessionStatus.active,
    )
    defaults.update(kw)
    return ClassSession(**defaults)


@pytest.fixture()
def db():
    init_db()
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture()
def seeded(db):
    """Professor + one student + course + enrollment, faces enrolled."""
    prof = User(
        role=Role.professor, name="Prof T", email="prof@test.edu",
        password_hash=hash_password("prof12345"),
    )
    stu = User(
        role=Role.student, name="Stu T", email="stu@test.edu", roll_no="R1",
        password_hash=hash_password("student123"),
    )
    db.add_all([prof, stu])
    db.flush()
    course = Course(code="T-101", name="Test Course", professor_id=prof.id)
    db.add(course)
    db.flush()
    db.add(Enrollment(student_id=stu.id, course_id=course.id))
    db.commit()
    return {"prof": prof, "stu": stu, "course": course}
