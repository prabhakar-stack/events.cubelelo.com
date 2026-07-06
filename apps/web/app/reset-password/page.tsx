"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { friendlyAuthError } from "@/lib/errorMessages";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center text-zinc-500">Loading...</main>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-2 text-xl font-bold">Invalid Link</h1>
          <p className="text-sm text-zinc-500">No reset token found. Request a new reset link.</p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm text-emerald-600 hover:text-emerald-500"
          >
            Forgot Password
          </Link>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 text-4xl">&#x2705;</div>
          <h1 className="mb-2 text-xl font-bold">Password Reset!</h1>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            Your password has been updated. You can now log in.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
          >
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-xl font-bold">Set New Password</h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your new password below.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={error ?? undefined}
          />
          <Button type="submit" fullWidth loading={loading} size="lg">
            {loading ? "Resetting…" : "Reset Password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
