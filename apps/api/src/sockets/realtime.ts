import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import type { RoundStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import { env } from "../config/env";
import { createVerifier } from "../auth/verifier";

/**
 * Real-time fan-out for live competition data. Routes depend only on this
 * interface; the actual Socket.io server is attached after the HTTP server
 * exists. A no-op default keeps inject-based tests simple.
 *
 * Rooms: `round:{roundId}`. Clients emit `join` (spectate) or `lobby:checkin`
 * (appear in the roster) with a roundId. Single-process for now — add
 * @socket.io/redis-adapter for horizontal scale once Redis is provisioned.
 */
export interface Realtime {
  emitLeaderboard(roundId: string, board: unknown): void;
  emitRoundStatus(roundId: string, status: RoundStatus, opensAt?: string): void;
  emitCompStatus(compId: string, status: string): void;
}

export const noopRealtime: Realtime = {
  emitLeaderboard() {},
  emitRoundStatus() {},
  emitCompStatus() {},
};

export interface AttachableRealtime extends Realtime {
  attach(app: FastifyInstance, repo: Repository): Promise<Server>;
  close(): Promise<void>;
}

export function createRealtime(): AttachableRealtime {
  let io: Server | null = null;
  const roomOf = (roundId: string) => `round:${roundId}`;

  return {
    emitLeaderboard(roundId, board) {
      io?.to(roomOf(roundId)).emit("leaderboard:update", { roundId, board });
    },

    emitRoundStatus(roundId, status, opensAt) {
      io?.to(roomOf(roundId)).emit("round:status", { roundId, status, opensAt });
    },

    emitCompStatus(compId, status) {
      io?.to(`comp:${compId}`).emit("comp:status", { compId, status });
    },

    async attach(app, repo) {
      const corsOrigin = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",")
        : true;
      io = new Server(app.server, { cors: { origin: corsOrigin } });

      // Use Redis pub/sub adapter for horizontal scaling when REDIS_URL is set
      if (env.REDIS_URL) {
        try {
          const { createAdapter } = await import("@socket.io/redis-adapter");
          const { default: Redis } = await import("ioredis");
          const pub = new Redis(env.REDIS_URL);
          const sub = pub.duplicate();
          io.adapter(createAdapter(pub, sub));
          console.log("Socket.io using Redis adapter");
        } catch (err) {
          console.error("Socket.io Redis adapter failed:", err);
        }
      }

      const broadcastRoster = async (roundId: string) => {
        io?.to(roomOf(roundId)).emit("lobby:roster", {
          roundId,
          competitors: await repo.roster.snapshot(roundId),
        });
      };

      const verifier = createVerifier();
      io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          socket.data.authClaims = null;
          return next();
        }
        try {
          socket.data.authClaims = await verifier.verify(token);
        } catch {
          socket.data.authClaims = null;
        }
        next();
      });

      io.on("connection", (socket) => {
        socket.on("join", (payload: { roundId?: string; compId?: string }) => {
          if (payload?.roundId) socket.join(roomOf(payload.roundId));
          if (payload?.compId) socket.join(`comp:${payload.compId}`);
        });

        socket.on(
          "lobby:checkin",
          async (payload: { roundId?: string; name?: string }) => {
            const claims = socket.data.authClaims;
            if (!claims) return;
            const { roundId } = payload ?? {};
            if (!roundId) return;
            socket.join(roomOf(roundId));
            socket.data.lobby = { roundId, userId: claims.sub };
            const user = await repo.users.findById(claims.sub);
            await repo.roster.join(roundId, claims.sub, payload.name?.trim() || user?.name || claims.name || claims.sub.slice(0, 8));
            await broadcastRoster(roundId);
          },
        );

        socket.on("disconnect", async () => {
          const lobby = socket.data.lobby as
            | { roundId: string; userId: string }
            | undefined;
          if (!lobby) return;
          await repo.roster.leave(lobby.roundId, lobby.userId);
          await broadcastRoster(lobby.roundId);
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
