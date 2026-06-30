import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import { resolveUser, requireAuth } from "../../auth/plugin";
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
      const isAdmin = caller?.role === "admin" || caller?.role === "super_admin" || caller?.role === "moderator";

      let comps = await repo.competitions.findAll();

      // Non-admins cannot see drafts
      if (!isAdmin) {
        comps = comps.filter((c) => {
          const s = effectiveCompStatus(c);
          return s !== "draft";
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
            cancellationReason: c.cancellationReason ?? null,
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
      const isAdmin = caller?.role === "admin" || caller?.role === "super_admin" || caller?.role === "moderator";
      const effStatus = effectiveCompStatus(competition);

      // Non-admins cannot see draft competitions
      if (!isAdmin && effStatus === "draft") {
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
        cancellationReason: competition.cancellationReason ?? null,
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
                  advancementCriteria: r.advancementCriteria ?? null,
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

  // User's progression status for a competition
  app.get<{ Params: { id: string } }>(
    "/api/v1/competitions/:id/my-progress",
    { preHandler: requireAuth },
    async (req, reply) => {
      const competition = await repo.competitions.findById(req.params.id);
      if (!competition) return reply.code(404).send({ error: "competition_not_found" });

      const user = await repo.users.findById(req.authClaims!.sub);
      if (!user) return reply.code(403).send({ error: "not_synced" });

      const reg = await repo.registrations.findByUserAndComp(user.id, competition.id);
      if (!reg) return { registered: false, rounds: [] };

      const events = await repo.competitionEvents.findByCompetition(competition.id);
      const rounds = await repo.rounds.findByCompetition(competition.id);
      const userResults = await repo.results.findByUser(user.id);

      const roundProgress = await Promise.all(
        rounds
          .sort((a, b) => a.roundNumber - b.roundNumber)
          .map(async (r) => {
            const event = events.find((e) => e.id === r.competitionEventId);
            const status = effectiveRoundStatus(r);
            const result = userResults.find((res) => res.roundId === r.id);
            const advanced = r.roundNumber > 1
              ? await repo.advancements.isAdvanced(r.id, user.id)
              : true;

            let userStatus: string;
            if (result) {
              if (status === "closed" || status === "advanced") {
                const adv = await repo.advancements.findByRound(r.id);
                const qualified = adv.some((a) => a.userId === user.id);
                userStatus = qualified ? "qualified" : (adv.length > 0 ? "eliminated" : "result_pending");
              } else {
                userStatus = "submitted";
              }
            } else if (status === "cancelled") {
              userStatus = "cancelled";
            } else if (status === "open" && advanced) {
              userStatus = "active";
            } else if (status === "pending") {
              userStatus = advanced ? "upcoming" : "locked";
            } else {
              userStatus = advanced ? "not_submitted" : "locked";
            }

            return {
              roundId: r.id,
              roundNumber: r.roundNumber,
              eventType: event?.eventType ?? null,
              status,
              userStatus,
              result: result ? { rank: result.rank, ao5Ms: result.ao5Ms, bestSingleMs: result.bestSingleMs } : null,
            };
          }),
      );

      return { registered: true, rounds: roundProgress };
    },
  );

  // Live ranking for a competition event's active round
  app.get<{ Params: { id: string }; Querystring: { event?: string } }>(
    "/api/v1/competitions/:id/live-ranking",
    async (req, reply) => {
      const competition = await repo.competitions.findById(req.params.id);
      if (!competition) return reply.code(404).send({ error: "competition_not_found" });

      const events = await repo.competitionEvents.findByCompetition(competition.id);
      const eventFilter = req.query.event;
      const targetEvent = eventFilter
        ? events.find((e) => e.eventType === eventFilter)
        : events[0];
      if (!targetEvent) return reply.code(404).send({ error: "event_not_found" });

      const rounds = await repo.rounds.findByCompetition(competition.id);
      const eventRounds = rounds
        .filter((r) => r.competitionEventId === targetEvent.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);

      // Find the latest round with results (active or closed)
      let activeRound = eventRounds.find((r) => effectiveRoundStatus(r) === "open");
      if (!activeRound) {
        activeRound = [...eventRounds].reverse().find((r) => {
          const s = effectiveRoundStatus(r);
          return s === "closed" || s === "advanced";
        });
      }
      if (!activeRound) return { roundId: null, roundNumber: null, ranking: [] };

      const results = await repo.results.findByRound(activeRound.id);
      const users = await Promise.all(
        results.map(async (r) => {
          const u = await repo.users.findById(r.userId);
          return {
            userId: r.userId,
            clId: u?.clId ?? r.userId,
            name: u?.name ?? "Unknown",
            rank: r.rank,
            ao5Ms: r.ao5Ms,
            bestSingleMs: r.bestSingleMs,
            flagStatus: r.flagStatus,
          };
        }),
      );

      users.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

      return {
        roundId: activeRound.id,
        roundNumber: activeRound.roundNumber,
        eventType: targetEvent.eventType,
        ranking: users,
      };
    },
  );

  // Event detail page — combines competition, event, rounds, and user progress
  app.get<{ Params: { id: string; eventId: string } }>(
    "/api/v1/competitions/:id/event/:eventId",
    async (req, reply) => {
      const competition = await repo.competitions.findById(req.params.id);
      if (!competition) return reply.code(404).send({ error: "competition_not_found" });

      const effComp = effectiveCompStatus(competition);
      if (effComp === "draft") return reply.code(404).send({ error: "competition_not_found" });

      const events = await repo.competitionEvents.findByCompetition(competition.id);
      const event = events.find((e) => e.id === req.params.eventId);
      if (!event) return reply.code(404).send({ error: "event_not_found" });

      const allRounds = await repo.rounds.findByCompetition(competition.id);
      const eventRounds = allRounds
        .filter((r) => r.competitionEventId === event.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);

      // Count participants for R1 = registrations for this event
      const regs = await repo.registrations.findByCompetition(competition.id);
      const eventRegChecks = await Promise.all(
        regs
          .filter((r) => r.paymentStatus === "paid" || competition.type === "free" || competition.type === "practice")
          .map(async (r) => {
            const evts = await repo.registrations.findEvents(r.id);
            return evts.some((e) => e.id === event.id);
          }),
      );
      const r1Participants = eventRegChecks.filter(Boolean).length;

      const rounds = await Promise.all(
        eventRounds.map(async (r) => {
          const results = await repo.results.findByRound(r.id);
          const advancements = r.roundNumber > 1
            ? await repo.advancements.findByRound(r.id)
            : [];
          return {
            id: r.id,
            roundNumber: r.roundNumber,
            status: effectiveRoundStatus(r),
            opensAt: r.opensAt ?? null,
            closesAt: r.closesAt ?? null,
            advancementCriteria: r.advancementCriteria ?? null,
            resultCount: results.length,
            participantCount: r.roundNumber === 1 ? r1Participants : advancements.length,
          };
        }),
      );

      // User progress (if authenticated)
      let userStatus: { registered: boolean; rounds: unknown[] } | null = null;
      if (req.authClaims?.sub) {
        const user = await repo.users.findById(req.authClaims.sub);
        if (user) {
          const reg = await repo.registrations.findByUserAndComp(user.id, competition.id);
          if (reg) {
            const userResults = await repo.results.findByUser(user.id);
            const roundProgress = await Promise.all(
              eventRounds.map(async (r) => {
                const status = effectiveRoundStatus(r);
                const result = userResults.find((res) => res.roundId === r.id);
                const advanced = r.roundNumber > 1
                  ? await repo.advancements.isAdvanced(r.id, user.id)
                  : true;

                let userRoundStatus: string;
                if (result) {
                  if (status === "closed" || status === "advanced") {
                    const adv = await repo.advancements.findByRound(r.id);
                    const qualified = adv.some((a) => a.userId === user.id);
                    userRoundStatus = qualified ? "qualified" : (adv.length > 0 ? "eliminated" : "result_pending");
                  } else {
                    userRoundStatus = "submitted";
                  }
                } else if (status === "cancelled") {
                  userRoundStatus = "cancelled";
                } else if (status === "open" && advanced) {
                  userRoundStatus = "active";
                } else if (status === "pending") {
                  userRoundStatus = advanced ? "upcoming" : "locked";
                } else {
                  userRoundStatus = advanced ? "not_submitted" : "locked";
                }

                return {
                  roundId: r.id,
                  roundNumber: r.roundNumber,
                  userStatus: userRoundStatus,
                  result: result
                    ? { rank: result.rank, ao5Ms: result.ao5Ms, bestSingleMs: result.bestSingleMs }
                    : null,
                };
              }),
            );
            userStatus = { registered: true, rounds: roundProgress };
          } else {
            userStatus = { registered: false, rounds: [] };
          }
        }
      }

      // Final standings for the last round (top finishers / winners)
      let finalStandings: { rank: number; userId: string; displayName: string }[] | null = null;
      const lastRound = eventRounds[eventRounds.length - 1];
      if (lastRound && effectiveRoundStatus(lastRound) === "advanced") {
        const adv = await repo.advancements.findByRound(lastRound.id);
        if (adv.length > 0) {
          const entries = await Promise.all(
            adv.map(async (a) => {
              const u = await repo.users.findById(a.userId);
              return { rank: a.rank, userId: a.userId, displayName: u?.name ?? u?.wcaId ?? "Unknown" };
            }),
          );
          finalStandings = entries.sort((a, b) => a.rank - b.rank);
        }
      }

      return {
        competition: {
          id: competition.id,
          title: competition.title,
          status: effComp,
          rulesMd: competition.rulesMd ?? null,
          startsAt: competition.startsAt ?? null,
          endsAt: competition.endsAt ?? null,
          type: competition.type,
          cancellationReason: competition.cancellationReason ?? null,
        },
        event: {
          id: event.id,
          eventType: event.eventType,
          roundCount: event.roundCount,
          cutoffMs: event.cutoffMs ?? null,
          timeLimitMs: event.timeLimitMs ?? null,
        },
        rounds,
        userStatus,
        finalStandings,
      };
    },
  );

  // Participant list for a competition
  app.get<{ Params: { id: string } }>(
    "/api/v1/competitions/:id/participants",
    async (req, reply) => {
      const competition = await repo.competitions.findById(req.params.id);
      if (!competition) return reply.code(404).send({ error: "competition_not_found" });

      const regs = await repo.registrations.findByCompetition(competition.id);
      const participants = await Promise.all(
        regs
          .filter((r) => r.paymentStatus === "paid" || competition.type === "free" || competition.type === "practice")
          .map(async (reg) => {
            const u = await repo.users.findById(reg.userId);
            const events = await repo.registrations.findEvents(reg.id);
            return {
              userId: reg.userId,
              clId: u?.clId ?? reg.userId,
              name: u?.name ?? "Unknown",
              city: u?.city ?? null,
              country: u?.country ?? null,
              eventTypes: events.map((e) => e.eventType),
              registeredAt: reg.createdAt,
            };
          }),
      );

      return { count: participants.length, participants };
    },
  );

  // Public rankings — personal bests grouped by event
  app.get<{ Querystring: { event?: string } }>(
    "/api/v1/rankings",
    async (req) => {
      const allPbs = await repo.personalBests.findAll();
      const users = await repo.users.findAll();
      const userMap = new Map(users.map((u) => [u.id, u]));

      const eventFilter = req.query.event;
      const filtered = eventFilter
        ? allPbs.filter((pb) => pb.eventType === eventFilter)
        : allPbs;

      const entries = filtered
        .filter((pb) => pb.bestAo5Ms !== null || pb.bestSingleMs !== null)
        .map((pb) => {
          const u = userMap.get(pb.userId);
          return {
            userId: pb.userId,
            clId: u?.clId ?? pb.userId,
            name: u?.name ?? "Unknown",
            eventType: pb.eventType,
            bestSingleMs: pb.bestSingleMs,
            bestAo5Ms: pb.bestAo5Ms,
          };
        })
        .sort((a, b) => {
          const aVal = a.bestAo5Ms ?? a.bestSingleMs ?? Infinity;
          const bVal = b.bestAo5Ms ?? b.bestSingleMs ?? Infinity;
          return aVal - bVal;
        });

      return entries;
    },
  );
}
