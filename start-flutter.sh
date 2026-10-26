#!/usr/bin/env bash
# Runs the Flutter app pointed at the panorama backend.
#
# Phone on the same Wi-Fi: run ./start-backend.sh on this machine first, then
#   ./start-flutter.sh
# It auto-detects this machine's LAN IP and passes it as PANORAMA_API_URL.
#
# Usage:
#   ./start-flutter.sh                          # LAN IP auto-detected
#   ./start-flutter.sh http://192.168.1.5:8100  # explicit backend URL
#   ./start-flutter.sh -d chrome                # extra args pass to flutter run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$ROOT/apps/mobile"

# First non-flag arg is treated as the backend URL.
API_URL=""
ARGS=()
for arg in "$@"; do
  if [ -z "$API_URL" ] && [[ "$arg" == http* ]]; then
    API_URL="$arg"
  else
    ARGS+=("$arg")
  fi
done

if [ -z "$API_URL" ]; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  API_URL="http://${LAN_IP:-127.0.0.1}:8100/api"
fi
[[ "$API_URL" != */api ]] && API_URL="${API_URL%/}/api"

cd "$MOBILE_DIR"

echo "[flutter] fetching dependencies..."
flutter pub get

echo "[flutter] PANORAMA_API_URL=$API_URL"
echo "[flutter] make sure ./start-backend.sh is running and the phone is on the same Wi-Fi."
exec flutter run --dart-define=PANORAMA_API_URL="$API_URL" "${ARGS[@]}"
