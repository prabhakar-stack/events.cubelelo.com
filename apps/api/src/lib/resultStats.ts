import { randomUUID } from "node:crypto";
import { computeStats } from "@cubers/timer-core";
import type { FlagStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import type { Result } from "../db/types";
import type { Realtime } from "../sockets/realtime";

/** Rank all results in a round: eligible sorted by ao5 then best single; disqualified get rank 0. */
export async function recomputeRanks(repo: Repository, roundId: string, prefetched?: Result[]): Promise<Result[]> {
  const all = prefetched ?? await repo.results.findByRound(roundId);
  const updates = computeRankUpdates(all);
  await repo.results.updateRanks(updates);
  const rankMap = new Map(updates.map((u) => [u.id, u.rank]));
  return all.map((r) => ({ ...r, rank: rankMap.get(r.id) ?? r.rank }));
}

/** Same ranking logic but works on slim results (no solve data needed). */
export function computeRankUpdates(all: { id: string; ao5Ms: number | null; bestSingleMs: number | null; flagStatus: string }[]): { id: string; rank: number }[] {
  const eligible = all.filter((r) => r.flagStatus !== "disqualified");
  const disqualified = all.filter((r) => r.flagStatus === "disqualified");
  const key = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);
  const ranked = [...eligible].sort(
    (a, b) => key(a.ao5Ms) - key(b.ao5Ms) || key(a.bestSingleMs) - key(b.bestSingleMs),
  );
  const updates = ranked.map((r, i) => ({ id: r.id, rank: i + 1 }));
  for (const r of disqualified) updates.push({ id: r.id, rank: 0 });
  return updates;
}

/**
 * Derived stats for a result under a judge action. Raw solves are never
 * mutated, so a later "verified" restores the original numbers.
 *   plus2 → +2s on every comparable stat (std unchanged)
 *   dnf   → the whole attempt is a DNF, no counting stats
 *   else  → base stats straight from the solves
 */
function statsForAction(result: Result, action: FlagStatus): Pick<
  Result,
  "bestSingleMs" | "ao5Ms" | "meanMs" | "medianMs" | "stdMs"
> {
  if (action === "dnf") {
    return { bestSingleMs: null, ao5Ms: null, meanMs: null, medianMs: null, stdMs: null };
  }
  const base = computeStats(result.solves);
  const plus = action === "plus2" ? 2000 : 0;
  const add = (n: number | null) => (n === null ? null : n + plus);
  return {
    bestSingleMs: add(base.best_single_ms),
    ao5Ms: add(base.ao5_ms),
    meanMs: add(base.mean_ms),
    medianMs: add(base.median_ms),
    stdMs: base.std_ms,
  };
}

/**
 * Rebuild a user's personal best for an event from their non-disqualified
 * competition results. Overwrites (repo.personalBests.replace) so a PB set by
 * a since-penalized result is corrected, not just min-merged.
 */
export async function recomputePersonalBest(
  repo: Repository,
  userId: string,
  eventType: string,
): Promise<void> {
  const all = await repo.results.findByUser(userId);
  const eventByRound = new Map<string, string | undefined>();
  for (const roundId of new Set(all.map((r) => r.roundId))) {
    const event = await repo.competitionEvents.findByRound(roundId);
    eventByRound.set(roundId, event?.eventType);
  }
  const eligible = all.filter(
    (r) => eventByRound.get(r.roundId) === eventType && r.flagStatus !== "disqualified",
  );

  const min = (pick: (r: Result) => number | null): number | null => {
    const vals = eligible.map(pick).filter((n): n is number => n !== null);
    return vals.length ? Math.min(...vals) : null;
  };

  const existing = (await repo.personalBests.findByUser(userId)).find(
    (pb) => pb.eventType === eventType,
  );
  await repo.personalBests.replace({
    id: existing?.id ?? randomUUID(),
    userId,
    eventType,
    bestSingleMs: min((r) => r.bestSingleMs),
    bestAo5Ms: min((r) => r.ao5Ms),
    bestMeanMs: min((r) => r.meanMs),
    bestMedianMs: min((r) => r.medianMs),
    bestRank: min((r) => (r.rank && r.rank > 0 ? r.rank : null)),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Everything downstream of a judge/admin override (HIGH-009): re-derive the
 * result's stats under the action, re-rank the round, rebuild the user's PB,
 * and push the corrected leaderboard to the room.
 */
export async function applyResultOverride(
  repo: Repository,
  realtime: Realtime,
  result: Result,
  action: FlagStatus,
): Promise<void> {
  await repo.results.update(result.id, statsForAction(result, action));
  const board = await recomputeRanks(repo, result.roundId);
  board.sort(
    (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
  );

  const event = await repo.competitionEvents.findByRound(result.roundId);
  if (event) await recomputePersonalBest(repo, result.userId, event.eventType);

  realtime.emitLeaderboard(result.roundId, board);
}
