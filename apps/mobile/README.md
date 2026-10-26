# Classroom Attendance mobile client

A Flutter/Dart demo client for the shared classroom attendance API. It is a **review-first simulated attendance prototype**: it does not perform face recognition, retain biometric templates, or send email/SMS.

## Run configuration

From this directory on a machine with Flutter installed:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
```

`API_BASE_URL` defaults to `http://10.0.2.2:8000/api`, which reaches a local API from the Android emulator. For an iOS simulator use `http://127.0.0.1:8000/api`. For a physical device, use the development computer's LAN IP (for example `http://192.168.1.20:8000/api`) and ensure the API binds to that interface. Use HTTPS/WSS in production. To build the browser target, run `flutter build web`; pass a browser-reachable API URL with `--dart-define` when needed.

Android capture uses the system camera intent via Flutter's `image_picker` integration. `NSCameraUsageDescription` is included in `ios/Runner/Info.plist`. The app uses `ImagePicker().pickImage(source: ImageSource.camera)` only; there is no gallery path. Native Android APK/device verification requires an Android SDK and a compatible device/emulator; native iOS builds require macOS/Xcode.

## Demo accounts

- Teacher: `teacher@demo.edu` / `teach123`
- Student: `student1@demo.edu` / `student123`
- Student: `student2@demo.edu` / `student123`

## Panorama attendance module

The app also embeds the student side of the **panorama attendance** system (`apps/panorama/api` — FastAPI + OpenCV YuNet/SFace verification). Entry point: the panorama icon in the home app bar.

- Student sign-in uses the panorama API (`POST /api/auth/login`, role `student`), then lists live attendance windows (`GET /api/student/sessions/active`) and per-course history (`GET /api/student/history`).
- "Mark attendance" runs the same guided live capture as the web app: the front camera films the student for 8s, the app switches to the back camera, and the student sweeps ~180° across the lecturer on the podium and the class. Frames sampled every ~600ms (4 minimum, ~16s) are uploaded with the selfie to `POST /api/sessions/{id}/submit`; the server stitches them into the panorama and runs the full verification pipeline. There is no manual upload path.
- Backend URL: `--dart-define=PANORAMA_API_URL=http://<host>:8100/api` (default `http://localhost:8100/api`; use `10.0.2.2` on the Android emulator).
- Requires the `camera` plugin; `CAMERA` permission is declared in `android/app/src/main/AndroidManifest.xml` and `NSCameraUsageDescription` already exists in `ios/Runner/Info.plist`. Panorama demo students: `student1..5@demo.edu` — passwords are printed by `python seed.py` (random per run unless `PANORAMA_SEED_STUDENT_PASSWORD` is set).

## Product behavior

- Teacher flow: class list → start session → live roster → camera capture → clearly labelled synthetic confidence suggestions → accept/edit as desired → manual present/absent/pending overrides → explicit finalization.
- Camera files are uploaded once and the local temporary file is deleted after the request when possible. The API does not persist uploaded captures.
- Student flow: own attendance entries, totals, percentage, sessions, and private in-app notifications.
- Realtime: a single-use `/auth/ws-ticket` is obtained before `/ws?ticket=...`; incoming events trigger authoritative API refreshes. Reconnect and API failures are visible with retry/manual roll-call alternatives.
- Notifications are app-only. No push, email, SMS, face template, or face recognition code is present.

This is a development demo. Do not use real student data. Replace demo authentication, secure transport/storage, retention, audit, and privacy controls before any production use.
