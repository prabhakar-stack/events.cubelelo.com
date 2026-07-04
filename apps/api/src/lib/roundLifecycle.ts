import type { RoundStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import type { Round, RoundAdvancement, AdvancementCriteria } from "../db/types";
import type { Realtime } from "../sockets/realtime";

export async function closeRound(
  repo: Repository,
  realtime: Realtime,
  round: Round,
): Promise<void> {
  await repo.rounds.update(round.id, { status: "closed" });
  realtime.emitRoundStatus(round.id, "closed" as RoundStatus, round.opensAt);
}

export async function shortlistRound(
  repo: Repository,
  realtime: Realtime,
  round: Round,
): Promise<void> {
  const criteria = round.advancementCriteria;
  const legacyCount = round.advancementCount;

  if (!criteria && !legacyCount) return;

  const results = await repo.results.findByRound(round.id);
  const key = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);

  const eligible = results.filter(
    (r) => r.flagStatus !== "flagged" && r.flagStatus !== "disqualified",
  );

  const sorted = [...eligible].sort(
    (a, b) => key(a.ao5Ms) - key(b.ao5Ms) || key(a.bestSingleMs) - key(b.bestSingleMs),
  );

  let shortlisted: typeof eligible;

  if (criteria) {
    shortlisted = applyMethod(criteria, sorted);
  } else {
    shortlisted = sorted.slice(0, legacyCount!);
  }

  if (shortlisted.length === 0) return;

  const existing = await repo.advancements.findByRound(round.id);
  if (existing.length > 0) {
    throw new Error(`Round ${round.id} already has ${existing.length} advancements — clear them first`);
  }

  const advanced: RoundAdvancement[] = shortlisted.map((r, i) => ({
    roundId: round.id,
    userId: r.userId,
    rank: i + 1,
  }));

  await repo.advancements.save(round.id, advanced);
  await repo.rounds.update(round.id, { status: "advanced" });
  realtime.emitRoundStatus(round.id, "advanced" as RoundStatus, round.opensAt);
}

function applyMethod<T extends { ao5Ms: number | null }>(
  criteria: AdvancementCriteria,
  sorted: T[],
): T[] {
  if (criteria.method === "rank" && criteria.rankLimit) {
    return sorted.slice(0, criteria.rankLimit);
  }
  if (criteria.method === "time" && criteria.timeLimitMs) {
    const limit = criteria.timeLimitMs;
    return sorted.filter((r) => r.ao5Ms !== null && r.ao5Ms <= limit);
  }
  return [];
}

// Legacy wrapper for backward compatibility during transition
export async function closeAndShortlist(
  repo: Repository,
  realtime: Realtime,
  round: Round,
): Promise<void> {
  await closeRound(repo, realtime, round);

  if (!round.advancementCriteria && round.advancementCount && round.advancementCount > 0) {
    const freshRound = await repo.rounds.findById(round.id);
    if (freshRound) await shortlistRound(repo, realtime, freshRound);
  }
}
