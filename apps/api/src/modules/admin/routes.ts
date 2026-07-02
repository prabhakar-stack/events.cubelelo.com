import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isEventId } from "@cubers/scramble-core";
import type { CompStatus, CompType, FlagStatus } from "@cubers/types";
import type { Repository } from "../../db/repo";
import type { Competition, CompetitionEvent, Round, AuditLogEntry, Announcement, PromoCode, Appeal, RankTier, Banner, FaqEntry, ContentPage } from "../../db/types";
import type { Realtime } from "../../sockets/realtime";
import { requireRole } from "../../auth/plugin";
import { effectiveCompStatus, effectiveRoundStatus } from "../../lib/statusUtils";
import { shortlistRound } from "../../lib/roundLifecycle";
import { validateCompetitionSchedule, validateScheduleFields } from "../../lib/scheduleValidation";
import { collectCertificateData, generateCertificatePDF } from "../../lib/certificate";
import { emailService, roundNotificationEmail, bulkEmail, migrationEmail } from "../../lib/email";
import { ZipArchive } from "archiver";

const COMP_TYPES: CompType[] = ["paid", "free", "practice"];
const COMP_STATUSES: CompStatus[] = [
  "draft", "published", "registration_open", "registration_closed",
  "cancelled", "live", "results_pending", "completed",
];
const FLAG_ACTIONS: FlagStatus[] = ["verified", "plus2", "dnf", "disqualified"];

