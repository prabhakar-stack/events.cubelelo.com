"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRankings, type RankingEntry } from "@/lib/api";
import { eventDisplayName } from "@/lib/eventNames";
import { formatTime } from "@cubers/timer-core";

const EVENT_TYPES = [
  "333", "222", "444", "555", "666", "777",
  "333oh", "333bf", "pyram", "skewb", "minx", "sq1", "clock",
];

export default function RankingsPage() {
  const [event, setEvent] = useState("333");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchRankings(event)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [event]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Rankings</h1>

      {/* Event filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {EVENT_TYPES.map((e) => (
          <button
            key={e}
            onClick={() => setEvent(e)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              event === e
                ? "bg-emerald-600 text-white"
                : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {eventDisplayName(e)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
          No rankings yet for {eventDisplayName(event)}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <th className="px-4 py-3 w-16">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">CL ID</th>
                <th className="px-4 py-3 text-right">Average (ao5)</th>
                <th className="px-4 py-3 text-right">Best Single</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r, i) => (
                <tr
                  key={`${r.userId}-${r.eventType}`}
                  className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-400">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/profile/${r.clId}`}
                      className="font-mono text-emerald-400 hover:text-emerald-300"
                    >
                      {r.clId}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-800 dark:text-zinc-200">
                    {r.bestAo5Ms !== null && r.bestAo5Ms !== Infinity
                      ? formatTime(r.bestAo5Ms)
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-800 dark:text-zinc-200">
                    {r.bestSingleMs !== null && r.bestSingleMs !== Infinity
                      ? formatTime(r.bestSingleMs)
                      : "—"}
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
