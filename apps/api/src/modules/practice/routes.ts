import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { Repository } from "../../db/repo";
import { generateScramble } from "@cubers/scramble-core";

export async function registerPracticeRoutes(app: FastifyInstance, repo: Repository) {
  const prefix = "/api/v1";

  // ── Practice Sessions ─────────────────────────────────────────────────

  app.get(`${prefix}/practice/sessions`, async (req) => {
    const user = (req as any).user;
    if (!user) return { sessions: [] };
    const sessions = await repo.practice.findSessionsByUser(user.id);
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const solves = await repo.practice.findSolvesBySession(s.id);
        return { ...s, solveCount: solves.length };
      }),
    );
    return { sessions: enriched };
  });

  app.post(`${prefix}/practice/sessions`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { eventType, name } = req.body as { eventType: string; name?: string };
    if (!eventType) return reply.code(400).send({ error: "eventType required" });
    const session = {
      id: randomUUID(),
      userId: user.id,
      eventType,
      name: name || `Session ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
    };
    await repo.practice.createSession(session);
    return { session };
  });

  app.get(`${prefix}/practice/sessions/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await repo.practice.findSession(id);
    if (!session) return reply.code(404).send({ error: "not_found" });
    const solves = await repo.practice.findSolvesBySession(id);
    return { session, solves };
  });

  app.patch(`${prefix}/practice/sessions/:id`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const session = await repo.practice.findSession(id);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "not_found" });
    const { name } = req.body as { name?: string };
    const updated = await repo.practice.updateSession(id, { name });
    return { session: updated };
  });

  app.delete(`${prefix}/practice/sessions/:id`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const session = await repo.practice.findSession(id);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "not_found" });
    await repo.practice.deleteSession(id);
    return { ok: true };
  });

  app.post(`${prefix}/practice/sessions/:id/end`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const session = await repo.practice.findSession(id);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "not_found" });
    await repo.practice.endSession(id);
    return { ok: true };
  });

  // ── Solves ─────────────────────────────────────────────────────────────

  app.post(`${prefix}/practice/sessions/:id/solves`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const session = await repo.practice.findSession(id);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "not_found" });
    const { timeMs, scramble, penalty, note } = req.body as {
      timeMs: number; scramble: string; penalty?: string; note?: string;
    };
    if (!timeMs || !scramble) return reply.code(400).send({ error: "timeMs and scramble required" });
    const solve = {
      id: randomUUID(),
      sessionId: id,
      timeMs,
      scramble,
      penalty: (penalty ?? "none") as "none" | "plus2" | "dnf",
      note,
      createdAt: new Date().toISOString(),
    };
    await repo.practice.addSolve(solve);
    return { solve };
  });

  app.delete(`${prefix}/practice/solves/:id`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    await repo.practice.deleteSolve(id);
    return { ok: true };
  });

  // ── Practice Stats ─────────────────────────────────────────────────────

  app.get(`${prefix}/practice/stats`, async (req) => {
    const user = (req as any).user;
    if (!user) return { stats: null };
    const sessions = await repo.practice.findSessionsByUser(user.id);
    let totalSolves = 0;
    let totalTimeMs = 0;
    const eventBests: Record<string, number> = {};
    for (const s of sessions) {
      const solves = await repo.practice.findSolvesBySession(s.id);
      for (const solve of solves) {
        if (solve.penalty === "dnf") continue;
        totalSolves++;
        const effective = solve.penalty === "plus2" ? solve.timeMs + 2000 : solve.timeMs;
        totalTimeMs += effective;
        if (!eventBests[s.eventType] || effective < eventBests[s.eventType]!) {
          eventBests[s.eventType] = effective;
        }
      }
    }
    return {
      stats: {
        totalSessions: sessions.length,
        totalSolves,
        totalTimeMs,
        eventBests,
      },
    };
  });

  // ── Daily Challenge ────────────────────────────────────────────────────

  app.get(`${prefix}/daily-challenge`, async (req) => {
    const today = new Date().toISOString().slice(0, 10);
    let challenge = await repo.dailyChallenge.findByDate(today);
    if (!challenge) {
      const scramble = await generateScramble("333");
      challenge = {
        id: randomUUID(),
        date: today,
        eventType: "333",
        scramble,
        createdAt: new Date().toISOString(),
      };
      await repo.dailyChallenge.create(challenge);
    }
    const user = (req as any).user;
    let userResult = null;
    let streak = 0;
    if (user) {
      userResult = await repo.dailyChallenge.findResultByUserAndChallenge(user.id, challenge.id);
      streak = await repo.dailyChallenge.findUserStreak(user.id);
    }
    const results = await repo.dailyChallenge.findResultsByChallenge(challenge.id);
    return {
      challenge: userResult ? challenge : { ...challenge, scramble: challenge.scramble },
      userResult,
      streak,
      leaderboard: results.slice(0, 50),
    };
  });

  app.post(`${prefix}/daily-challenge/submit`, async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    const { timeMs } = req.body as { timeMs: number };
    if (!timeMs || timeMs <= 0) return reply.code(400).send({ error: "valid timeMs required" });

    const today = new Date().toISOString().slice(0, 10);
    const challenge = await repo.dailyChallenge.findByDate(today);
    if (!challenge) return reply.code(404).send({ error: "no challenge today" });

    const existing = await repo.dailyChallenge.findResultByUserAndChallenge(user.id, challenge.id);
    if (existing) return reply.code(409).send({ error: "already_submitted" });

    const result = {
      id: randomUUID(),
      challengeId: challenge.id,
      userId: user.id,
      timeMs,
      submittedAt: new Date().toISOString(),
    };
    await repo.dailyChallenge.submitResult(result);
    const streak = await repo.dailyChallenge.findUserStreak(user.id);
    return { result, streak };
  });
}
