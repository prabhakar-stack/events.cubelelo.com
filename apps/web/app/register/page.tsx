"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";

export default function RegisterPage() {
  const { user, register, signInGoogle, supabaseEnabled } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <p className="text-zinc-600 dark:text-zinc-300">
          You&apos;re signed in as <span className="font-semibold">{user.name}</span>
        </p>
        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{user.clId}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Go to Homepage
        </button>
      </main>
    );
  }

  const onRegister = async () => {
    if (!email.trim() || !password) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Join Cubelelo Events
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Compete in live speedcubing tournaments, track your personal bests, and climb the rankings.
        </p>
      </div>

      {supabaseEnabled && (
        <button
          onClick={() => signInGoogle()}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-zinc-900 shadow transition hover:bg-zinc-100 dark:hover:bg-zinc-200"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.8 0 6.9 5.4 3 13.3l7.8 6.1C12.7 13.2 17.9 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-9.9 7.1-17z"/>
            <path fill="#FBBC05" d="M10.8 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6L2.5 13.3A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.3-6z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.2-7.7 2.2-6.1 0-11.3-3.7-13.2-9l-7.8 6C6.9 42.6 14.8 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {supabaseEnabled ? "Or create with email" : "Create account"}
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
            />
          </div>
          <button
            onClick={onRegister}
            disabled={busy || !email.trim() || !password || !confirm}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <div className="space-y-2 text-center text-sm text-zinc-500">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-600 hover:underline dark:text-emerald-400">
            Sign in
          </Link>
        </p>
        <p>
          Had a cubelelo-event account?{" "}
          <Link href="/register/migrate" className="text-emerald-600 hover:underline dark:text-emerald-400">
            Claim your legacy profile →
          </Link>
        </p>
      </div>
    </main>
  );
}
