# Panorama attendance — architecture

Two new apps under `apps/panorama/`; the existing prototype (`backend/`,
`apps/dashboard`, `apps/mobile`) is untouched.

```
apps/panorama/web  (React+TS+Vite+Tailwind PWA)
        │  REST /api/*  (+ /uploads/* images)
        ▼
apps/panorama/api  (FastAPI + SQLAlchemy + OpenCV)
   app/routes/*  — auth, users, sessions, submissions
   app/pipeline.py — the verification pipeline (core logic)
   app/vision.py   — YuNet detector + SFace recognizer (lazy singleton)
   app/imaging.py  — decode, dHash, blur, moire FFT, EXIF
   panorama.config.yaml — EVERY threshold in one file
   models/ — ONNX weights from scripts/download_models.py (gitignored)
   uploads/ — stripped copies of submissions and reference photos
```

## Flow

1. Role landing → role-aware register/login (JWT, bcrypt; a student cannot
   enter through the professor flow).
2. First login → `POST /me/face` enrolls the reference face: largest detected
   face → 128-dim SFace embedding stored on the user row (+ photo kept for
   audit/deletion).
3. Professor starts a session: server stamps `start_time`/`end_time` from its
   own clock. `maybe_close` flips status to `closed` on any read once expired,
   so the window cannot be extended client-side.
4. Student marks attendance with the camera only — there is no file upload.
   The app films the student on the front camera for 8 seconds (the selfie),
   switches to the back camera, and guides a ~180° sweep across the room while
   sampling frames. `POST /sessions/{id}/submit` takes `selfie` + `frames[]`;
   the server stitches the frames (`cv2.Stitcher`, with a height-normalized
   concat fallback) into the panorama, re-checks the window, and runs the
   pipeline. The selfie is stored alongside for audit.
5. Professor's dashboard polls `GET /sessions/{id}/summary` every ~2 s: the
   newest submission per student is the standing verdict; roster minus
   present = absent. `PATCH /submissions/{id}/override` resolves
   PENDING_REVIEW (and can reverse any verdict) with an audit entry.
   `GET /sessions/{id}/export.csv` streams the roster report.

## Verification pipeline (all-or-review, in check order)

| # | Check | Fail → REJECTED | Borderline → PENDING_REVIEW |
|---|-------|-----------------|-----------------------------|
| 1 | Server receive time inside [start, end] | `window_closed` | — |
| 2 | width/height ≥ `panorama_min_ratio` (2.0) | `not_a_panorama` | — |
| 3 | dHash vs every earlier submission ≤ `phash_hamming_max` (8) | `duplicate_image` | — |
| 4 | Laplacian variance ≥ `blur_min_variance` (60) | `image_too_blurry` | — |
| 5 | EXIF DateTimeOriginal, if present, ≤ 30 min old | `stale_capture` | — |
| 6 | FFT peak/median in HF ring ≤ `moire_peak_ratio_max` (500) | — | `screen_moire_suspect` |
| 6b | Live selfie: blur + moire floors | `image_too_blurry` | `screen_moire_suspect` |
| 7 | ≥1 face detected (YuNet score ≥ 0.6) | `no_face_detected` | — |
| 8 | Self cosine similarity ≥ `self_match_threshold` — measured on the front-cam selfie in live mode, else the panorama | `self_not_found` | `self_match_borderline` (within `review_margin` below) |
| 9 | Best similarity to the professor's embedding (other faces) ≥ `lecturer_match_threshold` | `lecturer_not_found` | `lecturer_match_borderline` |
| 10 | ≥ `min_neighbours` other faces in the sweep — anchored within `neighbour_min/max_fraction` of the student's face when the student is also in the panorama, otherwise any distinct face that is neither the lecturer nor the student | `no_neighbouring_student` | — |
| 11 | If the professor enabled geofence: haversine ≤ `geo_radius_m` | `location_missing` / `out_of_range` | — |

Pass all → `present`. Every score is persisted on the submission for audit.

## Threshold choices (and why)

- **SFace cosine**: OpenCV documents 0.363 as the FR_COSINE "same person"
  threshold. Demo fixtures (different photo, same person) score ≈0.44; the
  worst cross-person pair scores ≈0.38. `self/lecturer_match_threshold: 0.40`
  with `review_margin: 0.08` puts genuine matches well above the line and
  sends 0.32–0.40 borderline scores to human review instead of a false
  accept/reject.
- **Panorama ratio 2.0**: phone panorama exports are ≥2:1; a normal photo is
  ~4:3 and fails fast.
- **dHash 16×16, hamming ≤8**: survives JPEG re-encoding but separates
  different compositions; catches the same image resubmitted by another
  student or in a later session.
- **Blur**: composited real photos measure ~1700 variance; a Gaussian-blurred
  retake drops under 60.
- **Moire**: photographing a screen produces a periodic grid — an isolated
  FFT peak hundreds of times the ring median (≈1600 in tests vs ≈50–70 for
  natural images). Threshold 500 is deliberately loose; borderline cases go
  to review, not rejection.
- **EXIF**: only penalizes a *stale* timestamp (>30 min); missing EXIF is
  tolerated since phone panoramas and shares strip it.
- **Neighbour band** 2–45% of image width: the neighbour must sit beside the
  student, not be the lecturer at the far end of the sweep.

## Honest limits

- The "180° sweep" is enforced by the multi-frame capture + stitched-image
  ratio, not by measuring camera yaw — a very fast or partial sweep still
  produces a usable wide image (concat fallback), but a sweep missing the
  lecturer or any neighbour fails verification by design.
- `cv2.Stitcher` needs overlapping textured frames; when it fails the
  height-normalized concat preserves every face at full size, at the cost of
  repeated-background seams (harmless to detection). Self-duplicate faces in
  the sweep are excluded via the self-match threshold.
- Desktops have no back camera: the `environment` facingMode gracefully falls
  back to the same device, so the flow still works in development.
- Spoof checks are heuristics: a printed photo held to the camera can still
  pass; that is why flagged submissions go to PENDING_REVIEW rather than an
  auto-ban.
- Embeddings are stored as raw float32 bytes; "encrypted at rest" is a TODO
  for deployment (column-level encryption or envelope-encrypted files).
- The vision stage runs in-process (~0.3 s/submission on CPU); split it into
  its own service when throughput matters.

## Privacy

Consent checkbox is mandatory at registration (`consent_at` stamped).
`DELETE /me/face` erases embedding + photo. Uploaded panoramas are re-encoded
without metadata before storage; EXIF is only read for the timestamp check.
Server time is the only clock consulted.
