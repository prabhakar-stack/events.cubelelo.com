import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createDb, seed } from "../src/db/store";
import { adminToken, bearer, devToken } from "./helpers";

let app: FastifyInstance;
let roundId: string;
let admin: string;

beforeAll(async () => {
  const db = createDb();
  await seed(db);
  app = await buildApp(db);
  admin = await adminToken(app);
});

async function getJson(url: string) {
  const res = await app.inject({ method: "GET", url });
  return { status: res.statusCode, body: res.json() };
}
async function postJson(url: string, payload: object, headers?: Record<string, string>) {
  const res = await app.inject({ method: "POST", url, payload, headers });
  return { status: res.statusCode, body: res.json() };
}

async function loginSync(email: string): Promise<{ token: string; clId: string }> {
  const token = await devToken(app, email);
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/sync",
    headers: bearer(token),
  });
  return { token, clId: (res.json() as { clId: string }).clId };
}

describe("health + competitions", () => {
  it("GET /health", async () => {
    expect((await getJson("/health")).body).toEqual({ status: "ok" });
  });

  it("lists the seeded demo competition", async () => {
    const { body } = await getJson("/api/v1/competitions");
    expect(body.some((c: { id: string }) => c.id === "demo")).toBe(true);
  });

  it("returns demo detail with a 3x3 round, and resolves the round id", async () => {
    const { status, body } = await getJson("/api/v1/competitions/demo");
    expect(status).toBe(200);
    const event = body.events.find((e: { eventType: string }) => e.eventType === "333");
    expect(event).toBeTruthy();
    roundId = event.rounds[0].id;
    expect(roundId).toBeTruthy();
  });

  it("404s an unknown competition", async () => {
    expect((await getJson("/api/v1/competitions/nope")).status).toBe(404);
  });
});

describe("server-locked scrambles", () => {
  it("serves 5 scrambles for the open, locked round", async () => {
    const { status, body } = await getJson(`/api/v1/rounds/${roundId}/scramble`);
    expect(status).toBe(200);
    expect(body.scrambles).toHaveLength(5);
    expect(body.scrambles[0].length).toBeGreaterThan(0);
  });

  it("blocks scrambles for a closed round (409), then serves again once reopened", async () => {
    await postJson(`/api/v1/admin/rounds/${roundId}/close`, {}, bearer(admin));
    expect((await getJson(`/api/v1/rounds/${roundId}/scramble`)).status).toBe(409);
    await postJson(`/api/v1/admin/rounds/${roundId}/open`, {}, bearer(admin));
    expect((await getJson(`/api/v1/rounds/${roundId}/scramble`)).status).toBe(200);
  });
});

describe("result submission + ranking", () => {
  it("requires authentication", async () => {
    const res = await postJson(`/api/v1/rounds/${roundId}/results`, {
      solves: [8000, 9000, 7000, 10000, 8500].map((t) => ({ time_ms: t, penalty: "none" })),
    });
    expect(res.status).toBe(401);
  });

  it("keys results by CL ID and ranks the faster competitor first", async () => {
    const slow = await loginSync("slow@x.com");
    const fast = await loginSync("fast@x.com");

    await postJson(
      `/api/v1/rounds/${roundId}/results`,
      { solves: [12000, 13000, 11000, 14000, 12500].map((t) => ({ time_ms: t, penalty: "none" })) },
      bearer(slow.token),
    );
    const fastRes = await postJson(
      `/api/v1/rounds/${roundId}/results`,
      { solves: [8000, 9000, 7000, 10000, 8500].map((t) => ({ time_ms: t, penalty: "none" })) },
      bearer(fast.token),
    );
    expect(fastRes.status).toBe(201);
    expect(fastRes.body.userId).toBe(fast.clId);

    const { body: board } = await getJson(`/api/v1/rounds/${roundId}/results`);
    expect(board[0].userId).toBe(fast.clId);
    expect(board[0].rank).toBe(1);
    expect(board[1].userId).toBe(slow.clId);
    expect(board[1].rank).toBe(2);
  });

  it("rejects malformed solves", async () => {
    const { token } = await loginSync("bad@x.com");
    const res = await postJson(
      `/api/v1/rounds/${roundId}/results`,
      { solves: [{ time_ms: "oops", penalty: "none" }] },
      bearer(token),
    );
    expect(res.status).toBe(400);
  });
});
