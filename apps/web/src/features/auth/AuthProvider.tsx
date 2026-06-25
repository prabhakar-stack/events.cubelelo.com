"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  devLogin,
  fetchMe,
  setAuthToken,
  syncUser,
  type AuthUser,
} from "@/lib/api";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

const TOKEN_KEY = "cubers_token";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  supabaseEnabled: boolean;
  signInDev: (email: string, name?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (data.session) {
          setAuthToken(data.session.access_token);
          try {
            const u = await syncUser();
            if (active) setUser(u);
          } catch {
            /* ignore */
          }
        }
        sb.auth.onAuthStateChange(async (_event, session) => {
          if (session) {
            setAuthToken(session.access_token);
            try {
              setUser(await syncUser());
            } catch {
              /* ignore */
            }
          } else {
            setAuthToken(null);
            setUser(null);
          }
        });
      } else {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          try {
            const u = await fetchMe().catch(() => syncUser());
            if (active) setUser(u);
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            setAuthToken(null);
          }
        }
      }
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const signInDev = useCallback(async (email: string, name?: string) => {
    const { token } = await devLogin(email, name);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(await syncUser());
  }, []);

  const signInGoogle = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase not configured");
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, supabaseEnabled, signInDev, signInGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
