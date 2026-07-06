"use client";

import { useEffect, useState } from "react";
import { fetchCompetitions, fetchMyRegistrations, type CompetitionSummary, type RegistrationDto } from "@/lib/api";
import { CompetitionCard } from "@/features/competitions/CompetitionCard";
import { SkeletonCard } from "@/components/Skeleton";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Past", value: "past" },
] as const;

type Tab = "all" | "my";

export default function CompetitionsPage() {
  const user = useAuthStore((s) => s.user);
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [myRegIds, setMyRegIds] = useState<Set<string> | null>(null);
  const [myLoading, setMyLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCompetitions(filter || undefined)
      .then(setComps)
      .catch(() => setComps([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (tab === "my" && user && !myRegIds) {
      setMyLoading(true);
      fetchMyRegistrations()
        .then((regs) => setMyRegIds(new Set(regs.map((r) => r.competitionId))))
        .catch(() => setMyRegIds(new Set()))
        .finally(() => setMyLoading(false));
    }
  }, [tab, user, myRegIds]);

  const displayed = tab === "my" && myRegIds
    ? comps.filter((c) => myRegIds.has(c.id))
    : comps;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Competitions</h1>

        {/* Tab toggle */}
        <div className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
          <button
            onClick={() => setTab("all")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === "all"
                ? "bg-zinc-800 text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
          >
            All Competitionss
          </button>
          <button
            onClick={() => setTab("my")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === "my"
                ? "bg-zinc-800 text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
          >
            My Competitionss
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div className="mb-6 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === f.value
                ? "bg-emerald-600 text-white"
                : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Not logged in warning for My tab */}
      {tab === "my" && !user && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <div className="mb-2 text-3xl">🔒</div>
          <p className="mb-3 text-zinc-500 dark:text-zinc-400">Sign in to see your registered competitions</p>
          <Link
            href="/auth/login"
            className="inline-block rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* Loading */}
      {(loading || (tab === "my" && myLoading)) && (tab !== "my" || user) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (tab === "my" && !user) ? null : displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
          <div className="mb-2 text-3xl">🧊</div>
          {tab === "my"
            ? "You haven't registered for any competitions yet."
            : "No competitions found — check back soon!"}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((c) => (
            <CompetitionCard key={c.id} comp={c} />
          ))}
        </div>
      )}
    </main>
  );
}
