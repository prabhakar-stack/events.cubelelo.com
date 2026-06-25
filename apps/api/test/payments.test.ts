import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createDb, seed, type Db } from "../src/db/store";
import { adminToken, bearer, devToken } from "./helpers";

let app: FastifyInstance;
let db: Db;
let userToken: string;
let registrationId: string;

beforeAll(async () => {
  db = createDb();
  await seed(db);

  // Make the demo competition paid so we can test payment flow
  const demo = db.competitions.get("demo")!;
  demo.baseFee = 10000; // 100 INR
  demo.perEventFee = 5000; // 50 INR

  app = await buildApp(db);
  userToken = await devToken(app, "payer@test.com", "Payer");
  await app.inject({ method: "POST", url: "/api/v1/auth/sync", headers: bearer(userToken) });

  // Register for the demo competition
  const detail = await app.inject({ method: "GET", url: "/api/v1/competitions/demo" });
  const eventId = detail.json().events[0].id;
  const reg = await app.inject({
    method: "POST",
    url: "/api/v1/competitions/demo/register",
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

  it("confirms payment via webhook", async () => {
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

    // Registration should now be paid
    const reg = db.registrations.get(registrationId)!;
    expect(reg.paymentStatus).toBe("paid");
  });
});
