"use client";

import Link from "next/link";
import type { CompetitionSummary } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

export function CompetitionCard({ comp }: { comp: CompetitionSummary }) {
  const feeLabel =
    comp.type === "free"
      ? "Free"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)}+`;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/60"
    >
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={comp.status} />
        <span className="text-xs text-zinc-500">{feeLabel}</span>
      </div>
      <h3 className="mb-1 text-lg font-semibold text-zinc-100 group-hover:text-white">
        {comp.title}
      </h3>
      {comp.description && (
        <p className="mb-3 line-clamp-2 text-sm text-zinc-400">
          {comp.description}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-zinc-500">
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
