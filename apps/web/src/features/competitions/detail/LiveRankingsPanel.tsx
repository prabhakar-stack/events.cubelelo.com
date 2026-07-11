"use client";

import { useLeaderboard } from "@/features/realtime/useLeaderboard";
import { ResultTable } from "./ResultTable";

export function LiveRankingsPanel({
  roundId,
  roundStatus,
}: {
  roundId: string;
  roundStatus: string;
}) {
  const board = useLeaderboard(roundId);

  if (roundStatus === "pending") {
    return <p className="text-sm text-zinc-500">Waiting for the round to open…</p>;
  }

  if (board.length === 0) {
    return <p className="text-sm text-zinc-500">No results yet.</p>;
  }

  return <ResultTable results={board} showFlagStatus live />;
}
