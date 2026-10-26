# Requirements review and implementation status

## Implemented in this pass

- Reused the existing Flutter, React/TypeScript, FastAPI, and Supabase stack; replaced the fake SQLite/synthetic capture path rather than changing the framework.
- Role-selected student/professor sign-in accepts registration ID or email. The backend authenticates through Supabase Auth and reads roles from provisioned profiles; students cannot invoke professor-only routes or see other students' private submissions.
- Professors can create timed sessions with a title, date/open time, duration/deadline, class, visible-person threshold, and optional normalized stage region. Server time drives scheduled/open/closed states, late uploads are rejected, early opening is explicit, and the dashboard/mobile controls close-before-finalize.
- Students receive class/session/professor and opening/deadline information, live countdown, own history/status, guided panorama workflow, image preview/retake, upload progress, and confirmation. Flutter guides the student to use the native camera's panorama mode and upload the saved panorama; the gallery original stays on the device.
- Backend performs real image decoding/quality checks and pretrained person detection for scene-level people/stage-region evidence. Configurable counts and stage region are supported. Invalid quality, detector failure, low confidence, or absent scene evidence do not silently mark present. The old synthetic capture route returns HTTP 410.
- Submissions and review metadata are stored in Postgres; image bytes use a private Supabase Storage bucket. Professor-only short-lived signed URLs support review. The backend retention worker deletes image objects after the configured default 30 days and clears image hashes/paths while preserving attendance and review metadata.
- Uncertain/rejected items remain pending. Professors see image/quality/scene evidence and can approve or reject with a required reason; attendance provenance distinguishes automatic scene verification from manual review. Manual roster edits, audited finalization, student-only attendance, in-app notifications, realtime refresh, CSV, and print-friendly report HTML are wired.
- The client login no longer pre-fills credentials or presents demo shortcuts. A guarded synthetic-account seeder accepts passwords only from environment variables.

## Explicit limitations and non-claims

The model detects people and scene layout only. It does not recognize student faces, prove the uploader appears in the photo, verify registration/identity of people shown, establish the lecturer's identity or physical presence, estimate body facing direction, or prove the lecturer is opposite the camera. Panorama capture is guided rather than forced into native panorama mode because `image_picker` cannot select that camera mode. A person-detection success is fallible evidence, not an attendance guarantee; manual attendance and professor review remain necessary.

No real Supabase credentials/project were available, so migrations, Auth provisioning, private Storage upload, signed image previews, realtime, and end-to-end network behavior have not been tested against a live project. The model may download weights on first inference; model and dependency license/provenance review is required before deployment. Android camera and iOS builds require device/platform toolchains. No fairness/accuracy benchmark, legal compliance certification, deployment, push notification provider, or production-readiness claim is made.

## Critical setup

Run `backend/supabase_schema.sql` on a fresh project, or apply `backend/migrations/20261026_smart_attendance.sql` after the earlier schema. Configure server-only Supabase credentials and `ATTENDANCE_IMAGE_RETENTION_DAYS` in `backend/.env`. Provision roles and class enrollments as an administrator; never let public signup metadata assign professor privileges. Follow [`API_CONTRACT.md`](API_CONTRACT.md) and [`PRIVACY_AND_DEPLOYMENT.md`](PRIVACY_AND_DEPLOYMENT.md).
