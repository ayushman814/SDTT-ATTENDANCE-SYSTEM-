# Classroom Attendance mobile client

Flutter/Dart client for the shared classroom attendance API. The app defaults to the deployed Render backend, so a local API server is not required for normal use.

## Run

```bash
flutter pub get
flutter run
```

The default API base is `https://sdtt-attendance-system.onrender.com/api`. If your deployment uses a different API, pass its URL with `--dart-define=API_BASE_URL=https://your-api.example.com/api`. The in-app server URL setting can also be changed when your administrator provides another endpoint.

For optional local backend development, use a reachable local address, for example `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api` from an Android emulator. For a physical device, use the development computer's LAN address. Do not use localhost unless the device can reach the server at that address.

## Product behavior

Professors can schedule sessions, set the opening/deadline window, configure the stage-region rectangle and visible-person threshold, review student submissions, make manual attendance decisions, and finalize reports. Students sign in with their registered ID or email, capture and submit a classroom panorama, view their own attendance, and receive in-app notifications.

Image analysis provides fallible scene evidence only. It does not recognize or match student/lecturer identities. The server controls attendance windows and image retention. See `../../docs/PRIVACY_AND_DEPLOYMENT.md` before using real student data.

Native Android camera behavior requires a compatible Android SDK/device or emulator; native iOS builds require macOS/Xcode. In a Flutter-enabled environment, run `flutter analyze`, `flutter test`, and optionally `flutter build web` to validate the client.
