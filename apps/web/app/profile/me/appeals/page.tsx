"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchMyAppeals, type AppealDto } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { formatTime } from "@cubers/timer-core";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function MyAppealsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appeals, setAppeals] = useState<AppealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchMyAppeals()
      .then(setAppeals)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">My Appeals</h1>
        <Link
          href={`/profile/${user?.clId}`}
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Back to profile
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      {appeals.length === 0 ? (
        <EmptyState icon="📮" title="No appeals" description="You haven't submitted any appeals yet." />
      ) : (
        <div className="space-y-4">
          {appeals.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Header: competition context + status */}
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {a.competitionName && (
                    <span className="font-medium text-zinc-900 dark:text-white">{a.competitionName}</span>
                  )}
                  {a.eventType && (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {a.eventType}
                    </span>
                  )}
                  {a.roundNumber != null && (
                    <span className="text-zinc-500">Round {a.roundNumber}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[a.status] ?? ""}`}>
                    {a.status}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Your reason</p>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{a.reason}</p>
              </div>

              {/* Admin response */}
              {a.status !== "pending" && (
                <div
                  className={`rounded-lg border px-3 py-2 ${
                    a.status === "accepted"
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  }`}
                >
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {a.status === "accepted" ? "Accepted" : "Rejected"} by {a.resolvedByName ?? "Admin"}
                    {a.resolvedAt && <> • {new Date(a.resolvedAt).toLocaleDateString()}</>}
                  </p>
                  {a.adminResponse && (
                    <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{a.adminResponse}</p>
                  )}
                </div>
              )}

              {/* Pending state */}
              {a.status === "pending" && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⏳ Under review — you&apos;ll see the response here once resolved.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
