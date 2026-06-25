const MAP: Record<string, string> = {
  open: "bg-emerald-900/40 text-emerald-300",
  live: "bg-emerald-900/40 text-emerald-300",
  pending: "bg-amber-900/40 text-amber-300",
  draft: "bg-zinc-800 text-zinc-400",
  closed: "bg-zinc-800 text-zinc-400",
  completed: "bg-blue-900/40 text-blue-300",
  advanced: "bg-blue-900/40 text-blue-300",
  cancelled: "bg-red-900/40 text-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        MAP[status] ?? "bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}
