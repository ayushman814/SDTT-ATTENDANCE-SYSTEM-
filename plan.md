# Attendrix Attendance Verification — Architecture & Execution Plan

## 1. Product Scope & Workflow
Attendrix provides continuous front-camera sweep attendance verification for real lecture halls:
1. **Role Selection & Secure Authentication**: "I am a Student" / "I am a Lecturer", enforced with server-side role validation.
2. **Biometric Reference Selfie Enrollment**: Front-camera single-face enrollment with quality checks and Fernet AES-encrypted 512-d template storage (service-role only, never exposed via API).
3. **Timed Sessions**: Lecturer creates session with duration presets (5, 10, 15 min, custom). Server clock enforces deadline strictly (`now <= ends_at + 5s`). Lifespan background task and lazy evaluation auto-close sessions and broadcast `session.closed`.
4. **Student Continuous Sweep Capture**: 1s selfie hold $\to$ 180° continuous horizontal arc $\to$ 1s hold facing stage. Continuous frame sampling (~5 fps) tagged with gyroscope heading and time offsets, guided by haptics, audio cues, and visual progress arc.
5. **Ordered 9-Rule Verification**: Auth/window, limits/idempotency, blur/luminance quality, sweep duration/monotonicity/visual continuity, self match (ArcFace cosine $\ge 0.72$), neighbour presence ($\ge 1$ within 3 face-widths), lecturer detection (IPD $\ge 30\text{px}$ match, IPD $< 30\text{px}$ FLAGGED), pHash duplicate prevention, and final decision.
6. **Lecturer Review Queue & Opt-Out Override**: Flagged attempts reviewable with key-frame filmstrips; manual roll-call override available at all times.

---

## 2. Architecture & Components
- **`backend/`**: FastAPI REST API + WebSocket service. Single consolidated entrypoint (`backend/app/main.py`), Supabase Postgres/Auth + in-memory database fallback for deterministic tests.
- **`apps/mobile/`**: Flutter application (Android/iOS) with `SweepCaptureScreen`, `EnrollmentScreen`, `RoleSelectionScreen`, and server-synced countdown timer cards.
- **`apps/dashboard/`**: React + TypeScript + Vite dashboard with Lecturer workspace, live countdowns, headline verified counts, filmstrip review queue, and CSV/HTML report exports.
- **`experiments/`**:
  - `experiments/optical_feasibility/`: Evaluates front-camera optical resolution and blur/luminance thresholds.
  - `experiments/panorama_verification/`: Empirical runner measuring per-rule pass rates and lecturer check flagged rate across classroom distances.

---

## 3. Privacy, Storage & Licenses
- Ephemeral raw sweep frames are purged immediately after analysis for VERIFIED and REJECTED attempts.
- Only key-frame filmstrips for FLAGGED attempts are stored in private storage (7-day automated expiration).
- YuNet face detection is licensed under Apache 2.0 (commercial use permitted).
- ArcFace official pre-trained weights carry non-commercial research restrictions; enterprise deployment requires open-weight replacement or custom-trained embeddings.

