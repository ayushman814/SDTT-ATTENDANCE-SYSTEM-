"""Regression tests for `seed.py --if-empty` (launcher seeding policy).

Covers the review findings on start-backend.sh: seeding must happen only for
a fresh local SQLite database — never for an external DB (Supabase/Postgres,
including one configured only via .env), and never once users exist (so a
restart can't resurrect deleted face data or undo un-enrollments).
"""
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "seed.py"
MODEL = ROOT / "models" / "face_detection_yunet_2023mar.onnx"


def run_seed(db_url: str, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["PANORAMA_DATABASE_URL"] = db_url
    return subprocess.run(
        [sys.executable, str(SEED), *args],
        capture_output=True,
        text=True,
        env=env,
        cwd=ROOT,
        timeout=120,
    )


def user_count(db_path: Path) -> int:
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute("SELECT count(*) FROM users").fetchone()[0]
    finally:
        conn.close()


@pytest.mark.skipif(not MODEL.exists(), reason="face models not downloaded")
def test_if_empty_seeds_fresh_db_then_skips(tmp_path):
    db = tmp_path / "test.db"
    url = f"sqlite:///{db}"

    first = run_seed(url, "--if-empty")
    assert first.returncode == 0, first.stderr
    assert "Seeded" in first.stdout
    assert user_count(db) == 6  # 1 professor + 5 students

    # Second launcher start: existing data must be preserved as-is.
    second = run_seed(url, "--if-empty")
    assert second.returncode == 0, second.stderr
    assert "skipped" in second.stdout
    assert user_count(db) == 6


def test_if_empty_skips_external_database_url():
    # An external URL must be skipped BEFORE any connection is attempted
    # (this DSN is deliberately unreachable).
    result = run_seed("postgresql+psycopg2://u:p@127.0.0.1:1/db", "--if-empty")
    assert result.returncode == 0, result.stderr
    assert "external database" in result.stdout


def test_if_empty_skips_external_url_from_dotenv():
    # The launcher path: URL configured ONLY in .env (app.config loads it),
    # not exported in the environment — seeding must still be skipped.
    dotenv = ROOT / ".env"
    backup = dotenv.read_text() if dotenv.exists() else None
    dotenv.write_text(
        "PANORAMA_DATABASE_URL=postgresql+psycopg2://u:p@127.0.0.1:1/db\n"
    )
    env = dict(os.environ)
    env.pop("PANORAMA_DATABASE_URL", None)
    try:
        result = subprocess.run(
            [sys.executable, str(SEED), "--if-empty"],
            capture_output=True,
            text=True,
            env=env,
            cwd=ROOT,
            timeout=120,
        )
    finally:
        if backup is None:
            dotenv.unlink(missing_ok=True)
        else:
            dotenv.write_text(backup)
    assert result.returncode == 0, result.stderr
    assert "external database" in result.stdout
