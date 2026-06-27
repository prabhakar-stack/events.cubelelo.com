import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import type { RoundStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import { env } from "../config/env";

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
}

export const noopRealtime: Realtime = {
  emitLeaderboard() {},
  emitRoundStatus() {},
};

export interface AttachableRealtime extends Realtime {
  attach(app: FastifyInstance, repo: Repository): Server;
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

    attach(app, repo) {
      io = new Server(app.server, { cors: { origin: true } });

      // Use Redis pub/sub adapter for horizontal scaling when REDIS_URL is set
      if (env.REDIS_URL) {
        import("@socket.io/redis-adapter").then(({ createAdapter }) =>
          import("ioredis").then(({ default: Redis }) => {
            const pub = new Redis(env.REDIS_URL);
            const sub = pub.duplicate();
            io!.adapter(createAdapter(pub, sub));
            console.log("🔴 Socket.io using Redis adapter");
          }),
        );
      }

      const broadcastRoster = (roundId: string) => {
        io?.to(roomOf(roundId)).emit("lobby:roster", {
          roundId,
          competitors: repo.roster.snapshot(roundId),
        });
      };

      io.on("connection", (socket) => {
        socket.on("join", (payload: { roundId?: string }) => {
          if (payload?.roundId) socket.join(roomOf(payload.roundId));
        });

        socket.on(
          "lobby:checkin",
          (payload: { roundId?: string; userId?: string; name?: string }) => {
            const { roundId, userId } = payload ?? {};
            if (!roundId || !userId) return;
            socket.join(roomOf(roundId));
            socket.data.lobby = { roundId, userId };
            repo.roster.join(roundId, userId, payload.name?.trim() || userId.slice(0, 8));
            broadcastRoster(roundId);
          },
        );

        socket.on("disconnect", () => {
          const lobby = socket.data.lobby as
            | { roundId: string; userId: string }
            | undefined;
          if (!lobby) return;
          repo.roster.leave(lobby.roundId, lobby.userId);
          broadcastRoster(lobby.roundId);
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
