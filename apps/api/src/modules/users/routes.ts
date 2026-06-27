import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import { requireAuth } from "../../auth/plugin";
import type { Solve } from "@cubers/types";
import { env } from "../../config/env";

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
  repo: Repository,
): Promise<void> {
  app.get<{ Params: { clid: string } }>(
    "/api/v1/users/:clid",
    async (req, reply) => {
      const user = await repo.users.findByClId(req.params.clid);
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      const userResults = await repo.results.findByUser(user.id);

      // ── Personal bests ──
      const pbs: Record<string, { bestSingle: number | null; bestAo5: number | null }> = {};
      for (const result of userResults) {
        const event = await repo.competitionEvents.findByRound(result.roundId);
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
        const event = await repo.competitionEvents.findByRound(result.roundId);
        const eventType = event?.eventType ?? "unknown";
        totalSolves += result.solves.length;
        if (result.ao5Ms !== null) {
          if (!eventAo5s[eventType]) eventAo5s[eventType] = [];
          eventAo5s[eventType].push(result.ao5Ms);
        }
      }

      const eventStats: Record<
        string,
        { mean: number | null; stdDev: number | null; solveCount: number }
      > = {};
      for (const [et, ao5s] of Object.entries(eventAo5s)) {
        const n = ao5s.length;
        const mean = ao5s.reduce((a, b) => a + b, 0) / n;
        const variance = ao5s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
        const solveCount = userResults
          .filter(async (r) => {
            const ev = await repo.competitionEvents.findByRound(r.roundId);
            return ev?.eventType === et;
          })
          .reduce((s, r) => s + r.solves.length, 0);
        eventStats[et] = {
          mean: Math.round(mean),
          stdDev: Math.round(Math.sqrt(variance)),
          solveCount,
        };
      }

      // ── Solve timeline ──
      const timelineByEvent: Record<
        string,
        Array<{ timeMs: number; ao5Ms: number | null; date: string; compTitle: string }>
      > = {};
      for (const result of userResults) {
        const event = await repo.competitionEvents.findByRound(result.roundId);
        const eventType = event?.eventType ?? "unknown";
        if (!timelineByEvent[eventType]) timelineByEvent[eventType] = [];
        const comp = event
          ? await repo.competitions.findById(event.competitionId)
          : undefined;
        for (const solve of result.solves) {
          const timeMs =
            solve.penalty === "dnf"
              ? null
              : solve.penalty === "plus2"
                ? solve.time_ms + 2000
                : solve.time_ms;
          if (timeMs !== null) {
            timelineByEvent[eventType].push({
              timeMs,
              ao5Ms: result.ao5Ms,
              date: result.submittedAt,
              compTitle: comp?.title ?? "Unknown",
            });
          }
        }
      }

      // ── Competition IDs from registrations + results ──
      const competitionIds = new Set<string>();
      const regs = await repo.registrations.findByUser(user.id);
      for (const r of regs) competitionIds.add(r.competitionId);
      for (const result of userResults) {
        const event = await repo.competitionEvents.findByRound(result.roundId);
        if (event) competitionIds.add(event.competitionId);
      }

      // ── Detailed competition history ──
      const history = await Promise.all(
        [...competitionIds].map(async (compId) => {
          const comp = await repo.competitions.findById(compId);
          const compEvents = await repo.competitionEvents.findByCompetition(compId);

          const events = (
            await Promise.all(
              compEvents.map(async (ce) => {
                const rounds = (await repo.rounds.findByCompetition(compId))
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
                return { eventType: ce.eventType, rounds: roundResults };
              }),
            )
          ).filter(Boolean);

          return {
            competitionId: compId,
            competitionTitle: comp?.title ?? "Unknown",
            status: comp?.status ?? "unknown",
            events,
          };
        }),
      );

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

  // WCA ID verification
  app.post<{ Body: { wcaId?: string } }>(
    "/api/v1/users/me/wca",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { wcaId } = req.body ?? {};
      if (!wcaId || typeof wcaId !== "string")
        return reply.code(400).send({ error: "missing_wca_id" });

      const formatted = wcaId.trim().toUpperCase();

      // Call WCA API to verify the ID exists
      try {
        const res = await fetch(`${env.WCA_API_BASE}/persons/${formatted}`);
        if (res.status === 404)
          return reply.code(404).send({ error: "wca_id_not_found" });
        if (!res.ok)
          return reply.code(502).send({ error: "wca_api_unavailable" });
      } catch {
        return reply.code(502).send({ error: "wca_api_unavailable" });
      }

      const updated = await repo.users.update(req.authClaims!.sub, {
        wcaId: formatted,
        wcaVerified: true,
      });
      if (!updated) return reply.code(404).send({ error: "not_synced" });

      return { wcaId: updated.wcaId, wcaVerified: updated.wcaVerified };
    },
  );

  app.patch<{ Body: Record<string, unknown> }>(
    "/api/v1/users/me",
    { preHandler: requireAuth },
    async (req, reply) => {
      const body = req.body ?? {};
      const fields: Record<string, string> = {};
      for (const field of EDITABLE_FIELDS) {
        if (field in body && typeof body[field] === "string") {
          fields[field] = body[field] as string;
        }
      }
      const updated = await repo.users.update(req.authClaims!.sub, fields);
      if (!updated) return reply.code(404).send({ error: "not_synced" });
      return updated;
    },
  );
}
