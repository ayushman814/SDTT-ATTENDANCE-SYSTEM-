import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ApiError } from "../api";

export default function AuthPage() {
  const { role = "student" } = useParams();
  const isStudent = role === "student";
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await login(role!, email, password)
          : await register({
              role: role!,
              name,
              email,
              password,
              roll_no: isStudent ? rollNo : undefined,
              invite_code: isStudent ? undefined : inviteCode,
              consent,
            });
      navigate(user.face_enrolled ? `/${role}` : "/enroll");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-teal-700 hover:underline">
          ← Back
        </Link>
        <div className="mt-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">
            {isStudent ? "Student" : "Professor"} {mode === "login" ? "sign in" : "registration"}
          </h1>

          <div className="mt-4 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-2 capitalize transition ${
                  mode === m ? "bg-white shadow text-slate-900" : "text-slate-500"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Full name">
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </Field>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                autoComplete="email"
              />
            </Field>
            {mode === "register" && isStudent && (
              <Field label="Roll number">
                <input required value={rollNo} onChange={(e) => setRollNo(e.target.value)} className={inputCls} />
              </Field>
            )}
            {mode === "register" && !isStudent && (
              <Field label="Professor invite code">
                <input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Provided by your institution"
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="Password">
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
            {mode === "register" && (
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                I consent to my reference face photo being stored and used to verify my
                attendance. I can delete this data at any time.
              </label>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
