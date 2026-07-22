import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import type { Payment } from "../../db/types";
import { requireAuth } from "../../auth/plugin";
import { env } from "../../config/env";
import { generateInvoicePDF, type InvoiceData } from "../../lib/invoice";
import { submitLimiter } from "../../lib/rateLimiter";
import { withTransaction } from "../../db/pool";

async function getRazorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  const { default: Razorpay } = await import("razorpay");
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export async function registerPaymentRoutes(
  app: FastifyInstance,
  repo: Repository,
): Promise<void> {
  app.post<{ Body: { registrationId?: string; promoCode?: string } }>(
    "/api/v1/payments/order",
    { preHandler: [submitLimiter, requireAuth] },
    async (req, reply) => {
      const { registrationId, promoCode } = req.body ?? {};
      if (!registrationId) return reply.code(400).send({ error: "missing_registration_id" });

      const registration = await repo.registrations.findById(registrationId);
      if (!registration) return reply.code(404).send({ error: "registration_not_found" });

      const user = await repo.users.findById(req.authClaims!.sub);
      if (!user || registration.userId !== user.id)
        return reply.code(403).send({ error: "forbidden" });

      if (registration.paymentStatus === "paid")
        return reply.code(409).send({ error: "already_paid" });

      const pendingPayment = await repo.payments.findByRegistration(registration.id);
      if (pendingPayment) {
        return reply.send({
          orderId: pendingPayment.razorpayOrderId,
          amount: pendingPayment.amount,
          currency: pendingPayment.currency,
          paymentId: pendingPayment.id,
        });
      }

      const comp = await repo.competitions.findById(registration.competitionId);
      const regEvents = await repo.registrations.findEvents(registration.id);
      const eventFeeSum = regEvents.reduce(
        (sum, ev) => sum + (ev.fee ?? comp?.perEventFee ?? 0), 0,
      );
      let amount = (comp?.baseFee ?? 0) + eventFeeSum;

      let appliedPromoId: string | undefined;
      if (promoCode) {
        const promo = await repo.promoCodes.findByCode(promoCode.trim().toUpperCase());
        if (!promo || !promo.active) {
          return reply.code(400).send({ error: "invalid_promo_code" });
        }
        if (promo.competitionId && promo.competitionId !== registration.competitionId) {
          return reply.code(400).send({ error: "promo_not_valid_for_competition" });
        }
        if (promo.competitionEventId && !regEvents.some((e) => e.id === promo.competitionEventId)) {
          return reply.code(400).send({ error: "promo_not_for_selected_events" });
        }
        // Competition coupons: valid only while registration is open
        if (promo.type === "competition" && comp) {
          const regOpen = comp.status === "registration_open" || comp.status === "published";
          if (!regOpen) {
            return reply.code(400).send({ error: "promo_registration_closed" });
          }
        }
        // Welcome coupons: only for users who never paid for a competition
        if (promo.type === "welcome") {
          const hasPaid = await repo.registrations.hasPaidRegistration(user.id);
          if (hasPaid) {
            return reply.code(400).send({ error: "promo_welcome_only" });
          }
        }
        // Date-based validity (welcome / general / special coupons)
        if (promo.type !== "competition") {
          const now = new Date().toISOString();
          if ((promo.validFrom && now < promo.validFrom) || (promo.validTo && now > promo.validTo)) {
            return reply.code(400).send({ error: "promo_expired" });
          }
        }
        // Per-user usage limit (welcome coupons: 1 per user)
        if (promo.maxUsesPerUser > 0) {
          const userUses = await repo.promoCodes.userUsageCount(promo.id, user.id);
          if (userUses >= promo.maxUsesPerUser) {
            return reply.code(409).send({ error: "promo_already_used" });
          }
        }
        if (promo.competitionEventId) {
          const targetEvent = regEvents.find((e) => e.id === promo.competitionEventId);
          const eventFee = targetEvent?.fee ?? comp?.perEventFee ?? 0;
          const discount = promo.discountType === "percentage"
            ? Math.round(eventFee * promo.discountValue / 100)
            : Math.min(promo.discountValue, eventFee);
          amount = Math.max(0, amount - discount);
        } else if (promo.discountType === "percentage") {
          amount = Math.max(0, Math.round(amount * (1 - promo.discountValue / 100)));
        } else {
          amount = Math.max(0, amount - promo.discountValue);
        }
        appliedPromoId = promo.id;
      }

      if (amount === 0) {
        const payment: Payment = {
          id: randomUUID(),
          userId: user.id,
          registrationId: registration.id,
          amount: 0,
          currency: "INR",
          promoCodeId: appliedPromoId,
          status: "paid",
          createdAt: new Date().toISOString(),
        };
        await withTransaction(async (client) => {
          if (appliedPromoId) {
            const { rowCount } = await client.query(
              "UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1 AND (max_uses = 0 OR used_count < max_uses)",
              [appliedPromoId],
            );
            if ((rowCount ?? 0) === 0) throw Object.assign(new Error("promo_fully_redeemed"), { statusCode: 409 });
            await client.query(
              "INSERT INTO promo_code_usages (id, promo_code_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
              [randomUUID(), appliedPromoId, user.id],
            );
          }
          await client.query(
            `INSERT INTO payments (id, user_id, registration_id, amount, currency, promo_code_id, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [payment.id, payment.userId, payment.registrationId, payment.amount, payment.currency, payment.promoCodeId ?? null, payment.status, payment.createdAt],
          );
          await client.query(
            "UPDATE registrations SET payment_status = $1 WHERE id = $2",
            ["paid", registration.id],
          );
        });
        return reply.code(201).send({ orderId: null, amount: 0, currency: "INR", paymentId: payment.id, status: "paid" });
      }

      let orderId: string;
      const rzp = await getRazorpay();
      if (rzp) {
        const order = await rzp.orders.create({
          amount,
          currency: "INR",
          receipt: registration.id,
        });
        orderId = order.id as string;
      } else {
        orderId = `order_${randomUUID().slice(0, 12)}`;
      }

      const payment: Payment = {
        id: randomUUID(),
        userId: user.id,
        registrationId: registration.id,
        amount,
        currency: "INR",
        razorpayOrderId: orderId,
        promoCodeId: appliedPromoId,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await withTransaction(async (client) => {
        if (appliedPromoId) {
          const { rowCount } = await client.query(
            "UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1 AND (max_uses = 0 OR used_count < max_uses)",
            [appliedPromoId],
          );
          if ((rowCount ?? 0) === 0) throw Object.assign(new Error("promo_fully_redeemed"), { statusCode: 409 });
          await client.query(
            "INSERT INTO promo_code_usages (id, promo_code_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [randomUUID(), appliedPromoId, user.id],
          );
        }
        await client.query(
          `INSERT INTO payments (id, user_id, registration_id, amount, currency, promo_code_id, status, razorpay_order_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [payment.id, payment.userId, payment.registrationId, payment.amount, payment.currency,
           payment.promoCodeId ?? null, payment.status, payment.razorpayOrderId, payment.createdAt],
        );
      });

      return reply.code(201).send({
        orderId,
        amount,
        currency: "INR",
        paymentId: payment.id,
        keyId: env.RAZORPAY_KEY_ID || null,
      });
    },
  );

  // Client-side checkout verification — uses RAZORPAY_KEY_SECRET (not webhook secret).
  app.post<{
    Body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
  }>(
    "/api/v1/payments/verify",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return reply.code(400).send({ error: "missing_fields" });

      if (!env.RAZORPAY_KEY_SECRET)
        return reply.code(500).send({ error: "razorpay_not_configured" });

      const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature)))
        return reply.code(400).send({ error: "invalid_signature" });

      const payment = await repo.payments.findByOrderId(razorpay_order_id);
      if (!payment) return reply.code(404).send({ error: "payment_not_found" });

      if (payment.userId !== req.authClaims!.sub)
        return reply.code(403).send({ error: "forbidden" });

      if (payment.status === "paid")
        return reply.send({ status: "already_confirmed" });

      const auditId = randomUUID();
      const now = new Date().toISOString();
      await withTransaction(async (client) => {
        await client.query(
          "UPDATE payments SET razorpay_payment_id = $1, status = $2 WHERE id = $3",
          [razorpay_payment_id, "paid", payment.id],
        );
        await client.query(
          "UPDATE registrations SET payment_status = $1 WHERE id = $2",
          ["paid", payment.registrationId],
        );
        await client.query(
          "INSERT INTO audit_log (id, admin_id, action, target, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [auditId, "system", "payment_confirmed", payment.id, `checkout verified: order=${razorpay_order_id} payment=${razorpay_payment_id}`, now],
        );
      });

      return { status: "confirmed" };
    },
  );

  // Razorpay webhook — verify X-Razorpay-Signature header against raw body.
  // Capture raw body for webhook signature verification via a scoped plugin.
  app.register(async (scope) => {
    let rawBodyStore = "";
    scope.addHook("preParsing", async (req, _reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const buf = Buffer.concat(chunks);
      rawBodyStore = buf.toString("utf8");
      (req as unknown as { rawBody: string }).rawBody = rawBodyStore;
      const { Readable } = await import("node:stream");
      return Readable.from(buf);
    });

    scope.post("/api/v1/payments/webhook", async (req, reply) => {
      const rawBody = (req as unknown as { rawBody: string }).rawBody;
      const body = req.body as Record<string, unknown> | undefined;
      if (!body) return reply.code(400).send({ error: "missing_body" });

      const headerSig = req.headers["x-razorpay-signature"] as string | undefined;

    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      return reply.code(500).send({ error: "webhook_secret_not_configured" });
    }

    if (!headerSig) return reply.code(400).send({ error: "missing_signature" });

    const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody ?? "")
      .digest("hex");
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(headerSig)))
      return reply.code(400).send({ error: "invalid_signature" });

    const event = body.event as string | undefined;
    const paymentEntity = (body.payload as Record<string, unknown>)?.payment as Record<string, unknown> | undefined;
    const entity = paymentEntity?.entity as Record<string, unknown> | undefined;

    if (!entity) return reply.code(400).send({ error: "invalid_payload" });

    const rzpOrderId = entity.order_id as string | undefined;
    const rzpPaymentId = entity.id as string | undefined;

    if (!rzpOrderId || !rzpPaymentId)
      return reply.code(400).send({ error: "missing_fields" });

    const payment = await repo.payments.findByOrderId(rzpOrderId);
    if (!payment) return reply.code(404).send({ error: "payment_not_found" });

    if (event === "payment.captured" || event === "order.paid") {
      if (payment.status === "paid") return { status: "already_confirmed" };

      const auditId = randomUUID();
      const now = new Date().toISOString();
      await withTransaction(async (client) => {
        await client.query(
          "UPDATE payments SET razorpay_payment_id = $1, status = $2 WHERE id = $3",
          [rzpPaymentId, "paid", payment.id],
        );
        await client.query(
          "UPDATE registrations SET payment_status = $1 WHERE id = $2",
          ["paid", payment.registrationId],
        );
        await client.query(
          "INSERT INTO audit_log (id, admin_id, action, target, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [auditId, "system", "payment_confirmed", payment.id, `webhook ${event}: order=${rzpOrderId} payment=${rzpPaymentId}`, now],
        );
      });
      return { status: "confirmed" };
    }

    if (event === "payment.failed") {
      if (payment.status === "paid") return { status: "already_paid_ignoring_failure" };
      await withTransaction(async (client) => {
        await client.query(
          "UPDATE payments SET razorpay_payment_id = $1, status = $2 WHERE id = $3",
          [rzpPaymentId, "failed", payment.id],
        );
        await client.query(
          "UPDATE registrations SET payment_status = $1 WHERE id = $2",
          ["failed", payment.registrationId],
        );
      });
      return { status: "marked_failed" };
    }

    return { status: "ignored", event };
    });
  });

  // GST Invoice PDF download
  app.get<{ Params: { id: string } }>(
    "/api/v1/payments/:id/invoice",
    { preHandler: requireAuth },
    async (req, reply) => {
      const payment = await repo.payments.findById(req.params.id);
      if (!payment) return reply.code(404).send({ error: "payment_not_found" });

      if (payment.status !== "paid")
        return reply.code(409).send({ error: "payment_not_completed" });

      const user = await repo.users.findById(payment.userId);
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      // Only the payer or an admin can download
      const requester = await repo.users.findById(req.authClaims!.sub);
      if (!requester || (requester.id !== user.id && requester.role !== "admin"))
        return reply.code(403).send({ error: "forbidden" });

      const reg = await repo.registrations.findById(payment.registrationId);
      const comp = reg ? await repo.competitions.findById(reg.competitionId) : null;
      const regEvents = reg ? await repo.registrations.findEvents(reg.id) : [];

      const hasCustomFees = regEvents.some((e) => e.fee != null);
      const data: InvoiceData = {
        invoiceNumber: `INV-${payment.createdAt.slice(0, 10).replace(/-/g, "")}-${payment.id.slice(0, 8).toUpperCase()}`,
        date: new Date(payment.createdAt).toLocaleDateString("en-IN", {
          year: "numeric", month: "long", day: "numeric",
        }),
        buyerName: user.name,
        buyerEmail: user.email,
        buyerClId: user.clId,
        competitionTitle: comp?.title ?? "Unknown",
        events: regEvents.map((e) => e.eventType),
        baseFee: comp?.baseFee ?? 0,
        perEventFee: comp?.perEventFee ?? 0,
        eventCount: regEvents.length,
        eventFees: hasCustomFees
          ? regEvents.map((e) => ({ name: e.eventType, fee: e.fee ?? comp?.perEventFee ?? 0 }))
          : undefined,
        totalAmount: payment.amount,
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
      };

      const pdf = generateInvoicePDF(data);
      const filename = `invoice_${data.invoiceNumber}.pdf`;

      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`);

      return reply.send(pdf);
    },
  );
}
