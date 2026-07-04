import { io, type Socket } from "socket.io-client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let instance: Socket | null = null;
let refCount = 0;

export function acquireSocket(): Socket {
  if (!instance || instance.disconnected) {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("cubers_token")
        : null;
    instance = io(BASE_URL, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
    });
  }
  refCount++;
  return instance;
}

export function releaseSocket(): void {
  refCount--;
  if (refCount <= 0 && instance) {
    instance.disconnect();
    instance = null;
    refCount = 0;
  }
}
