import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import EnrollFace from "./pages/EnrollFace";
import StudentHome from "./pages/StudentHome";
import ProfessorHome from "./pages/ProfessorHome";
import SessionDetail from "./pages/SessionDetail";

function Guard({ role, children }: { role: "student" | "professor"; children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (!user) return <Navigate to="/" state={{ from: loc.pathname }} replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  if (!user.face_enrolled) return <Navigate to="/enroll" replace />;
  return children;
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
      {children}
    </div>
  );
}

function Inner() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreen>Loading…</FullScreen>;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={user.role === "professor" ? "/professor" : "/student"} /> : <Landing />} />
      <Route path="/auth/:role" element={<AuthPage />} />
      <Route path="/enroll" element={user ? <EnrollFace /> : <Navigate to="/" />} />
      <Route path="/student" element={<Guard role="student"><StudentHome /></Guard>} />
      <Route path="/professor" element={<Guard role="professor"><ProfessorHome /></Guard>} />
      <Route path="/professor/sessions/:publicId" element={<Guard role="professor"><SessionDetail /></Guard>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
