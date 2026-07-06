"use client";

import { useCallback, useEffect, useState } from "react";
import type { Solve } from "@cubers/types";
import { formatTime, formatSolve } from "@cubers/timer-core";
import {
  fetchJudgeAssignments,
  fetchJudgeRoundResults,
  judgeVerifyResult,
  type JudgeRoundDto,
  type VerificationResultDto,
} from "@/lib/api";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";

export default function JudgeVerificationsPage() {
  const [assignments, setAssignments] = useState<JudgeRoundDto[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [results, setResults] = useState<VerificationResultDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJudgeAssignments()
      .then(setAssignments)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const loadResults = useCallback(async (roundId: string) => {
    if (!roundId) return;
    setLoadingResults(true);
    setError(null);
    try {
      const res = await fetchJudgeRoundResults(roundId);
      setResults(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoundId) loadResults(selectedRoundId);
    else setResults([]);
  }, [selectedRoundId, loadResults]);

  const handleVerify = async (
    resultId: string,
    action: string,
    reason?: string,
    comment?: string,
  ) => {
    setBusy(`verify-${resultId}`);
    try {
      await judgeVerifyResult(resultId, action, reason, comment);
      await loadResults(selectedRoundId);
      // Update assignment stats
      const updated = await fetchJudgeAssignments();
      setAssignments(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const selectedAssignment = assignments.find(
    (a) => a.roundId === selectedRoundId,
  );

  const totalResults = results.length;
  const verifiedCount = results.filter(
    (r) => r.flagStatus === "verified" || r.flagStatus === "plus2" || r.flagStatus === "dnf" || r.flagStatus === "disqualified",
  ).length;
  const flaggedCount = results.filter(
    (r) => r.flagStatus === "flagged",
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
        Assigned Verifications
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        Select a round to review and verify results.
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState icon="🧑‍⚖️" title="No rounds assigned yet" description="Check back once an admin assigns you to a round for verification." />
      ) : (
        <>
          {/* Assignment cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignments.map((a) => {
              const isSelected = selectedRoundId === a.roundId;
              const progress = a.totalResults
                ? Math.round((a.verifiedCount / a.totalResults) * 100)
                : 0;
              return (
                <button
                  key={a.id}
                  onClick={() =>
                    setSelectedRoundId(isSelected ? "" : a.roundId)
                  }
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {a.competitionTitle}
                  </div>
                  <div className="mb-2 text-xs text-zinc-500">
                    {a.eventType} — Round {a.roundNumber} ({a.roundStatus})
                  </div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      {a.verifiedCount}/{a.totalResults} verified
                    </span>
                    <span
                      className={
                        progress === 100
                          ? "font-semibold text-emerald-500"
                          : "text-zinc-400"
                      }
                    >
                      {progress}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress === 100
                          ? "bg-emerald-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected round results */}
          {selectedRoundId && (
            <>
              <div className="mb-4 flex items-center gap-4">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {selectedAssignment?.competitionTitle} —{" "}
                  {selectedAssignment?.eventType} Round{" "}
                  {selectedAssignment?.roundNumber}
                </h2>
                <div className="flex gap-3 text-xs text-zinc-500">
                  <span>
                    Total: <strong>{totalResults}</strong>
                  </span>
                  <span className="text-emerald-500">
                    Verified: <strong>{verifiedCount}</strong>
                  </span>
                  <span className="text-amber-500">
                    Flagged: <strong>{flaggedCount}</strong>
                  </span>
                </div>
              </div>

              {loadingResults ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
                  <p className="text-zinc-500">
                    No results for this round yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results
                    .sort((a, b) => {
                      const order: Record<string, number> = {
                        flagged: 0,
                        clean: 1,
                        verified: 2,
                        plus2: 2,
                        dnf: 2,
                        disqualified: 2,
                      };
                      return (
                        (order[a.flagStatus] ?? 1) -
                        (order[b.flagStatus] ?? 1)
                      );
                    })
                    .map((r) => (
                      <JudgeResultCard
                        key={r.id}
                        result={r}
                        busy={busy}
                        onVerify={handleVerify}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function JudgeResultCard({
  result,
  busy,
  onVerify,
}: {
  result: VerificationResultDto;
  busy: string | null;
  onVerify: (
    id: string,
    action: string,
    reason?: string,
    comment?: string,
  ) => void;
}) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const isBusy = busy === `verify-${result.id}`;
  const isFlagged = result.flagStatus === "flagged";
  const isVerified =
    result.flagStatus === "verified" ||
    result.flagStatus === "plus2" ||
    result.flagStatus === "dnf" ||
    result.flagStatus === "disqualified";

  const handleAction = (action: string) => {
    onVerify(result.id, action, reason.trim() || undefined, comment.trim() || undefined);
    setReason("");
    setComment("");
    setExpanded(false);
  };

  const borderColor = isFlagged
    ? "border-amber-400 dark:border-amber-800"
    : isVerified
      ? "border-emerald-300 dark:border-emerald-900"
      : "border-zinc-200 dark:border-zinc-800";

  return (
    <div
      className={`rounded-xl border ${borderColor} bg-zinc-50 p-5 dark:bg-zinc-900/40`}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {result.userName}
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {result.userClId}
          </span>
          <StatusBadge domain="verification" status={result.flagStatus} />
          {result.rank && (
            <span className="text-xs text-zinc-500">#{result.rank}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {expanded ? "Close" : "Review"}
        </button>
      </div>

      {/* Stats */}
      <div className="mb-3 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-zinc-500">ao5: </span>
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {result.ao5Ms !== null ? formatTime(result.ao5Ms) : "DNF"}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Best: </span>
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {result.bestSingleMs !== null
              ? formatTime(result.bestSingleMs)
              : "DNF"}
          </span>
        </div>
        {result.videoUrl ? (
          <a
            href={result.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline hover:text-blue-400"
          >
            Watch Video
          </a>
        ) : (
          <span className="text-xs text-zinc-400">No video</span>
        )}
      </div>

      {/* Solves */}
      <div className="mb-3">
        <span className="text-xs text-zinc-500">Solves: </span>
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {result.solves.map((s: Solve, i: number) => (
            <span key={i}>
              {i > 0 && ", "}
              {formatSolve(s)}
            </span>
          ))}
        </span>
      </div>

      {/* Verification info */}
      {isVerified && result.verifiedAt && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-900/20">
          <span className="text-emerald-700 dark:text-emerald-400">
            Verified as {result.flagStatus}
          </span>
          {result.verifiedByName && (
            <span className="ml-2 text-zinc-500">
              by {result.verifiedByName}
            </span>
          )}
          {result.verifiedAt && (
            <span className="ml-2 text-zinc-500">
              {new Date(result.verifiedAt).toLocaleString()}
            </span>
          )}
          {result.verificationComment && (
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              &quot;{result.verificationComment}&quot;
            </p>
          )}
        </div>
      )}

      {/* Expanded review area */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Reason (required for +2/DNF/DQ)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Comment (optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAction("verified")}
              disabled={isBusy}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Verify
            </button>
            <button
              onClick={() => handleAction("plus2")}
              disabled={isBusy || !reason.trim()}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              +2
            </button>
            <button
              onClick={() => handleAction("dnf")}
              disabled={isBusy || !reason.trim()}
              className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
            >
              DNF
            </button>
            <button
              onClick={() => handleAction("disqualified")}
              disabled={isBusy || !reason.trim()}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Disqualify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
