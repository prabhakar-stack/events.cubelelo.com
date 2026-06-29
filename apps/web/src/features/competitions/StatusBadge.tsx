"use client";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  published: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  registration_open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  registration_closed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  results_pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  advanced: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const DISPLAY_LABELS: Record<string, string> = {
  registration_open: "Reg. Open",
  registration_closed: "Reg. Closed",
  results_pending: "Results Pending",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        STATUS_STYLES[status] ?? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {DISPLAY_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
