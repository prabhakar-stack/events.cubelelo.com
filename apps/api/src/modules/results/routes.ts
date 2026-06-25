import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ao5, computeStats } from "@cubers/timer-core";
import type { Solve, SolvePenalty } from "@cubers/types";
import type { Db } from "../../db/store";
import { resultsForRound } from "../../db/store";
import type { Result } from "../../db/types";

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
): Promise<void> {
  app.post<{
    Params: { id: string };
    Body: { userId?: string; solves?: unknown; videoUrl?: string };
  }>("/api/v1/rounds/:id/results", async (req, reply) => {
    const round = db.rounds.get(req.params.id);
    if (!round) return reply.code(404).send({ error: "round_not_found" });

    const userId = req.body?.userId;
    if (!userId) return reply.code(400).send({ error: "missing_userId" });

    const solves = parseSolves(req.body?.solves);
    if (!solves) return reply.code(400).send({ error: "invalid_solves" });

    const stats = computeStats(solves);
    const result: Result = {
      id: randomUUID(),
      roundId: round.id,
      userId,
      solves,
      bestSingleMs: stats.best_single_ms,
      ao5Ms: ao5(solves),
      meanMs: stats.mean_ms,
      medianMs: stats.median_ms,
      stdMs: stats.std_ms,
      rank: null,
      videoUrl: req.body?.videoUrl ?? null,
      flagStatus: "clean", // TODO: statistical outlier check vs history
      submittedAt: new Date().toISOString(),
    };
    db.results.set(result.id, result);
    recomputeRanks(db, round.id);

    return reply.code(201).send(result);
  });

  // Leaderboard for a round.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/results",
    async (req) => {
      return resultsForRound(db, req.params.id).sort(
        (a, b) =>
          (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
      );
    },
  );
}
