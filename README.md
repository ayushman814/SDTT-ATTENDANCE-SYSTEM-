# Attendrix — classroom attendance system

> **Also in this repo:** `apps/panorama/` — a separate panorama-selfie
> attendance product (FastAPI + React PWA) where students mark attendance by
> uploading a panorama photo that is verified automatically (self + neighbour
> + lecturer in frame). See `apps/panorama/ARCHITECTURE.md` and
> `apps/panorama/api/README.md` for setup, demo accounts, and the real
> verification pipeline.

A shared Flutter mobile app, React dashboard, and Three.js/GSAP presentation site backed by a FastAPI service and Supabase Auth/Postgres/Storage. The supported verification path keeps identity matching, guided liveness, and classroom context as separate server-evaluated checks. Missing models or insufficient evidence become an inconclusive review state; the service never fabricates a successful result. The original classroom scene-evidence path remains available for deployments that have not enabled biometric enrollment.

## Components

- `apps/mobile/` — Flutter student/professor workflows, timed attendance, mobile image capture, personal history, in-app notifications, and WebSocket refresh.
- `apps/dashboard/` — React/TypeScript dashboard for timed session scheduling, student panorama upload, professor image review/manual decisions, audit, history, and CSV/printable reports.
- `presentation/attendrix/` — premium interactive presentation with custom Three.js lecture-hall geometry and GSAP/ScrollTrigger narrative sections.
- `backend/` — FastAPI service source for Supabase Auth token verification, database-backed records, private Storage uploads, image verification, retention cleanup, audit, and short-lived WebSocket tickets.
- `backend/supabase_schema.sql` — complete fresh-project schema and attendance upgrade.
- `backend/migrations/20261026_smart_attendance.sql` — upgrade for an existing database created from the earlier schema.
- `docs/` — API, privacy, setup, and validation notes.

## Hosted backend

The web and mobile clients default to the deployed Render API at **`https://sdtt-attendance-system.onrender.com/api`**. A read-only health check is available at [`/api/health`](https://sdtt-attendance-system.onrender.com/api/health). Normal client use does not require starting the backend locally.

To use a different API, set `VITE_API_BASE_URL` for a dashboard build or pass `--dart-define=API_BASE_URL=https://your-api.example.com/api` to Flutter. Keep backend credentials out of frontend configuration. The deployment must allow requests from the frontend's origin in its CORS settings.

## Client setup

First-time local setup:

```bash
cp .env.example backend/.env
# edit backend/.env with Supabase credentials and a Fernet key
./run.sh setup
```

Start all available services:

```bash
./run.sh
```

The launcher prints the services it can run and writes logs under `.attendrix-logs/`. Use `./run.sh check`, `./run.sh test`, and `./run.sh stop` for lifecycle management. On Windows use Git Bash or WSL; the script never overwrites an existing `.env`.

## Video walkthrough

The completed product walkthrough is available at [`artifacts/attendrix_product_walkthrough.mp4`](artifacts/attendrix_product_walkthrough.mp4). It covers the implemented workflow, teacher review, architecture, and responsible-use boundaries. The interactive website remains the live presentation experience.

For local dashboard development while using the hosted API:

```bash
cd apps/dashboard
npm ci
npm run dev
```

For Flutter, in an environment with Flutter installed:

```bash
cd apps/mobile
flutter pub get
flutter run
```

The clients use the hosted API unless you provide an explicit override. The presentation site runs at `http://localhost:3001` when launched by `run.sh`.

## Optional backend development or self-hosting

The `backend/` source remains in the repository for maintaining, testing, and deploying the service; it is not the default client target. To run your own backend, create a Supabase project. For a fresh database, run `backend/supabase_schema.sql` in SQL Editor. For a project using the earlier schema, run that original schema first and then `backend/migrations/20261026_smart_attendance.sql`.

In `backend/`, create a virtual environment, install `requirements.txt`, copy `.env.example` to `.env`, and set the Supabase URL, anon key, service-role key, JWT secret, allowed CORS origins, and image policy values. Never expose the service-role key or JWT secret in a client build or commit a real `.env` file. Provision Auth users and administrator-controlled `profiles` roles/enrollments. The guarded synthetic-account helper is development-only and reads passwords from environment variables.

Run the local API only when doing backend development or self-hosting:

```bash
cd backend
uvicorn app.main:app --env-file .env --host 0.0.0.0 --port 8000
```

For a local client-to-local API test, explicitly override the default URL with `http://localhost:8000/api` for the web client or a device-reachable address for Flutter.

## Attendance workflow

A professor creates a session with an opening time and duration, minimum visible-person threshold, and optional normalized stage region. The server, not the device clock, transitions it from scheduled to open and then closed. Students use their own registered ID/email account, capture a broad classroom panorama with the phone's camera app, and upload the saved image. The API enforces file type/size and image-quality requirements, and returns a scene-evidence result. `VERIFIED` is a scene-level result, not proof that the uploader's identity appears in the image. `NEEDS_REVIEW` and `REJECTED` are not treated as present; professors can inspect a signed, short-lived private image URL and make an audited decision. Rejected students may retry only when policy allows and no professor decision has been recorded. After closing the window, a professor can correct the roster and explicitly finalize; remaining pending students become absent.

## Privacy and limits

Images are re-encoded without embedded metadata, held in a private Supabase Storage bucket for review, and deleted by the backend retention worker after `ATTENDANCE_IMAGE_RETENTION_DAYS` (default 30; allowed range 1–3650). Face embeddings are encrypted with a server-only Fernet key and raw enrollment images are not stored. Face identity and liveness are optional model-backed checks; DeepFace/model setup is required, and unavailable or inconclusive checks remain pending review. No score is claimed as scientifically validated. Classroom evidence cannot prove a student's exact seat or identify every person in a 240-seat hall. Before a real pilot, review consent/notice, opt-out/manual pathways, model and dependency licensing, security, image retention, fairness/accuracy, and institutional requirements.

## Validation

Current reproducible checks include `python -m pytest -q` under `backend/` and `npm run build` under `apps/dashboard/`. Flutter checks require the Flutter SDK: `flutter analyze`, `flutter test`, and optionally `flutter build web`. Android device camera behavior and iOS native builds require the relevant SDK/device and are not claimed unless tested. See [`docs/BUILD_VALIDATION.md`](docs/BUILD_VALIDATION.md) for the latest environment-specific results.
