import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isEventId } from "@cubers/scramble-core";
import type { CompStatus, CompType, FlagStatus } from "@cubers/types";
import type { Db } from "../../db/store";
import { roundsForCompetition, resultsForRound } from "../../db/store";
import type { Competition, CompetitionEvent, Round, AuditLogEntry } from "../../db/types";
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
const FLAG_ACTIONS: FlagStatus[] = ["verified", "plus2", "dnf", "disqualified"];

export async function registerAdminRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  const adminOnly = { preHandler: requireRole(db, "admin") };

  // Create a competition with one or more events.
  app.post<{
    Body: {
      title?: string;
      type?: CompType;
      description?: string;
      rulesMd?: string;
      baseFee?: number;
      perEventFee?: number;
      registrationDeadline?: string;
      eventType?: string;
      roundCount?: number;
      events?: Array<{
        eventType: string;
        roundCount?: number;
        cutoffMs?: number;
        timeLimitMs?: number;
      }>;
    };
  }>("/api/v1/admin/competitions", adminOnly, async (req, reply) => {
    const { title, type, description, rulesMd, baseFee, perEventFee, registrationDeadline } =
      req.body ?? {};
    if (!title || typeof title !== "string") {
      return reply.code(400).send({ error: "missing_title" });
    }

    const user = db.users.get(req.authClaims!.sub);
    const now = new Date().toISOString();

    const competition: Competition = {
      id: randomUUID().slice(0, 8),
      title,
      type: type && COMP_TYPES.includes(type) ? type : "free",
      status: "draft",
      description: typeof description === "string" ? description : undefined,
      rulesMd: typeof rulesMd === "string" ? rulesMd : undefined,
      baseFee: typeof baseFee === "number" ? baseFee : 0,
      perEventFee: typeof perEventFee === "number" ? perEventFee : 0,
      registrationDeadline:
        typeof registrationDeadline === "string" ? registrationDeadline : undefined,
      createdBy: user?.clId,
      createdAt: now,
    };
    db.competitions.set(competition.id, competition);

    // Support multi-event creation via `events` array, fallback to single `eventType`
    const eventSpecs = req.body?.events?.length
      ? req.body.events
      : req.body?.eventType
        ? [{ eventType: req.body.eventType, roundCount: req.body.roundCount }]
        : [];

    // Validate that at least one valid event type is provided
    const validSpecs = eventSpecs.filter((s) => s.eventType && isEventId(s.eventType));
    if (eventSpecs.length > 0 && validSpecs.length === 0) {
      db.competitions.delete(competition.id);
      return reply.code(400).send({ error: "invalid_event_type" });
    }

    for (const spec of validSpecs) {

      const rounds = Math.max(1, Math.min(spec.roundCount ?? 1, 10));
      const event: CompetitionEvent = {
        id: randomUUID(),
        competitionId: competition.id,
        eventType: spec.eventType,
        roundCount: rounds,
        cutoffMs: spec.cutoffMs,
        timeLimitMs: spec.timeLimitMs,
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
    }

    return reply.code(201).send({ id: competition.id });
  });

  // Edit competition fields.
  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      status?: CompStatus;
      description?: string;
      rulesMd?: string;
      baseFee?: number;
      perEventFee?: number;
      registrationDeadline?: string;
    };
  }>("/api/v1/admin/competitions/:id", adminOnly, async (req, reply) => {
    const competition = db.competitions.get(req.params.id);
    if (!competition) {
      return reply.code(404).send({ error: "competition_not_found" });
    }
    const { title, status, description, rulesMd, baseFee, perEventFee, registrationDeadline } =
      req.body ?? {};
    if (typeof title === "string") competition.title = title;
    if (typeof description === "string") competition.description = description;
    if (typeof rulesMd === "string") competition.rulesMd = rulesMd;
    if (typeof baseFee === "number") competition.baseFee = baseFee;
    if (typeof perEventFee === "number") competition.perEventFee = perEventFee;
    if (typeof registrationDeadline === "string")
      competition.registrationDeadline = registrationDeadline;
    if (status && COMP_STATUSES.includes(status)) competition.status = status;
    return {
      id: competition.id,
      title: competition.title,
      status: competition.status,
    };
  });

  // Duplicate a competition (optionally reuse scrambles).
  app.post<{
    Params: { id: string };
    Body: { reuseScrambles?: boolean; type?: CompType };
  }>("/api/v1/admin/competitions/:id/duplicate", adminOnly, async (req, reply) => {
    const source = db.competitions.get(req.params.id);
    if (!source) return reply.code(404).send({ error: "competition_not_found" });

    const user = db.users.get(req.authClaims!.sub);
    const now = new Date().toISOString();
    const overrideType =
      req.body?.type && COMP_TYPES.includes(req.body.type) ? req.body.type : source.type;

    const comp: Competition = {
      id: randomUUID().slice(0, 8),
      title: `${source.title} (copy)`,
      type: overrideType,
      status: "draft",
      description: source.description,
      rulesMd: source.rulesMd,
      baseFee: overrideType === "free" ? 0 : source.baseFee,
      perEventFee: overrideType === "free" ? 0 : source.perEventFee,
      registrationDeadline: undefined,
      createdBy: user?.clId,
      createdAt: now,
    };
    db.competitions.set(comp.id, comp);

    const sourceEvents = [...db.events.values()].filter(
      (e) => e.competitionId === source.id,
    );

    for (const srcEvent of sourceEvents) {
      const event: CompetitionEvent = {
        id: randomUUID(),
        competitionId: comp.id,
        eventType: srcEvent.eventType,
        roundCount: srcEvent.roundCount,
        cutoffMs: srcEvent.cutoffMs,
        timeLimitMs: srcEvent.timeLimitMs,
      };
      db.events.set(event.id, event);

      const srcRounds = [...db.rounds.values()]
        .filter((r) => r.competitionEventId === srcEvent.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);

      for (const srcRound of srcRounds) {
        const round: Round = {
          id: randomUUID(),
          competitionEventId: event.id,
          roundNumber: srcRound.roundNumber,
          status: "pending",
        };
        db.rounds.set(round.id, round);

        if (req.body?.reuseScrambles) {
          const srcSet = [...db.scrambleSets.values()].find(
            (s) => s.roundId === srcRound.id,
          );
          if (srcSet) {
            const newSet: import("../../db/types").ScrambleSet = {
              id: randomUUID(),
              roundId: round.id,
              scrambles: [...srcSet.scrambles],
              generatedAt: now,
              lockedAt: now,
              lockedBy: "duplicate",
            };
            db.scrambleSets.set(newSet.id, newSet);
          }
        }
      }
    }

    return reply.code(201).send({ id: comp.id, title: comp.title });
  });

  // Flagged results verification queue for a competition.
  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/competitions/:id/queue",
    adminOnly,
    async (req, reply) => {
      const comp = db.competitions.get(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      const rounds = roundsForCompetition(db, comp.id);
      const flagged = rounds.flatMap((round) =>
        resultsForRound(db, round.id).filter((r) => r.flagStatus === "flagged"),
      );

      const thresholds: Record<string, number> = {
        "333": 3000, "222": 800, "444": 18000, "555": 35000,
        "666": 75000, "777": 110000, "pyram": 1000, "skewb": 1200,
        "minx": 25000, "333oh": 6000, "333bf": 12000, "sq1": 5000, "clock": 3000,
      };

      return flagged.map((r) => {
        const round = db.rounds.get(r.roundId);
        const event = round ? db.events.get(round.competitionEventId) : undefined;
        const eventType = event?.eventType ?? "unknown";
        const user = [...db.users.values()].find((u) => u.clId === r.userId);

        const userResultCount = [...db.results.values()].filter(
          (res) => res.userId === r.userId,
        ).length;

        const reasons: string[] = [];
        const threshold = thresholds[eventType];
        if (threshold && r.ao5Ms !== null && r.ao5Ms < threshold) {
          reasons.push(`ao5 (${(r.ao5Ms / 1000).toFixed(2)}s) below ${eventType} threshold (${(threshold / 1000).toFixed(1)}s)`);
        }
        if (userResultCount <= 1) {
          reasons.push("New user with no prior competition history");
        }

        return {
          id: r.id,
          roundId: r.roundId,
          userId: r.userId,
          userName: user?.name ?? r.userId,
          userClId: user?.clId ?? r.userId,
          eventType,
          roundNumber: round?.roundNumber ?? null,
          ao5Ms: r.ao5Ms,
          bestSingleMs: r.bestSingleMs,
          solves: r.solves,
          videoUrl: r.videoUrl,
          flagStatus: r.flagStatus,
          suspicionReasons: reasons,
          submittedAt: r.submittedAt,
        };
      });
    },
  );

  // Verify / override a flagged result.
  app.post<{
    Params: { id: string };
    Body: { action?: FlagStatus; reason?: string };
  }>("/api/v1/admin/results/:id/verify", adminOnly, async (req, reply) => {
    const result = db.results.get(req.params.id);
    if (!result) return reply.code(404).send({ error: "result_not_found" });

    const action = req.body?.action;
    if (!action || !FLAG_ACTIONS.includes(action)) {
      return reply.code(400).send({ error: "invalid_action" });
    }

    const admin = db.users.get(req.authClaims!.sub);
    const now = new Date().toISOString();

    result.flagStatus = action;
    result.verifiedBy = admin?.clId;
    result.verifiedAt = now;

    const entry: AuditLogEntry = {
      id: randomUUID(),
      adminId: admin?.clId ?? req.authClaims!.sub,
      action: `result_${action}`,
      target: result.id,
      reason: req.body?.reason,
      createdAt: now,
    };
    db.auditLog.push(entry);

    return { id: result.id, flagStatus: result.flagStatus };
  });
}
