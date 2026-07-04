"use client";

import { useEffect, useState } from "react";
import { acquireSocket, releaseSocket } from "./socket";

export function useRoundStatus(
  roundId: string | null,
  initialStatus?: string,
): { status: string; opensAt: string | null } {
  const [status, setStatus] = useState<string>(initialStatus ?? "pending");
  const [opensAt, setOpensAt] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId) return;

    const socket = acquireSocket();
    socket.emit("join", { roundId });
    const handler = (p: { roundId: string; status: string; opensAt?: string }) => {
      if (p.roundId !== roundId) return;
      setStatus(p.status);
      if (p.opensAt !== undefined) setOpensAt(p.opensAt ?? null);
    };
    socket.on("round:status", handler);

    return () => {
      socket.off("round:status", handler);
      releaseSocket();
    };
  }, [roundId]);

  return { status, opensAt };
}
