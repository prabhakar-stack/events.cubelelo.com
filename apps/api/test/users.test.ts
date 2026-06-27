import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createMemRepo } from "../src/db/mem-repo";
import { seed } from "../src/db/seed";
import { bearer, devToken } from "./helpers";

let app: FastifyInstance;
let userToken: string;
let clId: string;

beforeAll(async () => {
  const repo = createMemRepo();
  await seed(repo);
  app = await buildApp(repo);
  userToken = await devToken(app, "profile@test.com", "Profile User");
  const sync = await app.inject({
    method: "POST",
    url: "/api/v1/auth/sync",
    headers: bearer(userToken),
  });
  clId = sync.json().clId;
});

describe("user profile", () => {
  it("fetches public profile by CL ID", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/users/${clId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.clId).toBe(clId);
    expect(body.name).toBe("Profile User");
    expect(body.competitionHistory).toBeDefined();
    expect(body.personalBests).toBeDefined();
  });

  it("returns 404 for unknown CL ID", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/users/CL-9999-0000" });
    expect(res.statusCode).toBe(404);
  });

  it("updates own profile", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      payload: { city: "Mumbai", instagram: "@cuber" },
      headers: bearer(userToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().city).toBe("Mumbai");
    expect(res.json().instagram).toBe("@cuber");
  });
});
