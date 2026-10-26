# Rollcall dashboard

Responsive React + TypeScript + Vite client for the classroom attendance API described in `../../docs/API_CONTRACT.md`.

## Hosted API

The dashboard defaults to `https://sdtt-attendance-system.onrender.com/api`. The URL is configurable with `VITE_API_BASE_URL` for builds or deployments that use a different backend. The dashboard derives its secure WebSocket URL from the API base and refreshes data when events arrive.

To run the dashboard locally while still using the hosted API:

```bash
npm ci
npm run dev
```

For a production build, set `VITE_API_BASE_URL` in the build environment if needed, then run `npm run build`. Do not add Supabase service-role credentials or other backend secrets to Vite environment variables; frontend variables are public.

Sign in with an administrator-provisioned student or professor account. The app does not provide demo credentials or fake attendance data. If the API is unavailable, requests show an error rather than substituting local records.
