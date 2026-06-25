"use client";

import { useCallback, useEffect, useState } from "react";
import { generateScrambleSet, getEvent, type EventId } from "@cubers/scramble-core";
import { ao5, formatSolve, formatTime } from "@cubers/timer-core";
import type { Solve, SolvePenalty } from "@cubers/types";
import { useTimer } from "@/features/timer/useTimer";
import { TwistyPlayer } from "@/features/scramble/TwistyPlayer";

const SOLVES_PER_ROUND = 5;

interface CompetitionTerminalProps {
  competitionId: string;
  round: string;
  eventId: EventId;
}

export function CompetitionTerminal({
  competitionId,
  round,
  eventId,
}: CompetitionTerminalProps) {
  const event = getEvent(eventId);
  const { snapshot, down, up, reset } = useTimer({ useInspection: true });

  const [scrambles, setScrambles] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [pendingPenalty, setPendingPenalty] = useState<SolvePenalty>("none");

  // Generate the round's scramble set. (Demo: client-side. In production this is
  // fetched server-locked from the API at round-open — see ARCHITECTURE §5.)
  useEffect(() => {
    let active = true;
    generateScrambleSet(eventId, SOLVES_PER_ROUND).then((set) => {
      if (active) setScrambles(set);
    });
    return () => {
      active = false;
    };
  }, [eventId]);

  // When a solve stops, seed the penalty controls from the engine's verdict.
  useEffect(() => {
    if (snapshot.phase === "stopped" && snapshot.result) {
      setPendingPenalty(snapshot.result.penalty);
    }
  }, [snapshot.phase, snapshot.result]);

  // Input: spacebar (and any key stops a running solve), Escape cancels.
  useEffect(() => {
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
  }, [snapshot.phase, down, up, reset]);

  const roundComplete = solves.length >= SOLVES_PER_ROUND;

  const confirmSolve = useCallback(() => {
    if (!snapshot.result) return;
    setSolves((prev) => [
      ...prev,
      { time_ms: snapshot.result!.time_ms, penalty: pendingPenalty },
    ]);
    setIndex((i) => Math.min(i + 1, SOLVES_PER_ROUND - 1));
    reset();
  }, [snapshot.result, pendingPenalty, reset]);

  // ── Touch (mobile two-finger model maps to the same down/up) ──
  const onPointerDown = useCallback(() => {
    if (snapshot.phase === "stopped" || roundComplete) return;
    down();
  }, [snapshot.phase, roundComplete, down]);
  const onPointerUp = useCallback(() => {
    if (snapshot.phase === "stopped" || roundComplete) return;
    up();
  }, [snapshot.phase, roundComplete, up]);

  const currentScramble = scrambles?.[index] ?? "";
  const runningAo5 = ao5(solves);

  // Focus mode: while armed ("ready") or solving, hide the scramble + cube and
  // center the timer so nothing distracts the competitor.
  const focusMode = snapshot.phase === "ready" || snapshot.phase === "solving";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 select-none">
      {/* Locked header — competition details, no interaction */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs uppercase tracking-wide text-zinc-400">
            Comp {competitionId}
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

      {focusMode ? (
        /* Distraction-free solve view: scramble hidden, timer centered */
        <div
          className="flex flex-1 flex-col items-center justify-center gap-4 px-6"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <TimerDisplay
            phase={snapshot.phase}
            timeMs={snapshot.timeMs}
            inspectionRemainingMs={snapshot.inspectionRemainingMs}
            pendingPenalty={pendingPenalty}
            resultTimeMs={snapshot.result?.time_ms ?? null}
            roundComplete={roundComplete}
            finalAo5={runningAo5}
          />
          <p className="text-sm text-zinc-500">
            {instruction(snapshot.phase, roundComplete)}
          </p>
        </div>
      ) : (
        <>
          {/* Scramble (locked: not selectable / copyable) */}
          <div className="border-b border-zinc-800 px-6 py-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Scramble
            </div>
            <div className="mt-1 font-mono text-lg text-zinc-200">
              {currentScramble || "Generating…"}
            </div>
          </div>

          {/* Visualizer + status */}
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              {currentScramble ? (
                <TwistyPlayer
                  puzzle={event.puzzle}
                  scramble={currentScramble}
                  className="h-64 w-full"
                />
              ) : (
                <span className="text-zinc-600">Loading cube…</span>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
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
                      i === index && !roundComplete ? "bg-zinc-800/60" : ""
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

          {/* Timer terminal area */}
          <div
            className="flex flex-col items-center gap-4 border-t border-zinc-800 px-6 py-10"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <TimerDisplay
              phase={snapshot.phase}
              timeMs={snapshot.timeMs}
              inspectionRemainingMs={snapshot.inspectionRemainingMs}
              pendingPenalty={pendingPenalty}
              resultTimeMs={snapshot.result?.time_ms ?? null}
              roundComplete={roundComplete}
              finalAo5={runningAo5}
            />

            {snapshot.phase === "stopped" && !roundComplete ? (
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
                {instruction(snapshot.phase, roundComplete)}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function instruction(phase: string, roundComplete: boolean): string {
  if (roundComplete) return "Round complete. Results ready to submit.";
  switch (phase) {
    case "idle":
      return "Hold Space (or two fingers) to begin inspection";
    case "inspection":
      return "Hold Space to arm when ready — release to start";
    case "ready":
      return "Release to start solving";
    case "solving":
      return "Press any key to stop";
    default:
      return "";
  }
}

function TimerDisplay({
  phase,
  timeMs,
  inspectionRemainingMs,
  pendingPenalty,
  resultTimeMs,
  roundComplete,
  finalAo5,
}: {
  phase: string;
  timeMs: number;
  inspectionRemainingMs: number | null;
  pendingPenalty: SolvePenalty;
  resultTimeMs: number | null;
  roundComplete: boolean;
  finalAo5: number | null;
}) {
  if (roundComplete) {
    return (
      <div className="text-center">
        <div className="text-sm uppercase tracking-wider text-zinc-500">
          Final ao5
        </div>
        <div className="font-mono text-7xl font-bold text-emerald-400">
          {finalAo5 === null ? "DNF" : formatTime(finalAo5)}
        </div>
      </div>
    );
  }

  let text: string;
  let color = "text-zinc-100";

  if (phase === "inspection" || phase === "ready") {
    const remaining = inspectionRemainingMs ?? 0;
    if (remaining <= 0) {
      text = "+2";
      color = "text-red-500";
    } else {
      text = Math.ceil(remaining / 1000).toString();
      color = "text-amber-400";
    }
    if (phase === "ready") color = "text-emerald-400";
  } else if (phase === "solving") {
    text = formatTime(timeMs);
    color = "text-white";
  } else if (phase === "stopped" && resultTimeMs !== null) {
    text = formatSolve({ time_ms: resultTimeMs, penalty: pendingPenalty });
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
    <div className={`font-mono text-8xl font-bold tabular-nums ${color}`}>
      {text}
    </div>
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
