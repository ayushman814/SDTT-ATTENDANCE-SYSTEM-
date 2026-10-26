# Attendrix — Continuous Sweep Classroom Attendance Verification

> **Also in this repo:** `apps/panorama/` — a separate panorama-selfie
> attendance product (FastAPI + React PWA) where students mark attendance by
> uploading a panorama photo that is verified automatically (self + neighbour
> + lecturer in frame). See `apps/panorama/ARCHITECTURE.md` and
> `apps/panorama/api/README.md` for setup, demo accounts, and the real
> verification pipeline.

Attendrix is an attendance verification system built for real lecture halls. It eliminates proxy attendance by having students perform a **single, continuous front-camera sweep** (from a selfie beside classmates across to the lecturer on stage). Verification is entirely server-authoritative, governed by an ordered 9-rule computer vision pipeline, with a dedicated review queue for flagged attempts.

---

## Architecture & Components

- **`backend/` (FastAPI + Supabase Auth / PostgreSQL)**:
  - **Single Consolidated Entrypoint**: `backend/app/main.py`.
  - **Server-Authoritative Time & Lifespan Task**: Manages session time windows (`starts_at`, `ends_at`, duration presets: 5, 10, 15 min, custom). Background asyncio task and lazy checks on reads/submits auto-close expired sessions (+5s grace), writing audit entries, creating lecturer notifications, and broadcasting WebSocket `session.closed` events.
  - **Biometric Security**: Encrypted face templates (Fernet AES-128-CBC / SHA256 HMAC) stored in `face_templates` table with consent timestamps and model versions. Templates are service-role readable only and never exposed via any API.
  - **FaceEngine Interface**:
    - Production: Real face detection via **YuNet** and 512-d embeddings via **ArcFace ONNX**.
    - Tests: Deterministic `FakeFaceEngine` for unit and negative tests.
  - **Model Licenses**:
    - **YuNet (OpenCV)**: Apache 2.0 license (commercial use allowed).
    - **ArcFace / InsightFace**: Non-commercial / academic research license for official InsightFace weights. Commercial deployment requires retraining embeddings on permissible datasets or swapping weights under an open commercial license.
  - **Privacy & Storage**: Ephemeral raw sweep frames are purged immediately after analysis for VERIFIED and REJECTED attempts. Only key frame filmstrips for FLAGGED attempts are retained in private storage with an auto-delete policy (7 days retention).
  - **Database Migration**: `backend/migrations/002_real_sweep_verification.sql`.

- **`apps/mobile/` (Flutter)**:
  - **Role Selection Screen**: "I am a Student" / "I am a Lecturer", backed by backend role-locking (rejects role mismatches). Demo credentials removed from non-debug builds.
  - **Reference Selfie Enrollment**: First-login consent screen and front-camera selfie capture.
  - **Student Home**: Active session card with server-synced countdown timer and "Mark Attendance" trigger.
  - **Continuous Front-Camera Sweep (`SweepCaptureScreen`)**:
    1. 1s selfie hold (front camera, with classmates in frame).
    2. 180° continuous horizontal sweep tagged with gyroscope headings (`sensors_plus`) and frame time offsets (~5 fps).
    3. 1s hold facing stage/lecturer.
    4. Audio and haptic cues ("start", "keep going", "hold", "done"), visual progress arc, and first-use practice mode.
  - **Lecturer Home & Session**: Start timed session with preset/custom duration, live verified count headline over WebSocket, results breakdown, and review queue filmstrip viewer.

- **`apps/dashboard/` (React / TypeScript / Vite)**:
  - **Lecturer Workspace**: Displays "Lecturer" across UI (while preserving DB role `'teacher'`).
  - **Live Sessions**: Server-synced countdown timer and headline verified counts (`Present`, `Needs Review`, `Absent`, `Total Enrolled`).
  - **Lecturer Review Queue**: Visualizes flagged attempts with reason badges, filmstrip thumbnail images, and Accept/Reject buttons with audit notes.
  - **Manual Roll-Call Override**: Present/Absent/Note overrides for lecturer as the opt-out route.

- **`experiments/`**:
  - `experiments/optical_feasibility/`: Evaluates front-camera optical resolution (IPD vs distance) and blur/luminance metrics.
  - `experiments/panorama_verification/`: Benchmark runner measuring per-rule pass rates and empirical lecturer check flagged rates.

---

## 9-Rule Ordered Verification Pipeline

