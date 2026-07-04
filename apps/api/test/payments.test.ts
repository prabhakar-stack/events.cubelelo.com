import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createMemRepo } from "../src/db/mem-repo";
import { seed, SEED_DEMO_COMP_ID } from "../src/db/seed";
import { adminToken, bearer, devToken, syncVerifiedUser } from "./helpers";

let app: FastifyInstance;
let userToken: string;
let registrationId: string;

beforeAll(async () => {
  const repo = createMemRepo();
  await seed(repo);
  app = await buildApp(repo);

  // Make the demo competition paid via admin PATCH
  const admin = await adminToken(app);
  await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/competitions/${SEED_DEMO_COMP_ID}`,
    payload: { baseFee: 10000, perEventFee: 5000 },
    headers: bearer(admin),
  });

  userToken = await devToken(app, "payer@test.com", "Payer");
  await syncVerifiedUser(app, repo, userToken);

  // Register for the demo competition
  const detail = await app.inject({
    method: "GET",
    url: `/api/v1/competitions/${SEED_DEMO_COMP_ID}`,
  });
  const eventId = detail.json().events[0].id;
  const reg = await app.inject({
    method: "POST",
    url: `/api/v1/competitions/${SEED_DEMO_COMP_ID}/register`,
    payload: { eventIds: [eventId] },
    headers: bearer(userToken),
  });
  registrationId = reg.json().registrationId;
});

describe("payment flow", () => {
  let orderId: string;

  it("creates a payment order", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/order",
      payload: { registrationId },
      headers: bearer(userToken),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.orderId).toMatch(/^order_/);
    expect(body.amount).toBe(15000); // 10000 + 5000*1
    orderId = body.orderId;
  });

  it("confirms payment via webhook and updates registration status", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      payload: {
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_test_123",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("confirmed");

    // Verify via the registrations API
    const regs = await app.inject({
      method: "GET",
      url: "/api/v1/me/registrations",
      headers: bearer(userToken),
    });
    const reg = regs.json().find((r: { id: string }) => r.id === registrationId);
    expect(reg?.paymentStatus).toBe("paid");
  });
});
