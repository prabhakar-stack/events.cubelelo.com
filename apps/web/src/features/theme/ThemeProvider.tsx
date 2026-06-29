"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const init = useThemeStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return <>{children}</>;
}

export function useTheme() {
  return useThemeStore();
}
