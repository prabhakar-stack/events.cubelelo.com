import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/store";
import { roundsForCompetition, eventForRound } from "../../db/store";

export async function registerCompetitionRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  // List all competitions (summary).
  app.get("/api/v1/competitions", async () => {
    return [...db.competitions.values()].map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      status: c.status,
    }));
  });

  // Competition detail with its events and rounds.
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

      return {
        id: competition.id,
        title: competition.title,
        type: competition.type,
        status: competition.status,
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          roundCount: e.roundCount,
          rounds: rounds
            .filter((r) => r.competitionEventId === e.id)
            .sort((a, b) => a.roundNumber - b.roundNumber)
            .map((r) => ({
              id: r.id,
              roundNumber: r.roundNumber,
              status: r.status,
              eventType: eventForRound(db, r)?.eventType ?? e.eventType,
            })),
        })),
      };
    },
  );
}
