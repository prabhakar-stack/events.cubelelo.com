"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";

export function NavBar() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");

  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3 text-sm">
      {/* Left — logo + nav links */}
      <div className="flex items-center gap-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-zinc-100">
          Cubelelo
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/competitions">Competitions</NavLink>
          <NavLink href="/practice" disabled>Practice</NavLink>
          <NavLink href="/rankings" disabled>Rankings</NavLink>
        </div>
      </div>

      {/* Center — search */}
      <div className="hidden md:block">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-48 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      {/* Right — notifications + auth */}
      <div className="flex items-center gap-3">
        {user && (
          <button className="relative rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
            <BellIcon />
          </button>
        )}

        {loading ? (
          <span className="text-zinc-600">…</span>
        ) : user ? (
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-xs md:inline">{user.name}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-100"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Sign up
            </Link>
          </div>
        )}

        {user?.role === "admin" && (
          <Link
            href="/admin"
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg px-3 py-1.5 text-zinc-600">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
    >
      {children}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
