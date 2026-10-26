import { useAuth } from "../auth";

export default function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">
            PA
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{user?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </div>
    </header>
  );
}
