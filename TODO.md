# Delivery checklist and status

## Implemented

- Existing Flutter, React/TypeScript, FastAPI, and Supabase stack reused.
- Registration-ID/email login with Supabase Auth; provisioned backend profiles determine roles. Demo credentials are no longer prefilled in the UI.
- Professor session creation supports a title, opening time, deadline/duration, visible-person threshold, and optional normalized stage region. Server time enforces scheduled/open/closed state, early-open, close, and late-upload rejection.
- Student panorama workflow in web and mobile: framing instructions, preview/retake, image submission, progress/confirmation, timed status, own history, and in-app notifications.
- Real image validation, quality checks, and pretrained person detection for scene-level evidence; no fake success, face recognition, embeddings, identity matching, lecturer identity, or orientation claims.
- Private Supabase Storage, metadata-free re-encoded images, professor-scoped expiring image URLs, review UI/API with required reasons, manual attendance, provenance tracking, audit, CSV/printable report, and app/API realtime signals.
- Hourly server worker purges image objects after `ATTENDANCE_IMAGE_RETENTION_DAYS` (default 30) and clears the corresponding Storage path/hash while keeping attendance and review metadata.
- Legacy simulated capture endpoint is disabled with HTTP 410. Guarded development account seeder reads passwords from environment variables.
- Setup/API/privacy/requirements documentation updated for Supabase and the scene-only model limits.
- Optional model-backed face enrollment, guided liveness, separate identity/context verification results, controller registration/import endpoints, real XLSX workbook exports, cross-platform launcher, and a rendered product walkthrough were added.

## Verification in this work session

- Backend tests: `18 passed`; Python compilation passed. The suite uses fake Supabase clients for session-time and retention cases and a deterministic injected detector; it does not download model weights.
- Product video: `artifacts/attendrix_product_walkthrough.mp4` rendered successfully at 1280×720, 24fps, 840 frames.
- Dashboard `npm run build`: TypeScript check and Vite production build passed after the final cleanup.
- Flutter/Dart analyzer and widget tests could not run because neither `flutter` nor `dart` is installed in the current environment.
- Dashboard/presentation builds could not run because Node.js/npm are not installed in the current environment.
- No live Supabase project/credentials are available, so migrations, Auth provisioning, private Storage upload, signed image previews, realtime network behavior, and end-to-end session testing are not claimed.

## Remaining external/deployment requirements

- Run the fresh schema or upgrade migration against a real Supabase project, configure server-only secrets and CORS, provision real profiles/roles/enrollments, and confirm private bucket lifecycle.
- Review the Ultralytics/model license and weights provenance, then evaluate quality thresholds and scene heuristics in real classroom conditions.
- Complete institutional/legal/privacy/security/fairness review before using real student records or images. Configure production TLS/WSS, backups, monitoring, incident response, and approved deletion policy.
- Native Android device camera behavior and iOS builds need platform toolchains/devices. No accuracy, latency, fairness, legal-compliance, or production-readiness claim is made.
