"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, [init]);

  return <>{children}</>;
}

export function useAuth() {
  return useAuthStore();
}
