# Shared API Contract — Attendrix Attendance Verification

Base path: `/api`. All JSON payloads are UTF-8. Authenticated routes require `Authorization: Bearer <access_token>`.

---

## 1. Authentication, Roles & Biometric Enrollment

- `POST /api/auth/login`
  - Request: `{ "email": string, "password": string, "selected_role"?: "student" | "lecturer" }`
  - Behavior: Verifies account credentials. If `selected_role` is supplied, rejects mismatch (`403 Forbidden`).
  - Response: `{ "access_token": string, "token_type": "bearer", "user": { "id": string, "name": string, "email": string, "role": "teacher" | "student" } }`
  - Note: In database and token payload, lecturer role is stored as `"teacher"`. The UI displays "Lecturer".

- `POST /api/auth/enroll`
  - Headers: `Authorization: Bearer <token>`
  - Body: Multipart Form (`photo`: binary image, `consent`: `"true"` | `"false"`)
  - Validation: Requires front camera image with exactly one clear face (Laplacian blur variance $\ge 80$, luminance $40 \dots 220$). Rejects multi-face, no-face, or blurry images.
  - Storage: Computes 512-d ArcFace embedding, encrypts using Fernet AES-128-CBC + SHA256 HMAC, and stores in `face_templates` table alongside model version (`arcface_r100_v1`) and consent timestamp.
  - Security: Biometric embeddings are service-role readable only and are never exposed via any API endpoint.
  - Response: `{ "status": "enrolled", "model_version": string, "enrolled_at": string }`

- `GET /api/auth/enrollment-status`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "enrolled": boolean, "enrolled_at": string | null, "model_version": string | null }`

- `GET /api/me`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "id": string, "name": string, "email": string, "role": string }`

- `POST /api/auth/ws-ticket`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "ticket": string, "expires_in": 60 }` (single-use ticket for WebSocket connection)

- `GET /api/time`
  - Response: `{ "server_time": ISO8601, "timestamp": float }`
  - Purpose: Provides server-authoritative clock for client countdown calculations.

---

## 2. Classes and Sessions

- `GET /api/classes`
  - Response: `[{ "id": string, "name": string, "code": string, "student_count": int }]`

- `GET /api/classes/{class_id}/students`
  - Access: Lecturer only (`role == "teacher"`).
  - Response: Roster of students enrolled in the class.

- `GET /api/sessions`
  - Access: Authenticated users.
  - Response: For lecturers, all created sessions. For students, relevant sessions in enrolled classes.

- `POST /api/sessions`
  - Access: Lecturer only.
  - Request: `{ "class_id": string, "duration_minutes"?: int }` (presets: 5, 10, 15, or custom; default 10, max 60).
  - Behavior: Computes server-authoritative `starts_at` and `ends_at`. Populates class roster with status `"pending"`.
  - Response: Session object (`status: "open"`).

- `GET /api/sessions/{session_id}`
  - Behavior: Lazy auto-close check executed; if `server_time >= ends_at`, marks session `"closed"`.
  - Response: Session details with enrolled roster, counts (`present_count`, `pending_count`, `absent_count`), and time limits.

---

## 3. Continuous Front-Camera Sweep Check-in

- `POST /api/sessions/{session_id}/checkin`
  - Access: Student only (`role == "student"`, must be enrolled in session's class).
  - Body: Multipart Form
    - `attempt_id`: Unique UUID client idempotency key.
    - `metadata`: JSON array containing frame headings and time offsets:
      ```json
      [
        {"frame_index": 0, "offset_ms": 0, "heading": 0.0},
        {"frame_index": 1, "offset_ms": 200, "heading": 12.5},
        ...
      ]
      ```
    - `frames`: Continuous recorded video frame images (multipart files `frame_0.jpg`, `frame_1.jpg`, ...).
  - 9-Rule Ordered Verification Pipeline:
    1. **Auth & Window**: Session open, `now <= ends_at + 5s` grace.
    2. **Limits**: Unique `attempt_id`, student attempts $\le 3$, at most 1 VERIFIED record per student.
    3. **Quality**: Laplacian variance $\ge 100$, luminance $40 \dots 220$.
    4. **Sweep Evidence**: $\ge 12$ frames, 4–15s duration, monotonic heading, gaps $\le 25^\circ$, total span $\ge 150^\circ$, visual continuity.
    5. **Self Match**: Early frames ($\le 30^\circ$) matched with student template: $\ge 0.72$ pass, $0.50 \dots 0.71$ flagged, $< 0.50$ fail.
    6. **Neighbour Presence**: $\ge 1$ distinct classmate face detected in early frames within 3 face-widths.
    7. **Lecturer Identification**: Late frames ($\ge 150^\circ$): face with IPD $\ge 30\text{px}$ matched (Pass); person detected with IPD $< 30\text{px}$ (**FLAGGED** for lecturer review); no person detected (Fail).
    8. **Fraud Signals**: dHash perceptual near-duplicate check.
    9. **Decision**:
       - `VERIFIED` $\to$ Marks attendance `present`, logs audit event.
       - `FLAGGED` $\to$ Stores key-frame filmstrip in private storage (7-day retention), adds to Lecturer Review Queue.
       - `REJECTED` $\to$ Purges raw frames, returns specific plain-language reason code.
  - Response:
    ```json
    {
      "status": "verified" | "flagged" | "rejected",
      "attempt_id": string,
      "reason_codes": string[],
      "decision_rule": string,
      "metrics": object,
      "filmstrip_urls": string[]
    }
    ```

---

## 4. Lecturer Review Queue & Overrides

- `GET /api/sessions/{session_id}/review-queue`
  - Access: Lecturer only.
  - Response: List of flagged attempts containing `student_name`, `student_email`, `reason_codes`, and signed URLs for filmstrip key frames.

- `POST /api/sessions/{session_id}/review/{attempt_id}`
  - Access: Lecturer only.
  - Request: `{ "decision": "verified" | "rejected", "note"?: string }`
  - Behavior: If `verified`, updates student attendance to `present`. Audits action and broadcasts WebSocket update.

- `PATCH /api/sessions/{session_id}/attendance/{student_id}`
  - Access: Lecturer only (manual roll-call override / opt-out route).
  - Request: `{ "status": "present" | "absent" | "pending", "note"?: string }`
  - Behavior: Directly updates record with required audit note.

- `POST /api/sessions/{session_id}/finalize`
  - Access: Lecturer only.
  - Request: `{ "mark_pending_absent"?: boolean }` (default `true`)
  - Behavior: Sets session status to `"finalized"`, converts remaining `"pending"` students to `"absent"`, generates student notifications, and publishes record.

- `GET /api/reports/sessions/{session_id}`
  - Response: CSV text, print-ready HTML report, and attendance summary.

- `GET /api/audit?session_id=<id>`
  - Response: Full chronological immutable audit trail.

---

## 5. Real-Time WebSockets

- Endpoint: `GET /ws?ticket=<ticket>`
- Events:
  - `session.created` — Broadcast when lecturer launches a session.
  - `attendance.changed` — Emitted on verified check-in or review queue decision.
  - `session.closed` — Emitted when session reaches `ends_at`. Payload:
    ```json
    {
      "session_id": string,
      "present": int,
      "needs_review": int,
      "absent": int,
      "rejected_attempts": int,
      "total_enrolled": int
    }
    ```
  - `session.finalized` — Emitted on lecturer final confirmation.
  - `notification.created` — Sent privately to affected student.

