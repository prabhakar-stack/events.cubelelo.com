import { io, type Socket } from "socket.io-client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "cubers_token";

let instance: Socket | null = null;
let refCount = 0;
let connectedWithToken: string | null = null;

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
