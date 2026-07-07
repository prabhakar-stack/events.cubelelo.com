export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  neutral: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

interface StatusEntry {
  label: string;
  tone: BadgeTone;
}

/**
 * Single source of truth for "what does this status mean, visually" across the
 * whole app. One domain per concept — replaces 5 previously-independent
 * per-file status/color maps.
 */
export const STATUS_DOMAINS = {
  competition: {
    draft: { label: "Draft", tone: "neutral" },
    published: { label: "Published", tone: "info" },
    registration_open: { label: "Reg. Open", tone: "success" },
    registration_closed: { label: "Reg. Closed", tone: "warning" },
    cancelled: { label: "Cancelled", tone: "danger" },
    live: { label: "Live", tone: "success" },
    results_pending: { label: "Results Pending", tone: "warning" },
    completed: { label: "Completed", tone: "info" },
    open: { label: "Open", tone: "success" },
    pending: { label: "Upcoming", tone: "info" },
    closed: { label: "Closed", tone: "neutral" },
    advanced: { label: "Advanced", tone: "info" },
  },
  round: {
    pending: { label: "Upcoming", tone: "info" },
    open: { label: "Live", tone: "success" },
    closed: { label: "Closed", tone: "neutral" },
    advanced: { label: "Shortlisted", tone: "info" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
  payment: {
    pending: { label: "Pending", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
    failed: { label: "Failed", tone: "danger" },
    refunded: { label: "Refunded", tone: "info" },
    refund_pending: { label: "Refund Pending", tone: "warning" },
  },
  accountStage: {
    active: { label: "Active", tone: "success" },
    migrated_stub: { label: "Migrated Stub", tone: "info" },
    suspended: { label: "Suspended", tone: "warning" },
    banned: { label: "Banned", tone: "danger" },
    deleted: { label: "Deleted", tone: "neutral" },
  },
  verification: {
    clean: { label: "Clean", tone: "neutral" },
    flagged: { label: "Flagged", tone: "warning" },
    verified: { label: "Verified", tone: "success" },
    plus2: { label: "+2", tone: "warning" },
    dnf: { label: "DNF", tone: "danger" },
    disqualified: { label: "Disqualified", tone: "danger" },
  },
  activeToggle: {
    active: { label: "Active", tone: "success" },
    inactive: { label: "Inactive", tone: "neutral" },
  },
} satisfies Record<string, Record<string, StatusEntry>>;

export type StatusDomain = keyof typeof STATUS_DOMAINS;

export function StatusBadge({ domain, status }: { domain: StatusDomain; status: string }) {
  const table = STATUS_DOMAINS[domain] as Record<string, StatusEntry>;
  const entry = table[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as BadgeTone };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
