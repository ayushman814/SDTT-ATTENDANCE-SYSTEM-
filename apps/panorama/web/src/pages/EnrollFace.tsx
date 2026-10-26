import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import CameraCapture from "../components/CameraCapture";

export default function EnrollFace() {
  const { token, user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: Blob, url: string) {
    setFile(f);
    setPreview(url);
    setError(null);
  }

  async function submit() {
    if (!file || !token) return;
    setBusy(true);
    setError(null);
    try {
      const u = await api.enrollFace(token, file);
      setUser(u);
      navigate(`/${u.role}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Enrollment failed — try a clearer photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Enroll your face</h1>
          <p className="mt-2 text-sm text-slate-600">
            Hi {user?.name} — take one clear, front-facing photo. We store a mathematical
            face signature plus this photo to verify you at attendance time. You can delete
            it anytime.
          </p>

          {preview ? (
            <img src={preview} alt="reference" className="mt-4 w-full rounded-xl object-cover" />
          ) : (
            <div className="mt-4 flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400">
              No photo yet
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => setCamera(true)}
              className="rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Use camera
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Upload photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f, URL.createObjectURL(f));
              }}
            />
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            onClick={submit}
            disabled={!file || busy}
            className="mt-4 w-full rounded-xl bg-teal-700 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Enrolling…" : "Enroll and continue"}
          </button>
          <button onClick={logout} className="mt-3 w-full text-sm text-slate-500 hover:underline">
            Sign out
          </button>
        </div>
      </div>
      {camera && (
        <CameraCapture
          onCapture={(b) => {
            setCamera(false);
            pick(b, URL.createObjectURL(b));
          }}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}
