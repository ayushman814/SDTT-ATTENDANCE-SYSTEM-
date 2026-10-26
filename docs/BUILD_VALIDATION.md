# Build and integration validation

Validation run: 2026-10-27, in the local Windows Git Bash workspace.

## Checks completed

- Backend Python compilation: `backend/.venv/Scripts/python.exe -m py_compile ...` — passed.
- Backend tests: `backend/.venv/Scripts/python.exe -m pytest -q` — **18 passed**. Tests cover timed-session transitions, role/JWT contract helpers, disabled legacy capture, private-image retention, image quality outcomes, fail-closed detector errors, scene evidence, metadata stripping, liveness input requirements, biometric-key fail-closed behavior, and workbook sheet contents. Tests do not download model weights or call Supabase.
- OpenAPI route generation: imported the FastAPI app with test configuration — passed; 31 routes were generated, including live verification, controller registry, and XLSX export routes.
- Walkthrough renderer: `backend/.venv/Scripts/python.exe scripts/render_walkthrough.py` — passed; generated a 1280×720, 24fps, 840-frame MP4.

## Checks not available or not performed

- Dashboard/presentation builds were not run: Node.js and npm are not installed in the current environment. Run `npm ci && npm run build` in `apps/dashboard/` and `presentation/attendrix/` on a Node-enabled machine.
- Flutter/Dart validation was not run: neither `flutter` nor `dart` is installed in the current environment. Mobile source changes therefore still need `flutter pub get`, `flutter analyze`, `flutter test`, and a web build in a Flutter-enabled environment.
- No Supabase project credentials were available. Schema execution, Supabase Auth, RLS, private Storage upload/signed URLs, realtime network behavior, and full frontend-to-backend E2E flows have not been tested against a live service.
- No DeepFace or YOLO weight download/inference benchmark was performed. The models are loaded lazily in production and detector behavior in unit tests is injected.
- No Android/iOS device camera, native build, public deployment, accuracy/fairness benchmark, or production-security review is claimed.

## Reproducible commands

From the repository root, run `./run.sh check`, then `./backend/.venv/Scripts/python.exe -m pytest -q` and `./backend/.venv/Scripts/python.exe -m py_compile backend/app/main.py backend/app/vision.py backend/app/verification.py backend/app/reports.py`. A first real inference may download configured model weights; supply approved local files after license and provenance review.

From `apps/dashboard/`, run `npm ci` followed by `npm run build`.

From `apps/mobile/` in a Flutter-enabled environment, run `flutter pub get`, `flutter analyze`, `flutter test`, and optionally `flutter build web`. Native Android camera behavior needs an Android SDK/device; native iOS builds need macOS/Xcode.
