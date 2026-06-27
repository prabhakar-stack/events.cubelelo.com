import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import { resolveUser } from "../../auth/plugin";
import { effectiveCompStatus, effectiveRoundStatus } from "../../lib/statusUtils";

export async function registerCompetitionRoutes(
  app: FastifyInstance,
  repo: Repository,
): Promise<void> {
  // Public announcements
  app.get("/api/v1/announcements", async () => {
    return repo.announcements.findAll(true);
  });

  // Featured competitions for the homepage
  app.get("/api/v1/competitions/featured", async () => {
    const all = await repo.competitions.findAll();
    return all
      .filter((c) => {
        const s = effectiveCompStatus(c);
        return c.featured && s !== "draft" && s !== "cancelled";
      })
      .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99))
      .map((c) => ({
        id: c.id, title: c.title, type: c.type,
        status: effectiveCompStatus(c),
        description: c.description,
        coverUrl: c.coverUrl, coverCaption: c.coverCaption,
        registrationOpensAt: c.registrationOpensAt ?? null,
        registrationDeadline: c.registrationDeadline ?? null,
        startsAt: c.startsAt ?? null,
        endsAt: c.endsAt ?? null,
        featuredOrder: c.featuredOrder,
      }));
  });

  // List competitions with optional status filter.
  app.get<{ Querystring: { status?: string } }>(
    "/api/v1/competitions",
    async (req) => {
      const caller = await resolveUser(repo, req);
      const isAdmin = caller?.role === "admin" || caller?.role === "moderator";

      let comps = await repo.competitions.findAll();

      // Non-admins cannot see drafts or cancelled competitions
      if (!isAdmin) {
        comps = comps.filter((c) => {
          const s = effectiveCompStatus(c);
          return s !== "draft" && s !== "cancelled";
        });
      }

      const filter = req.query?.status;
      if (filter === "upcoming") {
        comps = comps.filter((c) => {
          const s = effectiveCompStatus(c);
          return s === "upcoming" || s === "registration_open" || s === "registration_closed";
        });
      } else if (filter === "live") {
        comps = comps.filter((c) => effectiveCompStatus(c) === "live");
      } else if (filter === "past") {
        comps = comps.filter((c) => effectiveCompStatus(c) === "completed");
      } else if (filter === "draft" && isAdmin) {
        comps = comps.filter((c) => c.status === "draft");
      }

      return Promise.all(
        comps.map(async (c) => {
          const events = await repo.competitionEvents.findByCompetition(c.id);
          const regCount = await repo.competitions.countRegistrations(c.id);
          return {
            id: c.id,
            title: c.title,
            type: c.type,
            status: effectiveCompStatus(c),
            description: c.description,
            baseFee: c.baseFee,
            perEventFee: c.perEventFee,
            registrationOpensAt: c.registrationOpensAt ?? null,
            registrationDeadline: c.registrationDeadline ?? null,
            startsAt: c.startsAt ?? null,
            endsAt: c.endsAt ?? null,
            coverUrl: c.coverUrl,
            featured: c.featured,
            featuredOrder: c.featuredOrder,
            createdAt: c.createdAt,
            eventTypes: events.map((e) => e.eventType),
            registrationCount: regCount,
          };
        }),
      );
    },
  );

  // Competition detail with events and rounds.
  app.get<{ Params: { id: string } }>(
    "/api/v1/competitions/:id",
    async (req, reply) => {
      const competition = await repo.competitions.findById(req.params.id);
      if (!competition) return reply.code(404).send({ error: "competition_not_found" });

      const caller = await resolveUser(repo, req);
      const isAdmin = caller?.role === "admin" || caller?.role === "moderator";
      const effStatus = effectiveCompStatus(competition);

      // Non-admins cannot see draft/cancelled competitions
      if (!isAdmin && (effStatus === "draft" || effStatus === "cancelled")) {
        return reply.code(404).send({ error: "competition_not_found" });
      }

      const [events, rounds, regCount] = await Promise.all([
        repo.competitionEvents.findByCompetition(competition.id),
        repo.rounds.findByCompetition(competition.id),
        repo.competitions.countRegistrations(competition.id),
      ]);

      return {
        id: competition.id,
        title: competition.title,
        type: competition.type,
        status: effStatus,
        description: competition.description,
        rulesMd: competition.rulesMd,
        baseFee: competition.baseFee,
        perEventFee: competition.perEventFee,
        registrationOpensAt: competition.registrationOpensAt ?? null,
        registrationDeadline: competition.registrationDeadline ?? null,
        startsAt: competition.startsAt ?? null,
        endsAt: competition.endsAt ?? null,
        coverUrl: competition.coverUrl,
        bannerUrl: competition.bannerUrl,
        featured: competition.featured,
        createdBy: competition.createdBy,
        createdAt: competition.createdAt,
        registrationCount: regCount,
        events: await Promise.all(
          events.map(async (e) => {
            const eventRounds = rounds
              .filter((r) => r.competitionEventId === e.id)
              .sort((a, b) => a.roundNumber - b.roundNumber);

            const roundsWithScramble = await Promise.all(
              eventRounds.map(async (r) => {
                const set = await repo.scrambleSets.findByRound(r.id);
                return {
                  id: r.id,
                  roundNumber: r.roundNumber,
                  status: effectiveRoundStatus(r),
                  eventType: e.eventType,
                  opensAt: r.opensAt ?? null,
                  closesAt: r.closesAt ?? null,
                  advancementCount: r.advancementCount ?? null,
                  scrambleLocked: Boolean(set?.lockedAt),
                };
              }),
            );

            return {
              id: e.id,
              eventType: e.eventType,
              roundCount: e.roundCount,
              cutoffMs: e.cutoffMs,
              timeLimitMs: e.timeLimitMs,
              rounds: roundsWithScramble,
            };
          }),
        ),
      };
    },
  );
}
