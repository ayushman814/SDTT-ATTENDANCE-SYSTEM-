# Classroom Attendance prototype

> **Also in this repo:** `apps/panorama/` — a separate panorama-selfie
> attendance product (FastAPI + React PWA) where students mark attendance by
> uploading a panorama photo that is verified automatically (self + neighbour
> + lecturer in frame). See `apps/panorama/ARCHITECTURE.md` and
> `apps/panorama/api/README.md` for setup, demo accounts, and the real
> verification pipeline.

A review-first classroom attendance prototype with a Flutter mobile client, responsive web dashboard, and one shared real-time API. Build order follows the request: mobile app, web dashboard, then live connection through a shared FastAPI service and WebSocket event stream.

## Safety scope

This is a demo using synthetic students and simulated recognition suggestions. It does **not** perform facial identity recognition. Capture bytes are processed for the request and not persisted in application storage; multipart parsing may use temporary spooling for large uploads. No biometric templates are generated or exposed. Teacher review is required before a record becomes present/absent. Manual roll call is available. Notifications appear in the app only; there is no email or SMS sender. Do not enter real student data or use this prototype in a live school setting.

## Components

- `apps/mobile/` — Flutter app for teacher/student use, with Android/iOS/Web scaffolding. Flutter 3.47.7 was installed at `/home/ubuntu/tools/flutter` in this sandbox with user approval; the Android SDK is not installed, so an Android APK/device-camera build was not verified.
- `apps/dashboard/` — React/TypeScript responsive dashboard.
- `backend/` — FastAPI REST + WebSocket service with SQLite demo persistence and role checks.
- `docs/API_CONTRACT.md` — shared endpoint and event details.
- `plan.md`, `TODO.md` — agreed scope and implementation status.

## Run locally

1. Start the API from `backend/`: create a Python virtual environment, install `requirements.txt`, copy `.env.example` to `.env`, then run `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
2. Start the dashboard: `cd apps/dashboard && npm install && VITE_API_BASE_URL=http://localhost:8000/api npm run dev`. Use the API's browser-reachable address instead of `localhost` if the dashboard and API run on different machines.
3. Open the Vite URL in a browser and sign in using the demo credentials listed in `docs/API_CONTRACT.md`.
4. For Flutter, run `cd apps/mobile && flutter pub get && flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api` for Android Emulator. For a physical phone, use the host computer's LAN IP and ensure it can reach port 8000. iOS Simulator can use `http://localhost:8000/api`.

Keep the backend, dashboard, and Flutter app pointed at the same API address to share changes in real time. Android emulator, iOS simulator, and physical-device networking may require different base URLs.

## Verification in this sandbox

Flutter static analysis and widget smoke tests pass, and `flutter build web` succeeds. Backend tests pass (4 tests), including role/privacy and single-use realtime ticket behavior. The dashboard TypeScript/Vite production build succeeds. Flutter APK/device camera behavior is not verified because this sandbox has no Android SDK or attached mobile device; native iOS builds require macOS/Xcode.

## Demo credentials

Teacher: `teacher@demo.edu` / `teach123`.

Students: `student1@demo.edu` or `student2@demo.edu` / `student123`.

These credentials, SQLite storage, local WebSocket tickets, and demo CORS configuration are development-only. Production requires real authentication, HTTPS/WSS, encrypted storage, proper retention and deletion, backup/monitoring, access control review, school-specific legal/privacy review, demographic fairness assessment, and a configured app-push provider if true push delivery is required. The requested accuracy/latency figures are evaluation goals, not performance claims.
