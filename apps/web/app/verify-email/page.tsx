"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center text-zinc-500">Verifying...</main>}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token",
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((e) => {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : String(e));
      });
  }, [token]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        {status === "loading" && (
          <p className="text-zinc-500">Verifying your email...</p>
        )}
        {status === "success" && (
          <>
            <div className="mb-3 text-4xl">&#x2705;</div>
            <h1 className="mb-2 text-xl font-bold">Email Verified!</h1>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              Your email has been verified. You can now access all features.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
            >
              Go to Login
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mb-3 text-4xl">&#x274C;</div>
            <h1 className="mb-2 text-xl font-bold">Verification Failed</h1>
            <p className="mb-6 text-sm text-red-400">{errorMsg || "Invalid or expired token."}</p>
            <Link
              href="/login"
              className="inline-block rounded-lg bg-zinc-700 px-6 py-2.5 font-semibold text-white transition hover:bg-zinc-600"
            >
              Back to Login
            </Link>
          </>
        )}
        {status === "no-token" && (
          <>
            <h1 className="mb-2 text-xl font-bold">Missing Token</h1>
            <p className="mb-6 text-sm text-zinc-500">
              No verification token found. Check your email for the verification link.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
