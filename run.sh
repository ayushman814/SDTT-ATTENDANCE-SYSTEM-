#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.attendrix-pids"
LOG_DIR="$ROOT_DIR/.attendrix-logs"
PYTHON_BIN="${PYTHON_BIN:-python}"
VENV_DIR="$ROOT_DIR/backend/.venv"
venv_python() {
  if [[ -x "$VENV_DIR/Scripts/python.exe" ]]; then printf '%s' "$VENV_DIR/Scripts/python.exe"; else printf '%s' "$VENV_DIR/bin/python"; fi
}
VENV_PYTHON="$(venv_python)"

has_command() { command -v "$1" >/dev/null 2>&1; }
info() { printf '[attendrix] %s\n' "$*"; }
warn() { printf '[attendrix] warning: %s\n' "$*" >&2; }

check() {
  local failed=0
  has_command "$PYTHON_BIN" || { warn "Python is required."; failed=1; }
  if has_command node; then info "Node $(node --version) detected"; else warn "Node.js is unavailable; dashboard and presentation servers cannot start."; fi
  has_command npm || warn "npm is unavailable; JavaScript dependencies cannot be installed." 
  if has_command flutter; then info "Flutter detected"; else warn "Flutter is unavailable; mobile hardware checks are skipped."; fi
  if has_command psql; then info "PostgreSQL client detected"; else warn "PostgreSQL client is unavailable. Supabase or another configured database must still be reachable by the API."; fi
  [[ -f "$ROOT_DIR/backend/requirements.txt" ]] || { warn "backend/requirements.txt is missing"; failed=1; }
  [[ -f "$ROOT_DIR/apps/dashboard/package-lock.json" ]] || { warn "dashboard lockfile is missing"; failed=1; }
  [[ -f "$ROOT_DIR/presentation/attendrix/package-lock.json" ]] || { warn "presentation lockfile is missing"; failed=1; }
  if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then warn "backend/.env is missing; copy .env.example and configure the database before starting the API."; fi
  return "$failed"
}

stop() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid _; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
    info "Stopped tracked Attendrix processes."
  else
    info "No tracked Attendrix processes found."
  fi
}

ensure_dependencies() {
  mkdir -p "$LOG_DIR"
  if [[ ! -x "$VENV_PYTHON" ]]; then
    info "Creating backend virtual environment"
    "$PYTHON_BIN" -m venv "$ROOT_DIR/backend/.venv"
    VENV_PYTHON="$(venv_python)"
  fi
  "$VENV_PYTHON" -m pip install -r "$ROOT_DIR/backend/requirements.txt"
  if has_command npm; then
    (cd "$ROOT_DIR/apps/dashboard" && npm ci)
    (cd "$ROOT_DIR/presentation/attendrix" && npm ci)
  else
    return 1
  fi
}

start_service() {
  local name="$1"; shift
  "$@" >"$LOG_DIR/$name.log" 2>&1 &
  local pid=$!
  printf '%s %s\n' "$pid" "$name" >> "$PID_FILE"
  info "$name started (pid $pid); log: .attendrix-logs/$name.log"
}

start() {
  check || { warn "Prerequisite check failed; fix the reported items and retry."; return 1; }
  ensure_dependencies
  : > "$PID_FILE"
  if [[ -f "$ROOT_DIR/backend/.env" ]]; then
    start_service backend bash -lc "cd '$ROOT_DIR/backend' && '$VENV_PYTHON' -m uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8000"
  fi
  start_service dashboard bash -lc "cd '$ROOT_DIR/apps/dashboard' && npm run dev -- --host 127.0.0.1 --port 4173"
  start_service presentation bash -lc "cd '$ROOT_DIR/presentation/attendrix' && npm run dev -- --hostname 127.0.0.1 --port 3001"
  info "Dashboard: http://localhost:4173"
  info "Presentation: http://localhost:3001"
  [[ -f "$ROOT_DIR/backend/.env" ]] && info "Backend: http://localhost:8000/api/health" || warn "Backend not started until backend/.env is configured."
}

test() {
  local failed=0
  if [[ -x "$VENV_PYTHON" ]]; then (cd "$ROOT_DIR/backend" && "$VENV_PYTHON" -m pytest -q) || failed=1; else warn "Backend virtual environment missing; run ./run.sh setup or install requirements."; failed=1; fi
  if has_command npm; then (cd "$ROOT_DIR/apps/dashboard" && npm run build) || failed=1; (cd "$ROOT_DIR/presentation/attendrix" && npm run build) || failed=1; else warn "Skipping JavaScript builds because npm is unavailable."; failed=1; fi
  if has_command flutter; then (cd "$ROOT_DIR/apps/mobile" && flutter analyze && flutter test) || failed=1; else warn "Skipping Flutter checks because Flutter is unavailable."; fi
  return "$failed"
}

case "${1:-start}" in
  check) check ;;
  setup) check && ensure_dependencies ;;
  test) test ;;
  stop) stop ;;
  start) start ;;
  *) printf 'Usage: %s [start|check|setup|test|stop]\n' "$0"; exit 2 ;;
esac
