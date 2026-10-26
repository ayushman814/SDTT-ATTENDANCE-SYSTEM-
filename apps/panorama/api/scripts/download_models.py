#!/usr/bin/env python3
"""Download the OpenCV Zoo face models used by the verification pipeline.

- YuNet  : face_detection_yunet_2023mar.onnx  (~0.2 MB)
- SFace  : face_recognition_sface_2021dec.onnx (~37 MB)

Usage: python scripts/download_models.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

FILES = {
    "face_detection_yunet_2023mar.onnx":
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx":
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}


def main() -> int:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        dest = MODELS_DIR / name
        if dest.exists() and dest.stat().st_size > 0:
            print(f"already present: {name}")
            continue
        print(f"downloading {name} ...")
        urllib.request.urlretrieve(url, dest)
        print(f"  -> {dest} ({dest.stat().st_size} bytes)")
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
