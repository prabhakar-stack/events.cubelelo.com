import { create } from "zustand";
import {
  apiSignOut,
  authLogin,
  authRegister,
  fetchMe,
  setAuthToken,
  syncUser,
  verifyEmailWithGoogle,
  type AuthUser,
} from "@/lib/api";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

const TOKEN_KEY = "cubers_token";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  supabaseEnabled: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (identifier: string, password: string) => Promise<void>;
  register: (identifier: string, password: string, name?: string) => Promise<{ otpSentTo: "email" | "mobile" }>;
  signInGoogle: () => Promise<void>;
  verifyWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  supabaseEnabled,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  signIn: async (identifier, password) => {
    const { token } = await authLogin(identifier, password);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    set({ user: await fetchMe().catch(() => syncUser()) });
  },

  register: async (identifier, password, name?) => {
    const { token, otpSentTo } = await authRegister(identifier, password, name);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    set({ user: await fetchMe().catch(() => syncUser()) });
    return { otpSentTo };
  },

  signInGoogle: async () => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase not configured");
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  },

  verifyWithGoogle: async () => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase not configured");
    // Trigger Google OAuth with redirect back to /settings?verified=1
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/settings?verified=1` },
    });
  },

  signOut: async () => {
    await apiSignOut();
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    set({ user: null });
  },

  init: () => {
    let active = true;

    (async () => {
      let resolved = false;
      const sb = getSupabase();

      if (sb) {
        try {
          const { data } = await sb.auth.getSession();
          if (data.session) {
            resolved = true;
            setAuthToken(data.session.access_token);
            const u = await syncUser();
            if (active) set({ user: u });
          }
        } catch {}

        sb.auth.onAuthStateChange(async (_event, session) => {
          if (session) {
            setAuthToken(session.access_token);
            try { set({ user: await syncUser() }); } catch {}
          } else if (!localStorage.getItem(TOKEN_KEY)) {
            setAuthToken(null);
            set({ user: null });
          }
        });
      }

      if (!resolved) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          try {
            const u = await fetchMe().catch(() => syncUser());
            if (active) set({ user: u });
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            setAuthToken(null);
          }
        }
      }
      if (active) set({ loading: false });
    })();

    return () => { active = false; };
  },
}));
