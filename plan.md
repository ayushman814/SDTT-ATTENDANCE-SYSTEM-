# Smart Classroom Attendance — implementation plan

## Product scope

Reuse the repository's Flutter mobile app, responsive React dashboard, FastAPI service, and Supabase database/Auth/Storage. Students authenticate with a school-provisioned ID/email account and submit a classroom panorama during a scheduled window. The backend validates image quality and scene-level people/stage evidence; it does not perform facial recognition or identify the people shown. Uncertain outcomes go to a professor for review. Manual roll call and explicit finalization remain available.

## Components and current workflow

- `apps/mobile/`: role-selected sign-in, student timed-session card with countdown/panorama guidance/preview/progress, own history/notifications, professor session scheduling, roster review, and submission review.
- `apps/dashboard/`: role-aware login, student attendance/history and image submission, professor timed-session scheduling, private image review/manual decisions, audit and report/export.
- `backend/`: Supabase Auth verification, administrator-assigned roles, Postgres session/attendance/submission records, server-time window enforcement, image checks/person detector, private Storage, retention cleanup, audit, notifications, and WebSocket events.
- `backend/supabase_schema.sql` and `backend/migrations/`: fresh install and existing-project upgrade.
- `docs/`: API contract, privacy/deployment, requirement status, and validation.

## State and safety rules

Sessions are scheduled, open, closed, or finalized. Server time—not client clocks—controls submission access. A qualifying scene result may mark the authenticated submitter present but is not identity evidence. `NEEDS_REVIEW` and `REJECTED` remain pending until a professor decision or manual edit. Duplicate submissions are constrained per student/session; an automatic rejection may be retried before review while the session is open. Closing precedes finalization; finalization marks remaining pending students absent, records audit events, and creates private in-app notifications.

Image objects are private and deleted by an hourly backend task after the configured retention period (default 30 days). Attendance/submission metadata remains. There is no email/SMS sender, push service, biometric template, face matcher, lecturer identity/orientation detector, or accuracy/fairness guarantee.

## Realtime contract

REST remains authoritative. Authenticated clients obtain a short-lived one-use WebSocket ticket and receive session/submission/attendance/finalization/notification update signals; clients refetch data after events and reconnects.

## Verification and limitations

Automated tests and builds should be run after each change. Live Supabase schema/Auth/Storage/realtime behavior requires project credentials, which are not present in the repository. Native Android camera testing requires an Android SDK/device; iOS builds require macOS/Xcode. See [`docs/BUILD_VALIDATION.md`](docs/BUILD_VALIDATION.md) for actual checks performed.
