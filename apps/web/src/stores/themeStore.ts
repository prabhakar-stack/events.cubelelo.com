import { create } from "zustand";

type Theme = "dark" | "light";

const STORAGE_KEY = "cubers_theme";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  init: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "dark",

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),

  init: () => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      set({ theme: stored });
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
  },
}));
