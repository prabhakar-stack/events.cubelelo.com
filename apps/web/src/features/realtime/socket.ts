import { io, type Socket } from "socket.io-client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "cubers_token";

let instance: Socket | null = null;
let refCount = 0;
let connectedWithToken: string | null = null;

const joinedRooms = new Map<string, number>();

function rejoinRooms(socket: Socket): void {
  for (const roundId of joinedRooms.keys()) {
    socket.emit("join", { roundId });
  }
}

export function trackJoin(roundId: string): void {
  joinedRooms.set(roundId, (joinedRooms.get(roundId) ?? 0) + 1);
}

export function trackLeave(roundId: string): void {
  const count = joinedRooms.get(roundId) ?? 0;
  if (count <= 1) {
    joinedRooms.delete(roundId);
  } else {
    joinedRooms.set(roundId, count - 1);
  }
}

export function acquireSocket(): Socket {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null;

  if (instance && !instance.disconnected && connectedWithToken !== token) {
    instance.disconnect();
    instance = null;
    refCount = 0;
  }

  if (!instance || instance.disconnected) {
    connectedWithToken = token;
    instance = io(BASE_URL, {
      transports: ["websocket"],
      auth: (cb) => {
        cb(token ? { token } : {});
      },
    });
    instance.on("connect", () => {
      if (instance) rejoinRooms(instance);
    });
  }
  refCount++;
  return instance;
}

export function releaseSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && instance) {
    instance.disconnect();
    instance = null;
    connectedWithToken = null;
    refCount = 0;
    joinedRooms.clear();
  }
}

export function reconnectSocket(): void {
  if (instance) {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(TOKEN_KEY)
        : null;
    connectedWithToken = token;
    instance.disconnect();
    instance.connect();
  }
}
