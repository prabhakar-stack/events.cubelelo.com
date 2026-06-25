import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { io as ioClient, type Socket } from "socket.io-client";
import { buildApp } from "../src/app";
import { createDb, seed } from "../src/db/store";
import { createRealtime, type AttachableRealtime } from "../src/sockets/realtime";

let app: FastifyInstance;
let realtime: AttachableRealtime;
let baseUrl: string;
let roundId: string;

beforeAll(async () => {
  const db = createDb();
  await seed(db);
  realtime = createRealtime();
  app = await buildApp(db, realtime);
  await app.ready();
  realtime.attach(app, db);
  await app.listen({ port: 0, host: "127.0.0.1" });

  const { port } = app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  const detail = (await (
    await fetch(`${baseUrl}/api/v1/competitions/demo`)
  ).json()) as { events: { eventType: string; rounds: { id: string }[] }[] };
  roundId = detail.events.find((e) => e.eventType === "333")!.rounds[0]!.id;
});

afterAll(async () => {
  await realtime.close();
  await app.close();
});

function connectAndJoin(): Promise<Socket> {
  return new Promise((resolve) => {
    const socket = ioClient(baseUrl, { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("join", { roundId });
      // Give the server a tick to process the room join before resolving.
      setTimeout(() => resolve(socket), 50);
    });
  });
}

function nextLeaderboard(socket: Socket): Promise<{ roundId: string; board: unknown[] }> {
  return new Promise((resolve) => {
    socket.once("leaderboard:update", resolve);
  });
}

describe("live leaderboard over Socket.io", () => {
  it("broadcasts leaderboard:update to all clients in the round room on submit", async () => {
    const [a, b] = await Promise.all([connectAndJoin(), connectAndJoin()]);
    const updates = Promise.all([nextLeaderboard(a), nextLeaderboard(b)]);

    const res = await fetch(`${baseUrl}/api/v1/rounds/${roundId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "socket-user",
        solves: [8000, 9000, 7000, 10000, 8500].map((t) => ({
          time_ms: t,
          penalty: "none",
        })),
      }),
    });
    expect(res.status).toBe(201);

    const [updateA, updateB] = await updates;
    expect(updateA.roundId).toBe(roundId);
    expect(updateA.board.length).toBe(1);
    expect((updateA.board[0] as { userId: string }).userId).toBe("socket-user");
    // both clients in the room received it
    expect(updateB.board.length).toBe(1);

    a.disconnect();
    b.disconnect();
  });
});
