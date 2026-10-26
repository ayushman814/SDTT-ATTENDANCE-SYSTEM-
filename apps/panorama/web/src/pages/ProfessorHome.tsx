import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import type { RosterStudent, SessionListItem } from "../types";
import Header from "../components/Header";
import Countdown from "../components/Countdown";
import StatusBadge from "../components/StatusBadge";

export default function ProfessorHome() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [courses, setCourses] = useState<{ id: number; code: string; name: string }[]>([]);
  const [courseId, setCourseId] = useState<number | "new">("new");
  const [courseName, setCourseName] = useState("");
  const [window, setWindow] = useState(10);
  const [geo, setGeo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rosterCourseId, setRosterCourseId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  const refresh = () => {
    if (!token) return;
    api.professorSessions(token).then((r) => setSessions(r.sessions)).catch(() => {});
    api.professorCourses(token).then((r) => setCourses(r.courses)).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function startSession(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      let geoLat: number | undefined, geoLng: number | undefined;
      if (geo) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }),
        ).catch(() => null);
        // Geofencing must never silently degrade: no fix, no session.
        if (!pos) {
          setError("Location unavailable — allow location access or uncheck the geofence option.");
          setBusy(false);
          return;
        }
        geoLat = pos.coords.latitude;
        geoLng = pos.coords.longitude;
      }
      const payload =
        courseId === "new"
          ? { course_name: courseName.trim(), window_minutes: window, geo_lat: geoLat, geo_lng: geoLng }
          : { course_id: courseId, window_minutes: window, geo_lat: geoLat, geo_lng: geoLng };
      await api.createSession(token, payload);
      setCourseName("");
      refresh();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Could not start session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Professor home" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Start attendance</h2>
          <form onSubmit={startSession} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Course</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={courseId}
                onChange={(e) =>
                  setCourseId(e.target.value === "new" ? "new" : Number(e.target.value))
                }
              >
                <option value="new">New course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            {courseId === "new" && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Course name</span>
                <input
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Computer Science 101"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Attendance window
              </span>
              <div className="flex gap-2">
                {[5, 10, 15].map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setWindow(m)}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold ${
                      window === m
                        ? "border-teal-700 bg-teal-50 text-teal-800"
                        : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={geo}
                onChange={(e) => setGeo(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700"
              />
              Require students to be near this classroom (uses your current location)
            </label>
            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start attendance"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Course enrollment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Students must be enrolled before they can see or submit to a course's sessions.
          </p>
          <select
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            value={rosterCourseId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              setRosterCourseId(id);
              setEnrollMsg(null);
              if (id && token)
                api.courseStudents(token, id).then((r) => setRoster(r.students)).catch(() => {});
            }}
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          {rosterCourseId !== null && (
            <div className="mt-4 space-y-3">
              {roster.length === 0 ? (
                <p className="text-sm text-slate-500">No students enrolled yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {roster.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-800">
                        {s.name}
                        <span className="ml-2 text-slate-400">{s.roll_no || s.email}</span>
                      </span>
                      <button
                        onClick={() => {
                          if (!token || !rosterCourseId) return;
                          api
                            .unenrollStudent(token, rosterCourseId, s.id)
                            .then(() => setRoster((r) => r.filter((x) => x.id !== s.id)))
                            .catch(() => {});
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!token || !rosterCourseId || !enrollEmail.trim()) return;
                  api
                    .enrollStudent(token, rosterCourseId, enrollEmail.trim())
                    .then((s) => {
                      setRoster((r) => [...r, s]);
                      setEnrollEmail("");
                      setEnrollMsg(`Enrolled ${s.name}`);
                    })
                    .catch((e2) =>
                      setEnrollMsg(e2 instanceof ApiError ? e2.message : "Enrollment failed"),
                    );
                }}
              >
                <input
                  type="email"
                  required
                  placeholder="student@university.edu"
                  value={enrollEmail}
                  onChange={(e) => setEnrollEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Enroll
                </button>
              </form>
              {enrollMsg && <p className="text-sm text-slate-600">{enrollMsg}</p>}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Sessions</h2>
          {sessions.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 ring-1 ring-slate-200">
              No sessions yet — start one above.
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <Link
                  key={s.public_id}
                  to={`/professor/sessions/${s.public_id}`}
                  className="flex items-center justify-between rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-teal-300"
                >
                  <div>
                    <p className="font-medium text-slate-900">{s.course_name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(s.start_time).toLocaleString()} · {s.present_count} present of{" "}
                      {s.submission_count} submitted
                    </p>
                  </div>
                  <div className="text-right">
                    {s.status === "active" ? (
                      <Countdown endTime={s.end_time} />
                    ) : (
                      <StatusBadge status={s.status} />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
