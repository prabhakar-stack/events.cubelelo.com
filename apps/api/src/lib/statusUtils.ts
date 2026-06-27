import type { Competition, Round } from "../db/types";

/**
 * Computes the effective competition status from schedule timestamps.
 *
 * Stored status is only authoritative for "draft" and "cancelled".
 * Everything else is derived from the time window fields so that status
 * updates automatically without any admin action.
 *
 * Cascade (first match wins):
 *   now >= endsAt               → completed
 *   now >= startsAt             → live
 *   now >= registrationDeadline → registration_closed
 *   now >= registrationOpensAt  → registration_open
 *   else                        → upcoming
 *
 * If none of the schedule fields are populated the stored status is returned
 * unchanged (backward-compat for existing rows and tests).
 */
export function effectiveCompStatus(comp: Competition): string {
  if (comp.status === "draft" || comp.status === "cancelled" || comp.status === "completed") return comp.status;

  if (!comp.registrationOpensAt && !comp.startsAt && !comp.endsAt) {
    return comp.status; // no schedule set — fall back to stored value
  }

  const now = Date.now();

  if (comp.endsAt && now >= +new Date(comp.endsAt)) return "results_pending";
  if (comp.startsAt && now >= +new Date(comp.startsAt)) return "live";
  if (comp.registrationDeadline && now >= +new Date(comp.registrationDeadline)) return "registration_closed";
  if (comp.registrationOpensAt && now >= +new Date(comp.registrationOpensAt)) return "registration_open";

  return "upcoming";
}

/**
 * Computes the effective round status from opensAt / closesAt.
 *
 * "advanced" is always preserved (set by admin after shortlisting).
 * If no opensAt is stored the round is under manual admin control.
 *
 * Cascade:
 *   stored === "advanced"  → advanced  (shortlisting already done)
 *   no opensAt             → stored status (manual)
 *   now >= closesAt        → closed
 *   now >= opensAt         → open
 *   else                   → pending
 */
export function effectiveRoundStatus(round: Round): string {
  if (round.status === "advanced") return "advanced";
  if (!round.opensAt) return round.status;

  const now = Date.now();
  const opensAtMs = +new Date(round.opensAt);
  const closesAtMs = round.closesAt ? +new Date(round.closesAt) : null;

  // If the admin re-opened the round after it was closed (opensAt >= closesAt),
  // ignore the stale closesAt and treat the round as open.
  const isReopened = closesAtMs !== null && opensAtMs >= closesAtMs;

  if (closesAtMs !== null && !isReopened && now >= closesAtMs) return "closed";
  if (now >= opensAtMs) return "open";

  return "pending";
}
