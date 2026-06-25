import { randomUUID } from "node:crypto";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/store";
import type { Payment } from "../../db/types";
import { requireAuth } from "../../auth/plugin";
import { env } from "../../config/env";

export async function registerPaymentRoutes(
  app: FastifyInstance,
  db: Db,
): Promise<void> {
  // Create a Razorpay order for a pending registration.
  app.post<{ Body: { registrationId?: string } }>(
    "/api/v1/payments/order",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { registrationId } = req.body ?? {};
      if (!registrationId) return reply.code(400).send({ error: "missing_registration_id" });

      const registration = db.registrations.get(registrationId);
      if (!registration) return reply.code(404).send({ error: "registration_not_found" });

      const user = db.users.get(req.authClaims!.sub);
      if (!user || registration.userId !== user.id) {
        return reply.code(403).send({ error: "forbidden" });
      }

      if (registration.paymentStatus === "paid") {
        return reply.code(409).send({ error: "already_paid" });
      }

      const comp = db.competitions.get(registration.competitionId);
      const eventCount = db.registrationEvents.filter(
        (re) => re.registrationId === registration.id,
      ).length;
      const amount = (comp?.baseFee ?? 0) + (comp?.perEventFee ?? 0) * eventCount;

      // In dev mode, generate a stub order ID. In production, call Razorpay API.
      const orderId = `order_${randomUUID().slice(0, 12)}`;

      const payment: Payment = {
        id: randomUUID(),
        userId: user.id,
        registrationId: registration.id,
        amount,
        currency: "INR",
        razorpayOrderId: orderId,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      db.payments.set(payment.id, payment);

      return reply.code(201).send({
        orderId,
        amount,
        currency: "INR",
        paymentId: payment.id,
      });
    },
  );

  // Razorpay webhook — verify signature and confirm payment.
  app.post<{
    Body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
  }>("/api/v1/payments/webhook", async (req, reply) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id) {
      return reply.code(400).send({ error: "missing_fields" });
    }

    const payment = [...db.payments.values()].find(
      (p) => p.razorpayOrderId === razorpay_order_id,
    );
    if (!payment) return reply.code(404).send({ error: "payment_not_found" });

    // Verify signature (stub: always passes in dev when no webhook secret configured)
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret && razorpay_signature) {
      const expected = createHmac("sha256", webhookSecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (expected !== razorpay_signature) {
        return reply.code(400).send({ error: "invalid_signature" });
      }
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.status = "paid";

    const registration = db.registrations.get(payment.registrationId);
    if (registration) {
      registration.paymentStatus = "paid";
    }

    return { status: "confirmed" };
  });
}
