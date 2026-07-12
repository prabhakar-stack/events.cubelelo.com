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

  const myUpcoming = tab === "my" ? displayed.filter((c) => ["registration_open", "registration_closed"].includes(c.status)).length : 0;
  const myLive = tab === "my" ? displayed.filter((c) => c.status === "live").length : 0;
  const myPast = tab === "my" ? displayed.filter((c) => ["results_pending", "completed"].includes(c.status)).length : 0;

  return (
    <>
      {/* Left rail */}
      <nav className="space-y-4 overflow-x-auto px-6 pb-2 pt-4 lg:fixed lg:left-0 lg:top-14 lg:z-30 lg:h-[calc(100vh-56px)] lg:w-56 lg:space-y-6 lg:overflow-y-auto lg:overflow-x-visible lg:border-r lg:border-[var(--border-default)] lg:bg-[var(--bg-glass)] lg:px-3 lg:py-6 lg:backdrop-blur-xl">
        <div className="flex gap-1.5 lg:block lg:space-y-0.5">
          <p className="mb-1.5 hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] lg:block">
            View
          </p>
          {(["all", "my"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`block shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full lg:shrink ${
                tab === t
                  ? "bg-accent-primary/10 font-semibold text-accent-primary"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t === "all" ? "All Competitions" : "My Competitions"}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 lg:block lg:space-y-0.5">
          <p className="mb-1.5 hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] lg:block">
            Status
          </p>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`block shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full lg:shrink ${
                filter === f.value
                  ? "bg-accent-primary/10 font-semibold text-accent-primary"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="lg:pl-56">
        <main className="relative z-[1] mx-auto max-w-[1400px] px-6 py-10">
          <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Competitions</h1>

        <div>
          {tab === "my" && !user && (
            <div className="glass-card rounded-xl border-dashed p-10 text-center">
              <div className="mb-2 text-3xl">🔒</div>
              <p className="mb-3 text-[var(--text-tertiary)]">Sign in to see your registered competitions</p>
              <Link
                href="/login"
                className="inline-block rounded-lg bg-gradient-to-r from-accent-primary to-[var(--accent-secondary)] px-5 py-2 text-sm font-semibold text-[#080b12] shadow-[0_4px_16px_var(--accent-glow)]"
              >
                Sign in
              </Link>
            </div>
          )}

          {tab === "my" && user && !myLoading && displayed.length > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">{myUpcoming}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Upcoming</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">{myLive}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Live</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">{myPast}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Completed</div>
              </div>
            </div>
          )}

          {(loading || (tab === "my" && myLoading)) && (tab !== "my" || user) ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (tab === "my" && !user) ? null : displayed.length === 0 ? (
            <div className="glass-card rounded-xl border-dashed p-10 text-center text-[var(--text-tertiary)]">
              <div className="mb-2 text-3xl">🧊</div>
              {tab === "my"
                ? "You haven't registered for any competitions yet."
                : "No competitions found — check back soon!"}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {displayed.map((c) => (
                <CompetitionCard key={c.id} comp={c} />
              ))}
            </div>
          )}
        </div>
        </main>
      </div>
    </>
  );
}
