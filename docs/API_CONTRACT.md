# Shared API contract

Base path: `/api`. JSON is UTF-8. Authenticated HTTP routes use `Authorization: Bearer <Supabase access token>`. IDs are UUID strings. The backend verifies Supabase Auth tokens and resolves the caller's role from the administrator-provisioned `profiles` row; client-supplied user metadata cannot grant a professor role.

## Authentication and identity

- `POST /auth/login` accepts `{ "identifier": "registration-id-or-email", "password": "..." }`; legacy `email` input is accepted. It returns `{access_token, token_type, user:{id,name,email,role,registration_id}}`.
- `GET /me` returns the authenticated provisioned profile.
- `POST /auth/ws-ticket` returns a short-lived, single-use `{ticket}`. The ticket—not the bearer token—is used for WebSocket connection.
- Roles are `teacher` and `student`. Student routes are scoped to the authenticated student's own profile and class enrollments.

## Classes and timed sessions

- `GET /classes` returns a professor's classes or the student's enrolled classes.
- `GET /classes/{class_id}/students` returns an enrolled roster; professor only.
- `GET /sessions` returns relevant sessions ordered newest first. Server time synchronizes scheduled/open/closed state.
- `POST /sessions` is professor-only and accepts `{class_id, title?, opens_at?, deadline_at?, stage_region?, minimum_people_visible?}`. Datetimes must include timezone offsets. `stage_region` uses normalized coordinates `{x,y,width,height}` in the 0–1 range. Defaults are now and a ten-minute window. A pending attendance row is created for each enrolled student.
- `GET /sessions/{session_id}` returns role-limited detail. Professor detail includes roster; student detail includes only their own attendance and submission state.
- `POST /sessions/{session_id}/open` allows a professor to open a scheduled session early while preserving its deadline.
- `POST /sessions/{session_id}/close` closes a scheduled/open window; repeated close is idempotent. Server-side state checks prevent submissions after the deadline.
- `POST /sessions/{session_id}/capture` is retired and returns HTTP 410; no synthetic suggestions are generated.

## Student scene-evidence submission

- `POST /sessions/{session_id}/submissions` is student-only, multipart field `photo`. The student must be enrolled and the server must consider the session open. Supported MIME types are JPEG, PNG, and WebP; size limit defaults to 10 MiB.
- The image is quality-checked for format, minimum width/height, panoramic aspect ratio, blur, and brightness, then analyzed with a pretrained person detector. Optional stage-region and visible-person criteria classify scene evidence.
- Result status is `VERIFIED`, `NEEDS_REVIEW`, or `REJECTED`. `VERIFIED` means only that the configured scene criteria passed for an authenticated submitter; it does not identify a student, lecturer, or any person in the image. Uncertain/rejected submissions remain pending until a professor decides or manually corrects attendance.
- Each student may have one submission per session. An automatic `REJECTED` submission may be replaced before a professor decision, subject to the open window. The retry updates the existing submission row and increments `attempt_number`.
- Upload images are stored only in the private `attendance-submissions` Supabase bucket. A background retention worker (default 30 days, configurable with `ATTENDANCE_IMAGE_RETENTION_DAYS`) deletes expired image objects and clears storage path/hash references. Attendance and review metadata remain.

## Professor review, attendance, and reports

- `GET /sessions/{session_id}/submissions` is professor-only and returns submission metadata, scene evidence, review status, and a signed private `image_url` with short expiry. Student accounts cannot access classmates' images.
- `POST /sessions/{session_id}/submissions/{submission_id}/review` accepts `{decision:"approve"|"reject", reason}`. Decisions and reason are audited. Approve sets present; reject returns the student's attendance to pending for later manual correction/finalization.
- `PATCH /sessions/{session_id}/attendance/{student_id}` accepts `{status:"present"|"absent"|"pending",note?}`; professor-only and audited.
- `POST /sessions/{session_id}/finalize` accepts `{mark_pending_absent:true}` and only succeeds after closing. Remaining pending students become absent; an audit record and private in-app notifications are written for enrolled students.
- `GET /students/me/attendance` returns only the student's records and summary (`present`, `absent`, `pending`, `total_finalized`, nullable `percentage`).
- `GET /reports/sessions/{session_id}` is professor-only and returns session metadata, rows, summary counts, CSV text, and print-friendly `pdf_html` (the API does not itself render a PDF).
- `GET /audit?session_id=<uuid>` is professor-only. `GET /notifications` and `POST /notifications/{notification_id}/read` are scoped to the current user.

## Realtime events

After `POST /auth/ws-ticket`, connect to `/ws?ticket=<ticket>` over WebSocket (`wss` in production). Tickets expire quickly and are consumed once. Events include `session.created`, `submission.created`, `attendance.changed`, `session.finalized`, and `notification.created`. Events are update signals; clients should re-fetch authoritative REST data after receipt or reconnect.

## Privacy and limits

No facial identity recognition, face embeddings, email/SMS sender, or push adapter is included. Image analysis is scene evidence only and can be wrong; keep manual attendance available. The current detector/model is a prototype component, not a verified accuracy claim. Review notice/consent, retention, model licensing, access controls, security, fairness, and jurisdiction-specific requirements before handling real student records or photos.
