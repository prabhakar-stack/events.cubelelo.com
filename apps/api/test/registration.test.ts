import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createDb, seed } from "../src/db/store";
import { adminToken, bearer, devToken } from "./helpers";

let app: FastifyInstance;
let admin: string;
let userToken: string;

beforeAll(async () => {
  const db = createDb();
  await seed(db);
  app = await buildApp(db);
  admin = await adminToken(app);
  userToken = await devToken(app, "cuber@test.com", "Test Cuber");
  await app.inject({ method: "POST", url: "/api/v1/auth/sync", headers: bearer(userToken) });
});

describe("registration flow", () => {
  let eventId: string;

  it("registers for a competition", async () => {
    // Get the demo competition events
    const detail = await app.inject({ method: "GET", url: "/api/v1/competitions/demo" });
    const comp = detail.json();
    eventId = comp.events[0].id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/competitions/demo/register",
      payload: { eventIds: [eventId] },
      headers: bearer(userToken),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.registrationId).toBeDefined();
    expect(body.paymentStatus).toBe("paid"); // free competition
  });

  it("rejects duplicate registration", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/competitions/demo/register",
      payload: { eventIds: [eventId] },
      headers: bearer(userToken),
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects registration with no events", async () => {
    const tok2 = await devToken(app, "noevents@test.com", "No Events");
    await app.inject({ method: "POST", url: "/api/v1/auth/sync", headers: bearer(tok2) });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/competitions/demo/register",
      payload: { eventIds: [] },
      headers: bearer(tok2),
    });
    expect(res.statusCode).toBe(400);
  });

  it("lists my registrations", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me/registrations",
      headers: bearer(userToken),
    });
    expect(res.statusCode).toBe(200);
    const regs = res.json();
    expect(regs).toHaveLength(1);
    expect(regs[0].competitionTitle).toBe("Demo Open");
    expect(regs[0].events).toHaveLength(1);
  });
});
