import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-700 text-2xl font-bold text-white">
          PA
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Panorama Attendance</h1>
        <p className="mt-2 text-slate-600">
          Mark attendance with a single panorama selfie — verified automatically.
        </p>
        <p className="mt-8 mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          Are you a student or a professor?
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/auth/student"
            className="rounded-2xl bg-teal-700 px-6 py-10 text-xl font-semibold text-white shadow-sm transition hover:bg-teal-800"
          >
            I'm a Student
          </Link>
          <Link
            to="/auth/professor"
            className="rounded-2xl bg-slate-900 px-6 py-10 text-xl font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            I'm a Professor
          </Link>
        </div>
      </div>
    </div>
  );
}
