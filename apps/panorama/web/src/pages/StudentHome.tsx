import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import type { ActiveSession, StudentHistory } from "../types";
import Header from "../components/Header";
import Countdown from "../components/Countdown";
import StatusBadge from "../components/StatusBadge";
import CameraCapture from "../components/CameraCapture";

export default function StudentHome() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!token) return;
    api.studentActiveSessions(token).then((r) => setSessions(r.sessions)).catch(() => {});
    api.studentHistory(token).then(setHistory).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Student home" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Active attendance windows</h2>
          {sessions.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 ring-1 ring-slate-200">
              No active sessions right now. When a professor opens a window it appears here.
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.map((s) => (
                <SessionCard key={s.public_id} session={s} onDone={refresh} onError={setError} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">My attendance</h2>
          {history && history.courses.length > 0 ? (
            <div className="space-y-3">
              {history.courses.map((c) => (
                <div key={c.course_code} className="flex items-center justify-between rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{c.course_name}</p>
                    <p className="text-sm text-slate-500">
                      {c.sessions_attended} of {c.sessions_total} sessions attended
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-teal-700">{c.pct}%</p>
                  </div>
                </div>
              ))}
              <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <p className="mb-2 text-sm font-medium text-slate-700">Recent submissions</p>
                <ul className="divide-y divide-slate-100">
                  {history.submissions.slice(0, 10).map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{new Date(s.submitted_at).toLocaleString()}</span>
                      <span className="flex items-center gap-2">
                        {s.reason && s.status !== "present" && (
                          <span className="max-w-[220px] truncate text-xs text-slate-400" title={s.reason}>{s.reason}</span>
                        )}
                        <StatusBadge status={s.status} />
                      </span>
                    </li>
                  ))}
                  {history.submissions.length === 0 && (
                    <li className="py-2 text-sm text-slate-400">No submissions yet.</li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 ring-1 ring-slate-200">
              No attendance history yet.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function SessionCard({
  session,
  onDone,
  onError,
}: {
  session: ActiveSession;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(session.my_status);
  const [reason, setReason] = useState<string | null>(session.my_reason);
  const windowOpen = new Date(session.end_time).getTime() > Date.now();

  useEffect(() => {
    setStatus(session.my_status);
    setReason(session.my_reason);
  }, [session.my_status, session.my_reason]);

  async function submit() {
    if (!file || !token) return;
    setBusy(true);
    onError(null);
    try {
      let geo: { lat: number; lng: number } | undefined;
      if (session.geo_enabled) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }),
        ).catch(() => null);
        if (pos) geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      const sub = await api.submit(token, session.public_id, file, geo);
      setStatus(sub.status);
      setReason(sub.reason);
      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-slate-900">{session.course_name}</p>
          <p className="text-sm text-slate-500">{session.course_code}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">time left</p>
          <p className="text-xl"><Countdown endTime={session.end_time} /></p>
        </div>
      </div>

      {status && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <StatusBadge status={status} />
          {reason && status !== "present" && <p className="text-sm text-slate-600">{reason}</p>}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-teal-50/60 p-4">
        <p className="text-sm font-medium text-teal-900">How to take the panorama</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-teal-800">
          <li>Stay in your seat with the people beside you in frame.</li>
          <li>Use your camera's panorama mode and sweep slowly across the room.</li>
          <li>Keep sweeping until the lecturer at the front is visible in the shot.</li>
        </ol>
      </div>

      {preview && (
        <img src={preview} alt="panorama preview" className="mt-4 w-full rounded-xl object-cover" />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!windowOpen}
          className="rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Upload panorama
        </button>
        <button
          onClick={() => setCamera(true)}
          disabled={!windowOpen}
          className="rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Take photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }
          }}
        />
      </div>
      <button
        onClick={submit}
        disabled={!file || !windowOpen || busy || status === "present"}
        className="mt-3 w-full rounded-xl bg-teal-700 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {busy ? "Verifying…" : status === "present" ? "Attendance marked" : "Mark attendance"}
      </button>
      {!windowOpen && <p className="mt-2 text-center text-xs text-red-600">Window closed</p>}

      {camera && (
        <CameraCapture
          onCapture={(b) => {
            setCamera(false);
            setFile(b);
            setPreview(URL.createObjectURL(b));
          }}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}
