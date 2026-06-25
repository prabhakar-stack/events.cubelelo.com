"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchLeaderboard, type ResultDto } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Live leaderboard for a round: loads the initial board over REST, then
 * subscribes to `leaderboard:update` for the round room via Socket.io.
 */
export function useLeaderboard(roundId: string | null): ResultDto[] {
  const [board, setBoard] = useState<ResultDto[]>([]);

  useEffect(() => {
    if (!roundId) return;
    let active = true;

    fetchLeaderboard(roundId)
      .then((b) => {
        if (active) setBoard(b);
      })
      .catch(() => {});

    const socket: Socket = io(BASE_URL, { transports: ["websocket"] });
    socket.on("connect", () => socket.emit("join", { roundId }));
    socket.on(
      "leaderboard:update",
      (payload: { roundId: string; board: ResultDto[] }) => {
        if (payload.roundId === roundId) setBoard(payload.board);
      },
    );

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [roundId]);

  return board;
}
