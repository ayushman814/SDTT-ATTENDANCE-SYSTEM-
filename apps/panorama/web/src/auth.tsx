import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (role: string, email: string, password: string) => Promise<User>;
  register: (payload: Parameters<typeof api.register>[0]) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("pano_token"));
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    api
      .me(token)
      .then(setUserState)
      .catch(() => {
        setToken(null);
        localStorage.removeItem("pano_token");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const save = (t: string, u: User) => {
    localStorage.setItem("pano_token", t);
    setToken(t);
    setUserState(u);
  };

  const login = useCallback(async (role: string, email: string, password: string) => {
    const r = await api.login(role, email, password);
    save(r.access_token, r.user);
    return r.user;
  }, []);

  const register = useCallback(async (payload: Parameters<typeof api.register>[0]) => {
    const r = await api.register(payload);
    save(r.access_token, r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pano_token");
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  return (
    <Ctx.Provider value={{ token, user, loading, login, register, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
