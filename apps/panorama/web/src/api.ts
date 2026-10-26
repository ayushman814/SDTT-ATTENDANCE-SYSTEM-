const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, String(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function json<T>(path: string, method: string, body: unknown, token?: string | null) {
  return request<T>(
    path,
    {
      method,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
    token,
  );
}

export const api = {
  register: (payload: {
    role: string;
    name: string;
    email: string;
    password: string;
    roll_no?: string;
    consent: boolean;
  }) => json<{ access_token: string; user: import("./types").User }>("/api/auth/register", "POST", payload),

  login: (role: string, email: string, password: string) =>
    json<{ access_token: string; user: import("./types").User }>("/api/auth/login", "POST", {
      role,
      email,
      password,
    }),

  me: (token: string) => request<import("./types").User>("/api/me", {}, token),

  enrollFace: (token: string, file: File | Blob) => {
    const fd = new FormData();
    fd.append("file", file, "face.jpg");
    return request<import("./types").User>("/api/me/face", { method: "POST", body: fd }, token);
  },

  deleteFace: (token: string) => request<void>("/api/me/face", { method: "DELETE" }, token),

  createSession: (
    token: string,
    payload: {
      course_id?: number;
      course_name?: string;
      window_minutes: number;
      geo_lat?: number;
      geo_lng?: number;
      geo_radius_m?: number;
    },
  ) => json<import("./types").SessionInfo>("/api/sessions", "POST", payload, token),

  closeSession: (token: string, publicId: string) =>
    json<import("./types").SessionInfo>(`/api/sessions/${publicId}/close`, "POST", {}, token),

  professorSessions: (token: string) =>
    request<{ sessions: import("./types").SessionListItem[] }>("/api/professor/sessions", {}, token),

  professorCourses: (token: string) =>
    request<{ courses: { id: number; code: string; name: string }[] }>("/api/professor/courses", {}, token),

  sessionSummary: (token: string, publicId: string) =>
    request<import("./types").SessionSummary>(`/api/sessions/${publicId}/summary`, {}, token),

  studentActiveSessions: (token: string) =>
    request<{ sessions: import("./types").ActiveSession[] }>("/api/student/sessions/active", {}, token),

  studentHistory: (token: string) =>
    request<import("./types").StudentHistory>("/api/student/history", {}, token),

  /** Live capture: front-cam selfie + back-cam sweep frames stitched server-side. */
  submitLive: (
    token: string,
    publicId: string,
    selfie: Blob,
    frames: Blob[],
    geo?: { lat: number; lng: number },
  ) => {
    const fd = new FormData();
    fd.append("selfie", selfie, "selfie.jpg");
    frames.forEach((f, i) => fd.append("frames", f, `frame-${String(i).padStart(3, "0")}.jpg`));
    if (geo) {
      fd.append("geo_lat", String(geo.lat));
      fd.append("geo_lng", String(geo.lng));
    }
    return request<import("./types").Submission>(
      `/api/sessions/${publicId}/submit`,
      { method: "POST", body: fd },
      token,
    );
  },

  override: (token: string, submissionId: number, status: "present" | "rejected", reason?: string) =>
    json<import("./types").Submission>(`/api/submissions/${submissionId}/override`, "PATCH", { status, reason }, token),

  exportCsv: async (token: string, publicId: string) => {
    const res = await fetch(`${API}/api/sessions/${publicId}/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new ApiError(res.status, "Export failed");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${publicId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
