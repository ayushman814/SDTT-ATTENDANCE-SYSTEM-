#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/backend/.env"
  echo "Created backend/.env from .env.example. Replace every placeholder before starting the API."
else
  echo "backend/.env already exists; left it unchanged."
fi
"$ROOT_DIR/run.sh" setup
