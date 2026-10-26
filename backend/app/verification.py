"""Optional identity and liveness primitives for the attendance workflow.

The service deliberately fails closed when the configured face model or key is
missing.  There is no fallback that turns an unavailable model into a passing
verification result.
"""
from __future__ import annotations

import base64
import io
import os
from typing import Any, Iterable

import cv2
import numpy as np
from cryptography.fernet import Fernet, InvalidToken
from PIL import Image, UnidentifiedImageError


class VerificationUnavailable(RuntimeError):
    """The configured identity pipeline cannot run in this environment."""


class VerificationInputError(ValueError):
    """The submitted image sequence is not suitable for verification."""


def _image_array(image_bytes: bytes) -> np.ndarray:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.verify()
        with Image.open(io.BytesIO(image_bytes)) as image:
            return np.asarray(image.convert("RGB"))
    except (UnidentifiedImageError, OSError) as exc:
        raise VerificationInputError("A submitted frame is not a readable image.") from exc


def _face_detector() -> cv2.CascadeClassifier:
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if detector.empty():
        raise VerificationUnavailable("OpenCV face detector is unavailable.")
    return detector


def detect_single_face(image_bytes: bytes) -> dict[str, float]:
    """Return one face box, or fail when zero/multiple faces are visible."""
    rgb = _image_array(image_bytes)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    faces = _face_detector().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        raise VerificationInputError("No face was visible. Centre your face and try again.")
    if len(faces) > 1:
        raise VerificationInputError("More than one face was visible. Only the enrolled student may be in frame.")
    x, y, width, height = [float(value) for value in faces[0]]
    return {"x": x, "y": y, "width": width, "height": height}


def _deepface_embedding(image_bytes: bytes) -> list[float]:
    try:
        from deepface import DeepFace  # type: ignore
    except Exception as exc:  # pragma: no cover - dependency is optional in unit tests
        raise VerificationUnavailable(
            "The face embedding model is not installed. Install the approved DeepFace model before enabling enrollment."
        ) from exc
    try:
        result = DeepFace.represent(
            img_path=_image_array(image_bytes),
            model_name=os.getenv("ATTENDANCE_FACE_MODEL", "Facenet512"),
            detector_backend=os.getenv("ATTENDANCE_FACE_DETECTOR", "opencv"),
            enforce_detection=True,
            align=True,
        )
        embedding = result[0]["embedding"] if isinstance(result, list) else result["embedding"]
        return [float(value) for value in embedding]
    except VerificationInputError:
        raise
    except Exception as exc:
        raise VerificationInputError("The face could not be extracted reliably. Retake the image in good light.") from exc


def _fernet() -> Fernet:
    key = os.getenv("ATTENDANCE_BIOMETRIC_ENCRYPTION_KEY", "").strip()
    if not key:
        raise VerificationUnavailable("ATTENDANCE_BIOMETRIC_ENCRYPTION_KEY is not configured.")
    try:
        return Fernet(key.encode("ascii"))
    except Exception as exc:
        raise VerificationUnavailable("ATTENDANCE_BIOMETRIC_ENCRYPTION_KEY is invalid.") from exc


def encrypt_embedding(embedding: Iterable[float]) -> str:
    payload = ",".join(f"{float(value):.10g}" for value in embedding).encode("utf-8")
    return _fernet().encrypt(payload).decode("ascii")


def decrypt_embedding(value: str) -> list[float]:
    try:
        payload = _fernet().decrypt(value.encode("ascii")).decode("utf-8")
        return [float(item) for item in payload.split(",") if item]
    except (InvalidToken, ValueError, UnicodeError) as exc:
        raise VerificationUnavailable("The stored face representation could not be decrypted.") from exc


def enroll_face(image_bytes: bytes) -> str:
    detect_single_face(image_bytes)
    return encrypt_embedding(_deepface_embedding(image_bytes))


def compare_face(image_bytes: bytes, encrypted_embedding: str) -> dict[str, Any]:
    detect_single_face(image_bytes)
    candidate = np.asarray(_deepface_embedding(image_bytes), dtype=np.float32)
    enrolled = np.asarray(decrypt_embedding(encrypted_embedding), dtype=np.float32)
    if candidate.size == 0 or candidate.size != enrolled.size:
        raise VerificationUnavailable("The enrolled and submitted face models are incompatible.")
    denominator = float(np.linalg.norm(candidate) * np.linalg.norm(enrolled))
    if denominator == 0:
        raise VerificationInputError("The submitted face representation is unusable.")
    similarity = float(np.dot(candidate, enrolled) / denominator)
    threshold = float(os.getenv("ATTENDANCE_FACE_SIMILARITY_THRESHOLD", "0.78"))
    if not 0 < threshold < 1:
        raise VerificationUnavailable("ATTENDANCE_FACE_SIMILARITY_THRESHOLD must be between 0 and 1.")
    return {
        "status": "VERIFIED" if similarity >= threshold else "REJECTED",
        "similarity": round(similarity, 5),
        "threshold": threshold,
        "reason": "Face similarity met the configured threshold." if similarity >= threshold else "Face similarity was below the configured threshold.",
    }


def evaluate_liveness(frames: list[bytes]) -> dict[str, Any]:
    """Evaluate guided movement and blink evidence from real camera frames.

    This is a challenge-response heuristic, not a certified anti-spoofing
    system.  It requires both horizontal movement and an eye-state transition;
    missing evidence is reported as INCONCLUSIVE rather than passed.
    """
    if len(frames) < 4:
        return {"status": "INCONCLUSIVE", "reason": "Capture at least four guided frames.", "head_turn": False, "blink": False}
    face_detector = _face_detector()
    eye_detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    centres: list[float] = []
    widths: list[float] = []
    eye_counts: list[int] = []
    try:
        for raw in frames:
            rgb = _image_array(raw)
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            faces = face_detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
            if len(faces) != 1:
                return {"status": "INCONCLUSIVE", "reason": "Every challenge frame must contain exactly one visible face.", "head_turn": False, "blink": False}
            x, y, width, height = [int(value) for value in faces[0]]
            centres.append((x + width / 2) / max(gray.shape[1], 1))
            widths.append(width / max(gray.shape[1], 1))
            eyes = eye_detector.detectMultiScale(gray[y : y + height, x : x + width], scaleFactor=1.1, minNeighbors=4, minSize=(12, 12))
            eye_counts.append(len(eyes))
    except VerificationInputError as exc:
        return {"status": "INCONCLUSIVE", "reason": str(exc), "head_turn": False, "blink": False}
    head_turn = max(centres) - min(centres) >= 0.08 or max(widths) - min(widths) >= 0.12
    blink = any(count == 0 for count in eye_counts) and any(count >= 1 for count in eye_counts)
    if head_turn and blink:
        return {"status": "VERIFIED", "reason": "Guided head movement and an eye-state transition were observed.", "head_turn": True, "blink": True}
    return {
        "status": "INCONCLUSIVE",
        "reason": "The required head movement and blink evidence was not both observed. Retake the guided sequence.",
        "head_turn": head_turn,
        "blink": blink,
    }
