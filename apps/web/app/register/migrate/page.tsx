"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";
import { migrateClaim } from "@/lib/api";

type Mode = "clId" | "email";

export default function MigratePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("clId");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // Must be logged in first
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/register/migrate");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  const onSubmit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await migrateClaim(
        mode === "clId"
          ? { legacyClId: value.trim().toUpperCase() }
          : { legacyEmail: value.trim().toLowerCase() },
      );
      setClaimed(true);
      setTimeout(() => router.replace("/profile/me"), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("legacy_account_not_found")) {
        setError("No legacy account found with that ID or email. Double-check and try again.");
      } else if (msg.includes("account_already_claimed")) {
        setError("This legacy account has already been claimed by another login.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (claimed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Account claimed!</h2>
        <p className="text-sm text-zinc-400">
          Your legacy cubelelo-event profile has been linked. Your CL ID and history are now
          attached to this login.
        </p>
        <p className="text-xs text-zinc-600">Redirecting to your profile…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      {/* Header */}
      <div>
        <Link href="/register" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Back to register
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-zinc-100">Claim your legacy profile</h1>
        <p className="mt-2 text-sm text-zinc-400">
          If you competed in cubelelo-event before this platform launched, your history has been
          imported as a stub. Enter your old CL ID or email to link it to your current login.
        </p>
      </div>

      {/* Current account badge */}
      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-200">{user.name}</p>
          <p className="font-mono text-xs text-zinc-500">{user.clId} · {user.email}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          Current login
        </span>
      </div>

      {/* Lookup form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        {/* Mode tabs */}
        <div className="mb-4 flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {(["clId", "email"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setValue(""); setError(null); }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                mode === m
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {m === "clId" ? "By Legacy CL ID" : "By Old Email"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              {mode === "clId" ? "Legacy CL ID (e.g. CL-2022-0042)" : "Email from your old account"}
            </label>
            <input
              type={mode === "email" ? "email" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              placeholder={mode === "clId" ? "CL-YYYY-XXXX" : "old@email.com"}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Looking up…" : "Claim legacy account"}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 px-4 py-3 text-xs text-zinc-500 space-y-1.5">
        <p className="font-semibold text-zinc-400">What happens when you claim?</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Your legacy CL ID and competition history are linked to this Google login</li>
          <li>Your old profile data (name, location, WCA ID) is merged onto your account</li>
          <li>You can only claim once — the legacy stub is deactivated after</li>
        </ul>
        <p className="pt-1">
          Don&apos;t have a legacy account?{" "}
          <Link href="/" className="text-emerald-400 hover:underline">
            Go to the homepage
          </Link>
        </p>
      </div>
    </main>
  );
}