Every continuous sweep attempt submitted to `POST /api/sessions/{id}/checkin` is evaluated strictly in order:

| Rule | Rule Name | Pass Criteria / Behavior | Failure / Outcome |
| :--- | :--- | :--- | :--- |
| **1** | **Auth & Time Window** | Valid JWT, role `student`, enrolled in class, session open & `submitted_at <= ends_at + 5s`. | `session_closed` / `unauthorized` (REJECTED) |
| **2** | **Limits & Idempotency** | Unique `attempt_id`, student attempts < 3, at most one VERIFIED record per (session, student). | `max_attempts_exceeded` / `already_verified` (REJECTED) |
| **3** | **Image Quality** | Laplacian blur variance $\ge 100$, mean luminance $40 \dots 220$ across key frames. | `image_blurry` / `poor_lighting` (REJECTED with retake prompt) |
| **4** | **Sweep Evidence** | $\ge 12$ frames, duration 4–15s, roughly monotonic heading, gaps $\le 25^\circ$, total span $\ge 150^\circ$, visual continuity. | `sweep_too_fast` / `heading_span_insufficient` / `visual_splice_detected` (REJECTED) |
| **5** | **Self Match** | Early frames ($\le 30^\circ$) face compared against enrolled student embedding: Cosine $\ge 0.72$ pass, $0.50 \dots 0.71$ flagged, $< 0.50$ fail. | `self_similarity_low` (REJECTED) or FLAGGED |
| **6** | **Neighbour Presence**| $\ge 1$ distinct face in early frames within 3 face-widths of student face. | `neighbour_count_zero` (FLAGGED for lecturer review) |
| **7** | **Lecturer Identification**| Late frames ($\ge 150^\circ$): If face detected with IPD $\ge 30\text{px}$, match against lecturer embedding (Pass). If person detected but IPD $< 30\text{px}$, **FLAGGED** for lecturer review. If no person detected, fail. | `lecturer_face_low_resolution` (FLAGGED) / `lecturer_not_visible` (REJECTED) |
| **8** | **Fraud Signals** | Perceptual hash (dHash) near-duplicate cross-student / cross-session check. | `duplicate_media_detected` (FLAGGED for lecturer review) |
| **9** | **Decision** | All rules pass $\to$ **VERIFIED** (marked present + audit). Any hard failure $\to$ **REJECTED** (student may retry). Uncertain $\to$ **FLAGGED** (pending review queue). | Emits audit log & WebSocket events |

---

## Empirical Verification & Optical Findings

Running `experiments/panorama_verification/run_panorama_verification.py` across 15 standard classroom configurations ($3\text{m}$ to $24\text{m}$) demonstrates:
- **Verified Rate**: 20.0% (at close distances $\le 3\text{m}$ where IPD $\ge 30\text{px}$).
- **Flagged Rate**: 80.0% (at distances $\ge 6\text{m}$ where front-camera resolution yields IPD $< 30\text{px}$).
- **False Reject Rate**: 0.0%.
- **Finding**: Smartphone front cameras have wide lenses and fixed focal lengths. At typical classroom distances, lecturer faces cannot be biometrically verified with certainty. The pipeline correctly routes these attempts to the lecturer review queue with key-frame filmstrips rather than falsely claiming liveness or rejecting genuine students.

---

## Running Locally

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate  # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Run tests:
```bash
pytest backend/tests
```

### 2. Dashboard (React / Vite)
```bash
cd apps/dashboard
npm install
npm run dev
# Build check
npm run build
```

### 3. Mobile App (Flutter)
```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
```

---

## Demo Accounts
- **Lecturer**: `teacher@demo.edu` / `teach123` (Role: Lecturer, DB role: `teacher`)
- **Student 1**: `student1@demo.edu` / `student123` (Enrolled in CS 204)
- **Student 2**: `student2@demo.edu` / `student123` (Enrolled in CS 204)

---

## Verification Status in this Environment
- **Backend**: 13 unit, negative, and experiment tests passing (`pytest backend/tests`).
- **Dashboard**: TypeScript compile and Vite bundle passing cleanly (`npm run build`).
- **Experiments**: Optical feasibility and panorama sweep benchmark executed and reported (`experiments/panorama_verification/results/summary_report.md`).
- **Mobile Client**: Dart models, services, role selection, enrollment, sweep capture, and countdown screens fully implemented and wired. Note: Physical device camera hardware and real classroom sweeping remain untested in this headless development environment.
