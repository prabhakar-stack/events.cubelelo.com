import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { io as ioClient, type Socket } from "socket.io-client";
import { buildApp } from "../src/app";
import { createMemRepo } from "../src/db/mem-repo";
import { seed, SEED_DEMO_COMP_ID, SEED_ADMIN_EMAIL } from "../src/db/seed";
import { createRealtime, type AttachableRealtime } from "../src/sockets/realtime";
import { devTokenHttp } from "./helpers";

let app: FastifyInstance;
let realtime: AttachableRealtime;
let baseUrl: string;
let roundId: string;
let adminAuth: { authorization: string };

beforeAll(async () => {
  const repo = createMemRepo();
  await seed(repo);
  realtime = createRealtime();
  app = await buildApp(repo, realtime);
  await app.ready();
  realtime.attach(app, repo);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { port } = app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  const detail = (await (
    await fetch(`${baseUrl}/api/v1/competitions/${SEED_DEMO_COMP_ID}`)
  ).json()) as { events: { eventType: string; rounds: { id: string }[] }[] };
  roundId = detail.events.find((e) => e.eventType === "333")!.rounds[0]!.id;

  const token = await devTokenHttp(baseUrl, SEED_ADMIN_EMAIL);
  adminAuth = { authorization: `Bearer ${token}` };
});

afterAll(async () => {
  await realtime.close();
  await app.close();
});

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve as (v: T) => void));
}

describe("competition lobby", () => {
  it("serves a lobby snapshot with rules", async () => {
    const lobby = (await (
      await fetch(`${baseUrl}/api/v1/rounds/${roundId}/lobby`)
    ).json()) as { competition: { rulesMd: string | null }; roster: unknown[] };
    expect(lobby.competition.rulesMd).toContain("WCA");
    expect(Array.isArray(lobby.roster)).toBe(true);
  });

  it("broadcasts the roster as competitors check in", async () => {
    const a = ioClient(baseUrl, { transports: ["websocket"] });
    await once(a, "connect");

    const aliceEcho = once<{ competitors: unknown[] }>(a, "lobby:roster");
    a.emit("lobby:checkin", { roundId, userId: "alice", name: "Alice" });
    expect((await aliceEcho).competitors.length).toBe(1);

    const afterBob = once<{ competitors: unknown[] }>(a, "lobby:roster");
    const b = ioClient(baseUrl, { transports: ["websocket"] });
    await once(b, "connect");
    b.emit("lobby:checkin", { roundId, userId: "bob", name: "Bob" });

    expect((await afterBob).competitors.length).toBe(2);

    a.disconnect();
    b.disconnect();
  });

  it("pushes round:status to the room when the round opens/closes", async () => {
    const c = ioClient(baseUrl, { transports: ["websocket"] });
    await once(c, "connect");
    c.emit("join", { roundId });
    await new Promise((r) => setTimeout(r, 50));

    const closed = once<{ status: string }>(c, "round:status");
    await fetch(`${baseUrl}/api/v1/admin/rounds/${roundId}/close`, {
      method: "POST",
      headers: adminAuth,
    });
    expect((await closed).status).toBe("closed");

    const opened = once<{ status: string }>(c, "round:status");
    await fetch(`${baseUrl}/api/v1/admin/rounds/${roundId}/open`, {
      method: "POST",
      headers: adminAuth,
    });
    expect((await opened).status).toBe("open");

    c.disconnect();
  });
});
