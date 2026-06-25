"use client";

import { useEffect, useState } from "react";
import { fetchCompetitions, type CompetitionSummary } from "@/lib/api";
import { CompetitionCard } from "@/features/competitions/CompetitionCard";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Past", value: "past" },
] as const;

export default function CompetitionsPage() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCompetitions(filter || undefined)
      .then(setComps)
      .catch(() => setComps([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Competitions</h1>

      <div className="mb-6 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filter === f.value
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-zinc-500">
          Loading…
        </div>
      ) : comps.length === 0 ? (
        <p className="text-zinc-500">No competitions found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comps.map((c) => (
            <CompetitionCard key={c.id} comp={c} />
          ))}
        </div>
      )}
    </main>
  );
}
