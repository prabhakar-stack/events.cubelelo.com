import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { generateScrambleSet, isEventId } from "@cubers/scramble-core";
import type { Db } from "../../db/store";
import { eventForRound, scrambleSetForRound } from "../../db/store";
import type { ScrambleSet } from "../../db/types";

export async function registerRoundRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  // Round detail.
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id",
    async (req, reply) => {
      const round = db.rounds.get(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const event = eventForRound(db, round);
      const set = scrambleSetForRound(db, round.id);
      return {
        id: round.id,
        roundNumber: round.roundNumber,
        status: round.status,
        eventType: event?.eventType,
        scrambleLocked: Boolean(set?.lockedAt),
      };
    },
  );

  // Server-locked scramble delivery — only when the round is open and locked.
  // Defeats the "open the Network tab early" exploit (ARCHITECTURE §5).
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/scramble",
    async (req, reply) => {
      const round = db.rounds.get(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      if (round.status !== "open") {
        return reply.code(409).send({ error: "round_not_open" });
      }
      const set = scrambleSetForRound(db, round.id);
      if (!set || !set.lockedAt) {
        return reply.code(409).send({ error: "scrambles_not_ready" });
      }
      return { roundId: round.id, scrambles: set.scrambles };
    },
  );

  // ── Admin (auth deferred) ──

  // Generate + lock a scramble set for the round. The event type is resolved
  // from the round → competition_event mapping (NOT supplied by the client):
  // this is the roundId → eventId resolution living in the backend.
  app.post<{ Params: { id: string }; Body: { count?: number } }>(
    "/api/v1/admin/rounds/:id/scrambles",
    async (req, reply) => {
      const round = db.rounds.get(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });

      const event = eventForRound(db, round);
      if (!event || !isEventId(event.eventType)) {
        return reply.code(409).send({ error: "invalid_event_type" });
      }

      const existing = scrambleSetForRound(db, round.id);
      if (existing?.lockedAt) {
        return reply.code(409).send({ error: "scrambles_already_locked" });
      }

      const count = req.body?.count ?? 5;
      if (count < 1) return reply.code(400).send({ error: "invalid_count" });

      const now = new Date().toISOString();
      const scrambles = await generateScrambleSet(event.eventType, count);
      const set: ScrambleSet = {
        id: existing?.id ?? randomUUID(),
        roundId: round.id,
        scrambles,
        generatedAt: now,
        lockedAt: now,
        lockedBy: "admin",
      };
      db.scrambleSets.set(set.id, set);
      return reply.code(201).send({ roundId: round.id, count: scrambles.length });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/open",
    async (req, reply) => {
      const round = db.rounds.get(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      round.opensAt = new Date().toISOString();
      round.status = "open";
      return { id: round.id, status: round.status };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/close",
    async (req, reply) => {
      const round = db.rounds.get(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      round.closesAt = new Date().toISOString();
      round.status = "closed";
      return { id: round.id, status: round.status };
    },
  );
}
