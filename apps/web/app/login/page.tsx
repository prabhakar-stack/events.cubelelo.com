"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";

export default function LoginPage() {
  const { user, signInDev, signInGoogle, signOut, supabaseEnabled } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-300">
          Signed in as <span className="font-semibold">{user.name}</span>
        </p>
        <p className="font-mono text-sm text-emerald-400">{user.clId}</p>
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
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const onDev = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await signInDev(email.trim(), name.trim() || undefined);
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
          className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-900 hover:bg-zinc-200"
        >
          Continue with Google
        </button>
      )}

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          {supabaseEnabled ? "Or dev sign-in" : "Dev sign-in"}
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="display name (optional)"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          onClick={onDev}
          disabled={busy || !email.trim()}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-zinc-600">
          Tip: use admin@cubelelo.com to sign in as the demo admin.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
