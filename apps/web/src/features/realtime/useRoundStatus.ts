"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function useRoundStatus(
  roundId: string | null,
  initialStatus?: string,
): { status: string; opensAt: string | null } {
  const [status, setStatus] = useState<string>(initialStatus ?? "pending");
  const [opensAt, setOpensAt] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId) return;

    const socket: Socket = io(BASE_URL, { transports: ["websocket"] });
    socket.on("connect", () => socket.emit("join", { roundId }));
    socket.on(
      "round:status",
      (p: { roundId: string; status: string; opensAt?: string }) => {
        if (p.roundId !== roundId) return;
        setStatus(p.status);
        if (p.opensAt !== undefined) setOpensAt(p.opensAt ?? null);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [roundId]);

  return { status, opensAt };
}
