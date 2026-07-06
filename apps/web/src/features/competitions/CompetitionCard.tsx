"use client";

import Link from "next/link";
import type { CompetitionSummary } from "@/lib/api";
import { UserStatusBadge } from "./UserStatusBadge";
import { EventIcon } from "@/components/EventIcon";

export function CompetitionCard({ comp }: { comp: CompetitionSummary }) {
  const feeLabel =
    comp.type === "free"
      ? "Free"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)}+`;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/70 p-5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-accent-primary/40"
    >
      <div className="shimmer-sweep pointer-events-none absolute inset-0" />
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {comp.status === "live" && (
            <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
          )}
          <UserStatusBadge comp={comp} />
        </div>
        <span className="text-xs text-zinc-500">{feeLabel}</span>
      </div>
      <h3 className="relative mb-1 text-lg font-semibold text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white">
        {comp.title}
      </h3>
      {comp.description && (
        <p className="relative mb-3 line-clamp-2 text-sm text-zinc-400">
          {comp.description}
        </p>
      )}
      {comp.eventTypes && comp.eventTypes.length > 0 && (
        <div className="relative mb-3 flex flex-wrap gap-1">
          {comp.eventTypes.slice(0, 8).map((et) => (
            <span
              key={et}
              title={et}
              className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800"
            >
              <EventIcon eventId={et} size={14} />
            </span>
          ))}
        </div>
      )}
      <div className="relative mt-auto flex items-center justify-between text-xs text-zinc-500">
        <span>
          {comp.eventTypes?.length ?? 0} event{(comp.eventTypes?.length ?? 0) !== 1 ? "s" : ""}
        </span>
        <span>
          {comp.registrationCount ?? 0} registered
        </span>
      </div>
    </Link>
  );
}
