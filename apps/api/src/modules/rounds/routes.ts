import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { generateScrambleSet, isEventId } from "@cubers/scramble-core";
import type { Repository } from "../../db/repo";
import type { Realtime } from "../../sockets/realtime";
import { requireRole, requireAuth } from "../../auth/plugin";
import type { RoundAdvancement } from "../../db/types";
import { effectiveRoundStatus } from "../../lib/statusUtils";
import { recordScrambleFetch } from "../../lib/scrambleTiming";

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
        roster: repo.roster.snapshot(round.id),
      };
    },
  );

  // Server-locked scramble delivery.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/scramble",
    { preHandler: requireAuth },
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

      recordScrambleFetch(round.id, req.authClaims!.sub);
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

  // Open a round.
  app.post<{ Params: { id: string }; Body: { opensAt?: string } }>(
    "/api/v1/admin/rounds/:id/open",
    adminOnly,
    async (req, reply) => {
      const now = req.body?.opensAt ?? new Date().toISOString();
      const round = await repo.rounds.update(req.params.id, { status: "open", opensAt: now });
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      realtime.emitRoundStatus(round.id, round.status, round.opensAt);
      return { id: round.id, status: round.status, opensAt: round.opensAt };
    },
  );

  // Close a round — shortlist top-N participants if advancementCount is set.
  app.post<{ Params: { id: string }; Body: { closesAt?: string } }>(
    "/api/v1/admin/rounds/:id/close",
    adminOnly,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });

      const now = req.body?.closesAt ?? new Date().toISOString();
      const updated = await repo.rounds.update(round.id, { status: "closed", closesAt: now });
      if (!updated) return reply.code(404).send({ error: "round_not_found" });

      let advanced: RoundAdvancement[] = [];

      // Shortlist top-N participants when advancementCount is defined
      if (round.advancementCount && round.advancementCount > 0) {
        const results = await repo.results.findByRound(round.id);
        const key = (n: number | null) => (n === null ? Number.POSITIVE_INFINITY : n);
        const ranked = [...results]
          .filter((r) => r.flagStatus !== "disqualified")
          .sort((a, b) => key(a.ao5Ms) - key(b.ao5Ms) || key(a.bestSingleMs) - key(b.bestSingleMs));

        const shortlisted = ranked.slice(0, round.advancementCount);
        advanced = shortlisted.map((r, i) => ({
          roundId: round.id,
          userId: r.userId,
          rank: i + 1,
        }));
        await repo.advancements.save(round.id, advanced);

        // Mark the round as "advanced" to signal next round can open
        await repo.rounds.update(round.id, { status: "advanced" });
      }

      realtime.emitRoundStatus(updated.id, updated.status, updated.opensAt);
      return {
        id: updated.id,
        status: advanced.length > 0 ? "advanced" : "closed",
        advancedCount: advanced.length,
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

  // Update round settings (advancementCount, schedule, duration)
  app.patch<{
    Params: { id: string };
    Body: { advancementCount?: number; opensAt?: string | null; closesAt?: string | null; durationMinutes?: number };
  }>("/api/v1/admin/rounds/:id", adminOnly, async (req, reply) => {
    const { advancementCount, opensAt, closesAt, durationMinutes } = req.body ?? {};
    const fields: Parameters<typeof repo.rounds.update>[1] = {};
    if (typeof advancementCount === "number") fields.advancementCount = advancementCount;
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

    const updated = await repo.rounds.update(req.params.id, fields);
    if (!updated) return reply.code(404).send({ error: "round_not_found" });
    return {
      id: updated.id, status: updated.status,
      advancementCount: updated.advancementCount,
      opensAt: updated.opensAt, closesAt: updated.closesAt,
      durationMinutes: updated.durationMinutes,
    };
  });
}
