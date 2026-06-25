import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ao5, computeStats } from "@cubers/timer-core";
import type { Solve, SolvePenalty, FlagStatus } from "@cubers/types";
import type { Db } from "../../db/store";
import { resultsForRound, eventForRound } from "../../db/store";
import type { Result } from "../../db/types";
import type { Realtime } from "../../sockets/realtime";
import { requireAuth } from "../../auth/plugin";

/** Leaderboard for a round, ordered by rank. */
function leaderboard(db: Db, roundId: string): Result[] {
  return resultsForRound(db, roundId).sort(
    (a, b) =>
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
  );
}

const PENALTIES: SolvePenalty[] = ["none", "plus2", "dnf"];

function parseSolves(input: unknown): Solve[] | null {
  if (!Array.isArray(input)) return null;
  const solves: Solve[] = [];
  for (const raw of input) {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as Solve).time_ms !== "number" ||
      !PENALTIES.includes((raw as Solve).penalty)
    ) {
      return null;
    }
    solves.push({ time_ms: (raw as Solve).time_ms, penalty: (raw as Solve).penalty });
  }
  return solves;
}

/** Rank by average (ao5), DNF/empty last; tiebreak by best single. */
function recomputeRanks(db: Db, roundId: string): void {
  const key = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);
  const ranked = resultsForRound(db, roundId).sort(
    (a, b) => key(a.ao5Ms) - key(b.ao5Ms) || key(a.bestSingleMs) - key(b.bestSingleMs),
  );
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
}

export async function registerResultRoutes(
  app: FastifyInstance,
  db: Db,
  realtime: Realtime,
): Promise<void> {
  app.post<{
    Params: { id: string };
    Body: { solves?: unknown; videoUrl?: string };
  }>(
    "/api/v1/rounds/:id/results",
    { preHandler: requireAuth },
    async (req, reply) => {
    const round = db.rounds.get(req.params.id);
    if (!round) return reply.code(404).send({ error: "round_not_found" });

    // The competitor is the authenticated user; results are keyed by CL ID.
    const user = db.users.get(req.authClaims!.sub);
    if (!user) return reply.code(403).send({ error: "not_synced" });
    const userId = user.clId;

    const solves = parseSolves(req.body?.solves);
    if (!solves) return reply.code(400).send({ error: "invalid_solves" });

    const stats = computeStats(solves);
    const computedAo5 = ao5(solves);

    // Anti-cheat: flag suspiciously fast results per event type
    const event = eventForRound(db, round);
    let flagStatus: FlagStatus = "clean";
    if (computedAo5 !== null && computedAo5 !== Infinity) {
      const thresholds: Record<string, number> = {
        "333": 3000, "222": 800, "444": 18000, "555": 35000,
        "666": 75000, "777": 110000, "pyram": 1000, "skewb": 1200,
        "minx": 25000, "333oh": 6000, "333bf": 12000, "sq1": 5000, "clock": 3000,
      };
      const eventType = event?.eventType ?? "333";
      const threshold = thresholds[eventType] ?? 3000;
      if (computedAo5 < threshold) {
        flagStatus = "flagged";
      }
    }

    const result: Result = {
      id: randomUUID(),
      roundId: round.id,
      userId,
      solves,
      bestSingleMs: stats.best_single_ms,
      ao5Ms: computedAo5,
      meanMs: stats.mean_ms,
      medianMs: stats.median_ms,
      stdMs: stats.std_ms,
      rank: null,
      videoUrl: req.body?.videoUrl ?? null,
      flagStatus,
      submittedAt: new Date().toISOString(),
    };
    db.results.set(result.id, result);
    recomputeRanks(db, round.id);

    // Broadcast the updated leaderboard to everyone watching this round.
    realtime.emitLeaderboard(round.id, leaderboard(db, round.id));

    return reply.code(201).send(result);
  });

  // Leaderboard for a round.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/results",
    async (req) => leaderboard(db, req.params.id),
  );
}
