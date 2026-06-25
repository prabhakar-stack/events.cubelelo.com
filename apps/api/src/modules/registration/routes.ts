import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/store";
import { eventsForRegistration } from "../../db/store";
import type { Registration, RegistrationEvent } from "../../db/types";
import { requireAuth } from "../../auth/plugin";

export async function registerRegistrationRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  app.post<{
    Params: { id: string };
    Body: { eventIds?: string[] };
  }>(
    "/api/v1/competitions/:id/register",
    { preHandler: requireAuth },
    async (req, reply) => {
      const comp = db.competitions.get(req.params.id);
      if (!comp) return reply.code(404).send({ error: "competition_not_found" });

      const user = db.users.get(req.authClaims!.sub);
      if (!user) return reply.code(403).send({ error: "not_synced" });

      // Check duplicate
      const existing = [...db.registrations.values()].find(
        (r) => r.userId === user.id && r.competitionId === comp.id,
      );
      if (existing) return reply.code(409).send({ error: "already_registered" });

      const eventIds = req.body?.eventIds;
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return reply.code(400).send({ error: "no_events_selected" });
      }

      // Validate event IDs belong to this competition
      const compEvents = [...db.events.values()].filter(
        (e) => e.competitionId === comp.id,
      );
      const compEventIds = new Set(compEvents.map((e) => e.id));
      for (const eid of eventIds) {
        if (!compEventIds.has(eid)) {
          return reply.code(400).send({ error: "invalid_event_id" });
        }
      }

      const totalFee = comp.baseFee + comp.perEventFee * eventIds.length;
      const isFree = totalFee === 0;

      const registration: Registration = {
        id: randomUUID(),
        userId: user.id,
        competitionId: comp.id,
        paymentStatus: isFree ? "paid" : "pending",
        createdAt: new Date().toISOString(),
      };
      db.registrations.set(registration.id, registration);

      for (const eid of eventIds) {
        const re: RegistrationEvent = {
          registrationId: registration.id,
          competitionEventId: eid,
        };
        db.registrationEvents.push(re);
      }

      return reply.code(201).send({
        registrationId: registration.id,
        totalFee,
        paymentStatus: registration.paymentStatus,
      });
    },
  );

  app.get(
    "/api/v1/me/registrations",
    { preHandler: requireAuth },
    async (req, reply) => {
      const user = db.users.get(req.authClaims!.sub);
      if (!user) return reply.code(403).send({ error: "not_synced" });

      const regs = [...db.registrations.values()].filter(
        (r) => r.userId === user.id,
      );

      return regs.map((r) => {
        const comp = db.competitions.get(r.competitionId);
        const events = eventsForRegistration(db, r.id);
        return {
          id: r.id,
          competitionId: r.competitionId,
          competitionTitle: comp?.title ?? "Unknown",
          paymentStatus: r.paymentStatus,
          events: events.map((e) => ({ id: e.id, eventType: e.eventType })),
          createdAt: r.createdAt,
        };
      });
    },
  );
}
