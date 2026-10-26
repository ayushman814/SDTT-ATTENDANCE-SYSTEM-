#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
MOBILE_DIR="$SCRIPT_DIR/apps/mobile"

# Ensure PATH has flutter and adb
export PATH="$HOME/development/flutter/bin:$HOME/Android/Sdk/platform-tools:$PATH"

echo "=================================================="
echo " 📱 Attendance System - Phone & Backend Launcher"
echo "=================================================="

# Check ADB
if ! command -v adb >/dev/null 2>&1; then
    echo "❌ Error: 'adb' not found. Please install Android SDK platform-tools."
    exit 1
fi

# Check Flutter
if ! command -v flutter >/dev/null 2>&1; then
    echo "❌ Error: 'flutter' not found in PATH or ~/development/flutter/bin."
    exit 1
fi

# Check for attached Android devices
CONNECTED_DEVICE=$(adb devices | grep -w "device" | awk '{print $1}' | head -n 1)

if [ -z "$CONNECTED_DEVICE" ]; then
    echo "⚠️  No Android device detected via ADB."
    echo "   Please plug in your phone via USB and enable USB Debugging."
    echo "   Or connect wirelessly via 'adb connect <phone-ip>:5555'."
    exit 1
fi

echo "✅ Device detected: $CONNECTED_DEVICE"

# Setup ADB port reverse (routes phone's localhost:8000 to laptop's localhost:8000)
echo "🔄 Setting up ADB port reverse (tcp:8000 -> tcp:8000)..."
adb -s "$CONNECTED_DEVICE" reverse tcp:8000 tcp:8000
echo "   -> Phone can now talk directly to http://localhost:8000"

# Check if Backend is already running
BACKEND_PID=""
if curl -s --max-time 1 http://localhost:8000/api/time >/dev/null 2>&1; then
    echo "✅ Backend is already running on http://localhost:8000"
else
    echo "🚀 Starting Backend server in background..."
    if [ ! -d "$BACKEND_DIR/.venv" ]; then
        echo "   Creating Python virtualenv in backend/.venv..."
        python3 -m venv "$BACKEND_DIR/.venv"
        "$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
    fi

    # Launch uvicorn in background
    cd "$BACKEND_DIR"
    "$BACKEND_DIR/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 > /tmp/attendance_backend.log 2>&1 &
    BACKEND_PID=$!
    cd "$SCRIPT_DIR"

    # Wait for backend to be ready
    echo -n "   Waiting for backend to be healthy..."
    for i in {1..30}; do
        if curl -s --max-time 1 http://localhost:8000/api/time >/dev/null 2>&1; then
            echo " Ready!"
            break
        fi
        sleep 0.5
        echo -n "."
    done

    if ! curl -s --max-time 1 http://localhost:8000/api/time >/dev/null 2>&1; then
        echo ""
        echo "❌ Backend failed to start. Logs:"
        cat /tmp/attendance_backend.log
        exit 1
    fi
fi

# Cleanup backend when script terminates if we spawned it
cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo ""
        echo "🛑 Stopping background backend server (PID $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Run Flutter Mobile App
echo ""
echo "=================================================="
echo " 🚀 Launching Flutter on your phone..."
echo "    Target: $CONNECTED_DEVICE"
echo "    API:    http://localhost:8000/api"
echo "=================================================="
echo ""

cd "$MOBILE_DIR"
flutter run -d "$CONNECTED_DEVICE" --dart-define=API_BASE_URL=http://localhost:8000/api
