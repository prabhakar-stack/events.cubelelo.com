import type { Solve } from "@cubers/types";

const pad2 = (n: number): string => n.toString().padStart(2, "0");

/**
 * Format a duration (ms) as a WCA-style display string.
 * Truncated to hundredths (centiseconds), never rounded up (PRD §2.2).
 *   12340  → "12.34"
 *   65430  → "1:05.43"
 *   null   → "DNF"  (used for DNF averages / no result)
 */
export function formatTime(ms: number | null): string {
  if (ms === null) return "DNF";
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return min > 0 ? `${min}:${pad2(sec)}.${pad2(cs)}` : `${sec}.${pad2(cs)}`;
}

/** Format a solve including its penalty: DNF, or "13.45+" for a +2. */
export function formatSolve(solve: Solve): string {
  if (solve.penalty === "dnf") return "DNF";
  if (solve.penalty === "plus2") return `${formatTime(solve.time_ms + 2000)}+`;
  return formatTime(solve.time_ms);
}
