"use client";

import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";

export function NavBar() {
  const { user, loading } = useAuth();

  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3 text-sm">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-zinc-100">
          Cubelelo Events
        </Link>
        <Link
          href="/competitions"
          className="text-zinc-400 transition hover:text-zinc-100"
        >
          Competitions
        </Link>
        {user?.role === "admin" && (
          <Link
            href="/admin"
            className="text-zinc-400 transition hover:text-zinc-100"
          >
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        {loading ? (
          <span className="text-zinc-600">…</span>
        ) : user ? (
          <Link
            href="/settings"
            className="flex items-center gap-2 text-zinc-300 transition hover:text-zinc-100"
          >
            <span>{user.name}</span>
            <span className="font-mono text-xs text-emerald-400">{user.clId}</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white transition hover:bg-emerald-500"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
