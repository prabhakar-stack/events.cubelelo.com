import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createMemRepo } from "../src/db/mem-repo";
import { seed, SEED_DEMO_COMP_ID } from "../src/db/seed";
import { adminToken, bearer, devToken } from "./helpers";

let app: FastifyInstance;
let admin: string;

beforeAll(async () => {
  const repo = createMemRepo();
  await seed(repo);
  app = await buildApp(repo);
  admin = await adminToken(app);
});

describe("admin verification queue", () => {
  let resultId: string;

  it("shows empty queue when no flagged results", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/competitions/${SEED_DEMO_COMP_ID}/queue`,
      headers: bearer(admin),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("flags a suspiciously fast result and shows it in queue", async () => {
    const userTok = await devToken(app, "fast@test.com", "Fast Cuber");
    await app.inject({ method: "POST", url: "/api/v1/auth/sync", headers: bearer(userTok) });

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/competitions/${SEED_DEMO_COMP_ID}`,
    });
    const roundId = detail.json().events[0].rounds[0].id;

    // Submit very fast solves (ao5 ~1000ms, well below 3000ms threshold for 333)
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/rounds/${roundId}/results`,
      payload: {
        solves: [
          { time_ms: 900, penalty: "none" },
          { time_ms: 1000, penalty: "none" },
          { time_ms: 1100, penalty: "none" },
          { time_ms: 950, penalty: "none" },
          { time_ms: 1050, penalty: "none" },
        ],
      },
      headers: bearer(userTok),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().flagStatus).toBe("flagged");
    resultId = res.json().id;

    const queue = await app.inject({
      method: "GET",
      url: `/api/v1/admin/competitions/${SEED_DEMO_COMP_ID}/queue`,
      headers: bearer(admin),
    });
    expect(queue.json()).toHaveLength(1);
    expect(queue.json()[0].id).toBe(resultId);
  });

  it("verifies a flagged result and clears the queue", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/results/${resultId}/verify`,
      payload: { action: "verified", reason: "Video confirms legitimacy" },
      headers: bearer(admin),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().flagStatus).toBe("verified");

    // Queue should be empty again
    const queue = await app.inject({
      method: "GET",
      url: `/api/v1/admin/competitions/${SEED_DEMO_COMP_ID}/queue`,
      headers: bearer(admin),
    });
    expect(queue.json()).toEqual([]);
  });
});
