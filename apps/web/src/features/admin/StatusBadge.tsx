const COLORS: Record<string, string> = {
  registration_open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  draft: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  closed: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  advanced: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const LABELS: Record<string, string> = {
  registration_open: "Reg. Open",
  open: "Open",
  live: "Live",
  pending: "Pending",
  draft: "Draft",
  closed: "Closed",
  completed: "Completed",
  advanced: "Advanced",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        COLORS[status] ?? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
