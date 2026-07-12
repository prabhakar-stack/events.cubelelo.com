"use client";

import Link from "next/link";
import type { CompetitionSummary } from "@/lib/api";
import { EventIcon } from "@/components/EventIcon";
import { eventDisplayName } from "@/lib/eventNames";

export function Hero({ comp }: { comp: CompetitionSummary }) {
  const isLive = comp.status === "live";
  const events = comp.eventTypes ?? [];

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-glass)] px-6 py-10 backdrop-blur-xl md:px-10 md:py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/[0.04] via-transparent to-[var(--accent-secondary)]/[0.03]" />
      <div className="absolute right-0 top-0 h-[200px] w-[200px] rounded-full bg-accent-primary/[0.06] blur-[60px]" />

      <div className="relative z-10 mx-auto max-w-2xl">
        {isLive ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-danger/20 bg-accent-danger/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-danger">
            <span className="live-dot h-2 w-2 rounded-full bg-accent-danger" />
            Live now
          </div>
        ) : (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-primary/20 bg-accent-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-primary">
            Featured
          </div>
        )}

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-4xl">{comp.title}</h1>

        {events.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
            {events.map((et) => (
              <span key={et} className="inline-flex items-center gap-1.5 rounded-md border border-accent-primary/10 bg-accent-primary/5 px-2 py-0.5">
                <EventIcon eventId={et} size={14} className="text-accent-primary" />
                <span className="text-xs">{eventDisplayName(et)}</span>
              </span>
            ))}
          </div>
        )}

        {comp.description && (
          <p className="mt-3 max-w-xl text-sm text-[var(--text-tertiary)] md:text-base">{comp.description}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/competitions/${comp.id}`}
            className="rounded-lg bg-gradient-to-r from-accent-primary to-[var(--accent-secondary)] px-5 py-2.5 text-sm font-semibold text-[#080b12] shadow-[0_4px_16px_var(--accent-glow)] transition hover:shadow-[0_6px_24px_var(--accent-glow)]"
          >
            {isLive ? "Join →" : "View details →"}
          </Link>
          <Link
            href="/rankings"
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-glass)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] backdrop-blur-sm transition hover:border-[var(--border-hover)]"
          >
            Leaderboard →
          </Link>
        </div>
      </div>
    </section>
  );
}
