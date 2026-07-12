"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { GradientAvatar } from "@/components/GradientAvatar";
import { DecorativeCube } from "@/components/DecorativeCube";
import { friendlyAuthError } from "@/lib/errorMessages";

export default function LoginPage() {
  const { user, signIn, signInGoogle, signOut, supabaseEnabled } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <GradientAvatar name={user.name} size={56} className="text-xl" />
        <p className="text-zinc-600 dark:text-zinc-300">
          Signed in as <span className="font-semibold">{user.name}</span>
        </p>
        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{user.clId}</p>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{user.role}</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/")}>Continue</Button>
          <Button variant="secondary" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </main>
    );
  }

  const onLogin = async () => {
    if (!identifier.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
      router.push("/");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center gap-16 px-6">
      {/* Decorative 3D cube — hidden on small screens, draggable to spin */}
      <div className="hidden flex-1 items-center justify-center lg:flex">
        <DecorativeCube scramble="R U2 F' L2 D R2 B2 U2 F2 R2 U F U' R2 F R2 U'" className="h-72 w-72" />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-2xl font-bold">Sign in</h1>

        {supabaseEnabled && (
          <Button
            variant="secondary"
            onClick={() => signInGoogle()}
            className="flex w-full items-center justify-center gap-3 !border-zinc-300 bg-white !text-zinc-900 shadow hover:bg-zinc-100 dark:!border-transparent"
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin();
          }}
          className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 backdrop-blur-md"
        >
          <Input
            label="Email or mobile number"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or Mobile Number"
            type="text"
            autoComplete="username"
            autoFocus
          />
          <Input
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />
          <Button
            type="submit"
            fullWidth
            loading={busy}
            disabled={!identifier.trim() || !password}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <Link href="/forgot-password" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              Forgot password?
            </Link>
            <Link href="/register" className="text-accent-primary hover:brightness-110">
              Register
            </Link>
          </div>
          <Link href="/register/migrate" className="block text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Have a legacy cubelelo-event account? Claim it here
          </Link>
        </form>
      </div>
    </main>
  );
}
