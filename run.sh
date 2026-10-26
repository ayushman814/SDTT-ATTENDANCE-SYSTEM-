#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
DASHBOARD_DIR="$SCRIPT_DIR/apps/dashboard"
PRESENTATION_DIR="$SCRIPT_DIR/presentation/attendrix"
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"

log() { echo "==> $*"; }

cmd_check() {
  log "Validating shell script syntax"
  bash -n "$SCRIPT_DIR/run.sh"

  log "Compiling backend Python sources"
  "$BACKEND_DIR/.venv/bin/python" -m compileall -q "$BACKEND_DIR/app" || \
    (source "$BACKEND_DIR/.venv/bin/activate" && python -m compileall -q "$BACKEND_DIR/app")

  log "Type-checking dashboard TypeScript sources"
  if [ -d "$DASHBOARD_DIR/node_modules" ]; then
    (cd "$DASHBOARD_DIR" && npx tsc -b --pretty false)
  fi

  log "All static checks passed."
}

cmd_setup() {
  log "Creating backend virtual environment"
  if [ ! -d "$BACKEND_DIR/.venv" ]; then
    python3 -m venv "$BACKEND_DIR/.venv"
  fi

  log "Installing backend dependencies"
  source "$BACKEND_DIR/.venv/bin/activate"
  pip install -q -r "$BACKEND_DIR/requirements.txt"

  log "Installing dashboard dependencies"
  if [ -d "$DASHBOARD_DIR/node_modules" ]; then
    (cd "$DASHBOARD_DIR" && npm install --no-audit --no-fund)
  else
    (cd "$DASHBOARD_DIR" && npm install --no-audit --no-fund)
  fi

  log "Installing presentation dependencies"
  if [ -d "$PRESENTATION_DIR/node_modules" ]; then
    (cd "$PRESENTATION_DIR" && npm install --no-audit --no-fund)
  else
    (cd "$PRESENTATION_DIR" && npm install --no-audit --no-fund)
  fi

  log "Setup complete."
}

cmd_test() {
  log "Running backend test suite"
  (cd "$BACKEND_DIR" && source .venv/bin/activate && python -m pytest tests/ -q)

  log "Running Flutter mobile test suite"
  if command -v flutter >/dev/null 2>&1; then
    (cd "$SCRIPT_DIR/apps/mobile" && flutter test)
  else
    echo "SKIPPED: flutter not found in PATH"
  fi

  log "Building teacher dashboard"
  (cd "$DASHBOARD_DIR" && npm run build)

  log "Building presentation website"
  if [ -d "$PRESENTATION_DIR/node_modules" ]; then
    (cd "$PRESENTATION_DIR" && npm run build)
  else
    echo "SKIPPED: presentation dependencies not installed (run ./run.sh setup)"
  fi
}

cmd_stop() {
  log "Stopping attendance backend server"
  if [ -f "$BACKEND_PID_FILE" ]; then
    local pid
    pid="$(cat "$BACKEND_PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$BACKEND_PID_FILE"
  fi
  pkill -f "uvicorn app.main:app" 2>/dev/null || true
  sleep 1
  if curl -s --max-time 2 http://localhost:8000/api/health >/dev/null 2>&1; then
    echo "Backend still responding on :8000 - kill it manually (pkill -f uvicorn)."
  else
    echo "Backend stopped."
  fi
}

case "${1:-}" in
  check)  cmd_check ;;
  setup)  cmd_setup ;;
  test)   cmd_test ;;
  stop)   cmd_stop ;;
  help)   echo "Usage: ./run.sh {check|setup|test|stop}" ;;
  *)       echo "Usage: ./run.sh {check|setup|test|stop}"; exit 2 ;;
esac
