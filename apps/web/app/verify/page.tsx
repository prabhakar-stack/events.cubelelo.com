"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sendOtp, verifyOtp } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center text-zinc-500">Loading...</main>}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const type = (params.get("type") as "email" | "mobile") || "email";
  const value = params.get("value") || "";

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"input" | "verifying" | "success" | "error">("input");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length !== 6) return;
    setStatus("verifying");
    setErrorMsg("");
    try {
      await verifyOtp(type, value, code.trim());
      setStatus("success");
      if (user) {
        const updated = { ...user };
        if (type === "email") updated.emailVerified = true;
        else updated.mobileVerified = true;
        setUser(updated);
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    try {
      await sendOtp(type, value);
      setResent(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setResending(false);
    }
  };

  const label = type === "email" ? "email" : "mobile number";

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        {status === "success" ? (
          <>
            <div className="mb-3 text-4xl">&#x2705;</div>
            <h1 className="mb-2 text-xl font-bold">
              {type === "email" ? "Email" : "Mobile Number"} Verified!
            </h1>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              Your {label} has been verified successfully.
            </p>
            {user && !user.emailVerified && type === "mobile" ? (
              <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
                You still need to verify your email to register for competitions.
                <Link href="/settings" className="ml-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                  Go to Settings
                </Link>
              </p>
            ) : user && !user.mobileVerified && type === "email" ? (
              <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
                You still need to verify your mobile number to register for competitions.
                <Link href="/settings" className="ml-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                  Go to Settings
                </Link>
              </p>
            ) : null}
            <button
              onClick={() => router.push("/")}
              className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
            >
              Go to Homepage
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold">Verify your {label}</h1>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              We sent a 6-digit code to <span className="font-medium text-zinc-700 dark:text-zinc-300">{value}</span>
            </p>
            <div className="mb-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                }}
                placeholder="000000"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] placeholder:text-zinc-300 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                autoFocus
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={status === "verifying" || code.length !== 6}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {status === "verifying" ? "Verifying…" : "Verify"}
            </button>
            {status === "error" && (
              <p className="mt-3 text-sm text-red-400">{errorMsg || "Invalid or expired code."}</p>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <span>Didn&apos;t receive the code?</span>
              <button
                onClick={handleResend}
                disabled={resending}
                className="font-medium text-emerald-600 hover:text-emerald-500 disabled:opacity-50 dark:text-emerald-400"
              >
                {resending ? "Sending…" : "Resend"}
              </button>
            </div>
            {resent && (
              <p className="mt-2 text-sm text-emerald-500">Code resent!</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
