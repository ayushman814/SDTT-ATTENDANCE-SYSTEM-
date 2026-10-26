# Panorama Attendance web (PWA)

React + TypeScript + Vite + Tailwind installable PWA for the panorama
attendance API (`../api`).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api and /uploads to :8100
npm run build      # type-check + production build with service worker
```

`VITE_API_URL` overrides the API origin in production builds (default: same
origin — the dev server proxies to `localhost:8100`).

Screens: role landing → role-aware login/register (consent required) →
first-login face enrollment → student home (active windows with countdown,
guided live capture — front camera 8 s then a back-camera 180° sweep; no file
upload — status + reason, per-course history) or professor home
(start session with 5/10/15-minute window and optional geofence, live counts,
needs-review/present/rejected lists with override, CSV export, history).
