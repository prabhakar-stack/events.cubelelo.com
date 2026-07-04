import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { generateScrambleSet, isEventId } from "@cubers/scramble-core";
import type { Repository } from "../../db/repo";
import type { Realtime } from "../../sockets/realtime";
import { requireRole, requireAuth } from "../../auth/plugin";
import type { RoundStatus } from "@cubers/types";
import type { Round } from "../../db/types";
import { effectiveRoundStatus } from "../../lib/statusUtils";
import { validateRoundTimes } from "../../lib/scheduleValidation";
import { recordScrambleFetch } from "../../lib/scrambleTiming";
import { scrambleLimiter, adminLimiter } from "../../lib/rateLimiter";

export async function registerRoundRoutes(
  app: FastifyInstance,
  repo: Repository,
  realtime: Realtime,
): Promise<void> {
  const adminOnly = { preHandler: requireRole(repo, "admin") };

  // Round detail.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id",
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const event = await repo.competitionEvents.findByRound(round.id);
      const set = await repo.scrambleSets.findByRound(round.id);
      return {
        id: round.id,
        roundNumber: round.roundNumber,
        status: effectiveRoundStatus(round),
        opensAt: round.opensAt ?? null,
        closesAt: round.closesAt ?? null,
        advancementCount: round.advancementCount ?? null,
        advancementCriteria: round.advancementCriteria ?? null,
        eventType: event?.eventType,
        scrambleLocked: Boolean(set?.lockedAt),
      };
    },
  );

  // Lobby snapshot.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/lobby",
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const event = await repo.competitionEvents.findByRound(round.id);
      const competition = event
        ? await repo.competitions.findById(event.competitionId)
        : undefined;
      return {
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          status: round.status,
          opensAt: round.opensAt ?? null,
          closesAt: round.closesAt ?? null,
          eventType: event?.eventType ?? null,
        },
        competition: {
          id: competition?.id ?? null,
          title: competition?.title ?? null,
          rulesMd: competition?.rulesMd ?? null,
        },
        roster: await repo.roster.snapshot(round.id),
      };
    },
  );

  // Server-locked scramble delivery.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/scramble",
    { preHandler: [scrambleLimiter, requireAuth] },
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      if (effectiveRoundStatus(round) !== "open") return reply.code(409).send({ error: "round_not_open" });

      const set = await repo.scrambleSets.findByRound(round.id);
      if (!set || !set.lockedAt) return reply.code(409).send({ error: "scrambles_not_ready" });

      // For round 2+: only shortlisted participants can access scrambles
      if (round.roundNumber > 1) {
        const user = await repo.users.findById(req.authClaims!.sub);
        if (!user) return reply.code(403).send({ error: "not_synced" });
        const advanced = await repo.advancements.isAdvanced(round.id, user.id);
        if (!advanced) return reply.code(403).send({ error: "not_shortlisted" });
      }

      await recordScrambleFetch(round.id, req.authClaims!.sub);
      return { roundId: round.id, scrambles: set.scrambles };
    },
  );

  // Generate + lock scrambles.
  app.post<{ Params: { id: string }; Body: { count?: number } }>(
    "/api/v1/admin/rounds/:id/scrambles",
    adminOnly,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });

      const event = await repo.competitionEvents.findByRound(round.id);
      if (!event || !isEventId(event.eventType))
        return reply.code(409).send({ error: "invalid_event_type" });

      const existing = await repo.scrambleSets.findByRound(round.id);
      if (existing?.lockedAt) return reply.code(409).send({ error: "scrambles_already_locked" });

      const count = req.body?.count ?? 5;
      if (count < 1) return reply.code(400).send({ error: "invalid_count" });

      const now = new Date().toISOString();
      const scrambles = await generateScrambleSet(event.eventType, count);
      await repo.scrambleSets.upsert({
        id: existing?.id ?? randomUUID(),
        roundId: round.id,
        scrambles,
        generatedAt: now,
        lockedAt: now,
        lockedBy: req.authClaims!.sub,
      });

      return reply.code(201).send({ roundId: round.id, count: scrambles.length });
    },
  );

  // View scrambles (admin only).
  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/scrambles",
    adminOnly,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const set = await repo.scrambleSets.findByRound(round.id);
      if (!set) return { roundId: round.id, scrambles: [], locked: false };
      return {
        roundId: round.id, scrambles: set.scrambles,
        locked: Boolean(set.lockedAt), generatedAt: set.generatedAt, lockedAt: set.lockedAt,
      };
    },
  );

  // Cancel a round (admin only).
  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/cancel",
    adminOnly,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const status = effectiveRoundStatus(round);
      if (status === "advanced") return reply.code(409).send({ error: "round_already_advanced" });
      if (status === "cancelled") return reply.code(409).send({ error: "round_already_cancelled" });

      const updated = await repo.rounds.update(round.id, { status: "cancelled" });
      if (!updated) return reply.code(404).send({ error: "round_not_found" });
      realtime.emitRoundStatus(updated.id, "cancelled", updated.opensAt);
      return { id: updated.id, status: "cancelled" };
    },
  );

  // Reopen a closed or advanced round (admin only).
  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/reopen",
    adminOnly,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const status = effectiveRoundStatus(round);
      if (status !== "closed" && status !== "advanced") {
        return reply.code(409).send({ error: "round_not_closed_or_advanced" });
      }

      if (status === "advanced") {
        const event = await repo.competitionEvents.findByRound(round.id);
        if (event) {
          const allRounds = await repo.rounds.findByCompetition(event.competitionId);
          const nextRound = allRounds.find(
            (r) => r.competitionEventId === round.competitionEventId && r.roundNumber === round.roundNumber + 1,
          );
          if (nextRound) {
            const nextResults = await repo.results.findByRound(nextRound.id);
            if (nextResults.length > 0) {
              return reply.code(409).send({ error: "next_round_has_results" });
            }
          }
        }
      }

      await repo.rounds.update(round.id, { status: "open" });
      realtime.emitRoundStatus(round.id, "open" as RoundStatus, round.opensAt);
      return { id: round.id, status: "open" };
    },
  );

  // Update round settings (advancementCount, schedule, duration)
  app.patch<{
    Params: { id: string };
    Body: {
      advancementCount?: number;
      advancementCriteria?: { method: string; rankLimit?: number; timeLimitMs?: number } | null;
      opensAt?: string | null;
      closesAt?: string | null;
      durationMinutes?: number;
    };
  }>("/api/v1/admin/rounds/:id", adminOnly, async (req, reply) => {
    const { advancementCount, advancementCriteria, opensAt, closesAt, durationMinutes } = req.body ?? {};
    const fields: Parameters<typeof repo.rounds.update>[1] = {};
    if (typeof advancementCount === "number") fields.advancementCount = advancementCount;

    if (advancementCriteria !== undefined) {
      if (advancementCriteria === null) {
        fields.advancementCriteria = undefined;
      } else {
        const method = advancementCriteria.method;
        if (method === "rank") {
          if (!advancementCriteria.rankLimit || advancementCriteria.rankLimit < 1)
            return reply.code(400).send({ error: "rank_limit_required" });
          fields.advancementCriteria = { method: "rank", rankLimit: advancementCriteria.rankLimit };
        } else if (method === "time") {
          if (!advancementCriteria.timeLimitMs || advancementCriteria.timeLimitMs < 1)
            return reply.code(400).send({ error: "time_limit_required" });
          fields.advancementCriteria = { method: "time", timeLimitMs: advancementCriteria.timeLimitMs };
        } else {
          return reply.code(400).send({ error: "invalid_advancement_method" });
        }
      }
    }
    if (opensAt !== undefined) fields.opensAt = opensAt ?? undefined;
    if (closesAt !== undefined) fields.closesAt = closesAt ?? undefined;
    if (typeof durationMinutes === "number") fields.durationMinutes = durationMinutes;

    // Auto-compute closesAt from opensAt + durationMinutes when both are set
    if (fields.opensAt && fields.durationMinutes) {
      const open = new Date(fields.opensAt);
      fields.closesAt = new Date(open.getTime() + fields.durationMinutes * 60_000).toISOString();
    } else if (fields.durationMinutes && !fields.opensAt) {
      const round = await repo.rounds.findById(req.params.id);
      if (round?.opensAt) {
        const open = new Date(round.opensAt);
        fields.closesAt = new Date(open.getTime() + fields.durationMinutes * 60_000).toISOString();
      }
    }

    // Validate round times against competition and sibling rounds
    if (fields.opensAt !== undefined || fields.closesAt !== undefined) {
      const existing = await repo.rounds.findById(req.params.id);
      if (!existing) return reply.code(404).send({ error: "round_not_found" });
      const merged = { ...existing, ...fields };
      const event = await repo.competitionEvents.findByRound(existing.id);
      if (event) {
        const comp = await repo.competitions.findById(event.competitionId);
        const allRounds = await repo.rounds.findByCompetition(event.competitionId);
        const siblings = allRounds.filter((r) => r.competitionEventId === existing.competitionEventId);
        const result = validateRoundTimes(merged as Round, siblings, comp ?? {});
        if (!result.valid) {
          return reply.code(400).send({ error: "schedule_validation_failed", errors: result.errors });
        }
      }
    }

    const updated = await repo.rounds.update(req.params.id, fields);
    if (!updated) return reply.code(404).send({ error: "round_not_found" });
    return {
      id: updated.id, status: updated.status,
      advancementCount: updated.advancementCount,
      advancementCriteria: updated.advancementCriteria ?? null,
      opensAt: updated.opensAt, closesAt: updated.closesAt,
      durationMinutes: updated.durationMinutes,
    };
  });
}
