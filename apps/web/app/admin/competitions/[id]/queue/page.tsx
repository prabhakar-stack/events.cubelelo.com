"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchVerificationQueue, verifyResult, type ResultDto } from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { useAuth } from "@/features/auth/AuthProvider";
import { StatusBadge } from "@/features/competitions/StatusBadge";

export default function VerificationQueuePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [queue, setQueue] = useState<ResultDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    if (!params.id) return;
    setLoading(true);
    fetchVerificationQueue(params.id)
      .then(setQueue)
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [params.id]);

  if (user?.role !== "admin") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-400">
        Admin access required
      </main>
    );
  }

  const handleVerify = async (resultId: string, action: string) => {
    setBusy(resultId);
    try {
      const reason = action === "disqualified" ? prompt("Reason for disqualification:") ?? "" : undefined;
      await verifyResult(resultId, action, reason);
      load();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Verification Queue</h1>
        <Link
          href={`/admin/competitions/${params.id}`}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← Back to competition
        </Link>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : queue.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <p className="text-zinc-400">No flagged results to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-amber-900/40 bg-zinc-900/40 p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/profile/${r.userId}`}
                    className="font-mono text-emerald-400 hover:text-emerald-300"
                  >
                    {r.userId}
                  </Link>
                  <StatusBadge status={r.flagStatus ?? "flagged"} />
                </div>
                <span className="text-xs text-zinc-500">
                  Round: {r.roundId?.slice(0, 8)}
                </span>
              </div>

              <div className="mb-3 flex gap-6 text-sm">
                <div>
                  <span className="text-zinc-500">ao5: </span>
                  <span className="font-mono text-zinc-200">
                    {r.ao5Ms !== null ? formatTime(r.ao5Ms) : "DNF"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Best: </span>
                  <span className="font-mono text-zinc-200">
                    {r.bestSingleMs !== null
                      ? formatTime(r.bestSingleMs)
                      : "DNF"}
                  </span>
                </div>
                {r.videoUrl && (
                  <a
                    href={r.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    Video
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleVerify(r.id, "verified")}
                  disabled={busy === r.id}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  onClick={() => handleVerify(r.id, "disqualified")}
                  disabled={busy === r.id}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Disqualify
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
