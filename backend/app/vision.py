"""Classroom image checks using YOLO person detection.

The detector only establishes visible-person evidence. It does not identify the
submitter, identify students or lecturers, or prove that a stage is present.
"""
from __future__ import annotations

import io
import os
import threading
from typing import Any, Callable, Iterable

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
PERSON_CLASS_ID = 0  # COCO person class
MODEL_NAME = os.getenv("ATTENDANCE_PERSON_MODEL", "yolo11n.pt")
MIN_WIDTH = int(os.getenv("ATTENDANCE_MIN_IMAGE_WIDTH", "1000"))
MIN_HEIGHT = int(os.getenv("ATTENDANCE_MIN_IMAGE_HEIGHT", "500"))
MIN_ASPECT_RATIO = float(os.getenv("ATTENDANCE_MIN_IMAGE_ASPECT_RATIO", "1.7"))
MIN_BLUR_VARIANCE = float(os.getenv("ATTENDANCE_MIN_BLUR_VARIANCE", "18"))
MIN_BRIGHTNESS = float(os.getenv("ATTENDANCE_MIN_BRIGHTNESS", "35"))
MAX_BRIGHTNESS = float(os.getenv("ATTENDANCE_MAX_BRIGHTNESS", "235"))
MIN_PERSON_CONFIDENCE = float(os.getenv("ATTENDANCE_PERSON_MIN_CONFIDENCE", "0.35"))

_model: Any = None
_model_lock = threading.Lock()


