import { randomUUID, createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import type { Payment } from "../../db/types";
import { requireAuth } from "../../auth/plugin";
import { env } from "../../config/env";

function getRazorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  // Dynamic import avoids loading the SDK when keys aren't configured
  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export async function registerPaymentRoutes(
  app: FastifyInstance,
  repo: Repository,
): Promise<void> {
  app.post<{ Body: { registrationId?: string } }>(
    "/api/v1/payments/order",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { registrationId } = req.body ?? {};
      if (!registrationId) return reply.code(400).send({ error: "missing_registration_id" });

      const registration = await repo.registrations.findById(registrationId);
      if (!registration) return reply.code(404).send({ error: "registration_not_found" });

      const user = await repo.users.findById(req.authClaims!.sub);
      if (!user || registration.userId !== user.id)
        return reply.code(403).send({ error: "forbidden" });

      if (registration.paymentStatus === "paid")
        return reply.code(409).send({ error: "already_paid" });

      const [comp, eventCount] = await Promise.all([
        repo.competitions.findById(registration.competitionId),
        repo.registrations.countEvents(registration.id),
      ]);
      const amount = (comp?.baseFee ?? 0) + (comp?.perEventFee ?? 0) * eventCount;

      let orderId: string;
      const rzp = getRazorpay();
      if (rzp) {
        const order = await rzp.orders.create({
          amount,
          currency: "INR",
          receipt: registration.id,
        });
        orderId = order.id as string;
      } else {
        // Dev fallback — no Razorpay keys configured
        orderId = `order_${randomUUID().slice(0, 12)}`;
      }

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
      await repo.payments.create(payment);

      return reply.code(201).send({ orderId, amount, currency: "INR", paymentId: payment.id });
    },
  );

  // Razorpay webhook — verify HMAC signature then confirm payment.
  app.post<{
    Body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
  }>("/api/v1/payments/webhook", async (req, reply) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id)
      return reply.code(400).send({ error: "missing_fields" });

    // Verify Razorpay HMAC signature when webhook secret is configured
    if (env.RAZORPAY_WEBHOOK_SECRET) {
      if (!razorpay_signature) return reply.code(400).send({ error: "missing_signature" });
      const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (expected !== razorpay_signature)
        return reply.code(400).send({ error: "invalid_signature" });
    }

    const payment = await repo.payments.findByOrderId(razorpay_order_id);
    if (!payment) return reply.code(404).send({ error: "payment_not_found" });

    await repo.payments.update(payment.id, {
      razorpayPaymentId: razorpay_payment_id,
      status: "paid",
    });
    await repo.registrations.update(payment.registrationId, { paymentStatus: "paid" });

    return { status: "confirmed" };
  });
}
