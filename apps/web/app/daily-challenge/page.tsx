"use client";

import { useEffect, useState, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  fetchDailyChallenge,
  submitDailyChallenge,
  type DailyChallengeResponse,
  type DailyChallengeResultDto,
} from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { useTimer } from "@/features/timer/useTimer";
import { TimerDisplay } from "@/features/timer/TimerDisplay";
import { TwistyPlayer } from "@/features/scramble/TwistyPlayer";
import { eventDisplayName } from "@/lib/eventNames";
import { CountUp } from "@/components/CountUp";
import Link from "next/link";

export default function DailyChallengePage() {
  const [data, setData] = useState<DailyChallengeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [justSubmittedRank, setJustSubmittedRank] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const { snapshot, down, up, reset } = useTimer({ useInspection: true });

  useEffect(() => {
    fetchDailyChallenge()
      .then(setData)
      .catch(() => setError("Failed to load daily challenge"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!snapshot.result || !data) return;
    setSubmitting(true);
    try {
      const worstPenalty = snapshot.result.inspectionPenalty === "dnf" || snapshot.result.penalty === "dnf"
        ? "dnf"
        : snapshot.result.inspectionPenalty === "plus2" || snapshot.result.penalty === "plus2"
          ? "plus2"
          : undefined;
      const { result, streak } = await submitDailyChallenge(snapshot.result.time_ms, worstPenalty);
      const newLeaderboard = [...data.leaderboard, result].sort((a, b) => a.timeMs - b.timeMs);
      const rank = newLeaderboard.findIndex((r) => r.id === result.id) + 1;

      setData((prev) =>
        prev
          ? {
            ...prev,
            userResult: result,
            streak,
            leaderboard: newLeaderboard,
          }
          : prev,
      );
      setJustSubmittedRank(rank);

      if (!worstPenalty) {
        if (rank === 1) confetti({ colors: ["#fbbf24", "#00d4aa"], particleCount: 150, spread: 80 });
        else if (rank <= 3) confetti({ particleCount: 90, spread: 65 });
      }

      reset();
    } catch (err: any) {
      if (err?.message?.includes("409")) setError("You already submitted today!");
      else setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }, [snapshot.result, data, reset]);


  const handleShare = useCallback(async () => {
    if (!data || !data.userResult) return;
    const text = `I solved today's ${eventDisplayName(data.challenge.eventType)} in ${formatTime(data.userResult.timeMs)}! #CubeleloDaily`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  }, [data]);

  // Keyboard controls
  useEffect(() => {
    if (!data || data.userResult) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (snapshot.phase === "solving") { e.preventDefault(); down(); return; }
      if (e.code === "Space") { e.preventDefault(); down(); }
      if (e.key === "Escape") reset();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); up(); }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [snapshot.phase, down, up, reset, data]);

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-zinc-500">Loading...</main>;
  if (error && !data) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-red-500">{error}</main>;
  if (!data) return null;

  const { challenge, userResult, streak, leaderboard } = data;
  const alreadyDone = !!userResult;

  const focusMode = snapshot.phase === "inspection" || snapshot.phase === "ready" || snapshot.phase === "solving";

  if (focusMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center select-none">
        <TimerDisplay snapshot={snapshot} />
        <p className="mt-4 text-sm text-zinc-500">{instruction(snapshot.phase)}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/practice" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">&larr; Practice</Link>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Daily Challenge</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {challenge.date} &middot; {eventDisplayName(challenge.eventType)}
        </p>
        {streak > 0 && (
          <p className="mt-2 font-semibold text-accent-warn">
            🔥 <CountUp value={streak} duration={600} /> day streak!
          </p>
        )}
      </div>

      {error && <p className="mb-4 text-center text-sm text-red-500">{error}</p>}

      {/* Scramble */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Scramble</div>
        <p className="font-mono text-lg leading-relaxed">{challenge.scramble}</p>
      </div>

      {/* Visualizer */}
      <div className="mb-6 flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <TwistyPlayer puzzle="3x3x3" scramble={challenge.scramble} className="h-48 w-full sm:h-64" />
      </div>

      {/* Timer / Result */}
      {alreadyDone ? (
        <div className="fade-slide-in mb-8 rounded-xl border border-emerald-500/30 bg-emerald-50 p-6 text-center dark:bg-emerald-900/10">
          <p className="text-sm text-zinc-500">Your time today</p>
          <p className="font-mono text-5xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatTime(userResult.timeMs)}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Submitted {new Date(userResult.submittedAt).toLocaleTimeString()}
          </p>
          {justSubmittedRank !== null && (
            <p className="mt-3 text-lg font-semibold text-accent-gold">
              {justSubmittedRank === 1 ? "🏆" : justSubmittedRank <= 3 ? "🎉" : "📍"} You placed #{justSubmittedRank} today!
            </p>
          )}
          <button
            onClick={handleShare}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/10 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-600/20 dark:text-emerald-400"
          >
            {shareCopied ? "Copied to clipboard! ✓" : "Share your time →"}
          </button>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <TimerDisplay snapshot={snapshot} />
          {snapshot.phase === "stopped" && snapshot.result ? (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Time"}
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:border-zinc-700 dark:hover:text-zinc-300"
              >
                Retry
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">{instruction(snapshot.phase)}</p>
          )}
          <p className="mt-3 text-xs text-amber-500">You get one submission per day. Practice in the terminal first!</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Today&apos;s Leaderboard</h2>
        </div>
        {leaderboard.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No submissions yet. Be the first!</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-100 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`row-count-in border-b border-zinc-100 dark:border-zinc-800 ${r.userId === userResult?.userId ? "bg-accent-primary/10 shadow-[inset_0_0_0_1px_var(--accent-primary)]" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
                  >
                    <td className="px-4 py-2 font-medium">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-2">
                      {r.name || r.clId || "Anonymous"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-medium">
                      {formatTime(r.timeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}


function instruction(phase: string): string {
  switch (phase) {
    case "idle": return "click space to begin inspection";
    case "inspection": return "Hold Space to arm — release to start";
    case "ready": return "Release to start solving";
    case "solving": return "Press any key to stop";
    default: return "";
  }
}
