# Privacy and deployment notes

## What the prototype processes

Students submit classroom images and guided front-camera frames to the FastAPI service during an authorized attendance window. Face embeddings are encrypted with a server-only key; raw enrollment and liveness frames are not stored. Identity matching, OpenCV liveness heuristics, and classroom scene evidence are separate checks. A `CONFIRMED` result means those configured checks passed for the authenticated account; it cannot prove exact physical position, identify every person in a 240-seat room, or provide perfect spoof protection. Missing models and uncertain evidence become `PENDING_REVIEW`, and the model may miss or incorrectly detect evidence.

Images are re-encoded without embedded metadata and stored in the private Supabase Storage bucket for professor review. Only authorized professors can obtain short-lived signed image URLs for sessions they own. Students can read only their own attendance/submission status, not classmates' image files. The backend retention worker deletes image objects and clears path/hash references after `ATTENDANCE_IMAGE_RETENTION_DAYS` (default 30, range 1–3650). Attendance and review metadata remain; deletion is not a full record-erasure workflow. Students select a saved panorama from their device gallery, so the original gallery file remains under the device owner's control.

Scene evidence that is uncertain or rejected does not automatically become present. Professors can record an audited approve/reject reason or use manual roll call. Finalization is explicit, happens after closing, and marks remaining pending records absent. Notifications are private in-app records only; no email, SMS, or push provider is configured. WebSocket messages are signals to refresh authoritative REST data.

## Before using real student data

This project is a functional prototype, not a certified school system. Before any pilot, determine jurisdiction-specific education, privacy, biometric, accessibility, and records rules; provide clear notice and lawful basis/consent as applicable; offer a reliable opt-out/manual attendance route; set approved image and record-retention schedules; complete threat modeling, access-control review, security testing, and incident response planning; secure TLS/WSS, secret storage, database/storage backups, monitoring, and key rotation; and review model/dependency licenses and model provenance.

Evaluate false accepts/rejects across actual classroom layouts, panoramic camera types, lighting, pose, occlusion, different distances, and relevant demographic/accessibility factors. The configured people threshold and stage region are heuristics, not a published accuracy guarantee. Do not rely on literature benchmark scores as this system's classroom performance. Do not claim lecturer detection, direction/orientation verification, liveness, identity, consent, legal compliance, fairness, or production readiness without separate evidence and institutional approval.

No credentials are committed. Use Supabase Auth and administrator-provisioned `profiles` roles; keep the service-role key and JWT secret on the backend only. The SQL trigger assigns newly registered profiles as students by default. Development seed accounts are synthetic and guarded; use strong unique environment-supplied passwords and never use them for real data.
