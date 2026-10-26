# Delivery Checklist and Implementation Status

## Phase 0 — Baseline & Architecture Consolidation (COMPLETED)
- [x] **Backend Entrypoint Consolidation**: Consolidated on `backend/app/main.py` (Supabase Auth/Postgres architecture + InMemoryDatabase fallback for offline/isolated execution).
- [x] **Test Suite Modernization**: Removed obsolete SQLite/DB_PATH references; rewrote `backend/tests/test_api.py` into 8 end-to-end tests covering login, role mismatch rejection, reference selfie enrollment, session limits, time enforcement, sweep check-in rules 1–9, review queue, and manual roll-call override.
- [x] **Duplicate Dashboard Clarification**: `apps/dashboard` (React/Vite) maintained as the active production dashboard (`apps/dashboard-next` retained per user instruction).
- [x] **Removal of Fake Capture Flow**: Removed fake POST `/capture` size-based confidence generator and "synthetic confidence" UI; replaced with real 9-rule continuous sweep pipeline and review queue.

---

## Biometric Enrollment & Role Verification (COMPLETED)
- [x] **Role Selection Screen**: "I am a Student" / "I am a Lecturer" (`apps/mobile/lib/screens/role_selection_screen.dart`).
- [x] **Role-Mismatch Guard**: Backend verifies account role equals selected role and rejects mismatches (`403 Forbidden`).
- [x] **Biometric Reference Enrollment**: Front camera reference selfie enrollment with consent check (`POST /api/auth/enroll`), single-face validation, quality filter, and AES-encrypted 512-d template storage with model version and consent timestamp. Biometric vectors are service-role readable only.

---

## Server-Authoritative Time Limit & Session Management (COMPLETED)
- [x] **Duration Presets**: 5, 10, 15 min presets + custom duration up to 60 min.
- [x] **Server Clock Authority**: Clients compute countdowns using `/api/time` server clock offset. Submissions rejected after `ends_at + 5s` grace.
- [x] **Auto-Close Mechanisms**: Lifespan background task in FastAPI auto-closes sessions at `ends_at`; redundant lazy closure runs on every session read and submit.
- [x] **Session Closure Broadcast**: Emits WebSocket `session.closed` event with `{present, needs_review, absent, rejected_attempts, total_enrolled}`.

---

## Flutter Mobile Continuous Sweep Capture (COMPLETED)
- [x] **Continuous Sweep Gesture**: Single front-camera sweep: 1s selfie hold, 180° horizontal arc through neighbors to lecturer stage, 1s hold facing stage.
- [x] **Sensory Guidance**: Gyroscope-derived heading tagging (`sensors_plus`), continuous frame offsets (~5 fps), haptic feedback, audio cue sequence ("start", "keep going", "hold", "done"), visual progress arc, and first-use practice mode.
- [x] **Student Home**: Active session card with live server-synced countdown timer and "Mark Attendance" trigger.

---

## 9-Rule Ordered Backend Verification Pipeline (COMPLETED)
- [x] **Rule 1**: Auth & Session Window.
- [x] **Rule 2**: Idempotency & Limits (attempt_id uniqueness, max 3 attempts, 1 verified record per student/session).
- [x] **Rule 3**: Image Quality (Laplacian blur variance $\ge 100$, luminance $40 \dots 220$).
- [x] **Rule 4**: Sweep Evidence (Duration 4–15s, $\ge 12$ frames, monotonic arc, gaps $\le 25^\circ$, total span $\ge 150^\circ$, visual continuity).
- [x] **Rule 5**: Self Match (Cosine similarity $\ge 0.72$ pass, $0.50 \dots 0.71$ flagged, $< 0.50$ fail).
- [x] **Rule 6**: Neighbour Presence ($\ge 1$ distinct face within 3 face-widths of student).
- [x] **Rule 7**: Lecturer Identification (Late frames: face IPD $\ge 30\text{px}$ matched $\to$ Pass; person detected but IPD $< 30\text{px}$ $\to$ FLAGGED for lecturer review; nobody detected $\to$ Fail).
- [x] **Rule 8**: Fraud Signals (pHash near-duplicate check).
- [x] **Rule 9**: Decision, filmstrip extraction for flagged attempts, and ephemeral raw frame purging.

---

## Web Dashboard (React/Vite) & Lecturer Review Queue (COMPLETED)
- [x] **Lecturer Terminology**: Displays "Lecturer" across UI while retaining DB role `'teacher'`.
- [x] **Session Creation**: Duration selector with presets (5, 10, 15 min, custom).
- [x] **Live Session Screen**: Server-synced countdown timer and headline verified counts (`Present`, `Needs Review`, `Absent`, `Total Enrolled`).
- [x] **Lecturer Review Queue**: Flagged submissions displayed with reason codes, filmstrip thumbnail images, and Accept/Reject buttons with audit notes.
- [x] **Manual Roll-Call Override**: Present/Absent/Note buttons for lecturer as opt-out route.
- [x] **TypeScript & Vite Build**: Verified passing (`tsc -b && vite build` in 1.31s).

---

## Verification & Experiments (COMPLETED)
- [x] **Backend Pytest**: 13 tests passing in 4.55s (`test_api.py`, `test_optical_feasibility.py`, `test_panorama_verification.py`).
- [x] **Optical Feasibility & Sweep Benchmark**: Executed `experiments/panorama_verification/run_panorama_verification.py`. Confirmed Rule 7 FLAGGED rate = 80.0% due to front-camera optical resolution limitations at distance, properly routing to review queue.
- [!] **Untested**: Real-device camera hardware sweep and physical lecture hall deployment (requires live mobile device and physical classroom setting).

