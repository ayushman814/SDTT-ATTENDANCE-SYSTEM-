# Classroom Attendance Backend

FastAPI service using Supabase Auth, PostgreSQL, a private Storage bucket, optional DeepFace embeddings, OpenCV liveness heuristics, and a pretrained YOLO person detector. Identity, liveness, and classroom context are separate evidence categories. This is a prototype and not a production education-data system.

## Setup

1. Run `supabase_schema.sql` for a fresh Supabase project. For an existing database created from the earlier schema, apply `migrations/20261026_smart_attendance.sql` in the Supabase SQL Editor.
2. Create a virtual environment, install `requirements.txt`, copy the repository `.env.example` to `.env`, then set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ATTENDANCE_BIOMETRIC_ENCRYPTION_KEY`, and deployment-appropriate CORS origins. Keep service credentials and biometric keys server-only.
3. Provision application profiles with administrator-assigned roles and class enrollments. The SQL trigger creates a new profile as a student by default; user metadata cannot grant professor privileges. For local-only synthetic accounts, use `DEMO_TEACHER_PASSWORD` and `DEMO_STUDENT_PASSWORD` with `python scripts/seed_demo_accounts.py`.
4. Start with `uvicorn app.main:app --env-file .env --host 0.0.0.0 --port 8000`.

The first detector inference may download the configured model from Ultralytics. Set `ATTENDANCE_PERSON_MODEL` to a locally approved weights file when required. Check model/dependency licensing, network policy, and artifact provenance before a real deployment.

## API workflow

1. `POST /api/auth/login` accepts `{ "identifier": "registration-id-or-email", "password": "..." }` and returns a Supabase access token plus a provisioned profile.
2. Professor: `POST /api/sessions` with class, title, UTC-aware `opens_at`/`deadline_at`, `minimum_people_visible`, and optional normalized `stage_region`. `POST /api/sessions/{id}/open` can open a scheduled window early; `POST /api/sessions/{id}/close` ends submissions.
3. Student: `POST /api/sessions/{id}/submissions` multipart field `photo`. The backend verifies role/enrollment and server time, MIME type, byte limit, image dimensions/aspect/blur/brightness, and scene-level person evidence. Passing scene criteria marks the authenticated submitter present; uncertain/rejected evidence remains pending unless manually reviewed. This is not identity proof.
4. Professor: `GET /api/sessions/{id}/submissions` returns metadata and short-lived signed URLs from the private bucket. `POST /api/sessions/{id}/submissions/{submission_id}/review` records a required approve/reject reason and audited attendance decision. `PATCH /api/sessions/{id}/attendance/{student_id}` supports manual roll call.
5. Optional identity workflow: a controller opens `/api/registration/open`, an eligible student submits a front-camera image to `/api/students/me/face-enrollment`, and the student submits at least four guided face frames plus a rear-camera classroom image to `/api/sessions/{id}/verification`. The API returns `CONFIRMED`, `PENDING_REVIEW`, or `REJECTED` with separate identity/liveness/context results. Raw face frames are not stored.
6. After the session is closed, `POST /api/sessions/{id}/finalize` with `{ "mark_pending_absent": true }` commits final results, creates private in-app notifications, and emits an event.
7. Students read their own records with `GET /api/students/me/attendance`; professors access `GET /api/reports/sessions/{id}`, `GET /api/reports/sessions/{id}/xlsx`, `GET /api/audit?session_id={id}`, CSV data, and print-friendly HTML. WebSocket clients use a short-lived single-use ticket from `POST /api/auth/ws-ticket` and re-fetch authoritative state after events.

The legacy `POST /api/sessions/{id}/capture` endpoint returns HTTP 410; there is no synthetic capture or fake attendance suggestion path.

## Image retention and privacy

`ATTENDANCE_MAX_CAPTURE_BYTES` defaults to 10 MiB. `ATTENDANCE_STORAGE_BUCKET` defaults to the private `attendance-submissions` bucket. `ATTENDANCE_IMAGE_RETENTION_DAYS` defaults to 30 and must be between 1 and 3650. Accepted raster images are re-encoded without embedded metadata before storage. An hourly background worker deletes expired Storage objects and clears their paths and hashes while retaining attendance/submission metadata. Failed deletions are retried on later passes. Review URLs expire quickly. Configure deletion/backup behavior for every deployment and do not use real student data until institutional privacy/security review is complete.

Face representations are encrypted at rest and never returned to clients. DeepFace is loaded lazily; if it or the encryption key is missing, enrollment/identity evaluation returns a clear service-unavailable or pending-review outcome. Liveness uses OpenCV face/eye detections and guided movement; it is not certified spoof protection. In-app notifications only. Supabase keys, TLS, encrypted backups, account lifecycle, monitoring, model licensing, consent/notice, opt-out, and fairness/accuracy evaluation remain deployment responsibilities.

## Tests

Run `python -m pytest -q` from `backend/`. Unit tests use fake Supabase clients for server-time transitions and retention behavior; vision tests inject a deterministic detector so they do not download model weights. They do not constitute a live Supabase integration or accuracy benchmark.
