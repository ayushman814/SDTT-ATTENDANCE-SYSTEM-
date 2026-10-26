from __future__ import annotations

import io

import numpy as np
from PIL import Image

from app.vision import analyze_classroom_image, strip_image_metadata


STAGE = {"x": 0.4, "y": 0.0, "width": 0.25, "height": 1.0}


def classroom_jpeg() -> bytes:
    rng = np.random.default_rng(8)
    pixels = rng.integers(45, 210, size=(900, 1600, 3), dtype=np.uint8)
    output = io.BytesIO()
    Image.fromarray(pixels, "RGB").save(output, format="JPEG", quality=90)
    return output.getvalue()


def three_people(_image: np.ndarray) -> list[dict[str, float]]:
    return [
        {"x1": 770, "y1": 120, "x2": 850, "y2": 500, "confidence": 0.92},
        {"x1": 90, "y1": 180, "x2": 180, "y2": 550, "confidence": 0.88},
        {"x1": 330, "y1": 200, "x2": 400, "y2": 520, "confidence": 0.81},
    ]


def test_verifies_only_configured_person_scene_evidence():
    result = analyze_classroom_image(
        classroom_jpeg(), stage_region=STAGE, minimum_people=2, detector=three_people
    )
    assert result["status"] == "VERIFIED"
    assert result["quality"]["passed"] is True
    assert result["detected_people"] == 3
    assert result["nearby_people"] == 2
    assert result["stage_person_detected"] is True
    assert "not identified" in result["limitations"]


def test_quality_failure_rejects_portrait_or_selfie_framing():
    portrait = Image.new("RGB", (500, 900), "gray")
    buffer = io.BytesIO()
    portrait.save(buffer, format="JPEG")
    result = analyze_classroom_image(
        buffer.getvalue(), stage_region=STAGE, detector=three_people
    )
    assert result["status"] == "REJECTED"
    assert result["error_code"] == "image_quality"
    assert result["quality"]["checks"]["wide_landscape_framing"] is False


def test_missing_stage_region_never_auto_verifies():
    result = analyze_classroom_image(
        classroom_jpeg(), stage_region=None, detector=three_people
    )
    assert result["status"] == "NEEDS_REVIEW"
    assert result["error_code"] == "stage_region_unconfigured"


def test_detector_failure_needs_review_not_present():
    def broken(_image: np.ndarray):
        raise RuntimeError("detector unavailable")

    result = analyze_classroom_image(
        classroom_jpeg(), stage_region=STAGE, detector=broken
    )
    assert result["status"] == "NEEDS_REVIEW"
    assert result["error_code"] == "detector_unavailable"
    assert result["stage_person_detected"] is None


def test_corrupt_bytes_are_rejected():
    result = analyze_classroom_image(
        b"not an image", stage_region=STAGE, detector=three_people
    )
    assert result["status"] == "REJECTED"
    assert result["error_code"] == "invalid_image"


def test_storage_copy_drops_exif_metadata():
    image = Image.new("RGB", (1600, 900), (90, 120, 140))
    exif = Image.Exif()
    exif[270] = "private device note"
    exif[274] = 6
    original = io.BytesIO()
    image.save(original, format="JPEG", exif=exif)

    sanitized = strip_image_metadata(original.getvalue())
    with Image.open(io.BytesIO(sanitized)) as result:
        assert result.size == (900, 1600)
        assert 270 not in result.getexif()
        assert 274 not in result.getexif()
