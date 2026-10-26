"""Image utilities: decode, perceptual hash, blur/moire/EXIF anti-spoof checks."""
from __future__ import annotations

import io
from datetime import datetime, timezone

import cv2
import numpy as np
from PIL import Image


def decode_image(data: bytes) -> np.ndarray:
    """Decode uploaded bytes to a BGR array; raise ValueError when invalid."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        raise ValueError("invalid_image")
    return img


def dhash_hex(img_bgr: np.ndarray, size: int = 16) -> str:
    """64-char hex perceptual hash (difference hash) — robust to re-encoding."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (size + 1, size), interpolation=cv2.INTER_AREA)
    diff = small[:, 1:] > small[:, :-1]
    return "".join(f"{b:02x}" for b in np.packbits(diff.flatten()).tobytes())


def hamming(hex_a: str, hex_b: str) -> int:
    a = int(hex_a, 16)
    b = int(hex_b, 16)
    return (a ^ b).bit_count()


def blur_variance(img_bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def moire_score(img_bgr: np.ndarray) -> float:
    """Peak-to-median FFT ratio in the mid/high frequency ring.

    A photograph of a screen produces periodic moire stripes whose energy
    concentrates in isolated, strong frequency peaks — the max bin dwarfs the
    median of the ring (often >1000x). Natural panoramas keep a diffuse 1/f
    spectrum (~50-80). Returns the ratio; higher => more screen-like.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (512, 256), interpolation=cv2.INTER_AREA)
    spectrum = np.fft.fftshift(np.abs(np.fft.fft2(gray.astype(np.float32))))
    h, w = spectrum.shape
    cy, cx = h // 2, w // 2
    yy, xx = np.ogrid[:h, :w]
    radius = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    ring = spectrum[radius > 0.35 * min(cy, cx)]
    median = float(np.median(ring)) or 1.0
    return float(ring.max() / median)


def exif_capture_time(data: bytes) -> datetime | None:
    """Best-effort capture timestamp from EXIF (DateTimeOriginal)."""
    try:
        img = Image.open(io.BytesIO(data))
        exif = img.getexif()
        if not exif:
            return None
        dt_str = exif.get(36867)  # ExifIFD DateTimeOriginal
        if not dt_str:
            ifd = exif.get_ifd(0x8769)
            dt_str = ifd.get(36867) if ifd else None
        if not dt_str:
            return None
        return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
    except Exception:
        return None


def strip_metadata(data: bytes, fmt: str = "JPEG") -> bytes:
    """Re-encode the image without EXIF/metadata for storage."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    out = io.BytesIO()
    img.save(out, format=fmt, quality=92)
    return out.getvalue()
