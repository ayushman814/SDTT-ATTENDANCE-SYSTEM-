"""Unit tests for the verification pipeline — pass plus each failure reason.

Runs the real OpenCV YuNet+SFace engine against synthetic panoramas composed
from the demo portraits in seed_faces/.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from app import imaging
from app.models import SubmissionStatus
from app.pipeline import verify_submission
from conftest import make_session


def encode(img: np.ndarray, fmt=".jpg") -> bytes:
    ok, buf = cv2.imencode(fmt, img)
    assert ok
    return buf.tobytes()


# the standard "good" panorama: student1 (self) + student2 (neighbour) + professor (lecturer)
def good_pano(make_panorama):
    return make_panorama(
        [
            ("student1.png", 300, 280),
            ("student2.png", 1050, 280),
            ("professor.png", 1900, 300),
        ]
    )


def verify(img, engine, embeddings, cfg_obj, **kw):
    return verify_submission(
        img,
        encode(img),
        session=kw.pop("session", make_session()),
        student_embedding=kw.pop("student_embedding", embeddings["student1"]),
        professor_embedding=kw.pop("professor_embedding", embeddings["professor"]),
        prior_hashes=kw.pop("prior_hashes", []),
        engine=engine,
        cfg=cfg_obj,
        **kw,
    )


def test_pass_marks_present(make_panorama, engine, embeddings, cfg_obj):
    v = verify(good_pano(make_panorama), engine, embeddings, cfg_obj)
    assert v.status == SubmissionStatus.present
    assert v.reason == "pass"
    assert v.scores["faces_detected"] >= 3
    assert v.scores["neighbours_found"] >= 1


def test_window_closed(make_panorama, engine, embeddings, cfg_obj):
    import datetime as dt

    past = make_session(
        end_time=dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)
    )
    v = verify(good_pano(make_panorama), engine, embeddings, cfg_obj, session=past)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "window_closed"


def test_not_a_panorama(make_panorama, engine, embeddings, cfg_obj):
    square = make_panorama([("student1.png", 300, 280)], size=(900, 900))
    v = verify(square, engine, embeddings, cfg_obj)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "not_a_panorama"


def test_duplicate_image(make_panorama, engine, embeddings, cfg_obj):
    pano = good_pano(make_panorama)
    prior = [imaging.dhash_hex(pano)]
    v = verify(pano, engine, embeddings, cfg_obj, prior_hashes=prior)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "duplicate_image"


def test_blurry_rejected(make_panorama, engine, embeddings, cfg_obj):
    pano = good_pano(make_panorama)
    blurred = cv2.GaussianBlur(pano, (61, 61), 0)
    v = verify(blurred, engine, embeddings, cfg_obj)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "image_too_blurry"


def test_no_face_detected(engine, embeddings, cfg_obj):
    rng = np.random.default_rng(3)
    img = rng.integers(110, 190, (800, 2400, 3), dtype=np.uint8)
    img = cv2.GaussianBlur(img, (31, 31), 0)
    noise = rng.integers(-25, 25, (800, 2400, 3), dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    v = verify(img, engine, embeddings, cfg_obj)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "no_face_detected"


def test_self_not_found(make_panorama, engine, embeddings, cfg_obj):
    # panorama contains only students; the "self" being checked is the
    # professor's embedding — every similarity lands well below the band.
    pano = make_panorama(
        [
            ("student4.png", 300, 280),
            ("student2.png", 1050, 280),
            ("student3.png", 1900, 300),
        ]
    )
    v = verify(
        pano, engine, embeddings, cfg_obj,
        student_embedding=embeddings["professor"],
        professor_embedding=embeddings["professor"],
    )
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "self_not_found"


def test_lecturer_not_found(make_panorama, engine, embeddings, cfg_obj):
    pano = make_panorama(
        [
            ("student1.png", 300, 280),
            ("student2.png", 1050, 280),
            ("student3.png", 1900, 300),
        ]
    )
    v = verify(pano, engine, embeddings, cfg_obj)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "lecturer_not_found"


def test_no_neighbouring_student(make_panorama, engine, embeddings, cfg_obj):
    # self + lecturer, nobody beside the student
    pano = make_panorama(
        [("student1.png", 300, 280), ("professor.png", 1900, 300)]
    )
    v = verify(pano, engine, embeddings, cfg_obj)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "no_neighbouring_student"


def test_self_borderline_pending_review(make_panorama, engine, embeddings, cfg_obj):
    # student5 submits a panorama containing student1 — their faces are
    # similar enough to land inside the review margin, not a clean match.
    pano = make_panorama(
        [
            ("student1.png", 300, 280),
            ("student2.png", 1050, 280),
            ("professor.png", 1900, 300),
        ]
    )
    v = verify(pano, engine, embeddings, cfg_obj, student_embedding=embeddings["student5"])
    assert v.status == SubmissionStatus.pending_review
    assert v.reason == "self_match_borderline"


def test_geo_out_of_range(make_panorama, engine, embeddings, cfg_obj):
    s = make_session(geo_lat=19.0760, geo_lng=72.8777, geo_radius_m=200)
    v = verify(
        good_pano(make_panorama), engine, embeddings, cfg_obj,
        session=s, geo=(19.1363, 72.8296),  # ~8 km away
    )
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "out_of_range"


def test_geo_within_range(make_panorama, engine, embeddings, cfg_obj):
    s = make_session(geo_lat=19.0760, geo_lng=72.8777, geo_radius_m=200)
    v = verify(
        good_pano(make_panorama), engine, embeddings, cfg_obj,
        session=s, geo=(19.0761, 72.8778),
    )
    assert v.status == SubmissionStatus.present


def test_geo_missing_when_required(make_panorama, engine, embeddings, cfg_obj):
    s = make_session(geo_lat=19.0760, geo_lng=72.8777, geo_radius_m=200)
    v = verify(good_pano(make_panorama), engine, embeddings, cfg_obj, session=s, geo=None)
    assert v.status == SubmissionStatus.rejected
    assert v.reason == "location_missing"
