"use client";

import { useEffect, useState } from "react";
import { fetchVerifiedResults, type ResultDto } from "@/lib/api";
import { ResultTable, ResultTableSkeleton } from "./ResultTable";

export function VerifiedResultsPanel({ roundId }: { roundId: string }) {
  const [results, setResults] = useState<ResultDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchVerifiedResults(roundId)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [roundId]);

  if (loading) return <ResultTableSkeleton />;

  if (results.length === 0) {
    return <p className="text-sm text-zinc-500">No verified results yet.</p>;
  }

  return <ResultTable results={results} showFlagStatus={false} />;
}
