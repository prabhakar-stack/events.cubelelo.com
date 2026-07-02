"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface Props {
  /** If set, the user must have one of these roles; otherwise any logged-in user is allowed. */
  role?: string | string[];
  children: React.ReactNode;
}

export function RouteGuard({ role, children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const roles = role ? (Array.isArray(role) ? role : [role]) : [];
  const hasRole = roles.length === 0 || (user ? roles.includes(user.role) : false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasRole) {
      router.replace("/");
    }
  }, [user, loading, hasRole, router]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  if (!user || !hasRole) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Redirecting…
      </main>
    );
  }

  return <>{children}</>;
}
