import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const TOKEN_KEY = "todo_token";
const AuthContext = createContext(null);

async function readBody(res) {
  return res.json().catch(() => ({}));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const establish = useCallback((token, nextUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(nextUser);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api("/api/auth/me");
        if (!res.ok) throw new Error("session expired");
        const me = await res.json();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email, password) => {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const body = await readBody(res);
      if (!res.ok) throw new Error(body.error || "Could not log in");
      establish(body.token, body.user);
    },
    [establish]
  );

  const register = useCallback(
    async (email, password) => {
      const res = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const body = await readBody(res);
      if (!res.ok) throw new Error(body.error || "Could not create account");
      establish(body.token, body.user);
    },
    [establish]
  );

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