export async function registerAdminRoutes(
  app: FastifyInstance,
  repo: Repository,
  realtime: Realtime,
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
        advancementCriteria?: { method: string; rankLimit?: number; timeLimitMs?: number };
        roundCriteria?: Array<{ method: string; rankLimit?: number; timeLimitMs?: number } | null>;
        roundSchedule?: Array<{ startTime?: string; durationMinutes?: number } | null>;
        durationMinutes?: number;
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
        const rc = spec.roundCriteria?.[i - 1];
        const fallback = i < rounds && spec.advancementCriteria ? spec.advancementCriteria : undefined;
        const criteria = rc ?? fallback;
        const rs = spec.roundSchedule?.[i - 1];
        const roundDuration = rs?.durationMinutes ?? spec.durationMinutes;
        const opensAt = rs?.startTime;
        let closesAt: string | undefined;
        if (opensAt && roundDuration) {
          const close = new Date(new Date(opensAt).getTime() + roundDuration * 60_000);
          closesAt = close.toISOString();
        }
        const round: Round = {
          id: randomUUID(),
          competitionEventId: event.id,
          roundNumber: i,
          status: "pending",
          advancementCount: i < rounds ? (spec.advancementCount ?? undefined) : undefined,
          advancementCriteria: criteria
            ? { method: criteria.method as "rank" | "time",
                rankLimit: criteria.rankLimit,
                timeLimitMs: criteria.timeLimitMs }
            : undefined,
          opensAt,
          closesAt,
          durationMinutes: roundDuration,
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
      cancellationReason?: string;
    };
  }>("/api/v1/admin/competitions/:id", adminOnly, async (req, reply) => {
    const {
      title, status, description, rulesMd, baseFee, perEventFee,
      registrationOpensAt, registrationDeadline, startsAt, endsAt,
      featured, featuredOrder, coverCaption, coverUrl, bannerUrl,
      cancellationReason,
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
    if (typeof cancellationReason === "string") fields.cancellationReason = cancellationReason;

    if (status === "cancelled" && !cancellationReason?.trim()) {
      return reply.code(400).send({ error: "cancellation_reason_required" });
    }

    // Soft-validate schedule ordering on any schedule field update
    const hasScheduleChange = fields.registrationOpensAt !== undefined
      || fields.registrationDeadline !== undefined
      || fields.startsAt !== undefined
      || fields.endsAt !== undefined;

    if (hasScheduleChange || fields.status === "published") {
      const comp = await repo.competitions.findById(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });
      const merged = { ...comp, ...fields };

      if (hasScheduleChange && fields.status !== "published") {
        const soft = validateScheduleFields(merged);
        if (!soft.valid) {
          return reply.code(400).send({ error: "schedule_validation_failed", errors: soft.errors });
        }
      }

      if (fields.status === "published") {
        const rounds = await repo.rounds.findByCompetition(req.params.id);
        const result = validateCompetitionSchedule(merged, rounds);
        if (!result.valid) {
          return reply.code(400).send({ error: "schedule_validation_failed", errors: result.errors });
        }
      }
    }

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
      cancellationReason: updated.cancellationReason ?? null,
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
          advancementCriteria: srcRound.advancementCriteria,
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

  app.post<{ Body: { title?: string; bodyMd?: string; imageUrl?: string; redirectUrl?: string; pinned?: boolean; published?: boolean } }>(
    "/api/v1/admin/announcements",
    adminOnly,
    async (req, reply) => {
      const { title, bodyMd, imageUrl, redirectUrl, pinned, published } = req.body ?? {};
      if (!title || !bodyMd) return reply.code(400).send({ error: "missing_fields" });

      const user = await repo.users.findById(req.authClaims!.sub);
      const now = new Date().toISOString();
      const announcement: Announcement = {
        id: randomUUID(),
        title,
        bodyMd,
        imageUrl: imageUrl?.trim() || undefined,
        redirectUrl: redirectUrl?.trim() || undefined,
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
    Body: { title?: string; bodyMd?: string; imageUrl?: string; redirectUrl?: string; pinned?: boolean; published?: boolean };
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

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/announcements/:id/upload-image",
    adminOnly,
    async (req, reply) => {
      const ann = await repo.announcements.findById(req.params.id);
      if (!ann) return reply.code(404).send({ error: "announcement_not_found" });

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

      const { getStorage } = await import("../../lib/storage");
      const filename = `announcements/${ann.id}_${randomUUID().slice(0, 8)}.${ext}`;
      const storage = getStorage();
      const imageUrl = await storage.upload(filename, buffer, `image/${ext === "jpg" ? "jpeg" : ext}`);

      const updated = await repo.announcements.update(ann.id, { imageUrl });
      return updated;
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

    // Check if shortlisting should trigger (no more flagged results in this round)
    const round = await repo.rounds.findById(result.roundId);
    if (round && round.status === "closed" && (round.advancementCriteria || round.advancementCount)) {
      const allResults = await repo.results.findByRound(round.id);
      const hasFlagged = allResults.some((r) => r.flagStatus === "flagged");
      if (!hasFlagged) {
        await shortlistRound(repo, realtime, round);
      }
    }

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

  // Delete a user (admin)
  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/users/:id",
    adminOnly,
    async (req, reply) => {
      const target = await repo.users.findById(req.params.id);
      if (!target) return reply.code(404).send({ error: "user_not_found" });

      if (target.id === req.authClaims!.sub) {
        return reply.code(400).send({ error: "cannot_delete_self" });
      }

      await repo.users.delete(req.params.id);

      const admin = await repo.users.findById(req.authClaims!.sub);
      await repo.auditLog.create({
        id: randomUUID(),
        adminId: admin?.id ?? req.authClaims!.sub,
        action: "user_delete",
        target: req.params.id,
        reason: `Permanently deleted user ${target.email} (${target.clId})`,
        createdAt: new Date().toISOString(),
      });

      return reply.code(204).send();
    },
  );

  // Delete a competition (admin)
  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/competitions/:id",
    adminOnly,
    async (req, reply) => {
      const comp = await repo.competitions.findById(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      await repo.competitions.delete(req.params.id);

      const admin = await repo.users.findById(req.authClaims!.sub);
      await repo.auditLog.create({
        id: randomUUID(),
        adminId: admin?.id ?? req.authClaims!.sub,
        action: "competition_delete",
        target: req.params.id,
        reason: `Permanently deleted competition "${comp.title}"`,
        createdAt: new Date().toISOString(),
      });

      return reply.code(204).send();
    },
  );

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

  // ── CSV export ────────────────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/competitions/:id/export",
    adminOnly,
    async (req, reply) => {
      const comp = await repo.competitions.findById(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      const events = await repo.competitionEvents.findByCompetition(comp.id);
      const rounds = await repo.rounds.findByCompetition(comp.id);

      const rows: string[][] = [];
      rows.push([
        "Event", "Round", "Rank", "Name", "CL ID", "Best Single (s)",
        "ao5 (s)", "Solve 1", "Solve 2", "Solve 3", "Solve 4", "Solve 5",
        "Flag Status", "Video URL",
      ]);

      for (const ev of events) {
        const evRounds = rounds
          .filter((r) => r.competitionEventId === ev.id)
          .sort((a, b) => a.roundNumber - b.roundNumber);

        for (const round of evRounds) {
          const results = await repo.results.findByRound(round.id);
          const sorted = results.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));

          for (const r of sorted) {
            const user = await repo.users.findById(r.userId);
            const fmtMs = (ms: number | null) =>
              ms === null ? "DNF" : (ms / 1000).toFixed(2);
            const fmtSolve = (s: { time_ms: number; inspectionPenalty?: string; penalty: string }) => {
              const insp = s.inspectionPenalty ?? "none";
              if (insp === "dnf" || s.penalty === "dnf") return "DNF";
              let extra = 0;
              if (insp === "plus2") extra += 2000;
              if (s.penalty === "plus2") extra += 2000;
              const t = s.time_ms + extra;
              return (t / 1000).toFixed(2) + (extra > 0 ? "+" : "");
            };

            const solveStrs = Array.from({ length: 5 }, (_, i) =>
              r.solves[i] ? fmtSolve(r.solves[i]) : "",
            );

            rows.push([
              ev.eventType,
              `R${round.roundNumber}`,
              r.rank !== null ? String(r.rank) : "",
              user?.name ?? "",
              user?.clId ?? "",
              fmtMs(r.bestSingleMs),
              fmtMs(r.ao5Ms),
              ...solveStrs,
              r.flagStatus,
              r.videoUrl ?? "",
            ]);
          }
        }
      }

      const escapeCsv = (val: string) => {
        if (val.includes(",") || val.includes('"') || val.includes("\n"))
          return `"${val.replace(/"/g, '""')}"`;
        return val;
      };
      const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
      const filename = `${comp.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_results.csv`;

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    },
  );

  // ── Bulk email ────────────────────────────────────────────────────────────

  app.post<{
    Params: { id: string };
    Body: { subject?: string; bodyHtml?: string };
  }>(
    "/api/v1/admin/competitions/:id/email",
    adminOnly,
    async (req, reply) => {
      const { subject, bodyHtml } = req.body ?? {};
      if (!subject?.trim() || !bodyHtml?.trim())
        return reply.code(400).send({ error: "subject_and_body_required" });

      const comp = await repo.competitions.findById(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      const regs = await repo.registrations.findByCompetition(comp.id);
      const recipients: { email: string; name: string }[] = [];
      for (const reg of regs) {
        const user = await repo.users.findById(reg.userId);
        if (user?.email) recipients.push({ email: user.email, name: user.name });
      }

      if (recipients.length === 0)
        return reply.code(409).send({ error: "no_recipients" });

      let sentCount = 0;
      for (const r of recipients) {
        const msg = bulkEmail(r.name, subject, bodyHtml);
        const ok = await emailService.send({ to: r.email, subject: msg.subject, html: msg.html });
        if (ok) sentCount++;
      }

      const admin = await repo.users.findById(req.authClaims!.sub);
      await repo.auditLog.create({
        id: randomUUID(),
        adminId: admin?.id ?? req.authClaims!.sub,
        action: "bulk_email",
        target: comp.id,
        reason: `subject="${subject}", recipients=${recipients.length}, sent=${sentCount}`,
        createdAt: new Date().toISOString(),
      });

      return {
        sent: sentCount > 0,
        recipientCount: recipients.length,
        sentCount,
      };
    },
  );

  // ── Certificates ──────────────────────────────────────────────────────────

  app.get<{ Params: { id: string; userId: string } }>(
    "/api/v1/admin/competitions/:id/certificate/:userId",
    adminOnly,
    async (req, reply) => {
      const data = await collectCertificateData(repo, req.params.id, req.params.userId);
      if (!data) return reply.code(404).send({ error: "not_found" });

      const pdf = generateCertificatePDF(data);
      const filename = `${data.participantName.replace(/[^a-zA-Z0-9_-]/g, "_")}_certificate.pdf`;

      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`);

      return reply.send(pdf);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/competitions/:id/certificates",
    adminOnly,
    async (req, reply) => {
      const comp = await repo.competitions.findById(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      const regs = await repo.registrations.findByCompetition(comp.id);
      if (regs.length === 0)
        return reply.code(409).send({ error: "no_registrations" });

      const filename = `${comp.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_certificates.zip`;
      reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${filename}"`);

      const archive = new ZipArchive({ zlib: { level: 5 } });
      archive.on("error", (err: Error) => reply.log.error(err, "archive error"));

      for (const reg of regs) {
        const data = await collectCertificateData(repo, comp.id, reg.userId);
        if (!data) continue;

        const pdf = generateCertificatePDF(data);
        const pdfName = `${data.participantName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${data.clId}.pdf`;
        archive.append(pdf as never, { name: pdfName });
      }

      archive.finalize();
      return reply.send(archive);
    },
  );

  // ── Promo codes (admin CRUD) ──────────────────────────────────────────────

  app.get("/api/v1/admin/promo-codes", adminOnly, async () => {
    return repo.promoCodes.findAll();
  });

  app.post<{
    Body: {
      code?: string;
      discountType?: "percentage" | "flat";
      discountValue?: number;
      maxUses?: number;
      competitionId?: string;
      validFrom?: string;
      validTo?: string;
    };
  }>("/api/v1/admin/promo-codes", adminOnly, async (req, reply) => {
    const { code, discountType, discountValue, maxUses, competitionId, validFrom, validTo } = req.body ?? {};
    if (!code?.trim() || !discountType || discountValue == null || discountValue <= 0)
      return reply.code(400).send({ error: "code_type_and_value_required" });
    if (discountType === "percentage" && discountValue > 100)
      return reply.code(400).send({ error: "percentage_max_100" });

    const existing = await repo.promoCodes.findByCode(code);
    if (existing) return reply.code(409).send({ error: "code_already_exists" });

    const promo: PromoCode = {
      id: randomUUID(),
      code: code.toUpperCase().trim(),
      discountType,
      discountValue,
      maxUses: maxUses ?? 0,
      usedCount: 0,
      competitionId,
      validFrom,
      validTo,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await repo.promoCodes.create(promo);
    return reply.code(201).send(promo);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<Pick<PromoCode, "code" | "discountType" | "discountValue" | "maxUses" | "competitionId" | "validFrom" | "validTo" | "active">>;
  }>("/api/v1/admin/promo-codes/:id", adminOnly, async (req, reply) => {
    const updated = await repo.promoCodes.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: "promo_not_found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/promo-codes/:id",
    adminOnly,
    async (req, reply) => {
      const promo = await repo.promoCodes.findById(req.params.id);
      if (!promo) return reply.code(404).send({ error: "promo_not_found" });
      await repo.promoCodes.delete(req.params.id);
      return { ok: true };
    },
  );

  // ── Promo code validation (public, auth required) ────────────────────────

  app.post<{
    Body: { code?: string; competitionId?: string };
  }>("/api/v1/promo/validate", async (req, reply) => {
    const { code, competitionId } = req.body ?? {};
    if (!code?.trim()) return reply.code(400).send({ error: "code_required" });

    const promo = await repo.promoCodes.findByCode(code.trim());
    if (!promo || !promo.active)
      return reply.code(404).send({ error: "invalid_code" });

    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses)
      return reply.code(409).send({ error: "code_exhausted" });

    const now = new Date().toISOString();
    if (promo.validFrom && now < promo.validFrom)
      return reply.code(409).send({ error: "code_not_yet_valid" });
    if (promo.validTo && now > promo.validTo)
      return reply.code(409).send({ error: "code_expired" });

    if (promo.competitionId && competitionId && promo.competitionId !== competitionId)
      return reply.code(409).send({ error: "code_not_for_this_competition" });

    return {
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    };
  });

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

  // ── Migration email campaign ─────────────────────────────────────────────

  app.post("/api/v1/admin/migration/send-emails", adminOnly, async (req) => {
    const users = await repo.users.findAll();
    const stubs = users.filter((u) => u.accountStage === "migrated_stub" && u.email);
    let sentCount = 0;
    for (const stub of stubs) {
      const msg = migrationEmail(stub.name, stub.clId);
      const ok = await emailService.send({ to: stub.email, subject: msg.subject, html: msg.html });
      if (ok) sentCount++;
    }

    const admin = await repo.users.findById((req as { authClaims?: { sub: string } }).authClaims!.sub);
    await repo.auditLog.create({
      id: randomUUID(),
      adminId: admin?.id ?? (req as { authClaims?: { sub: string } }).authClaims!.sub,
      action: "migration_email_campaign",
      reason: `Sent migration emails to ${sentCount}/${stubs.length} unclaimed stubs`,
      createdAt: new Date().toISOString(),
    });

    return { totalStubs: stubs.length, sentCount };
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

  // ── Appeals (user-facing) ───────────────────────────────────────────────

  app.post<{
    Body: { resultId?: string; reason?: string };
  }>("/api/v1/appeals", { preHandler: requireRole(repo, "user", "admin", "moderator", "judge") }, async (req, reply) => {
    const { resultId, reason } = req.body ?? {};
    if (!resultId || !reason?.trim())
      return reply.code(400).send({ error: "result_id_and_reason_required" });

    const result = await repo.results.findById(resultId);
    if (!result) return reply.code(404).send({ error: "result_not_found" });
    if (result.userId !== req.authClaims!.sub)
      return reply.code(403).send({ error: "can_only_appeal_own_results" });

    const existing = await repo.appeals.findByResult(resultId);
    if (existing) return reply.code(409).send({ error: "appeal_already_submitted" });

    const appeal = {
      id: randomUUID(),
      resultId,
      userId: req.authClaims!.sub,
      reason: reason.trim(),
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
    await repo.appeals.create(appeal);
    return reply.code(201).send(appeal);
  });

  app.get("/api/v1/me/appeals", { preHandler: requireRole(repo, "user", "admin", "moderator", "judge") }, async (req) => {
    return repo.appeals.findByUser(req.authClaims!.sub);
  });

  // Admin: list all appeals
  app.get("/api/v1/admin/appeals", adminOrMod, async () => {
    const all = await repo.appeals.findAll();
    return Promise.all(
      all.map(async (a) => {
        const user = await repo.users.findById(a.userId);
        const result = await repo.results.findById(a.resultId);
        return { ...a, userName: user?.name, userClId: user?.clId, flagStatus: result?.flagStatus };
      }),
    );
  });

  // Admin: resolve appeal
  app.post<{
    Params: { id: string };
    Body: { action?: "accepted" | "rejected"; adminResponse?: string };
  }>("/api/v1/admin/appeals/:id/resolve", adminOrMod, async (req, reply) => {
    const { action, adminResponse } = req.body ?? {};
    if (!action || !["accepted", "rejected"].includes(action))
      return reply.code(400).send({ error: "action_required" });

    const updated = await repo.appeals.update(req.params.id, {
      status: action,
      adminResponse: adminResponse?.trim(),
      resolvedAt: new Date().toISOString(),
    });
    if (!updated) return reply.code(404).send({ error: "appeal_not_found" });

    const admin = await repo.users.findById(req.authClaims!.sub);
    await repo.auditLog.create({
      id: randomUUID(),
      adminId: admin?.id ?? req.authClaims!.sub,
      action: `appeal_${action}`,
      target: updated.resultId,
      reason: adminResponse?.trim(),
      createdAt: new Date().toISOString(),
    });

    return updated;
  });

  // ── WCA verification queue (admin) ──────────────────────────────────────

  app.get("/api/v1/admin/wca-queue", adminOnly, async () => {
    const users = await repo.users.findAll();
    return users
      .filter((u) => u.wcaId && !u.wcaVerified)
      .map((u) => ({
        id: u.id,
        clId: u.clId,
        name: u.name,
        email: u.email,
        wcaId: u.wcaId,
        wcaVerified: u.wcaVerified,
      }));
  });

  app.post<{
    Params: { id: string };
    Body: { action?: "verify" | "reject" };
  }>("/api/v1/admin/wca-queue/:id", adminOnly, async (req, reply) => {
    const { action } = req.body ?? {};
    if (!action) return reply.code(400).send({ error: "action_required" });

    const fields = action === "verify"
      ? { wcaVerified: true }
      : { wcaId: undefined, wcaVerified: false };

    const updated = await repo.users.update(req.params.id, fields as never);
    if (!updated) return reply.code(404).send({ error: "user_not_found" });

    const admin = await repo.users.findById(req.authClaims!.sub);
    await repo.auditLog.create({
      id: randomUUID(),
      adminId: admin?.id ?? req.authClaims!.sub,
      action: `wca_${action}`,
      target: req.params.id,
      reason: `WCA ID: ${updated.wcaId ?? "removed"}`,
      createdAt: new Date().toISOString(),
    });

    return { id: updated.id, wcaId: updated.wcaId, wcaVerified: updated.wcaVerified };
  });

  // ── Rank tiers (admin CRUD) ─────────────────────────────────────────────

  app.get("/api/v1/admin/rank-tiers", adminOnly, async () => {
    return repo.rankTiers.findAll();
  });

  app.post<{
    Body: { name?: string; eventType?: string; maxAo5Ms?: number; color?: string };
  }>("/api/v1/admin/rank-tiers", adminOnly, async (req, reply) => {
    const { name, eventType, maxAo5Ms, color } = req.body ?? {};
    if (!name?.trim() || !eventType?.trim() || !maxAo5Ms || !color?.trim())
      return reply.code(400).send({ error: "all_fields_required" });

    const tier: RankTier = {
      id: randomUUID(),
      name: name.trim(),
      eventType: eventType.trim(),
      maxAo5Ms,
      color: color.trim(),
      createdAt: new Date().toISOString(),
    };
    await repo.rankTiers.create(tier);
    return reply.code(201).send(tier);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<Pick<RankTier, "name" | "maxAo5Ms" | "color">>;
  }>("/api/v1/admin/rank-tiers/:id", adminOnly, async (req, reply) => {
    const updated = await repo.rankTiers.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: "tier_not_found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/rank-tiers/:id",
    adminOnly,
    async (req, reply) => {
      const tier = await repo.rankTiers.findById(req.params.id);
      if (!tier) return reply.code(404).send({ error: "tier_not_found" });
      await repo.rankTiers.delete(req.params.id);
      return { ok: true };
    },
  );

  // Public: get rank tiers for an event
  app.get<{ Params: { eventType: string } }>(
    "/api/v1/rank-tiers/:eventType",
    async (req) => {
      return repo.rankTiers.findByEvent(req.params.eventType);
    },
  );

  // ── Account merge (admin) ──────────────────────────────────────────────

  app.post<{
    Body: { keepUserId?: string; mergeUserId?: string };
  }>("/api/v1/admin/merge-accounts", adminOnly, async (req, reply) => {
    const { keepUserId, mergeUserId } = req.body ?? {};
    if (!keepUserId || !mergeUserId)
      return reply.code(400).send({ error: "keep_and_merge_user_ids_required" });
    if (keepUserId === mergeUserId)
      return reply.code(400).send({ error: "cannot_merge_same_account" });

    const keepUser = await repo.users.findById(keepUserId);
    const mergeUser = await repo.users.findById(mergeUserId);
    if (!keepUser) return reply.code(404).send({ error: "keep_user_not_found" });
    if (!mergeUser) return reply.code(404).send({ error: "merge_user_not_found" });

    // Move all registrations from mergeUser to keepUser
    const mergeRegs = await repo.registrations.findByUser(mergeUserId);
    for (const reg of mergeRegs) {
      await repo.registrations.update(reg.id, { userId: keepUserId } as never);
    }

    // Move all results from mergeUser to keepUser
    const mergeResults = await repo.results.findByUser(mergeUserId);
    for (const result of mergeResults) {
      await repo.results.update(result.id, { userId: keepUserId });
    }

    // Deactivate the merged account
    await repo.users.update(mergeUserId, {
      accountStage: "suspended" as never,
      name: `[MERGED → ${keepUser.clId}] ${mergeUser.name}`,
    } as never);

    const admin = await repo.users.findById(req.authClaims!.sub);
    await repo.auditLog.create({
      id: randomUUID(),
      adminId: admin?.id ?? req.authClaims!.sub,
      action: "account_merge",
      target: `${mergeUser.clId} → ${keepUser.clId}`,
      reason: `Merged ${mergeRegs.length} registrations, ${mergeResults.length} results`,
      createdAt: new Date().toISOString(),
    });

    return {
      kept: { id: keepUser.id, clId: keepUser.clId, name: keepUser.name },
      merged: { id: mergeUser.id, clId: mergeUser.clId, name: mergeUser.name },
      movedRegistrations: mergeRegs.length,
      movedResults: mergeResults.length,
    };
  });

  // ── Round notification (log-based) ──────────────────────────────────────

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/rounds/:id/notify",
    adminOnly,
    async (req, reply) => {
      const round = await repo.rounds.findById(req.params.id);
      if (!round) return reply.code(404).send({ error: "round_not_found" });

      const event = await repo.competitionEvents.findById(round.competitionEventId);
      if (!event) return reply.code(404).send({ error: "event_not_found" });

      const comp = await repo.competitions.findById(event.competitionId);
      const regs = await repo.registrations.findByCompetition(event.competitionId);
      const recipients: { email: string; name: string }[] = [];

      for (const reg of regs) {
        const user = await repo.users.findById(reg.userId);
        if (user?.email) recipients.push({ email: user.email, name: user.name });
      }

      const compTitle = comp?.title ?? "Competition";
      let sentCount = 0;
      for (const r of recipients) {
        const msg = roundNotificationEmail(r.name, compTitle, round.roundNumber, "opened");
        const ok = await emailService.send({ to: r.email, subject: msg.subject, html: msg.html });
        if (ok) sentCount++;
      }

      return {
        sent: sentCount > 0,
        recipientCount: recipients.length,
        sentCount,
        roundNumber: round.roundNumber,
        eventType: event.eventType,
      };
    },
  );

  // ── Banners (admin CRUD) ──────────────────────────────────────────────────

  app.get("/api/v1/admin/banners", adminOnly, async () => {
    return repo.banners.findAll();
  });

  app.post<{
    Body: { title?: string; imageUrl?: string; ctaText?: string; ctaLink?: string; expiresAt?: string; active?: boolean; order?: number };
  }>("/api/v1/admin/banners", adminOnly, async (req, reply) => {
    const { title, imageUrl, ctaText, ctaLink, expiresAt, active, order } = req.body ?? {};
    if (!title?.trim()) return reply.code(400).send({ error: "title_required" });

    const banner: Banner = {
      id: randomUUID(),
      title: title.trim(),
      imageUrl: imageUrl?.trim() || undefined,
      ctaText: ctaText?.trim() || undefined,
      ctaLink: ctaLink?.trim() || undefined,
      expiresAt: expiresAt || undefined,
      active: active ?? true,
      order: order ?? 0,
      createdAt: new Date().toISOString(),
    };
    await repo.banners.create(banner);
    return reply.code(201).send(banner);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<Pick<Banner, "title" | "imageUrl" | "ctaText" | "ctaLink" | "expiresAt" | "active" | "order">>;
  }>("/api/v1/admin/banners/:id", adminOnly, async (req, reply) => {
    const updated = await repo.banners.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: "banner_not_found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/banners/:id",
    adminOnly,
    async (req, reply) => {
      const banner = await repo.banners.findById(req.params.id);
      if (!banner) return reply.code(404).send({ error: "banner_not_found" });
      await repo.banners.delete(req.params.id);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/banners/:id/upload-image",
    adminOnly,
    async (req, reply) => {
      const banner = await repo.banners.findById(req.params.id);
      if (!banner) return reply.code(404).send({ error: "banner_not_found" });

      const data = await req.file();
      if (!data) return reply.code(400).send({ error: "no_file" });

      const ext = data.filename.split(".").pop()?.toLowerCase() ?? "png";
      if (!["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
        return reply.code(400).send({ error: "invalid_file_type" });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk as Buffer);
      const buffer = Buffer.concat(chunks);

      if (buffer.length > 5 * 1024 * 1024)
        return reply.code(400).send({ error: "file_too_large_max_5mb" });

      const { getStorage } = await import("../../lib/storage");
      const filename = `banners/${banner.id}_${randomUUID().slice(0, 8)}.${ext}`;
      const storage = getStorage();
      const imageUrl = await storage.upload(filename, buffer, `image/${ext === "jpg" ? "jpeg" : ext}`);

      const updated = await repo.banners.update(banner.id, { imageUrl });
      return updated;
    },
  );

  // Public: active banners
  app.get("/api/v1/banners", async () => {
    const all = await repo.banners.findAll();
    const now = new Date().toISOString();
    return all.filter((b) => b.active && (!b.expiresAt || b.expiresAt > now));
  });

  // ── FAQ (admin CRUD) ──────────────────────────────────────────────────────

  app.get("/api/v1/admin/faq", adminOnly, async () => {
    return repo.faq.findAll(false);
  });

  app.post<{
    Body: { question?: string; answerMd?: string; order?: number; published?: boolean };
  }>("/api/v1/admin/faq", adminOnly, async (req, reply) => {
    const { question, answerMd, order, published } = req.body ?? {};
    if (!question?.trim() || !answerMd?.trim())
      return reply.code(400).send({ error: "question_and_answer_required" });

    const entry: FaqEntry = {
      id: randomUUID(),
      question: question.trim(),
      answerMd: answerMd.trim(),
      order: order ?? 0,
      published: published ?? false,
      createdAt: new Date().toISOString(),
    };
    await repo.faq.create(entry);
    return reply.code(201).send(entry);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<Pick<FaqEntry, "question" | "answerMd" | "order" | "published">>;
  }>("/api/v1/admin/faq/:id", adminOnly, async (req, reply) => {
    const updated = await repo.faq.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: "faq_not_found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/faq/:id",
    adminOnly,
    async (req, reply) => {
      const entry = await repo.faq.findById(req.params.id);
      if (!entry) return reply.code(404).send({ error: "faq_not_found" });
      await repo.faq.delete(req.params.id);
      return { ok: true };
    },
  );

  // Public: published FAQ entries
  app.get("/api/v1/faq", async () => {
    return repo.faq.findAll(true);
  });

  // ── Content Pages (admin CRUD) ─────────────────────────────────────────────

  app.get("/api/v1/admin/content-pages", adminOnly, async () => {
    return repo.contentPages.findAll(false);
  });

  app.post<{
    Body: { slug?: string; title?: string; bodyMd?: string; published?: boolean };
  }>("/api/v1/admin/content-pages", adminOnly, async (req, reply) => {
    const { slug, title, bodyMd, published } = req.body ?? {};
    if (!slug?.trim() || !title?.trim())
      return reply.code(400).send({ error: "slug_and_title_required" });

    const existing = await repo.contentPages.findBySlug(slug.trim());
    if (existing) return reply.code(409).send({ error: "slug_already_exists" });

    const now = new Date().toISOString();
    const page: ContentPage = {
      id: randomUUID(), slug: slug.trim(), title: title.trim(),
      bodyMd: bodyMd?.trim() ?? "", published: published ?? false,
      updatedAt: now, createdAt: now,
    };
    await repo.contentPages.create(page);
    return reply.code(201).send(page);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<Pick<ContentPage, "slug" | "title" | "bodyMd" | "published">>;
  }>("/api/v1/admin/content-pages/:id", adminOnly, async (req, reply) => {
    const updated = await repo.contentPages.update(req.params.id, req.body ?? {});
    if (!updated) return reply.code(404).send({ error: "content_page_not_found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/content-pages/:id",
    adminOnly,
    async (req, reply) => {
      const page = await repo.contentPages.findById(req.params.id);
      if (!page) return reply.code(404).send({ error: "content_page_not_found" });
      await repo.contentPages.delete(req.params.id);
      return { ok: true };
    },
  );

  // Public: fetch a content page by slug
  app.get<{ Params: { slug: string } }>("/api/v1/pages/:slug", async (req, reply) => {
    const page = await repo.contentPages.findBySlug(req.params.slug);
    if (!page || !page.published) return reply.code(404).send({ error: "page_not_found" });
    return { slug: page.slug, title: page.title, bodyMd: page.bodyMd };
  });

  // ── Judge/Moderator creation (admin) ──────────────────────────────────────

  app.post<{
    Body: { email?: string; name?: string; role?: "judge" | "moderator" | "admin" };
  }>("/api/v1/admin/create-staff", adminOnly, async (req, reply) => {
    const { email, name, role } = req.body ?? {};
    if (!email?.trim() || !name?.trim())
      return reply.code(400).send({ error: "email_and_name_required" });
    if (!role || !["judge", "moderator", "admin"].includes(role))
      return reply.code(400).send({ error: "invalid_role" });

    // Promoting to admin requires super_admin
    if (role === "admin") {
      const caller = await repo.users.findById(req.authClaims!.sub);
      if (caller?.role !== "super_admin")
        return reply.code(403).send({ error: "super_admin_required_for_admin_promotion" });
    }

    const existing = await repo.users.findByEmail(email.trim());
    if (existing) {
      if (existing.role === role)
        return reply.code(409).send({ error: "user_already_has_role" });
      await repo.users.update(existing.id, { role } as never);
      const admin = await repo.users.findById(req.authClaims!.sub);
      await repo.auditLog.create({
        id: randomUUID(),
        adminId: admin?.id ?? req.authClaims!.sub,
        action: "role_assign",
        target: existing.id,
        reason: `Role changed to ${role}`,
        createdAt: new Date().toISOString(),
      });
      return { id: existing.id, clId: existing.clId, name: existing.name, email: existing.email, role };
    }

    const clId = await repo.users.nextClId();
    const now = new Date().toISOString();
    const newUser = {
      id: randomUUID(),
      clId,
      email: email.trim(),
      name: name.trim(),
      role: role as "judge" | "moderator" | "admin",
      wcaVerified: false,
      emailVerified: false,
      mobileVerified: false,
      profilePrivacy: "public" as const,
      accountStage: "active" as const,
      createdAt: now,
    };
    await repo.users.create(newUser);

    const admin = await repo.users.findById(req.authClaims!.sub);
    await repo.auditLog.create({
      id: randomUUID(),
      adminId: admin?.id ?? req.authClaims!.sub,
      action: "staff_create",
      target: newUser.id,
      reason: `Created ${role} account for ${email}`,
      createdAt: now,
    });

    return reply.code(201).send({ id: newUser.id, clId, name: newUser.name, email: newUser.email, role });
  });

}
