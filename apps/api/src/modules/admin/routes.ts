import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isEventId } from "@cubers/scramble-core";
import type { CompStatus, CompType, FlagStatus } from "@cubers/types";
import type { Repository } from "../../db/repo";
import type { Competition, CompetitionEvent, Round, AuditLogEntry, Announcement } from "../../db/types";
import { requireRole } from "../../auth/plugin";
import { effectiveCompStatus, effectiveRoundStatus } from "../../lib/statusUtils";

const COMP_TYPES: CompType[] = ["paid", "free", "practice"];
const COMP_STATUSES: CompStatus[] = [
  "draft", "published", "registration_open", "registration_closed",
  "cancelled", "live", "results_pending", "completed",
];
const FLAG_ACTIONS: FlagStatus[] = ["verified", "plus2", "dnf", "disqualified"];

export async function registerAdminRoutes(
  app: FastifyInstance,
  repo: Repository,
): Promise<void> {
  const adminOnly = { preHandler: requireRole(repo, "admin") };
  const adminOrMod = { preHandler: requireRole(repo, "admin", "moderator") };

  // ── Competitions ──────────────────────────────────────────────────────────

  app.post<{
    Body: {
      title?: string;
      type?: CompType;
      description?: string;
      rulesMd?: string;
      baseFee?: number;
      perEventFee?: number;
      registrationOpensAt?: string;
      registrationDeadline?: string;
      startsAt?: string;
      endsAt?: string;
      saveAsDraft?: boolean;
      eventType?: string;
      roundCount?: number;
      events?: Array<{
        eventType: string;
        roundCount?: number;
        cutoffMs?: number;
        timeLimitMs?: number;
        advancementCount?: number;
      }>;
    };
  }>("/api/v1/admin/competitions", adminOnly, async (req, reply) => {
    const { title, type, description, rulesMd, baseFee, perEventFee,
            registrationOpensAt, registrationDeadline, startsAt, endsAt, saveAsDraft } =
      req.body ?? {};
    if (!title || typeof title !== "string")
      return reply.code(400).send({ error: "missing_title" });

    const user = await repo.users.findById(req.authClaims!.sub);
    const now = new Date().toISOString();
    const compId = randomUUID();

    const competition: Competition = {
      id: compId,
      title,
      type: type && COMP_TYPES.includes(type) ? type : "free",
      status: "draft",
      description: typeof description === "string" ? description : undefined,
      rulesMd: typeof rulesMd === "string" ? rulesMd : undefined,
      baseFee: typeof baseFee === "number" ? baseFee : 0,
      perEventFee: typeof perEventFee === "number" ? perEventFee : 0,
      registrationOpensAt: typeof registrationOpensAt === "string" ? registrationOpensAt : undefined,
      registrationDeadline: typeof registrationDeadline === "string" ? registrationDeadline : undefined,
      startsAt: typeof startsAt === "string" ? startsAt : undefined,
      endsAt: typeof endsAt === "string" ? endsAt : undefined,
      featured: false,
      createdBy: user?.id,
      createdAt: now,
    };

    const eventSpecs = req.body?.events?.length
      ? req.body.events
      : req.body?.eventType
        ? [{ eventType: req.body.eventType, roundCount: req.body.roundCount }]
        : [];

    const validSpecs = eventSpecs.filter((s) => s.eventType && isEventId(s.eventType));
    if (eventSpecs.length > 0 && validSpecs.length === 0)
      return reply.code(400).send({ error: "invalid_event_type" });

    await repo.competitions.create(competition);

    for (const spec of validSpecs) {
      const rounds = Math.max(1, Math.min(spec.roundCount ?? 1, 10));
      const event: CompetitionEvent = {
        id: randomUUID(),
        competitionId: compId,
        eventType: spec.eventType,
        roundCount: rounds,
        cutoffMs: spec.cutoffMs,
        timeLimitMs: spec.timeLimitMs,
      };
      await repo.competitionEvents.create(event);

      for (let i = 1; i <= rounds; i++) {
        const round: Round = {
          id: randomUUID(),
          competitionEventId: event.id,
          roundNumber: i,
          status: "pending",
          // Only the first round is open to all; later rounds require advancement
          advancementCount: i < rounds ? (spec.advancementCount ?? undefined) : undefined,
        };
        await repo.rounds.create(round);
      }
    }

    // saveAsDraft = true keeps it as draft (default). If false, publish immediately.
    if (saveAsDraft === false) {
      await repo.competitions.update(compId, { status: "published" });
    }

    return reply.code(201).send({ id: compId, status: saveAsDraft === false ? "published" : "draft" });
  });

  // Edit competition fields (includes featured toggle and status)
  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      status?: CompStatus;
      description?: string;
      rulesMd?: string;
      baseFee?: number;
      perEventFee?: number;
      registrationOpensAt?: string;
      registrationDeadline?: string;
      startsAt?: string;
      endsAt?: string;
      featured?: boolean;
      featuredOrder?: number;
      coverCaption?: string;
      coverUrl?: string;
      bannerUrl?: string;
    };
  }>("/api/v1/admin/competitions/:id", adminOnly, async (req, reply) => {
    const {
      title, status, description, rulesMd, baseFee, perEventFee,
      registrationOpensAt, registrationDeadline, startsAt, endsAt,
      featured, featuredOrder, coverCaption, coverUrl, bannerUrl,
    } = req.body ?? {};

    const fields: Partial<Competition> = {};
    if (typeof title === "string") fields.title = title;
    if (typeof description === "string") fields.description = description;
    if (typeof rulesMd === "string") fields.rulesMd = rulesMd;
    if (typeof baseFee === "number") fields.baseFee = baseFee;
    if (typeof perEventFee === "number") fields.perEventFee = perEventFee;
    if (typeof registrationOpensAt === "string") fields.registrationOpensAt = registrationOpensAt;
    if (typeof registrationDeadline === "string") fields.registrationDeadline = registrationDeadline;
    if (typeof startsAt === "string") fields.startsAt = startsAt;
    if (typeof endsAt === "string") fields.endsAt = endsAt;
    if (status && COMP_STATUSES.includes(status)) fields.status = status;
    if (typeof featured === "boolean") fields.featured = featured;
    if (typeof featuredOrder === "number") fields.featuredOrder = featuredOrder;
    if (typeof coverCaption === "string") fields.coverCaption = coverCaption;
    if (typeof coverUrl === "string") fields.coverUrl = coverUrl;
    if (typeof bannerUrl === "string") fields.bannerUrl = bannerUrl;

    const updated = await repo.competitions.update(req.params.id, fields);
    if (!updated) return reply.code(404).send({ error: "competition_not_found" });
    return {
      id: updated.id, title: updated.title,
      status: effectiveCompStatus(updated),
      registrationOpensAt: updated.registrationOpensAt ?? null,
      registrationDeadline: updated.registrationDeadline ?? null,
      startsAt: updated.startsAt ?? null,
      endsAt: updated.endsAt ?? null,
      featured: updated.featured,
    };
  });

  // Duplicate a competition
  app.post<{
    Params: { id: string };
    Body: { reuseScrambles?: boolean; type?: CompType };
  }>("/api/v1/admin/competitions/:id/duplicate", adminOnly, async (req, reply) => {
    const source = await repo.competitions.findById(req.params.id);
    if (!source) return reply.code(404).send({ error: "competition_not_found" });

    const user = await repo.users.findById(req.authClaims!.sub);
    const now = new Date().toISOString();
    const overrideType =
      req.body?.type && COMP_TYPES.includes(req.body.type) ? req.body.type : source.type;
    const newCompId = randomUUID();

    const comp: Competition = {
      id: newCompId,
      title: `${source.title} (copy)`,
      type: overrideType,
      status: "draft",
      description: source.description,
      rulesMd: source.rulesMd,
      baseFee: overrideType === "free" ? 0 : source.baseFee,
      perEventFee: overrideType === "free" ? 0 : source.perEventFee,
      registrationDeadline: undefined,
      featured: false,
      createdBy: user?.id,
      createdAt: now,
    };
    await repo.competitions.create(comp);

    const sourceEvents = await repo.competitionEvents.findByCompetition(source.id);

    for (const srcEvent of sourceEvents) {
      const event: CompetitionEvent = {
        id: randomUUID(),
        competitionId: newCompId,
        eventType: srcEvent.eventType,
        roundCount: srcEvent.roundCount,
        cutoffMs: srcEvent.cutoffMs,
        timeLimitMs: srcEvent.timeLimitMs,
      };
      await repo.competitionEvents.create(event);

      const srcRounds = (await repo.rounds.findByCompetition(source.id))
        .filter((r) => r.competitionEventId === srcEvent.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);

      for (const srcRound of srcRounds) {
        const round: Round = {
          id: randomUUID(),
          competitionEventId: event.id,
          roundNumber: srcRound.roundNumber,
          status: "pending",
          advancementCount: srcRound.advancementCount,
        };
        await repo.rounds.create(round);

        if (req.body?.reuseScrambles) {
          const srcSet = await repo.scrambleSets.findByRound(srcRound.id);
          if (srcSet) {
            await repo.scrambleSets.upsert({
              id: randomUUID(),
              roundId: round.id,
              scrambles: [...srcSet.scrambles],
              generatedAt: now,
              lockedAt: now,
              lockedBy: undefined,
            });
          }
        }
      }
    }

    return reply.code(201).send({ id: newCompId, title: comp.title });
  });

  // ── Announcements ─────────────────────────────────────────────────────────

  app.get("/api/v1/admin/announcements", adminOrMod, async () => {
    return repo.announcements.findAll(false);
  });

  app.post<{ Body: { title?: string; bodyMd?: string; pinned?: boolean; published?: boolean } }>(
    "/api/v1/admin/announcements",
    adminOnly,
    async (req, reply) => {
      const { title, bodyMd, pinned, published } = req.body ?? {};
      if (!title || !bodyMd) return reply.code(400).send({ error: "missing_fields" });

      const user = await repo.users.findById(req.authClaims!.sub);
      const now = new Date().toISOString();
      const announcement: Announcement = {
        id: randomUUID(),
        title,
        bodyMd,
        pinned: pinned ?? false,
        published: published ?? false,
        createdBy: user?.id,
        createdAt: now,
        updatedAt: now,
      };
      await repo.announcements.create(announcement);
      return reply.code(201).send(announcement);
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { title?: string; bodyMd?: string; pinned?: boolean; published?: boolean };
  }>("/api/v1/admin/announcements/:id", adminOnly, async (req, reply) => {
    const updated = await repo.announcements.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: "announcement_not_found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/announcements/:id",
    adminOnly,
    async (req, reply) => {
      await repo.announcements.delete(req.params.id);
      return reply.code(204).send();
    },
  );

  // ── Verification queue (admin + moderator) ────────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/competitions/:id/queue",
    adminOrMod,
    async (req, reply) => {
      const comp = await repo.competitions.findById(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      const rounds = await repo.rounds.findByCompetition(comp.id);
      const flagged = (
        await Promise.all(rounds.map((r) => repo.results.findByRound(r.id)))
      )
        .flat()
        .filter((r) => r.flagStatus === "flagged");

      const thresholds: Record<string, number> = {
        "333": 3000, "222": 800, "444": 18000, "555": 35000,
        "666": 75000, "777": 110000, pyram: 1000, skewb: 1200,
        minx: 25000, "333oh": 6000, "333bf": 12000, sq1: 5000, clock: 3000,
      };

      return Promise.all(
        flagged.map(async (r) => {
          const round = await repo.rounds.findById(r.roundId);
          const event = round ? await repo.competitionEvents.findByRound(round.id) : undefined;
          const eventType = event?.eventType ?? "unknown";
          const user = await repo.users.findById(r.userId);
          const allUserResults = await repo.results.findByUser(r.userId);

          const reasons: string[] = [];
          const threshold = thresholds[eventType];
          if (threshold && r.ao5Ms !== null && r.ao5Ms < threshold) {
            reasons.push(
              `ao5 (${(r.ao5Ms / 1000).toFixed(2)}s) below ${eventType} threshold (${(threshold / 1000).toFixed(1)}s)`,
            );
          }
          if (allUserResults.length <= 1) {
            reasons.push("New user with no prior competition history");
          }

          return {
            id: r.id, roundId: r.roundId, userId: r.userId,
            userName: user?.name ?? r.userId, userClId: user?.clId ?? r.userId,
            eventType, roundNumber: round?.roundNumber ?? null,
            ao5Ms: r.ao5Ms, bestSingleMs: r.bestSingleMs,
            solves: r.solves, videoUrl: r.videoUrl, flagStatus: r.flagStatus,
            suspicionReasons: reasons, submittedAt: r.submittedAt,
          };
        }),
      );
    },
  );

  // Verify / override a flagged result (admin + moderator)
  app.post<{
    Params: { id: string };
    Body: { action?: FlagStatus; reason?: string };
  }>("/api/v1/admin/results/:id/verify", adminOrMod, async (req, reply) => {
    const result = await repo.results.findById(req.params.id);
    if (!result) return reply.code(404).send({ error: "result_not_found" });

    const action = req.body?.action;
    if (!action || !FLAG_ACTIONS.includes(action))
      return reply.code(400).send({ error: "invalid_action" });

    // Require a reason for destructive actions
    if (["plus2", "dnf", "disqualified"].includes(action) && !req.body?.reason) {
      return reply.code(400).send({ error: "reason_required" });
    }

    const admin = await repo.users.findById(req.authClaims!.sub);
    const now = new Date().toISOString();

    await repo.results.update(result.id, {
      flagStatus: action,
      verifiedBy: admin?.id ?? req.authClaims!.sub,
      verifiedAt: now,
    });

    const entry: AuditLogEntry = {
      id: randomUUID(),
      adminId: admin?.id ?? req.authClaims!.sub,
      action: `result_${action}`,
      target: result.id,
      reason: req.body?.reason,
      createdAt: now,
    };
    await repo.auditLog.create(entry);

    return { id: result.id, flagStatus: action };
  });

  // ── Users (admin) ────────────────────────────────────────────────────────

  app.get<{ Querystring: { search?: string; role?: string; stage?: string } }>(
    "/api/v1/admin/users",
    adminOnly,
    async (req) => {
      let users = await repo.users.findAll(req.query.search);
      if (req.query.role) users = users.filter((u) => u.role === req.query.role);
      if (req.query.stage) users = users.filter((u) => u.accountStage === req.query.stage);
      return users;
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { role?: string; accountStage?: string };
  }>("/api/v1/admin/users/:id", adminOnly, async (req, reply) => {
    const { role, accountStage } = req.body ?? {};
    const ROLES = ["user", "judge", "moderator", "admin"];
    const STAGES = ["active", "migrated_stub", "suspended", "banned"];

    const fields: Record<string, string> = {};
    if (role && ROLES.includes(role)) fields.role = role;
    if (accountStage && STAGES.includes(accountStage)) fields.accountStage = accountStage;

    if (Object.keys(fields).length === 0) return reply.code(400).send({ error: "no_valid_fields" });

    const updated = await repo.users.update(req.params.id, fields as never);
    if (!updated) return reply.code(404).send({ error: "user_not_found" });

    const admin = await repo.users.findById(req.authClaims!.sub);
    await repo.auditLog.create({
      id: randomUUID(),
      adminId: admin?.id ?? req.authClaims!.sub,
      action: "user_update",
      target: req.params.id,
      reason: `set ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      createdAt: new Date().toISOString(),
    });

    return updated;
  });

  // ── Payments (admin) ──────────────────────────────────────────────────────

  app.get<{ Querystring: { status?: string } }>(
    "/api/v1/admin/payments",
    adminOnly,
    async (req) => {
      let payments = await repo.payments.findAll();
      if (req.query.status) payments = payments.filter((p) => p.status === req.query.status);

      return Promise.all(
        payments.map(async (p) => {
          const user = await repo.users.findById(p.userId);
          const reg = await repo.registrations.findById(p.registrationId);
          const comp = reg ? await repo.competitions.findById(reg.competitionId) : null;
          return {
            ...p,
            userName: user?.name ?? p.userId,
            userClId: user?.clId ?? p.userId,
            userEmail: user?.email ?? "",
            competitionTitle: comp?.title ?? "Unknown",
          };
        }),
      );
    },
  );

  // ── Migration stats (admin) ───────────────────────────────────────────────

  app.get("/api/v1/admin/migration/stats", adminOnly, async () => {
    const users = await repo.users.findAll();
    const stubs = users.filter((u) => u.accountStage === "migrated_stub");
    const active = users.filter((u) => u.accountStage === "active");
    return {
      totalUsers: users.length,
      activeUsers: active.length,
      unclaimedStubs: stubs.length,
      stubs: stubs.map((u) => ({
        id: u.id, clId: u.clId, name: u.name, email: u.email, createdAt: u.createdAt,
      })),
    };
  });

  // ── Round advancement (shortlisting) ─────────────────────────────────────

  // Get advancement list for a round
  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/advanced",
    adminOrMod,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const advanced = await repo.advancements.findByRound(round.id);
      return Promise.all(
        advanced.map(async (a) => {
          const user = await repo.users.findById(a.userId);
          return { userId: a.userId, rank: a.rank, clId: user?.clId, name: user?.name };
        }),
      );
    },
  );

  // Public: who advanced from a round
  app.get<{ Params: { id: string } }>(
    "/api/v1/rounds/:id/advanced",
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });
      const rs = effectiveRoundStatus(round);
      if (rs !== "closed" && rs !== "advanced") {
        return reply.code(409).send({ error: "round_not_closed" });
      }
      const advanced = await repo.advancements.findByRound(round.id);
      return Promise.all(
        advanced.map(async (a) => {
          const user = await repo.users.findById(a.userId);
          return { userId: a.userId, rank: a.rank, clId: user?.clId, name: user?.name };
        }),
      );
    },
  );
}
