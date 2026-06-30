"use client";

import { useEffect, useState } from "react";

interface CompTimestamps {
  status: string;
  registrationOpensAt?: string | null;
  registrationDeadline?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  cancellationReason?: string | null;
}

interface UserStatusInfo {
  label: string;
  style: string;
}

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function computeUserStatus(comp: CompTimestamps, now: number, isRegistered?: boolean): UserStatusInfo {
  const { status } = comp;

  if (status === "cancelled") {
    return { label: "Competition Cancelled", style: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
  }
  if (status === "completed") {
    return { label: "Result Announced", style: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  }
  if (status === "results_pending") {
    return { label: "Result Pending", style: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  }
  if (status === "live") {
    return { label: "Competition Live", style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
  }
  if (status === "registration_closed") {
    if (isRegistered && comp.startsAt) {
      const remaining = new Date(comp.startsAt).getTime() - now;
      if (remaining > 0) {
        return {
          label: `Starting In ${formatCountdown(remaining)}`,
          style: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        };
      }
    }
    return { label: "Registration Closed", style: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  }
  if (status === "registration_open") {
    return { label: "Registration Open", style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
  }

  // upcoming — check if registration opening countdown applies
  if (status === "upcoming" && comp.registrationOpensAt) {
    const remaining = new Date(comp.registrationOpensAt).getTime() - now;
    if (remaining > 0) {
      return {
        label: `Reg. Opens In ${formatCountdown(remaining)}`,
        style: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      };
    }
  }

  return { label: "Upcoming", style: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
}

export function UserStatusBadge({
  comp,
  isRegistered,
}: {
  comp: CompTimestamps;
  isRegistered?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  const hasCountdown =
    (comp.status === "upcoming" && comp.registrationOpensAt) ||
    (comp.status === "registration_closed" && isRegistered && comp.startsAt);

  useEffect(() => {
    if (!hasCountdown) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasCountdown]);

  const { label, style } = computeUserStatus(comp, now, isRegistered);

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style}`}
    >
      {label}
    </span>
  );
}
