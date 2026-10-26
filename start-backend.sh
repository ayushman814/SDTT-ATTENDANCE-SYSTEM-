#!/usr/bin/env bash
# Starts the panorama attendance API so BOTH the Flutter app (real phone on the
# same Wi-Fi) and the web app can reach it. Binds 0.0.0.0 on purpose.
#
# Usage:
#   ./start-backend.sh                 # local dev, SQLite database
#   PANORAMA_DATABASE_URL=postgresql+psycopg2://... ./start-backend.sh   # Supabase
#   PORT=8200 ./start-backend.sh       # different port
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/apps/panorama/api"
PORT="${PORT:-8100}"

cd "$API_DIR"

# --- Python environment -----------------------------------------------------
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ ! -x .venv/bin/python ]; then
  echo "[backend] creating virtualenv..."
  "$PYTHON_BIN" -m venv .venv
fi

echo "[backend] installing dependencies..."
.venv/bin/pip install -q -r requirements.txt

# --- Face models (one-time download) ---------------------------------------
if [ ! -f models/face_detection_yunet_2023mar.onnx ]; then
  echo "[backend] downloading face models..."
  .venv/bin/python scripts/download_models.py
fi

# --- Demo data (skips silently if users already exist) ----------------------
if [ ! -f panorama.db ] && [ "${PANORAMA_DATABASE_URL:-}" = "" ]; then
  echo "[backend] seeding demo users (prof@demo.edu / prof12345, student1..5@demo.edu / student123)..."
  .venv/bin/python seed.py
fi

# --- Defaults for local development -----------------------------------------
export PANORAMA_JWT_SECRET="${PANORAMA_JWT_SECRET:-dev-secret-change-me}"
export PANORAMA_PROFESSOR_INVITE_CODE="${PANORAMA_PROFESSOR_INVITE_CODE:-dev-invite}"
export PANORAMA_CORS_ORIGINS="${PANORAMA_CORS_ORIGINS:-http://localhost:5173,http://localhost:4173}"

# --- Network info for the Flutter app ---------------------------------------
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "[backend] listening on http://0.0.0.0:$PORT"
[ -n "$LAN_IP" ] && echo "[backend] phone should use PANORAMA_API_URL=http://$LAN_IP:$PORT/api"

exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
