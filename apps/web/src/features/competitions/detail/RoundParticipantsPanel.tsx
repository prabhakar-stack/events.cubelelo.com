"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard, type ResultDto } from "@/lib/api";
import { ResultTable, ResultTableSkeleton } from "./ResultTable";

export function RoundParticipantsPanel({
  roundId,
  roundStatus,
}: {
  roundId: string;
  roundStatus: string;
}) {
  const [results, setResults] = useState<ResultDto[]>([]);
  const [loading, setLoading] = useState(true);

  const showResults =
    roundStatus === "closed" ||
    roundStatus === "advanced" ||
    roundStatus === "cancelled";

  useEffect(() => {
    if (!showResults) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchLeaderboard(roundId)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [roundId, showResults]);

  if (!showResults) {
    return (
      <p className="text-sm text-zinc-500">
        Participants will be shown after the round closes.
      </p>
    );
  }

  if (loading) return <ResultTableSkeleton />;

  if (results.length === 0) {
    return <p className="text-sm text-zinc-500">No participants found.</p>;
  }

  return <ResultTable results={results} showFlagStatus={false} />;
}
