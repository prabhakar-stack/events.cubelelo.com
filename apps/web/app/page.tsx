"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCompetitions, type CompetitionSummary } from "@/lib/api";
import { CompetitionCard } from "@/features/competitions/CompetitionCard";
import { StatusBadge } from "@/features/competitions/StatusBadge";

export default function Home() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitions()
      .then(setComps)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const live = comps.filter((c) => c.status === "live");
  const upcoming = comps.filter((c) =>
    ["draft", "published", "registration_open", "registration_closed"].includes(c.status),
  );
  const past = comps.filter((c) =>
    ["results_pending", "completed"].includes(c.status),
  );
  const featured = live[0] ?? upcoming[0];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Hero */}
      {featured && (
        <section className="mb-12 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 md:p-12">
          <div className="mb-4 flex items-center gap-3">
            <StatusBadge status={featured.status} />
            {featured.type !== "free" && (
              <span className="text-xs text-zinc-500">
                ₹{((featured.baseFee ?? 0) / 100).toFixed(0)}+
              </span>
            )}
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
            {featured.title}
          </h1>
          {featured.description && (
            <p className="mb-6 max-w-2xl text-zinc-400">{featured.description}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/competitions/${featured.id}`}
              className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
            >
              View Competition →
            </Link>
            {featured.status === "live" && (
              <Link
                href={`/competitions/${featured.id}/lobby`}
                className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-900"
              >
                Enter Lobby
              </Link>
            )}
          </div>
        </section>
      )}

      {!featured && !loading && (
        <section className="mb-12 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-100">
            Cubelelo Events
          </h1>
          <p className="text-zinc-400">
            No competitions scheduled yet. Check back soon!
          </p>
        </section>
      )}

      {loading && (
        <div className="flex min-h-[200px] items-center justify-center text-zinc-500">
          Loading competitions…
        </div>
      )}

      {/* Live */}
      {live.length > 0 && (
        <Section title="Live Now">
          {live.map((c) => (
            <CompetitionCard key={c.id} comp={c} />
          ))}
        </Section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section title="Upcoming">
          {upcoming.map((c) => (
            <CompetitionCard key={c.id} comp={c} />
          ))}
        </Section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <Section title="Past Competitions">
          {past.map((c) => (
            <CompetitionCard key={c.id} comp={c} />
          ))}
        </Section>
      )}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-200">{title}</h2>
        <Link
          href="/competitions"
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          View all →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
