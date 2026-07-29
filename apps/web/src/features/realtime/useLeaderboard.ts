"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard, type ResultDto } from "@/lib/api";
import { acquireSocket, releaseSocket, trackJoin, trackLeave } from "./socket";

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

    const socket = acquireSocket();
    socket.emit("join", { roundId });
    trackJoin(roundId);
    const handler = (payload: { roundId: string; board: ResultDto[] }) => {
      if (payload.roundId === roundId) setBoard(payload.board);
    };
    socket.on("leaderboard:update", handler);

    return () => {
      active = false;
      socket.off("leaderboard:update", handler);
      trackLeave(roundId);
      releaseSocket();
    };
  }, [roundId]);

  return board;
}
