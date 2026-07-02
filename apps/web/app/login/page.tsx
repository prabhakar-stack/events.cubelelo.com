"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";

export default function LoginPage() {
  const { user, signIn, signInDev, signInGoogle, signOut, supabaseEnabled } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">
          Signed in as <span className="font-semibold">{user.name}</span>
        </p>
        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{user.clId}</p>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{user.role}</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Continue
          </button>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const onDev = async () => {
    if (!identifier.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await signInDev(identifier.trim(), name.trim() || undefined);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async () => {
    if (!identifier.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">Sign in</h1>

      {supabaseEnabled && (
        <button
          onClick={() => signInGoogle()}
          className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-900 shadow hover:bg-zinc-100 dark:hover:bg-zinc-200"
        >
          Continue with Google
        </button>
      )}

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email or Mobile Number"
          type="text"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          onClick={onLogin}
          disabled={busy || !identifier.trim() || !password}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <Link href="/forgot-password" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Forgot password?
          </Link>
          <Link href="/register" className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">
            Register
          </Link>
        </div>
        <Link href="/register/migrate" className="block text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Have a legacy cubelelo-event account? Claim it here
        </Link>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Dev sign-in</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="display name (optional)"
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={onDev}
            disabled={busy || !identifier.trim()}
            className="w-full rounded-lg bg-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-400 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600 disabled:opacity-50"
          >
            Dev Sign in
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-600">
            Tip: use admin@cubelelo.com for demo admin.
          </p>
        </div>
      )}
    </main>
  );
}
