import { create } from "zustand";
import {
  authLogin,
  authRegister,
  devLogin,
  fetchMe,
  setAuthToken,
  syncUser,
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
  signInDev: (email: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  supabaseEnabled,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  signInDev: async (email, name?) => {
    const { token } = await devLogin(email, name);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    set({ user: await syncUser() });
  },

  signIn: async (email, password) => {
    const { token } = await authLogin(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    set({ user: await fetchMe().catch(() => syncUser()) });
  },

  register: async (email, password, name?) => {
    const { token } = await authRegister(email, password, name);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    set({ user: await fetchMe().catch(() => syncUser()) });
  },

  signInGoogle: async () => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase not configured");
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  },

  signOut: async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    set({ user: null });
  },

  init: () => {
    let active = true;

    (async () => {
      const sb = getSupabase();
      let resolved = false;

      if (sb) {
        const { data } = await sb.auth.getSession();
        if (data.session) {
          resolved = true;
          setAuthToken(data.session.access_token);
          try {
            const u = await syncUser();
            if (active) set({ user: u });
          } catch {}
        }
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