def _get_model() -> Any:
    """Load a pretrained Ultralytics YOLO model once per process."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from ultralytics import YOLO

                _model = YOLO(MODEL_NAME)
    return _model


def strip_image_metadata(image_bytes: bytes) -> bytes:
    """Re-encode an accepted raster image without embedded metadata."""
    with Image.open(io.BytesIO(image_bytes)) as source:
        image_format = source.format
        if image_format not in ALLOWED_FORMATS:
            raise ValueError("Unsupported image format")
        pixels = ImageOps.exif_transpose(source)
        pixels.load()
        pixels = pixels.copy()
    output = io.BytesIO()
    save_options: dict[str, Any] = {}
    if image_format == "JPEG":
        save_options.update(quality=95, optimize=True, exif=b"")
    elif image_format == "WEBP":
        save_options.update(quality=95, method=4, exif=b"")
    pixels.save(output, format=image_format, **save_options)
    return output.getvalue()


def _yolo_detect(rgb: np.ndarray) -> list[dict[str, float]]:
    results = _get_model().predict(
        source=rgb,
        classes=[PERSON_CLASS_ID],
        conf=MIN_PERSON_CONFIDENCE,
        imgsz=640,
        verbose=False,
    )
    if not results:
        return []
    boxes = getattr(results[0], "boxes", None)
    if boxes is None:
        return []
    xyxy = boxes.xyxy.cpu().numpy()
    confidences = boxes.conf.cpu().numpy()
    return [
        {
            "x1": float(box[0]),
            "y1": float(box[1]),
            "x2": float(box[2]),
            "y2": float(box[3]),
            "confidence": float(confidence),
        }
        for box, confidence in zip(xyxy, confidences)
    ]


def _in_region(detection: dict[str, float], region: dict[str, float], width: int, height: int) -> bool:
    center_x = (detection["x1"] + detection["x2"]) / 2 / width
    center_y = (detection["y1"] + detection["y2"]) / 2 / height
    return (
        region["x"] <= center_x <= region["x"] + region["width"]
        and region["y"] <= center_y <= region["y"] + region["height"]
    )


def _result(
    status: str,
    explanation: str,
    *,
    quality: dict[str, Any],
    width: int | None = None,
    height: int | None = None,
    detections: Iterable[dict[str, float]] = (),
    stage_detected: bool | None = None,
    nearby_count: int | None = None,
    error_code: str | None = None,
) -> dict[str, Any]:
    people = list(detections)
    return {
        "status": status,
        "explanation": explanation,
        "quality": quality,
        "width": width,
        "height": height,
        "detected_people": len(people),
        "nearby_people": nearby_count,
        "stage_person_detected": stage_detected,
        "person_confidences": [round(float(p["confidence"]), 3) for p in people],
        "error_code": error_code,
        "limitations": "Visible people are not identified. This check cannot prove that the submitter, lecturer, or registered students are physically present, and a person in the configured region is not proof of a stage.",
    }


def analyze_classroom_image(
    image_bytes: bytes,
    *,
    stage_region: dict[str, float] | None,
    minimum_people: int = 2,
    detector: Callable[[np.ndarray], list[dict[str, float]]] | None = None,
) -> dict[str, Any]:
    """Validate an image and assess person evidence in a configured stage ROI.

    `stage_region` uses normalized x/y/width/height values in [0, 1]. When the
    stage region is not configured, no automatic verification is permitted.
    Inject `detector` in tests; production uses the pretrained YOLO model.
    """
    quality: dict[str, Any] = {"passed": False, "checks": {}}
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            image_format = source.format
            width, height = source.size
            if image_format not in ALLOWED_FORMATS:
                raise ValueError("Unsupported image format. Upload a JPEG, PNG, or WebP image.")
            if width * height > 40_000_000:
                raise ValueError("Image dimensions are too large for safe analysis.")
            source.verify()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return _result(
            "REJECTED",
            str(exc) or "The uploaded file is not a readable image. Retake or upload a valid image.",
            quality=quality,
            error_code="invalid_image",
        )

    rgb = np.asarray(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    brightness = float(np.mean(gray))
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    aspect_ratio = width / max(height, 1)
    quality["format"] = image_format
    quality["brightness_mean"] = round(brightness, 2)
    quality["blur_variance"] = round(blur_variance, 2)
    quality["aspect_ratio"] = round(aspect_ratio, 3)
    quality["checks"] = {
        "minimum_resolution": width >= MIN_WIDTH and height >= MIN_HEIGHT,
        "wide_landscape_framing": aspect_ratio >= MIN_ASPECT_RATIO,
        "brightness": MIN_BRIGHTNESS <= brightness <= MAX_BRIGHTNESS,
        "sharpness": blur_variance >= MIN_BLUR_VARIANCE,
    }
    quality["passed"] = all(quality["checks"].values())
    if not quality["passed"]:
        reasons = []
        if not quality["checks"]["minimum_resolution"]:
            reasons.append(f"use an image at least {MIN_WIDTH}×{MIN_HEIGHT} pixels")
        if not quality["checks"]["wide_landscape_framing"]:
            reasons.append("use a wide classroom panorama, not a portrait or selfie")
        if not quality["checks"]["brightness"]:
            reasons.append("the image is too dark or overexposed")
        if not quality["checks"]["sharpness"]:
            reasons.append("the image is too blurry")
        return _result(
            "REJECTED",
            "Image quality check failed: " + "; ".join(reasons) + ". Retake the image.",
            quality=quality,
            width=width,
            height=height,
            error_code="image_quality",
        )

    if not stage_region:
        return _result(
            "NEEDS_REVIEW",
            "Image quality passed, but this session has no configured stage region. Ask the professor to review the image.",
            quality=quality,
            width=width,
            height=height,
            error_code="stage_region_unconfigured",
        )

    try:
        detections = (detector or _yolo_detect)(rgb)
    except Exception:
        # Fail closed: keep the submission reviewable, never auto-mark present.
        return _result(
            "NEEDS_REVIEW",
            "The person-detection service is unavailable. The image was not automatically verified; a professor must review it.",
            quality=quality,
            width=width,
            height=height,
            error_code="detector_unavailable",
        )

    people = [p for p in detections if float(p.get("confidence", 0)) >= MIN_PERSON_CONFIDENCE]
    stage_people = [p for p in people if _in_region(p, stage_region, width, height)]
    nearby_people = [p for p in people if not _in_region(p, stage_region, width, height)]
    stage_detected = bool(stage_people)

    if len(nearby_people) < minimum_people:
        return _result(
            "REJECTED",
            f"Only {len(nearby_people)} visible person(s) were detected outside the configured stage region; at least {minimum_people} are required. Retake a wider classroom view.",
            quality=quality,
            width=width,
            height=height,
            detections=people,
            stage_detected=stage_detected,
            nearby_count=len(nearby_people),
            error_code="insufficient_nearby_people",
        )
    if not stage_detected:
        return _result(
            "NEEDS_REVIEW",
            "Nearby people were detected, but no person was detected inside the professor-configured stage region. A professor must review the image.",
            quality=quality,
            width=width,
            height=height,
            detections=people,
            stage_detected=False,
            nearby_count=len(nearby_people),
            error_code="no_person_in_stage_region",
        )

    return _result(
        "VERIFIED",
        f"Image quality passed; {len(nearby_people)} person(s) were detected outside the configured stage region and a person was detected inside it. This is scene evidence only, not identity verification.",
        quality=quality,
        width=width,
        height=height,
        detections=people,
        stage_detected=True,
        nearby_count=len(nearby_people),
    )
