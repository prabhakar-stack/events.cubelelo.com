"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchCompetition, fetchLeaderboard, type CompetitionDetail, type ResultDto } from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { StatusBadge } from "@/features/competitions/StatusBadge";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [boards, setBoards] = useState<Map<string, ResultDto[]>>(new Map());
  const [activeRound, setActiveRound] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
              {r.eventType} R{r.roundNumber}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
