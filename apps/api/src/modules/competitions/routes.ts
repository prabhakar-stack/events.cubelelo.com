import type { FastifyInstance } from "fastify";
import type { CompStatus } from "@cubers/types";
import type { Db } from "../../db/store";
import {
  roundsForCompetition,
  eventForRound,
  scrambleSetForRound,
  registrationsForCompetition,
} from "../../db/store";

const UPCOMING_STATUSES: CompStatus[] = [
  "draft",
  "published",
  "registration_open",
  "registration_closed",
];
const LIVE_STATUSES: CompStatus[] = ["live"];
const PAST_STATUSES: CompStatus[] = ["results_pending", "completed"];

export async function registerCompetitionRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  // List competitions with optional status filter.
  app.get<{ Querystring: { status?: string } }>(
    "/api/v1/competitions",
    async (req) => {
      let comps = [...db.competitions.values()];

      const filter = req.query?.status;
      if (filter === "upcoming") {
        comps = comps.filter((c) => UPCOMING_STATUSES.includes(c.status));
      } else if (filter === "live") {
        comps = comps.filter((c) => LIVE_STATUSES.includes(c.status));
      } else if (filter === "past") {
        comps = comps.filter((c) => PAST_STATUSES.includes(c.status));
      }

      return comps.map((c) => {
        const events = [...db.events.values()].filter(
          (e) => e.competitionId === c.id,
        );
        const regCount = registrationsForCompetition(db, c.id).length;
        return {
          id: c.id,
          title: c.title,
          type: c.type,
          status: c.status,
          description: c.description,
          baseFee: c.baseFee,
          perEventFee: c.perEventFee,
          registrationDeadline: c.registrationDeadline,
          coverUrl: c.coverUrl,
          createdAt: c.createdAt,
          eventTypes: events.map((e) => e.eventType),
          registrationCount: regCount,
        };
      });
    },
  );

  // Competition detail with events and rounds.
  app.get<{ Params: { id: string } }>(
    "/api/v1/competitions/:id",
    async (req, reply) => {
      const competition = db.competitions.get(req.params.id);
      if (!competition) {
        return reply.code(404).send({ error: "competition_not_found" });
      }

      const events = [...db.events.values()].filter(
        (e) => e.competitionId === competition.id,
      );
      const rounds = roundsForCompetition(db, competition.id);
      const regCount = registrationsForCompetition(db, competition.id).length;

      return {
        id: competition.id,
        title: competition.title,
        type: competition.type,
        status: competition.status,
        description: competition.description,
        rulesMd: competition.rulesMd,
        baseFee: competition.baseFee,
        perEventFee: competition.perEventFee,
        registrationDeadline: competition.registrationDeadline,
        coverUrl: competition.coverUrl,
        bannerUrl: competition.bannerUrl,
        createdBy: competition.createdBy,
        createdAt: competition.createdAt,
        registrationCount: regCount,
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          roundCount: e.roundCount,
          cutoffMs: e.cutoffMs,
          timeLimitMs: e.timeLimitMs,
          rounds: rounds
            .filter((r) => r.competitionEventId === e.id)
            .sort((a, b) => a.roundNumber - b.roundNumber)
            .map((r) => ({
              id: r.id,
              roundNumber: r.roundNumber,
              status: r.status,
              eventType: eventForRound(db, r)?.eventType ?? e.eventType,
              scrambleLocked: Boolean(scrambleSetForRound(db, r.id)?.lockedAt),
            })),
        })),
      };
    },
  );
}
