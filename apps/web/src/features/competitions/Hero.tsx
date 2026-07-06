"use client";

import Link from "next/link";
import type { CompetitionSummary } from "@/lib/api";
import { eventIcon } from "@/lib/eventIcons";

export function Hero({ comp }: { comp: CompetitionSummary }) {
  const isLive = comp.status === "live";
  const events = comp.eventTypes ?? [];

  return (
    <section className="hero-gradient relative mt-8 overflow-hidden rounded-2xl px-6 py-10 text-white md:px-10 md:py-14">
      <div className="relative z-10 mx-auto max-w-2xl">
        {isLive ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
            <span className="live-dot h-2 w-2 rounded-full bg-red-400" />
            Live now
          </div>
        ) : (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-primary">
            Upcoming
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{comp.title}</h1>

        {events.length > 0 && (
          <p className="mt-3 font-mono text-sm text-zinc-300 md:text-base">
            {events.map((et) => `${eventIcon(et).emoji} ${et}`).join("  ·  ")}
          </p>
        )}

        {comp.description && (
          <p className="mt-3 max-w-xl text-sm text-zinc-300/90 md:text-base">{comp.description}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/competitions/${comp.id}`}
            className="rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
          >
            {isLive ? "Join →" : "View details →"}
          </Link>
          <Link
            href="/rankings"
            className="rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            Watch Leaderboard →
          </Link>
        </div>
      </div>
    </section>
  );
}
