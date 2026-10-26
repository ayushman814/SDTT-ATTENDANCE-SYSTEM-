# Build and integration validation

Validation run: 2026-10-26, in the Manus Sandbox clone of `pragna1004/SDTT-ATTENDANCE-SYSTEM-`.

## Checks completed

- Backend Python compilation: `python -m py_compile app/main.py app/vision.py tests/test_api.py tests/test_vision.py` — passed.
- Backend tests: `python -m pytest -q` in an isolated test virtual environment — **15 passed**. Tests cover timed-session transitions, role/JWT contract helpers, disabled legacy capture, private-image retention behavior, image quality outcomes, fail-closed detector errors, scene evidence, and removal of embedded EXIF from stored copies. The vision tests inject a deterministic detector; they do not download Ultralytics weights or call Supabase.
- Dashboard: `npm run build` in `apps/dashboard/` — TypeScript check and Vite production bundle passed.

## Checks not available or not performed

- Flutter/Dart validation was not run: neither `flutter` nor `dart` is installed in the current sandbox. Mobile source changes therefore still need `flutter analyze`, `flutter test`, and a web build in a Flutter-enabled environment.
- No Supabase project credentials were available. Schema execution, Supabase Auth, RLS, private Storage upload/signed URLs, realtime network behavior, and full frontend-to-backend E2E flows have not been tested against a live service.
- No YOLO weight download/inference benchmark was performed. The model is loaded lazily in production and detector behavior in unit tests is injected.
- No Android/iOS device camera, native build, public deployment, accuracy/fairness benchmark, or production-security review is claimed.

## Reproducible commands

From `backend/`, use `python -m venv .venv`, activate it, install `requirements.txt`, then run `python -m py_compile app/main.py app/vision.py tests/test_api.py tests/test_vision.py` and `python -m pytest -q`. A first real inference may download the configured Ultralytics model weights; consider supplying an approved local file with `ATTENDANCE_PERSON_MODEL` after license and provenance review.

From `apps/dashboard/`, run `npm ci` followed by `npm run build`.

From `apps/mobile/` in a Flutter-enabled environment, run `flutter pub get`, `flutter analyze`, `flutter test`, and optionally `flutter build web`. Native Android camera behavior needs an Android SDK/device; native iOS builds need macOS/Xcode.
