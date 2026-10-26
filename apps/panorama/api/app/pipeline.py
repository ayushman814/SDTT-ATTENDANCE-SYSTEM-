"""The attendance verification pipeline — the core of the product.

Every check returns a concrete verdict; the first failure produces a REJECTED
submission with a specific reason, a borderline AI score produces
PENDING_REVIEW for the professor, and only a fully clean pass yields PRESENT.
All thresholds come from `panorama.config.yaml`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Protocol

import numpy as np

from . import imaging
from .models import ClassSession, SubmissionStatus, User
from .vision import Face, FaceEngine


class Engine(Protocol):
    def detect(self, image_bgr: np.ndarray) -> list[Face]: ...

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float: ...


REASONS = {
    "window_closed": "The attendance window is closed.",
    "invalid_image": "The file is not a readable image.",
    "not_a_panorama": "The photo is not a panorama — sweep the camera across the room.",
    "duplicate_image": "This photo was already submitted (same or near-identical image).",
    "image_too_blurry": "The photo is too blurry to verify.",
    "stale_capture": "The photo's EXIF timestamp is too old — retake it now.",
    "screen_moire_suspect": "The photo looks like a picture of a screen — review needed.",
    "no_face_detected": "No face detected in the panorama.",
    "self_not_found": "Your face was not found in the panorama.",
    "self_match_borderline": "Your face match is uncertain — review needed.",
    "lecturer_not_found": "The lecturer was not found in the panorama.",
    "lecturer_match_borderline": "The lecturer match is uncertain — review needed.",
    "no_neighbouring_student": "No neighbouring student detected beside you.",
    "location_missing": "Location is required for this session but was not provided.",
    "out_of_range": "You are outside the allowed area for this class.",
}

PASS = "pass"


@dataclass
class Verdict:
    status: SubmissionStatus
    reason: str | None
    scores: dict[str, Any] = field(default_factory=dict)


def _fail(reason: str, scores: dict[str, Any]) -> Verdict:
    return Verdict(SubmissionStatus.rejected, reason, scores)


def _review(reason: str, scores: dict[str, Any]) -> Verdict:
    return Verdict(SubmissionStatus.pending_review, reason, scores)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def verify_submission(
    image_bgr: np.ndarray,
    raw_bytes: bytes,
    *,
    session: ClassSession,
    student_embedding: np.ndarray | None,
    professor_embedding: np.ndarray | None,
    prior_hashes: Iterable[str],
    engine: Engine,
    cfg: dict,
    geo: tuple[float, float] | None = None,
    now: datetime | None = None,
    selfie_bgr: np.ndarray | None = None,
) -> Verdict:
    now = now or datetime.now(timezone.utc)
    vcfg = cfg["verification"]
    spoof = cfg["anti_spoof"]
    scores: dict[str, Any] = {}

    # 1 — Timing (server clock only)
    start, end = session.start_time, session.end_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    scores["received_at"] = now.isoformat()
    if not (start <= now <= end):
        return _fail("window_closed", scores)

    # 2 — Panorama ratio
    h, w = image_bgr.shape[:2]
    aspect = w / max(h, 1)
    scores["aspect_ratio"] = round(aspect, 3)
    if aspect < vcfg["panorama_min_ratio"]:
        return _fail("not_a_panorama", scores)

    # 3 — Duplicate perceptual hash (across all students and sessions)
    phash = imaging.dhash_hex(image_bgr)
    scores["phash"] = phash
    min_dist = None
    for old in prior_hashes:
        if not old:
            continue
        d = imaging.hamming(phash, old)
        min_dist = d if min_dist is None else min(min_dist, d)
    scores["phash_min_distance"] = min_dist
    if min_dist is not None and min_dist <= vcfg["phash_hamming_max"]:
        return _fail("duplicate_image", scores)

    # 4 — Blur
    blur = imaging.blur_variance(image_bgr)
    scores["blur_variance"] = round(blur, 2)
    if blur < spoof["blur_min_variance"]:
        return _fail("image_too_blurry", scores)

    # 5 — EXIF freshness (missing EXIF is tolerated: many cameras strip it)
    capture_time = imaging.exif_capture_time(raw_bytes)
    if capture_time is not None:
        age_min = (now - capture_time).total_seconds() / 60.0
        scores["exif_age_minutes"] = round(age_min, 2)
        if age_min > spoof["exif_max_age_minutes"] or age_min < -5:
            return _fail("stale_capture", scores)
    else:
        scores["exif_age_minutes"] = None

    # 6 — Screen-moire heuristic (weak signal: borderline → human review)
    moire = imaging.moire_score(image_bgr)
    scores["moire_score"] = round(moire, 4)
    if moire > spoof["moire_peak_ratio_max"]:
        return _review("screen_moire_suspect", scores)

    self_thr = vcfg["self_match_threshold"]
    lec_thr = vcfg["lecturer_match_threshold"]
    margin = vcfg["review_margin"]

    # 6b — Live-capture selfie: anti-spoof + the self-identity anchor.
    #      (live mode: front-cam frame, so the student need not be in the sweep)
    self_face: Face | None = None
    self_sim = -1.0
    if selfie_bgr is not None:
        scores["selfie_blur_variance"] = round(imaging.blur_variance(selfie_bgr), 2)
        if scores["selfie_blur_variance"] < spoof["blur_min_variance"]:
            return _fail("image_too_blurry", scores)
        scores["selfie_moire_score"] = round(imaging.moire_score(selfie_bgr), 4)
        if scores["selfie_moire_score"] > spoof["moire_peak_ratio_max"]:
            return _review("screen_moire_suspect", scores)
        selfie_faces = engine.detect(selfie_bgr)
        scores["selfie_faces_detected"] = len(selfie_faces)
        if student_embedding is not None:
            for f in selfie_faces:
                s = engine.cosine(f.embedding, student_embedding)
                if s > self_sim:
                    self_sim = s
    scores["capture_mode"] = "live" if selfie_bgr is not None else "upload"

    # 7 — Face detection on the panorama
    faces = engine.detect(image_bgr)
    scores["faces_detected"] = len(faces)
    if not faces and selfie_bgr is None:
        return _fail("no_face_detected", scores)

    # 8 — Self identity: from the selfie in live mode, else from the panorama
    if selfie_bgr is None and student_embedding is not None:
        for f in faces:
            s = engine.cosine(f.embedding, student_embedding)
            if s > self_sim:
                self_sim, self_face = s, f
    elif selfie_bgr is None:
        self_face = None
    else:
        # live mode: locate a self-matching face in the sweep too, if present
        # (student may appear in their own panorama) — used as the neighbour anchor
        best = (-1.0, None)
        if student_embedding is not None:
            for f in faces:
                s = engine.cosine(f.embedding, student_embedding)
                if s > best[0]:
                    best = (s, f)
        if best[1] is not None and best[0] >= self_thr:
            self_face = best[1]
    scores["self_similarity"] = round(self_sim, 4)
    if self_sim < self_thr - margin:
        return _fail("self_not_found", scores)
    if self_sim < self_thr:
        return _review("self_match_borderline", scores)

    # 9 — Lecturer in the panorama
    lec_face: Face | None = None
    lec_sim = -1.0
    if professor_embedding is not None:
        for f in faces:
            if f is self_face:
                continue
            s = engine.cosine(f.embedding, professor_embedding)
            if s > lec_sim:
                lec_sim, lec_face = s, f
    scores["lecturer_similarity"] = round(lec_sim, 4)
    if lec_face is None or lec_sim < lec_thr - margin:
        return _fail("lecturer_not_found", scores)
    if lec_sim < lec_thr:
        return _review("lecturer_match_borderline", scores)

    # 10 — Neighbouring student(s): other faces, not the lecturer and not a
    #      duplicate of the student's own face. In upload mode they must sit
    #      beside the student's face; in live mode (self comes from the selfie)
    #      any additional distinct face counts, anchored to the self face when
    #      the student is also visible in the sweep.
    sx = self_face.center[0] if self_face is not None else None
    neighbours = 0
    for f in faces:
        if f is self_face or f is lec_face:
            continue
        if sx is not None:
            fx, _ = f.center
            dist_frac = abs(fx - sx) / w
            if not (vcfg["neighbour_min_fraction"] <= dist_frac <= vcfg["neighbour_max_fraction"]):
                continue
        if student_embedding is not None and engine.cosine(f.embedding, student_embedding) >= self_thr:
            continue  # it's the same person photographed twice — not a neighbour
        neighbours += 1
    scores["neighbours_found"] = neighbours
    if neighbours < vcfg["min_neighbours"]:
        return _fail("no_neighbouring_student", scores)

    # 11 — Optional geolocation (professor enables per session)
    if session.geo_lat is not None and session.geo_lng is not None:
        if geo is None:
            return _fail("location_missing", scores)
        dist = haversine_m(geo[0], geo[1], session.geo_lat, session.geo_lng)
        scores["geo_distance_m"] = round(dist, 1)
        if dist > (session.geo_radius_m or cfg["geo"]["radius_default_m"]):
            return _fail("out_of_range", scores)

    return Verdict(SubmissionStatus.present, PASS, scores)
