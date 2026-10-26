import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import type { SessionSummary, Submission } from "../types";
import Header from "../components/Header";
import Countdown from "../components/Countdown";
import StatusBadge from "../components/StatusBadge";

export default function SessionDetail() {
  const { publicId } = useParams();
  const { token } = useAuth();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!token || !publicId) return;
    api.sessionSummary(token, publicId).then(setSummary).catch((e) => {
      if (e instanceof ApiError) setError(e.message);
    });
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, publicId]);

  async function close() {
    if (!token || !publicId) return;
    await api.closeSession(token, publicId);
    refresh();
  }

  async function override(id: number, status: "present" | "rejected") {
    if (!token) return;
    await api.override(token, id, status);
    refresh();
  }

  if (error)
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Session" />
        <p className="mx-auto mt-10 max-w-3xl rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>
      </div>
    );
  if (!summary)
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Session" />
        <p className="mt-10 text-center text-slate-500">Loading…</p>
      </div>
    );

  const s = summary.session;
  const active = s.status === "active";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title={s.course_name} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Link to="/professor" className="text-sm text-teal-700 hover:underline">
          ← All sessions
        </Link>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {s.course_code} — {s.course_name}
              </h2>
              <p className="text-sm text-slate-500">
                {new Date(s.start_time).toLocaleString()} → {new Date(s.end_time).toLocaleTimeString()}
              </p>
            </div>
            <div className="text-right">
              {active ? (
                <p className="text-2xl"><Countdown endTime={s.end_time} /></p>
              ) : (
                <StatusBadge status={s.status} />
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Present" value={summary.present_count} tone="teal" />
            <Stat label="Absent" value={summary.absent_count} tone="slate" />
            <Stat label="Rejected" value={summary.rejected_count} tone="red" />
            <Stat label="Review" value={summary.pending_count} tone="amber" />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {summary.present_pct}% of {summary.enrolled_count} enrolled students present
          </p>

          <div className="mt-4 flex gap-3">
            {active && (
              <button
                onClick={close}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close window now
              </button>
            )}
            <button
              onClick={() => token && api.exportCsv(token, s.public_id)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Export CSV
            </button>
          </div>
        </section>

        {summary.pending.length > 0 && (
          <Section title="Needs review">
            {summary.pending.map((sub) => (
              <SubmissionRow key={sub.id} sub={sub} onOverride={override} />
            ))}
          </Section>
        )}

        <Section title={`Present (${summary.present.length})`}>
          {summary.present.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Nobody yet.</p>
          ) : (
            summary.present.map((sub) => <SubmissionRow key={sub.id} sub={sub} onOverride={override} />)
          )}
        </Section>

        <Section title={`Rejected (${summary.rejected.length})`}>
          {summary.rejected.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No rejected submissions.</p>
          ) : (
            summary.rejected.map((sub) => <SubmissionRow key={sub.id} sub={sub} onOverride={override} />)
          )}
        </Section>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-800",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-800",
  };
  return (
    <div className={`rounded-xl px-4 py-3 text-center ${tones[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">{children}</div>
    </section>
  );
}

function SubmissionRow({
  sub,
  onOverride,
}: {
  sub: Submission;
  onOverride: (id: number, status: "present" | "rejected") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">
          {sub.student_name}
          {sub.roll_no ? <span className="ml-2 text-xs text-slate-500">{sub.roll_no}</span> : null}
        </p>
        <p className="text-xs text-slate-500">
          {new Date(sub.submitted_at).toLocaleTimeString()}
          {sub.reason && sub.status !== "present" ? ` · ${sub.reason}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={sub.status} />
        {sub.status !== "present" ? (
          <button
            onClick={() => onOverride(sub.id, "present")}
            className="rounded-lg border border-teal-200 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            Approve
          </button>
        ) : (
          <button
            onClick={() => onOverride(sub.id, "rejected")}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
