# Privacy, Security, and Deployment Specification — Attendrix

## 1. Biometric Data Protection & Encryption

- **Reference Template Storage**:
  - Reference selfies enrolled via `POST /api/auth/enroll` are processed in memory to generate a 512-dimensional vector embedding.
  - The raw selfie image is discarded after enrollment.
  - The vector embedding is encrypted using **Fernet AES-128-CBC with SHA256 HMAC** before database insertion (`face_templates` table).
  - Templates include model version metadata (`arcface_r100_v1`) and an explicit `consent_timestamp`.
  - Under Row Level Security (RLS), biometric templates are readable exclusively by the backend service role and are never exposed via any client or external API.

- **Continuous Sweep Media Lifecycle**:
  - **VERIFIED & REJECTED Attempts**: All raw frame images uploaded during continuous sweep captures are ephemeral and purged immediately upon analysis completion. Only numerical metrics (Laplacian variance, span, heading gaps, similarity scores) and reason codes are saved to `checkin_attempts`.
  - **FLAGGED Attempts**: Only a small filmstrip of extracted key frames (up to 4–6 frames capturing student selfie, trajectory, and lecturer stage) is uploaded to private storage with time-limited signed URLs.
  - **Retention & Auto-Purge**: Filmstrip files in private storage are governed by an automated 7-day retention lifecycle policy, after which they are permanently deleted.

---

## 2. Computer Vision Model Licenses & Commercial Restrictions

The system implements a unified `FaceEngine` abstraction (`backend/app/face_engine.py`):

1. **YuNet Face Detector (OpenCV Model Zoo)**:
   - **License**: **Apache 2.0**.
   - **Permitted Use**: Commercial and non-commercial deployment permitted with standard attribution.
2. **ArcFace Face Recognizer (DeepInsight / ONNX Runtime)**:
   - **License**: Non-commercial / academic research restrictions apply to official pre-trained InsightFace model weights (e.g. `glint360k_r100.onnx` or `w600k_r50.onnx`).
   - **Production Requirement**: For production enterprise deployment, the embedding model must either:
     - Be retrained on an open, commercially licensed biometric dataset, or
     - Be replaced with an Apache 2.0 / MIT-licensed face feature extractor (e.g., OpenFace, FaceNet PyTorch with permissible weights).

---

## 3. Server-Authoritative Integrity & Time Enforcement

- **Clock Authority**:
  - All deadline evaluations (`submitted_at <= ends_at + grace_period`) are computed strictly against the server's UTC clock.
  - Client devices synchronize with `/api/time` to display estimated countdowns, but client device clocks are untrusted.
  - A background lifespan asyncio task in FastAPI monitors open sessions and transitions them to `closed` at `ends_at`.
  - Redundant lazy closure runs on every read and submission to guarantee consistency across worker restarts.
- **WebSocket Signals**:
  - On window closure, the backend emits `session.closed` with headline metrics (`present`, `needs_review`, `absent`, `rejected_attempts`, `total_enrolled`).

---

## 4. Optical Limitations & Honest Review Workflow

- **Distance Degradation (Optical Reality)**:
  - Smartphone front-facing cameras have fixed focal lengths and wide fields of view.
  - At distances $\ge 6\text{m}$ in lecture halls, the inter-pupillary distance (IPD) of the lecturer on stage falls below the $30\text{px}$ threshold necessary for reliable biometric identification.
  - Empirical testing confirms an **80% FLAGGED rate** for Rule 7 in real classroom distances.
  - **Safety Policy**: The backend neither falsely auto-verifies nor falsely rejects low-resolution lecturer frames. Instead, it marks the attempt `FLAGGED` and presents the key frame filmstrip to the lecturer in the Review Queue.
- **No Unsubstantiated Liveness Claims**:
  - The system checks heading monotonicity, capture duration (4–15s), frame rate, and frame-to-frame visual continuity.
  - Gyroscope heading data is client-supplied and spoofable; it is logged as supporting continuity evidence, never as cryptographic proof.
- **Opt-Out Route**:
  - Manual roll-call overrides (`PATCH /api/sessions/{id}/attendance/{student_id}`) allow lecturers to directly mark students present or absent with an audited rationale.

