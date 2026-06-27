"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface Props {
  /** If set, the user must have exactly this role; otherwise any logged-in user is allowed. */
  role?: string;
  children: React.ReactNode;
}

export function RouteGuard({ role, children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role && user.role !== role) {
      router.replace("/");
    }
  }, [user, loading, role, router]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  if (!user || (role && user.role !== role)) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Redirecting…
      </main>
    );
  }

  return <>{children}</>;
}
