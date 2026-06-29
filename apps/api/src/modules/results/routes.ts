import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ao5, computeStats } from "@cubers/timer-core";
import type { Solve, SolvePenalty, FlagStatus } from "@cubers/types";
import type { Repository } from "../../db/repo";
import type { Result } from "../../db/types";
import type { Realtime } from "../../sockets/realtime";
import { requireAuth } from "../../auth/plugin";
import { effectiveRoundStatus } from "../../lib/statusUtils";
import { getScrambleFetchTime } from "../../lib/scrambleTiming";

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

async function recomputeRanks(repo: Repository, roundId: string): Promise<void> {
  const all = await repo.results.findByRound(roundId);
  const key = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);
  const ranked = [...all].sort(
    (a, b) => key(a.ao5Ms) - key(b.ao5Ms) || key(a.bestSingleMs) - key(b.bestSingleMs),
  );
  await repo.results.updateRanks(ranked.map((r, i) => ({ id: r.id, rank: i + 1 })));
}

export async function registerResultRoutes(
  app: FastifyInstance,
  repo: Repository,
  realtime: Realtime,
): Promise<void> {
  app.post<{
    Params: { id: string };
    Body: { solves?: unknown; videoUrl?: string };
  }>(
    "/api/v1/rounds/:id/results",
    { preHandler: requireAuth },
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });

      if (effectiveRoundStatus(round) !== "open") return reply.code(409).send({ error: "round_not_open" });

      const user = await repo.users.findById(req.authClaims!.sub);
      if (!user) return reply.code(403).send({ error: "not_synced" });

      // For round 2+: only shortlisted participants may submit
      if (round.roundNumber > 1) {
        const advanced = await repo.advancements.isAdvanced(round.id, user.id);
        if (!advanced) return reply.code(403).send({ error: "not_shortlisted" });
      }

      // Prevent duplicate submissions
      const existingResults = await repo.results.findByRound(round.id);
      if (existingResults.some((r) => r.userId === user.id)) {
        return reply.code(409).send({ error: "already_submitted" });
      }

      const solves = parseSolves(req.body?.solves);
      if (!solves) return reply.code(400).send({ error: "invalid_solves" });

      const videoUrl = req.body?.videoUrl?.trim() ?? null;
      if (!videoUrl) return reply.code(400).send({ error: "video_url_required" });

      // Anti-cheat: validate submission falls within round open/close window
      const now = Date.now();
      if (round.opensAt && now < new Date(round.opensAt).getTime()) {
        return reply.code(400).send({ error: "round_not_yet_open" });
      }
      if (round.closesAt && now > new Date(round.closesAt).getTime()) {
        return reply.code(400).send({ error: "round_closed" });
      }

      // Anti-cheat: total claimed solve time must not exceed wall-clock time since scramble fetch
      const fetchedAt = getScrambleFetchTime(round.id, user.id);
      if (fetchedAt) {
        const totalClaimedMs = solves.reduce((sum, s) => sum + s.time_ms, 0);
        const wallClockMs = now - fetchedAt;
        if (totalClaimedMs > wallClockMs) {
          return reply.code(400).send({ error: "timing_mismatch" });
        }
        // If round has a close time, ensure scramble fetch happened after round opened
        if (round.opensAt && fetchedAt < new Date(round.opensAt).getTime()) {
          return reply.code(400).send({ error: "scramble_fetched_before_round_open" });
        }
      }

      const stats = computeStats(solves);
      const computedAo5 = ao5(solves);

      // Anti-cheat: flag suspiciously fast results per event type
      const event = await repo.competitionEvents.findByRound(round.id);
      let flagStatus: FlagStatus = "clean";
      if (computedAo5 !== null && computedAo5 !== Infinity) {
        const thresholds: Record<string, number> = {
          "333": 3000, "222": 800, "444": 18000, "555": 35000,
          "666": 75000, "777": 110000, pyram: 1000, skewb: 1200,
          minx: 25000, "333oh": 6000, "333bf": 12000, sq1: 5000, clock: 3000,
        };
        const eventType = event?.eventType ?? "333";
        const threshold = thresholds[eventType] ?? 3000;
        if (computedAo5 < threshold) flagStatus = "flagged";
      }

      const result: Result = {
        id: randomUUID(),
        roundId: round.id,
        userId: user.id,  // UUID, matches FK in PG schema
        solves,
        bestSingleMs: stats.best_single_ms,
        ao5Ms: computedAo5,
        meanMs: stats.mean_ms,
        medianMs: stats.median_ms,
        stdMs: stats.std_ms,
        rank: null,
        videoUrl,
        flagStatus,
        submittedAt: new Date().toISOString(),
      };
      try {
        await repo.results.create(result);
        await recomputeRanks(repo, round.id);
        // Update personal bests
        if (event) {
          const existing = (await repo.personalBests.findByUser(user.id))
            .find((pb) => pb.eventType === event.eventType);
          await repo.personalBests.upsert({
            id: existing?.id ?? randomUUID(),
            userId: user.id,
            eventType: event.eventType,
            bestSingleMs: result.bestSingleMs,
            bestAo5Ms: result.ao5Ms,
            bestMeanMs: result.meanMs,
            bestMedianMs: result.medianMs,
            bestRank: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate") || msg.includes("unique")) {
          return reply.code(409).send({ error: "already_submitted" });
        }
        return reply.code(400).send({ error: "save_failed", detail: msg });
      }

      const board = await repo.results.findByRound(round.id);
      board.sort(
        (a, b) =>
          (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
      );
      realtime.emitLeaderboard(round.id, board);

      return reply.code(201).send(result);
    },
  );

  // Leaderboard for a round.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/results",
    async (req) => {
      const board = await repo.results.findByRound(req.params.id);
      return board.sort(
        (a, b) =>
          (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
      );
    },
  );
}
