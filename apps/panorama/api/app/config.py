"""Runtime configuration.

Secrets and environment values come from `.env` / process env; every
verification tunable comes from `panorama.config.yaml` at the package root —
the single config file referenced by the spec.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

CONFIG_PATH = Path(os.getenv("PANORAMA_CONFIG", ROOT / "panorama.config.yaml"))


@lru_cache
def get_config() -> dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def cfg() -> dict[str, Any]:
    return get_config()


# ── Environment / secrets ────────────────────────────────────────────────────
DATABASE_URL = os.getenv("PANORAMA_DATABASE_URL", f"sqlite:///{ROOT / 'panorama.db'}")
JWT_SECRET = os.getenv("PANORAMA_JWT_SECRET", "dev-only-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL_SECONDS = int(os.getenv("PANORAMA_JWT_TTL_SECONDS", "28800"))

MODELS_DIR = Path(os.getenv("PANORAMA_MODELS_DIR", ROOT / "models"))
UPLOAD_DIR = Path(os.getenv("PANORAMA_UPLOAD_DIR", ROOT / "uploads"))

CORS_ORIGINS = [
    v.strip()
    for v in os.getenv(
        "PANORAMA_CORS_ORIGINS",
        "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
    ).split(",")
    if v.strip()
]

if JWT_SECRET == "dev-only-secret-change-me":
    import warnings

    warnings.warn("PANORAMA_JWT_SECRET is unset; using the development default.", stacklevel=1)
