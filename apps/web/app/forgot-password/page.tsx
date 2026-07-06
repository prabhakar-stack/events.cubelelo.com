"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { friendlyAuthError } from "@/lib/errorMessages";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        {sent ? (
          <div className="text-center">
            <div className="mb-3 text-4xl">&#x1F4E7;</div>
            <h1 className="mb-2 text-xl font-bold">Check Your Email</h1>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link.
            </p>
            <Link
              href="/login"
              className="text-sm text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-2 text-center text-xl font-bold">Forgot Password</h1>
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                error={error ?? undefined}
              />
              <Button type="submit" fullWidth loading={loading} size="lg">
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-zinc-500">
              <Link href="/login" className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400">
                Back to Login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
