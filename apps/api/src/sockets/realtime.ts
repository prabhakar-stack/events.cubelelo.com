import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";

/**
 * Real-time fan-out for live competition data. Routes depend only on this
 * interface; the actual Socket.io server is attached after the HTTP server
 * exists. A no-op default keeps inject-based tests simple.
 *
 * Rooms: `round:{roundId}`. Clients emit `join` with a roundId to subscribe.
 * Single-process for now — add @socket.io/redis-adapter for horizontal scale
 * once Redis is provisioned (ARCHITECTURE §5).
 */
export interface Realtime {
  emitLeaderboard(roundId: string, board: unknown): void;
}

export const noopRealtime: Realtime = {
  emitLeaderboard() {},
};

export interface AttachableRealtime extends Realtime {
  attach(app: FastifyInstance): Server;
  close(): Promise<void>;
}

export function createRealtime(): AttachableRealtime {
  let io: Server | null = null;
  return {
    emitLeaderboard(roundId, board) {
      io?.to(`round:${roundId}`).emit("leaderboard:update", { roundId, board });
    },
    attach(app) {
      io = new Server(app.server, { cors: { origin: true } });
      io.on("connection", (socket) => {
        socket.on("join", (payload: { roundId?: string }) => {
          if (payload?.roundId) socket.join(`round:${payload.roundId}`);
        });
      });
      return io;
    },
    async close() {
      await io?.close();
      io = null;
    },
  };
}
