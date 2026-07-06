"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { GradientAvatar } from "@/components/GradientAvatar";
import { friendlyAuthError } from "@/lib/errorMessages";

export default function RegisterPage() {
  const { user, register, signInGoogle, supabaseEnabled } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <GradientAvatar name={user.name} size={48} className="text-xl" />
        <p className="text-zinc-600 dark:text-zinc-300">
          You&apos;re signed in as <span className="font-semibold">{user.name}</span>
        </p>
        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{user.clId}</p>
        <Button size="lg" onClick={() => router.push("/")}>
          Go to Homepage
        </Button>
      </main>
    );
  }

  const passwordMismatch = confirm.length > 0 && password !== confirm;

  const onRegister = async () => {
    if (!identifier.trim() || !password) return;
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
      const { otpSentTo } = await register(identifier.trim(), password, name.trim() || undefined);
      router.push(`/verify?type=${otpSentTo}&value=${encodeURIComponent(identifier.trim())}`);
    } catch (e) {
      setError(friendlyAuthError(e));
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
        <Button
          variant="secondary"
          onClick={() => signInGoogle()}
          className="flex w-full items-center justify-center gap-3 !rounded-xl !border-zinc-300 bg-white !py-3 !text-zinc-900 shadow hover:bg-zinc-100 dark:!border-transparent"
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRegister();
        }}
        className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {supabaseEnabled ? "Or create with email / mobile" : "Create account"}
        </p>
        <div className="space-y-3">
          <Input
            label="Display name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
          <Input
            label="Email or mobile number"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or 9876543210"
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            error={passwordMismatch ? "Passwords don't match yet" : undefined}
          />
          <Button
            type="submit"
            fullWidth
            loading={busy}
            disabled={!identifier.trim() || !password || !confirm}
          >
            {busy ? "Creating account…" : "Create account"}
          </Button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </form>

      <div className="space-y-2 text-center text-sm text-zinc-500">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-600 hover:underline dark:text-emerald-400">
            Sign in
          </Link>
        </p>
        <p>
          Had a cubelelo-event account?{" "}
          <Link href="/register/migrate" className="text-zinc-500 hover:underline dark:text-zinc-400">
            Claim your legacy profile →
          </Link>
        </p>
      </div>
    </main>
  );
}
