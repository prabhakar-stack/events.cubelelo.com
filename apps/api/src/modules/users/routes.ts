import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/store";
import { userByClId, registrationsForUser, eventsForRegistration } from "../../db/store";
import { requireAuth } from "../../auth/plugin";
import type { Solve } from "@cubers/types";

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
  app.get<{ Params: { clid: string } }>(
    "/api/v1/users/:clid",
    async (req, reply) => {
      const user = userByClId(db, req.params.clid);
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      const userResults = [...db.results.values()].filter(
        (r) => r.userId === user.clId,
      );

      // ── Personal bests ──
      const pbs: Record<string, { bestSingle: number | null; bestAo5: number | null }> = {};
      for (const result of userResults) {
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

      // ── Stats ──
      const eventAo5s: Record<string, number[]> = {};
      let totalSolves = 0;
      for (const result of userResults) {
        const round = db.rounds.get(result.roundId);
        const event = round ? db.events.get(round.competitionEventId) : undefined;
        const eventType = event?.eventType ?? "unknown";
        totalSolves += result.solves.length;
        if (result.ao5Ms !== null) {
          if (!eventAo5s[eventType]) eventAo5s[eventType] = [];
          eventAo5s[eventType].push(result.ao5Ms);
        }
      }

      const eventStats: Record<string, { mean: number | null; stdDev: number | null; solveCount: number }> = {};
      for (const [et, ao5s] of Object.entries(eventAo5s)) {
        const n = ao5s.length;
        const mean = ao5s.reduce((a, b) => a + b, 0) / n;
        const variance = ao5s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
        const stdDev = Math.sqrt(variance);
        eventStats[et] = {
          mean: Math.round(mean),
          stdDev: Math.round(stdDev),
          solveCount: userResults
            .filter((r) => {
              const rd = db.rounds.get(r.roundId);
              const ev = rd ? db.events.get(rd.competitionEventId) : undefined;
              return ev?.eventType === et;
            })
            .reduce((s, r) => s + r.solves.length, 0),
        };
      }

      // ── Solve timeline (chronological data points per event) ──
      const timelineByEvent: Record<string, Array<{ timeMs: number; ao5Ms: number | null; date: string; compTitle: string }>> = {};
      for (const result of userResults) {
        const round = db.rounds.get(result.roundId);
        const event = round ? db.events.get(round.competitionEventId) : undefined;
        const eventType = event?.eventType ?? "unknown";
        if (!timelineByEvent[eventType]) timelineByEvent[eventType] = [];
        for (const solve of result.solves) {
          const timeMs = solve.penalty === "dnf" ? null : solve.penalty === "plus2" ? solve.time_ms + 2000 : solve.time_ms;
          if (timeMs !== null) {
            const comp = event ? db.competitions.get(event.competitionId) : undefined;
            timelineByEvent[eventType].push({
              timeMs,
              ao5Ms: result.ao5Ms,
              date: result.submittedAt,
              compTitle: comp?.title ?? "Unknown",
            });
          }
        }
      }

      const competitionIds = new Set<string>();
      const regs = registrationsForUser(db, user.id);
      for (const r of regs) competitionIds.add(r.competitionId);
      for (const result of userResults) {
        const round = db.rounds.get(result.roundId);
        const event = round ? db.events.get(round.competitionEventId) : undefined;
        if (event) competitionIds.add(event.competitionId);
      }

      // ── Detailed competition history ──
      const history = [...competitionIds].map((compId) => {
        const comp = db.competitions.get(compId);
        const compEvents = [...db.events.values()].filter(
          (e) => e.competitionId === compId,
        );

        const events = compEvents
          .map((ce) => {
            const rounds = [...db.rounds.values()]
              .filter((r) => r.competitionEventId === ce.id)
              .sort((a, b) => a.roundNumber - b.roundNumber);

            const roundResults = rounds
              .map((rd) => {
                const result = userResults.find((r) => r.roundId === rd.id);
                if (!result) return null;
                return {
                  roundNumber: rd.roundNumber,
                  rank: result.rank,
                  bestSingleMs: result.bestSingleMs,
                  ao5Ms: result.ao5Ms,
                  solves: result.solves as Solve[],
                };
              })
              .filter(Boolean);

            if (roundResults.length === 0) return null;
            return {
              eventType: ce.eventType,
              rounds: roundResults,
            };
          })
          .filter(Boolean);

        return {
          competitionId: compId,
          competitionTitle: comp?.title ?? "Unknown",
          status: comp?.status ?? "unknown",
          events,
        };
      });

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
        personalBests: pbs,
        stats: {
          totalCompetitions: competitionIds.size,
          totalSolves,
          eventStats,
          solveTimeline: timelineByEvent,
        },
        competitionHistory: history,
      };
    },
  );

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
