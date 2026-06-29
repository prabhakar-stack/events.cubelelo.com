"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchCompetition, fetchLeaderboard, submitAppeal, type CompetitionDetail, type ResultDto } from "@/lib/api";
import { eventDisplayName } from "@/lib/eventNames";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatTime } from "@cubers/timer-core";
import { StatusBadge } from "@/features/competitions/StatusBadge";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [boards, setBoards] = useState<Map<string, ResultDto[]>>(new Map());
  const [activeRound, setActiveRound] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appealModal, setAppealModal] = useState<{ resultId: string; open: boolean }>({ resultId: "", open: false });
  const [appealReason, setAppealReason] = useState("");
  const [appealStatus, setAppealStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [appealError, setAppealError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    fetchCompetition(params.id)
      .then(async (c) => {
        setComp(c);
        const map = new Map<string, ResultDto[]>();
        for (const ev of c.events) {
          for (const r of ev.rounds) {
            try {
              const lb = await fetchLeaderboard(r.id);
              if (lb.length > 0) map.set(r.id, lb);
            } catch {
              /* ignore */
            }
          }
        }
        setBoards(map);
        // Default to first round with results
        const first = c.events.flatMap((e) => e.rounds).find((r) => map.has(r.id));
        if (first) setActiveRound(first.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading results…
      </main>
    );
  }

  if (!comp) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-400">
        Competition not found
      </main>
    );
  }

  const allRounds = comp.events.flatMap((ev) =>
    ev.rounds.map((r) => ({ ...r, eventType: ev.eventType })),
  );

  const results = activeRound ? boards.get(activeRound) ?? [] : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">
        {comp.title} — Results
      </h1>
      <p className="mb-6 text-sm text-zinc-400">
        <StatusBadge status={comp.status} />
      </p>

      {/* Round tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {allRounds.map((r) => {
          const hasResults = boards.has(r.id);
          return (
            <button
              key={r.id}
              onClick={() => hasResults && setActiveRound(r.id)}
              disabled={!hasResults}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                activeRound === r.id
                  ? "bg-emerald-600 text-white"
                  : hasResults
                    ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                    : "bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {eventDisplayName(r.eventType)} R{r.roundNumber}
            </button>
          );
        })}
      </div>

      {/* Leaderboard table */}
      {results.length === 0 ? (
        <p className="text-zinc-500">No results yet for this round.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Competitor</th>
                <th className="px-4 py-3 text-right">Average (ao5)</th>
                <th className="px-4 py-3 text-right">Best Single</th>
                {user && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-300">
                    {r.rank ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/profile/${r.userId}`}
                      className="font-mono text-emerald-400 hover:text-emerald-300"
                    >
                      {r.userId}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-200">
                    {r.ao5Ms !== null && r.ao5Ms !== Infinity
                      ? formatTime(r.ao5Ms)
                      : "DNF"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-200">
                    {r.bestSingleMs !== null && r.bestSingleMs !== Infinity
                      ? formatTime(r.bestSingleMs)
                      : "DNF"}
                  </td>
                  {user && (
                    <td className="px-4 py-2.5">
                      {r.userId === user.id && (
                        <button
                          onClick={() => {
                            setAppealModal({ resultId: r.id, open: true });
                            setAppealReason("");
                            setAppealStatus("idle");
                          }}
                          className="rounded bg-amber-900/30 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/50"
                        >
                          Appeal
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appeal modal */}
      {appealModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Submit Appeal</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Explain why you believe this result should be reviewed.
            </p>
            <textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="Reason for appeal..."
              rows={4}
              className="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
            />
            {appealStatus === "error" && (
              <p className="mb-3 text-sm text-red-400">{appealError}</p>
            )}
            {appealStatus === "sent" && (
              <p className="mb-3 text-sm text-emerald-400">Appeal submitted successfully!</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAppealModal({ resultId: "", open: false })}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                {appealStatus === "sent" ? "Close" : "Cancel"}
              </button>
              {appealStatus !== "sent" && (
                <button
                  disabled={!appealReason.trim() || appealStatus === "sending"}
                  onClick={async () => {
                    setAppealStatus("sending");
                    try {
                      await submitAppeal(appealModal.resultId, appealReason.trim());
                      setAppealStatus("sent");
                    } catch (e) {
                      setAppealError(e instanceof Error ? e.message : String(e));
                      setAppealStatus("error");
                    }
                  }}
                  className="rounded bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {appealStatus === "sending" ? "Submitting..." : "Submit Appeal"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
