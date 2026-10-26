# Panorama Attendance API

FastAPI + SQLAlchemy service for the panorama-selfie attendance system. Students
mark attendance by uploading a panorama photo inside a professor-controlled
time window; a server-side vision pipeline (OpenCV YuNet detection + SFace
embeddings) verifies self, a neighbour, and the lecturer before marking PRESENT.

## Setup

```bash
cd apps/panorama/api
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                      # set PANORAMA_JWT_SECRET for anything real
python scripts/download_models.py         # YuNet + SFace ONNX models (~37 MB, one-time)
python seed.py                            # demo professor + 5 students + CS-101
uvicorn app.main:app --reload --port 8100
```

The API is under `/api`; uploaded panoramas and reference photos are served
from `/uploads` with metadata stripped. All verification thresholds live in one
file: `panorama.config.yaml`.

## Roles and flow

- `POST /api/auth/register`, `POST /api/auth/login` are role-aware: a student
  cannot log in through the professor flow. JWT bearer + bcrypt.
- `POST /api/me/face` enrolls the reference face (first login). `DELETE
  /api/me/face` erases embedding and photo (privacy opt-out).
- Professor: `POST /api/sessions` (course + window minutes), live
  `GET /api/sessions/{id}/summary`, `POST /api/sessions/{id}/close`,
  `GET /api/sessions/{id}/export.csv`, `PATCH /api/submissions/{id}/override`.
- Student: `GET /api/student/sessions/active`, `POST
  /api/sessions/{id}/submit` (multipart `file`, optional `geo_lat`/`geo_lng`),
  `GET /api/student/history`.
- Server time is authoritative everywhere; uploads outside the window are
  refused (403 `window_closed`).

## Verification pipeline (`app/pipeline.py`)

Checks run in order; the first failure stores REJECTED with a specific reason,
a borderline AI score stores PENDING_REVIEW for the professor:
timing → panorama ratio → duplicate phash → blur → stale EXIF → screen-moire
→ faces present → self match → lecturer match → neighbour adjacent →
optional geofence → PRESENT.

## Demo accounts (after `python seed.py`)

- Professor: `prof@demo.edu` / `prof12345`
- Students: `student1..5@demo.edu` / `student123` (all enrolled in CS-101)

`seed_faces/` holds synthetic generated portraits used only for demo seeds and
tests. `professor_alt.png` shows the same professor in a different photo for
match-margin checks.

## Tests

```bash
pytest tests/ -q
```

`test_pipeline.py` runs the real vision engine on composed panoramas (pass plus
each failure reason and the borderline PENDING_REVIEW path);
`test_api.py` covers role isolation, consent, the server-side window rule,
summary counts, override, and CSV export.

## Storage

SQLite by default (`PANORAMA_DATABASE_URL`); set a Postgres DSN for deployment.
Uploads land under `uploads/`; point `PANORAMA_UPLOAD_DIR` at object storage or
a volume in production.
