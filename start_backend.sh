#!/usr/bin/env bash
set -e

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "=========================================="
echo " Starting Attendance Backend Server"
echo "=========================================="

cd "$BACKEND_DIR"

# Ensure virtualenv exists
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment in backend/.venv..."
    python3 -m venv .venv
fi

# Activate virtualenv
source .venv/bin/activate

# Install / verify dependencies
echo "Checking backend dependencies..."
pip install -q -r requirements.txt

# Detect local IP
LOCAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n 1 || echo "localhost")
echo ""
echo "Backend listening on:"
echo " -> Local:   http://localhost:8000/api"
echo " -> Network: http://${LOCAL_IP}:8000/api"
echo " -> Swagger: http://localhost:8000/docs"
echo ""

# Run uvicorn on 0.0.0.0 so both localhost and Wi-Fi devices can reach it
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
