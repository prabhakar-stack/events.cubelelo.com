import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import { requireAuth } from "../../auth/plugin";
import type { Solve } from "@cubers/types";
import { env } from "../../config/env";
import { getStorage } from "../../lib/storage";

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
  "profilePrivacy",
] as const;

export async function registerUserRoutes(
  app: FastifyInstance,
  repo: Repository,
): Promise<void> {
  app.get<{ Querystring: { q?: string } }>(
    "/api/v1/users/search",
    async (req, reply) => {
      const q = req.query.q?.trim();
      if (!q || q.length < 2)
        return reply.code(400).send({ error: "query_too_short" });
      const all = await repo.users.findAll(q);
      return all
        .filter((u) => u.profilePrivacy !== "private")
        .slice(0, 20)
        .map((u) => ({
          clId: u.clId,
          name: u.name,
          avatarUrl: u.avatarUrl,
          city: u.city,
          country: u.country,
        }));
    },
  );

  app.get<{ Params: { clid: string } }>(
    "/api/v1/users/:clid",
    async (req, reply) => {
      const user = await repo.users.findByClId(req.params.clid);
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      const isOwner = req.authClaims?.sub === user.id;
      if (user.profilePrivacy === "private" && !isOwner) {
        return {
          clId: user.clId,
          name: user.name,
          country: user.country ?? "India",
          avatarUrl: user.avatarUrl,
          profilePrivacy: "private",
          personalBests: {},
          stats: null,
          competitionHistory: [],
        };
      }

      const userResults = await repo.results.findByUser(user.id);

      // Precompute roundId → event mapping (1 query instead of N)
      const roundIds = [...new Set(userResults.map((r) => r.roundId))];
      const eventByRound = new Map<string, { eventType: string; competitionId: string }>();
      for (const rid of roundIds) {
        if (eventByRound.has(rid)) continue;
        const ev = await repo.competitionEvents.findByRound(rid);
        if (ev) eventByRound.set(rid, { eventType: ev.eventType, competitionId: ev.competitionId });
      }

      const getEventType = (roundId: string) => eventByRound.get(roundId)?.eventType ?? "unknown";

      // ── Personal bests ──
      const pbs: Record<string, { bestSingle: number | null; bestAo5: number | null }> = {};
      for (const result of userResults) {
        const eventType = getEventType(result.roundId);
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
      const eventSolveCounts: Record<string, number> = {};
      let totalSolves = 0;
      for (const result of userResults) {
        const eventType = getEventType(result.roundId);
        totalSolves += result.solves.length;
        eventSolveCounts[eventType] = (eventSolveCounts[eventType] ?? 0) + result.solves.length;
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
        eventStats[et] = {
          mean: Math.round(mean),
          stdDev: Math.round(Math.sqrt(variance)),
          solveCount: eventSolveCounts[et] ?? 0,
        };
      }

      // Precompute competitionId → title map
      const compIds = new Set<string>();
      for (const e of eventByRound.values()) compIds.add(e.competitionId);
      const regs = await repo.registrations.findByUser(user.id);
      for (const r of regs) compIds.add(r.competitionId);
      const compTitles = new Map<string, string>();
      for (const cid of compIds) {
        const comp = await repo.competitions.findById(cid);
        if (comp) compTitles.set(cid, comp.title);
      }

      // ── Solve timeline ──
      const timelineByEvent: Record<
        string,
        Array<{ timeMs: number; ao5Ms: number | null; date: string; compTitle: string }>
      > = {};
      for (const result of userResults) {
        const eventType = getEventType(result.roundId);
        if (!timelineByEvent[eventType]) timelineByEvent[eventType] = [];
        const compId = eventByRound.get(result.roundId)?.competitionId;
        const compTitle = compId ? (compTitles.get(compId) ?? "Unknown") : "Unknown";
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
              compTitle,
            });
          }
        }
      }

      // ── Competition IDs from registrations + results ──
      const competitionIds = new Set(compIds);

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
        profilePrivacy: user.profilePrivacy ?? "public",
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
        wcaVerified: false,
      });
      if (!updated) return reply.code(404).send({ error: "not_synced" });

      return { wcaId: updated.wcaId, wcaVerified: updated.wcaVerified, pendingReview: true };
    },
  );

  // Avatar upload — uses R2 when configured, local uploads/ dir otherwise
  app.post(
    "/api/v1/users/me/avatar",
    { preHandler: requireAuth },
    async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: "no_file" });

      const ext = data.filename.split(".").pop()?.toLowerCase() ?? "png";
      if (!["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
        return reply.code(400).send({ error: "invalid_file_type" });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk as Buffer);
      const buffer = Buffer.concat(chunks);

      if (buffer.length > 2 * 1024 * 1024)
        return reply.code(400).send({ error: "file_too_large_max_2mb" });

      const filename = `avatars/${req.authClaims!.sub}_${randomUUID().slice(0, 8)}.${ext}`;
      const storage = getStorage();
      const avatarUrl = await storage.upload(filename, buffer, `image/${ext === "jpg" ? "jpeg" : ext}`);

      const updated = await repo.users.update(req.authClaims!.sub, { avatarUrl });
      if (!updated) return reply.code(404).send({ error: "not_synced" });

      return { avatarUrl };
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
          if (field === "profilePrivacy" && !["public", "private"].includes(body[field] as string)) {
            return reply.code(400).send({ error: "invalid_profile_privacy" });
          }
          fields[field] = body[field] as string;
        }
      }
      const updated = await repo.users.update(req.authClaims!.sub, fields);
      if (!updated) return reply.code(404).send({ error: "not_synced" });
      return updated;
    },
  );

  // Global search across competitions, users, announcements, content pages
  app.get<{ Querystring: { q?: string } }>(
    "/api/v1/search",
    async (req, reply) => {
      const q = req.query.q?.trim()?.toLowerCase();
      if (!q || q.length < 2)
        return reply.code(400).send({ error: "query_too_short" });

      let userRole: string | undefined;
      try {
        if (req.authClaims?.sub) {
          const u = await repo.users.findById(req.authClaims.sub);
          userRole = u?.role;
        }
      } catch {}

      const [users, competitions, announcements, pages] = await Promise.all([
        repo.users.findAll(q),
        repo.competitions.findAll(q),
        repo.announcements.findAll(true),
        repo.contentPages.findAll(true),
      ]);

      const matchedUsers = users.filter((u) => u.profilePrivacy !== "private").slice(0, 10).map((u) => ({
        type: "user" as const,
        id: u.clId,
        title: u.name,
        subtitle: u.clId,
        href: `/profile/${u.clId}`,
      }));

      const matchedComps = competitions.slice(0, 10).map((c) => ({
        type: "competition" as const,
        id: c.id,
        title: c.title,
        subtitle: c.type,
        href: `/competitions/${c.id}`,
      }));

      const matchedAnnouncements = announcements
        .filter((a) => a.title.toLowerCase().includes(q) || a.bodyMd.toLowerCase().includes(q))
        .slice(0, 5)
        .map((a) => ({
          type: "announcement" as const,
          id: a.id,
          title: a.title,
          subtitle: "Announcement",
          href: a.redirectUrl || null,
        }));

      const matchedPages = pages
        .filter((p) => p.title.toLowerCase().includes(q) || p.bodyMd.toLowerCase().includes(q))
        .slice(0, 5)
        .map((p) => ({
          type: "page" as const,
          id: p.slug,
          title: p.title,
          subtitle: "Page",
          href: `/pages/${p.slug}`,
        }));

      type SearchItem = { type: string; id: string; title: string; subtitle: string; href: string | null };
      const results: SearchItem[] = [...matchedComps, ...matchedUsers, ...matchedAnnouncements, ...matchedPages];

      // Admin pages only for admin/moderator
      if (userRole === "admin" || userRole === "super_admin" || userRole === "moderator") {
        const adminPages = [
          { slug: "competitions", title: "Admin: Competitions" },
          { slug: "users", title: "Admin: Users" },
          { slug: "payments", title: "Admin: Payments" },
          { slug: "announcements", title: "Admin: Announcements" },
          { slug: "content", title: "Admin: Content" },
          { slug: "faq", title: "Admin: Details" },
          { slug: "pages", title: "Admin: Pages" },
          { slug: "staff", title: "Admin: Staff" },
          { slug: "appeals", title: "Admin: Appeals" },
        ];
        const matchedAdmin = adminPages
          .filter((p) => p.title.toLowerCase().includes(q) || p.slug.includes(q))
          .map((p) => ({
            type: "admin" as const,
            id: p.slug,
            title: p.title,
            subtitle: "Admin",
            href: `/admin/${p.slug === "competitions" ? "" : p.slug}`,
          }));
        results.push(...matchedAdmin);
      }

      return results.slice(0, 25);
    },
  );

  // Delete own account (soft-delete: anonymize PII, set stage to deleted)
  app.delete(
    "/api/v1/me",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const userId = req.authClaims!.sub;
      const user = await repo.users.findById(userId);
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      await repo.users.update(userId, {
        email: `deleted-${userId}@deleted.local`,
        name: "Deleted User",
        lastName: undefined,
        mobileNo: undefined,
        avatarUrl: undefined,
        instagram: undefined,
        passwordHash: undefined,
        accountStage: "deleted",
      });
      return reply.code(204).send();
    },
  );
}
