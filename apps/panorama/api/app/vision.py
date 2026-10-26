"""Face engine: OpenCV YuNet detection + SFace recognition embeddings.

Models are downloaded by `scripts/download_models.py` into `models/` and loaded
lazily on first use so tests and seeding can inject a lighter engine if needed.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .config import MODELS_DIR

DETECTOR_FILE = "face_detection_yunet_2023mar.onnx"
RECOGNIZER_FILE = "face_recognition_sface_2021dec.onnx"


@dataclass
class Face:
    box: tuple[int, int, int, int]  # x, y, w, h
    score: float
    embedding: np.ndarray  # (128,)

    @property
    def center(self) -> tuple[float, float]:
        x, y, w, h = self.box
        return x + w / 2.0, y + h / 2.0


class FaceEngine:
    """Detect faces and compute SFace embeddings (cosine-similarity matched)."""

    def __init__(self, models_dir: Path = MODELS_DIR, det_score: float = 0.6) -> None:
        self._det_path = models_dir / DETECTOR_FILE
        self._rec_path = models_dir / RECOGNIZER_FILE
        self._det_score = det_score
        if not self._det_path.exists() or not self._rec_path.exists():
            raise FileNotFoundError(
                f"Vision models missing under {models_dir}. "
                "Run `python scripts/download_models.py` first."
            )
        self._recognizer = cv2.FaceRecognizerSF_create(str(self._rec_path), "")

    def detect(self, image_bgr: np.ndarray) -> list[Face]:
        h, w = image_bgr.shape[:2]
        detector = cv2.FaceDetectorYN_create(
            str(self._det_path), "", (w, h), self._det_score
        )
        _, raw = detector.detect(image_bgr)
        if raw is None or len(raw) == 0:
            return []
        out: list[Face] = []
        for row in raw:
            aligned = self._recognizer.alignCrop(image_bgr, row)
            emb = self._recognizer.feature(aligned).astype(np.float32).reshape(-1)
            out.append(
                Face(
                    box=tuple(int(v) for v in row[:4]),
                    score=float(row[-1]),
                    embedding=emb,
                )
            )
        return out

    def embed_largest(self, image_bgr: np.ndarray) -> np.ndarray:
        faces = self.detect(image_bgr)
        if not faces:
            raise ValueError("no_face_detected")
        largest = max(faces, key=lambda f: f.box[2] * f.box[3])
        return largest.embedding

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        return float(np.dot(a, b) / denom)


_engine: FaceEngine | None = None
_engine_lock = threading.Lock()


def get_engine() -> FaceEngine:
    """Process-wide lazy singleton so the 37MB recognizer loads once."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = FaceEngine()
    return _engine


def set_engine(engine: FaceEngine | None) -> None:
    global _engine
    _engine = engine
