import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isEventId } from "@cubers/scramble-core";
import type { CompStatus, CompType } from "@cubers/types";
import type { Db } from "../../db/store";
import type { Competition, CompetitionEvent, Round } from "../../db/types";
import { requireRole } from "../../auth/plugin";

const COMP_TYPES: CompType[] = ["paid", "free", "practice"];
const COMP_STATUSES: CompStatus[] = [
  "draft",
  "published",
  "registration_open",
  "registration_closed",
  "cancelled",
  "live",
  "results_pending",
  "completed",
];

/** Admin competition management (auth deferred). Round/scramble controls live
 *  in the rounds module. */
export async function registerAdminRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  const adminOnly = { preHandler: requireRole(db, "admin") };

  // Create a competition with one event and N pending rounds.
  app.post<{
    Body: {
      title?: string;
      type?: CompType;
      eventType?: string;
      roundCount?: number;
      rulesMd?: string;
    };
  }>("/api/v1/admin/competitions", adminOnly, async (req, reply) => {
    const { title, type, eventType, roundCount, rulesMd } = req.body ?? {};
    if (!title || typeof title !== "string") {
      return reply.code(400).send({ error: "missing_title" });
    }
    if (!eventType || !isEventId(eventType)) {
      return reply.code(400).send({ error: "invalid_event_type" });
    }

    const competition: Competition = {
      id: randomUUID().slice(0, 8),
      title,
      type: type && COMP_TYPES.includes(type) ? type : "free",
      status: "draft",
      rulesMd: typeof rulesMd === "string" ? rulesMd : undefined,
    };
    db.competitions.set(competition.id, competition);

    const rounds = Math.max(1, Math.min(roundCount ?? 1, 10));
    const event: CompetitionEvent = {
      id: randomUUID(),
      competitionId: competition.id,
      eventType,
      roundCount: rounds,
    };
    db.events.set(event.id, event);

    for (let i = 1; i <= rounds; i++) {
      const round: Round = {
        id: randomUUID(),
        competitionEventId: event.id,
        roundNumber: i,
        status: "pending",
      };
      db.rounds.set(round.id, round);
    }

    return reply.code(201).send({ id: competition.id });
  });

  // Edit title / status / rules.
  app.patch<{
    Params: { id: string };
    Body: { title?: string; status?: CompStatus; rulesMd?: string };
  }>("/api/v1/admin/competitions/:id", adminOnly, async (req, reply) => {
    const competition = db.competitions.get(req.params.id);
    if (!competition) {
      return reply.code(404).send({ error: "competition_not_found" });
    }
    const { title, status, rulesMd } = req.body ?? {};
    if (typeof title === "string") competition.title = title;
    if (typeof rulesMd === "string") competition.rulesMd = rulesMd;
    if (status && COMP_STATUSES.includes(status)) competition.status = status;
    return {
      id: competition.id,
      title: competition.title,
      status: competition.status,
    };
  });
}
