"""Image utilities: decode, perceptual hash, blur/moire/EXIF anti-spoof checks."""
from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

import cv2
import numpy as np
from PIL import Image


def decoded_size(data: bytes) -> tuple[int, int] | None:
    """(width, height) read from the image header without decoding pixels."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            return img.size
    except Exception:
        return None


def decode_image(data: bytes, max_pixels: int | None = None) -> np.ndarray:
    """Decode uploaded bytes to a BGR array; raise ValueError when invalid.

    Checks the declared dimensions first: a small compressed file can decode
    to a huge bitmap (decompression bomb), so oversized uploads are rejected
    before cv2 allocates them.
    """
    if max_pixels is not None:
        size = decoded_size(data)
        if size is not None and size[0] * size[1] > max_pixels:
            raise ValueError("image_too_large")
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
    """Best-effort capture timestamp from EXIF (DateTimeOriginal + offset).

    DateTimeOriginal alone is timezone-naive — assuming UTC would misclassify
    fresh photos from cameras in other zones — so an offset tag is required
    to produce a comparable instant; without one we return None (no check).
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            exif = img.getexif()
            if not exif:
                return None
            ifd = exif.get_ifd(0x8769)
            dt_str = exif.get(36867) or (ifd.get(36867) if ifd else None)
            offset_str = exif.get(36881) or (ifd.get(36881) if ifd else None)
        if not dt_str or not offset_str:
            return None
        sign = 1 if offset_str.startswith("+") else -1
        oh, om = int(offset_str[1:3]), int(offset_str[4:6])
        tz = timezone(sign * timedelta(hours=oh, minutes=om))
        return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(tzinfo=tz)
    except Exception:
        return None


def strip_metadata(data: bytes, fmt: str = "JPEG") -> bytes:
    """Re-encode the image without EXIF/metadata for storage."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    out = io.BytesIO()
    img.save(out, format=fmt, quality=92)
    return out.getvalue()


def stitch_frames(frames: list[np.ndarray], target_h: int = 640) -> np.ndarray:
    """Turn camera sweep frames into one panorama image.

    Tries cv2.Stitcher (proper panorama registration) first; when it fails —
    which is common with sparse/lofi frames — falls back to a horizontal
    concat of the frames normalized to a common height, which still gives a
    wide sweep image the face pipeline can verify.
    """
    if not frames:
        raise ValueError("no frames")
    if len(frames) == 1:
        return frames[0]

    scaled = []
    for f in frames:
        h, w = f.shape[:2]
        s = target_h / h
        scaled.append(cv2.resize(f, (max(1, int(w * s)), target_h)))
    try:
        stitcher = cv2.Stitcher.create(cv2.Stitcher_SCANS)
        ok, pano = stitcher.stitch(scaled)
        # A genuine sweep stitches wide; a near-square result means the frames
        # barely moved — concat so the pipeline's ratio check reflects that.
        if ok == cv2.Stitcher_OK and pano is not None and pano.size:
            h, w = pano.shape[:2]
            if w / max(h, 1) >= 1.8:
                return pano
    except Exception:
        pass
    return cv2.hconcat(scaled)


def encode_jpeg(img_bgr: np.ndarray, quality: int = 90) -> bytes:
    ok, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("encode_failed")
    return buf.tobytes()
