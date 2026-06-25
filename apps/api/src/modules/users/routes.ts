import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/store";
import { userByClId, registrationsForUser, eventsForRegistration } from "../../db/store";
import { requireAuth } from "../../auth/plugin";

const EDITABLE_FIELDS = [
  "name",
  "lastName",
  "gender",
  "dob",
  "mobileNo",
  "city",
  "state",
  "country",
  "instagram",
] as const;

export async function registerUserRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  // Public profile by CL ID.
  app.get<{ Params: { clid: string } }>(
    "/api/v1/users/:clid",
    async (req, reply) => {
      const user = userByClId(db, req.params.clid);
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      const regs = registrationsForUser(db, user.id);
      const history = regs.map((r) => {
        const comp = db.competitions.get(r.competitionId);
        const events = eventsForRegistration(db, r.id);
        return {
          competitionId: r.competitionId,
          competitionTitle: comp?.title ?? "Unknown",
          status: comp?.status ?? "unknown",
          events: events.map((e) => e.eventType),
        };
      });

      // Gather results for this user
      const results = [...db.results.values()].filter(
        (r) => r.userId === user.clId,
      );
      const pbs: Record<string, { bestSingle: number | null; bestAo5: number | null }> = {};
      for (const result of results) {
        const round = db.rounds.get(result.roundId);
        const event = round ? db.events.get(round.competitionEventId) : undefined;
        const eventType = event?.eventType ?? "unknown";
        if (!pbs[eventType]) pbs[eventType] = { bestSingle: null, bestAo5: null };
        const pb = pbs[eventType];
        if (result.bestSingleMs !== null) {
          if (pb.bestSingle === null || result.bestSingleMs < pb.bestSingle) {
            pb.bestSingle = result.bestSingleMs;
          }
        }
        if (result.ao5Ms !== null) {
          if (pb.bestAo5 === null || result.ao5Ms < pb.bestAo5) {
            pb.bestAo5 = result.ao5Ms;
          }
        }
      }

      return {
        clId: user.clId,
        name: user.name,
        city: user.city,
        state: user.state,
        country: user.country ?? "India",
        avatarUrl: user.avatarUrl,
        instagram: user.instagram,
        wcaId: user.wcaId,
        wcaVerified: user.wcaVerified,
        createdAt: user.createdAt,
        competitionHistory: history,
        personalBests: pbs,
      };
    },
  );

  // Edit own profile.
  app.patch<{ Body: Record<string, unknown> }>(
    "/api/v1/users/me",
    { preHandler: requireAuth },
    async (req, reply) => {
      const user = db.users.get(req.authClaims!.sub);
      if (!user) return reply.code(404).send({ error: "not_synced" });

      const body = req.body ?? {};
      for (const field of EDITABLE_FIELDS) {
        if (field in body && typeof body[field] === "string") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any)[field] = body[field];
        }
      }

      return user;
    },
  );
}
