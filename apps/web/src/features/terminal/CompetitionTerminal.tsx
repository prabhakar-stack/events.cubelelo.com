"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getEvent, isEventId, type EventId } from "@cubers/scramble-core";
import { ao5, formatSolve, formatTime } from "@cubers/timer-core";
import type { Solve, SolvePenalty } from "@cubers/types";
import Link from "next/link";
import { useTimer } from "@/features/timer/useTimer";
import { TwistyPlayer } from "@/features/scramble/TwistyPlayer";
import { useLeaderboard } from "@/features/realtime/useLeaderboard";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  fetchCompetition,
  fetchScramble,
  submitResult,
  type ResultDto,
} from "@/lib/api";

const SOLVES_PER_ROUND = 5;

interface CompetitionTerminalProps {
  competitionId: string;
  round: string;
  eventId: EventId;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; roundId: string; eventType: EventId; scrambles: string[] };

export function CompetitionTerminal({
  competitionId,
  round,
  eventId,
}: CompetitionTerminalProps) {
  const { snapshot, down, up, reset } = useTimer({ useInspection: true });

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [index, setIndex] = useState(0);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [pendingPenalty, setPendingPenalty] = useState<SolvePenalty>("none");
  const [scrambleStep, setScrambleStep] = useState(0);

  const { user } = useAuth();
  const userId = user?.clId ?? "guest";
  const [videoUrl, setVideoUrl] = useState("");
  const [submit, setSubmit] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "done"; rank: number | null }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const comp = await fetchCompetition(competitionId);
        const ev =
          comp.events.find((e) => e.eventType === eventId) ?? comp.events[0];
        const rnd =
          ev?.rounds.find((r) => r.roundNumber === Number(round)) ?? ev?.rounds[0];
        if (!ev || !rnd) throw new Error("Round not found");
        const sc = await fetchScramble(rnd.id);
        if (!active) return;
        setLoad({
          kind: "ready",
          roundId: rnd.id,
          eventType: isEventId(ev.eventType) ? ev.eventType : "333",
          scrambles: sc.scrambles,
        });
      } catch (e) {
        if (active) {
          setLoad({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [competitionId, round, eventId]);

  useEffect(() => {
    if (snapshot.phase === "stopped" && snapshot.result) {
      setPendingPenalty(snapshot.result.penalty);
    }
  }, [snapshot.phase, snapshot.result]);

  const roundComplete = solves.length >= SOLVES_PER_ROUND;

  const currentScramble = load.kind === "ready" ? (load.scrambles[index] ?? "") : "";
  const scrambleMoves = useMemo(() => currentScramble.trim().split(/\s+/).filter(Boolean), [currentScramble]);
  const totalSteps = scrambleMoves.length;

  useEffect(() => {
    setScrambleStep(totalSteps);
  }, [totalSteps]);

  const visibleScrambleAlg = useMemo(
    () => scrambleMoves.slice(0, scrambleStep).join(" "),
    [scrambleMoves, scrambleStep],
  );

  useEffect(() => {
    if (load.kind !== "ready" || roundComplete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (snapshot.phase === "solving") {
        e.preventDefault();
        down();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        down();
      } else if (e.key === "Escape") {
        reset();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        up();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [load.kind, roundComplete, snapshot.phase, down, up, reset]);

  const confirmSolve = useCallback(() => {
    if (!snapshot.result) return;
    setSolves((prev) => [
      ...prev,
      { time_ms: snapshot.result!.time_ms, penalty: pendingPenalty },
    ]);
    setIndex((i) => Math.min(i + 1, SOLVES_PER_ROUND - 1));
    reset();
  }, [snapshot.result, pendingPenalty, reset]);

  const handleSubmit = useCallback(async () => {
    if (load.kind !== "ready") return;
    setSubmit({ kind: "submitting" });
    try {
      const result = await submitResult(load.roundId, {
        solves,
        videoUrl: videoUrl.trim() || undefined,
      });
      setSubmit({ kind: "done", rank: result.rank });
    } catch (e) {
      setSubmit({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [load, solves, videoUrl]);

  const onPointerDown = useCallback(() => {
    if (snapshot.phase === "stopped" || roundComplete) return;
    down();
  }, [snapshot.phase, roundComplete, down]);
  const onPointerUp = useCallback(() => {
    if (snapshot.phase === "stopped" || roundComplete) return;
    up();
  }, [snapshot.phase, roundComplete, up]);

  const runningAo5 = ao5(solves);
  const focusMode = snapshot.phase === "inspection" || snapshot.phase === "ready" || snapshot.phase === "solving";

  const event = useMemo(
    () => getEvent(load.kind === "ready" ? load.eventType : eventId),
    [load, eventId],
  );

  const liveBoard = useLeaderboard(load.kind === "ready" ? load.roundId : null);

  if (load.kind === "loading") {
    return <CenterMessage>Loading round…</CenterMessage>;
  }
  if (load.kind === "error") {
    return (
      <CenterMessage>
        <div className="space-y-2 text-center">
          <p className="text-red-400">Could not load this round.</p>
          <p className="font-mono text-xs text-zinc-500">{load.message}</p>
          <p className="text-sm text-zinc-500">
            Is the API running on the configured URL?
          </p>
        </div>
      </CenterMessage>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 select-none">
      {/* ── Locked header ── */}
      <header className="pointer-events-none flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs uppercase tracking-wide text-zinc-400">
            {competitionId}
          </span>
          <span className="font-semibold">{event.name}</span>
          <span className="text-zinc-500">Round {round}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Solve</span>
          <span className="font-mono font-semibold">
            {Math.min(index + 1, SOLVES_PER_ROUND)} / {SOLVES_PER_ROUND}
          </span>
        </div>
      </header>

      {roundComplete ? (
        <RoundComplete
          finalAo5={runningAo5}
          solves={solves}
          submit={submit}
          videoUrl={videoUrl}
          setVideoUrl={setVideoUrl}
          onSubmit={handleSubmit}
          userId={userId}
          board={liveBoard}
          signedIn={Boolean(user)}
        />
      ) : focusMode ? (
        /* ── Full-screen timer (inspection / ready / solving) ── */
        <div
          className="flex flex-1 flex-col items-center justify-center gap-4 px-6"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <TimerDisplay snapshot={snapshot} pendingPenalty={pendingPenalty} />
          <p className="text-sm text-zinc-500">{instruction(snapshot.phase)}</p>
        </div>
      ) : (
        <>
          {/* ══════ TOP: info panel ══════ */}
          <div className="flex-shrink-0">
            {/* Scramble text — locked, no select/copy */}
            <div className="flex items-start gap-3 border-b border-zinc-800 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Scramble
                </div>
                <div
                  className="mt-1 font-mono text-lg leading-relaxed text-zinc-200"
                  style={{ userSelect: "none", WebkitUserSelect: "none" }}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                >
                  {scrambleMoves.map((move, i) => (
                    <span
                      key={i}
                      className={
                        i < scrambleStep
                          ? "text-zinc-200"
                          : "text-zinc-600"
                      }
                    >
                      {move}
                      {i < scrambleMoves.length - 1 ? " " : ""}
                    </span>
                  ))}
                </div>
              </div>
              {/* Prev / Next step controls */}
              <div className="flex flex-col gap-1 pt-5">
                <button
                  onClick={() => setScrambleStep((s) => Math.max(0, s - 1))}
                  disabled={scrambleStep <= 0}
                  className="rounded border border-zinc-700 px-4 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-30"
                >
                  prev
                </button>
                <button
                  onClick={() => setScrambleStep((s) => Math.min(totalSteps, s + 1))}
                  disabled={scrambleStep >= totalSteps}
                  className="rounded border border-zinc-700 px-4 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-30"
                >
                  next
                </button>
              </div>
            </div>

            {/* 2D visualizer + solve status grid */}
            <div className="grid grid-cols-1 gap-6 px-6 pb-4 pt-4 md:grid-cols-2">
              {/* 2D scramble visualizer — shows state at current step */}
              <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <TwistyPlayer
                  puzzle={event.puzzle}
                  scramble={visibleScrambleAlg}
                  className="h-64 w-full"
                />
              </div>

              {/* Solve status for this round */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                {/* Progress bar — scoped to solves panel */}
                <div className="mb-3">
                  <ProgressBar current={solves.length} total={SOLVES_PER_ROUND} />
                </div>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">This round</span>
                  <span className="text-zinc-400">
                    ao5:{" "}
                    <span className="font-mono text-zinc-100">
                      {runningAo5 === null ? "—" : formatTime(runningAo5)}
                    </span>
                  </span>
                </div>
                <ol className="space-y-1 font-mono text-sm">
                  {Array.from({ length: SOLVES_PER_ROUND }).map((_, i) => (
                    <li
                      key={i}
                      className={`flex justify-between rounded px-2 py-1 ${
                        i === index ? "bg-zinc-800/60" : ""
                      }`}
                    >
                      <span className="text-zinc-500">Solve {i + 1}</span>
                      <span className={solves[i] ? "text-zinc-100" : "text-zinc-700"}>
                        {solves[i] ? formatSolve(solves[i]!) : "—"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* ══════ DIVIDER ══════ */}
          <div className="border-t border-zinc-800" />

          {/* ══════ BOTTOM: timer area ══════ */}
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <TimerDisplay snapshot={snapshot} pendingPenalty={pendingPenalty} />
            {snapshot.phase === "stopped" ? (
              <div className="flex items-center gap-3">
                <PenaltyButtons value={pendingPenalty} onChange={setPendingPenalty} />
                <button
                  onClick={confirmSolve}
                  className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-500"
                >
                  {index + 1 >= SOLVES_PER_ROUND ? "Confirm & Finish" : "Confirm & Next"}
                </button>
              </div>
            ) : (
              <p className="h-10 text-center text-sm text-zinc-500">
                {instruction(snapshot.phase)}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Progress bar ── */
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-zinc-500">
        {current}/{total}
      </span>
    </div>
  );
}

/* ── Instruction text ── */
function instruction(phase: string): string {
  switch (phase) {
    case "idle":
      return "Hold Space to begin inspection";
    case "inspection":
      return "Hold Space to arm — release to start";
    case "ready":
      return "Release Space bar to start solving";
    case "solving":
      return "Press any key to stop";
    default:
      return "";
  }
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      {children}
    </div>
  );
}

function RoundComplete({
  finalAo5,
  solves,
  submit,
  videoUrl,
  setVideoUrl,
  onSubmit,
  userId,
  board,
  signedIn,
}: {
  finalAo5: number | null;
  solves: Solve[];
  submit:
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "done"; rank: number | null }
    | { kind: "error"; message: string };
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  onSubmit: () => void;
  userId: string;
  board: ResultDto[];
  signedIn: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <div className="text-sm uppercase tracking-wider text-zinc-500">Final ao5</div>
        <div className="font-mono text-7xl font-bold text-emerald-400">
          {finalAo5 === null ? "DNF" : formatTime(finalAo5)}
        </div>
        <div className="mt-2 font-mono text-sm text-zinc-500">
          {solves.map((s) => formatSolve(s)).join("   ")}
        </div>
      </div>

      {submit.kind === "done" ? (
        <div className="text-center text-sm text-zinc-400">
          Submitted · your rank{" "}
          <span className="font-mono font-bold text-emerald-400">
            #{submit.rank ?? "—"}
          </span>
        </div>
      ) : !signedIn ? (
        <Link
          href="/login"
          className="rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white transition hover:bg-emerald-500"
        >
          Sign in to submit results
        </Link>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-3">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Video link (YouTube / Drive) — optional"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            onClick={onSubmit}
            disabled={submit.kind === "submitting"}
            className="rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {submit.kind === "submitting" ? "Submitting…" : "Submit results"}
          </button>
          {submit.kind === "error" && (
            <p className="text-sm text-red-400">{submit.message}</p>
          )}
        </div>
      )}

      <div className="w-full max-w-md">
        <LeaderboardCard board={board} userId={userId} />
      </div>
    </div>
  );
}

function LeaderboardCard({
  board,
  userId,
}: {
  board: ResultDto[];
  userId: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-zinc-400">Live leaderboard</span>
        <span className="text-zinc-500">
          {board.length} competitor{board.length === 1 ? "" : "s"}
        </span>
      </div>
      {board.length === 0 ? (
        <p className="text-sm text-zinc-600">No submissions yet.</p>
      ) : (
        <ol className="space-y-1 font-mono text-sm">
          {board.map((r) => (
            <li
              key={r.id}
              className={`flex justify-between rounded px-2 py-1 ${
                r.userId === userId ? "bg-emerald-900/30" : ""
              }`}
            >
              <span className="text-zinc-400">
                #{r.rank} {r.userId === userId ? "(you)" : r.userId.slice(0, 8)}
              </span>
              <span className="text-zinc-100">
                {r.ao5Ms === null ? "DNF" : formatTime(r.ao5Ms)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TimerDisplay({
  snapshot,
  pendingPenalty,
}: {
  snapshot: ReturnType<typeof useTimer>["snapshot"];
  pendingPenalty: SolvePenalty;
}) {
  let text: string;
  let color = "text-zinc-100";

  if (snapshot.phase === "inspection" || snapshot.phase === "ready") {
    const remaining = snapshot.inspectionRemainingMs ?? 0;
    if (remaining <= 0) {
      text = "+2";
      color = "text-red-500";
    } else {
      text = Math.ceil(remaining / 1000).toString();
      color = "text-amber-400";
    }
    if (snapshot.phase === "ready") color = "text-emerald-400";
  } else if (snapshot.phase === "solving") {
    text = formatTime(snapshot.timeMs);
    color = "text-white";
  } else if (snapshot.phase === "stopped" && snapshot.result) {
    text = formatSolve({ time_ms: snapshot.result.time_ms, penalty: pendingPenalty });
    color =
      pendingPenalty === "dnf"
        ? "text-red-500"
        : pendingPenalty === "plus2"
          ? "text-orange-400"
          : "text-emerald-400";
  } else {
    text = "0.00";
    color = "text-zinc-600";
  }

  return (
    <div className={`font-mono text-8xl font-bold tabular-nums ${color}`}>{text}</div>
  );
}

function PenaltyButtons({
  value,
  onChange,
}: {
  value: SolvePenalty;
  onChange: (p: SolvePenalty) => void;
}) {
  const opts: { key: SolvePenalty; label: string }[] = [
    { key: "none", label: "OK" },
    { key: "plus2", label: "+2" },
    { key: "dnf", label: "DNF" },
  ];
  return (
    <div className="flex overflow-hidden rounded-lg border border-zinc-700">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-4 py-2 text-sm font-semibold transition ${
            value === o.key
              ? "bg-zinc-200 text-zinc-900"
              : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
