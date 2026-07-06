"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime, formatSolve } from "@cubers/timer-core";
import type { Solve, SolvePenalty } from "@cubers/types";
import type { useTimer } from "./useTimer";

const INSPECTION_TOTAL_MS = 15_000;

const SIZE_CLASSES = {
  lg: "text-6xl sm:text-7xl",
  xl: "text-7xl sm:text-8xl",
};

/**
 * Shared solve-timer readout used by Daily Challenge, the practice terminal, and
 * competition round entry. Gives every solve the same staged inspection warning
 * (white -> amber at 8s elapsed -> red at 12s) and the same stop/DNF motion, since
 * the practice/competition surfaces matter at least as much as Daily Challenge and
 * previously had none of this.
 */
export function TimerDisplay({
  snapshot,
  pendingPenalty,
  size = "lg",
  theme = "auto",
}: {
  snapshot: ReturnType<typeof useTimer>["snapshot"];
  /** Manually-selected penalty not yet baked into the result (competition/practice PenaltyButtons). */
  pendingPenalty?: SolvePenalty;
  size?: "lg" | "xl";
  theme?: "auto" | "dark";
}) {
  let text: string;
  let color = "";
  let extraClass = "";

  const prevPhase = useRef(snapshot.phase);
  const [popKey, setPopKey] = useState(0);
  useEffect(() => {
    if (prevPhase.current !== "stopped" && snapshot.phase === "stopped") {
      setPopKey((k) => k + 1);
    }
    prevPhase.current = snapshot.phase;
  }, [snapshot.phase]);

  const idleColor = theme === "dark" ? "text-zinc-600" : "text-zinc-400 dark:text-zinc-600";
  const solvingColor = theme === "dark" ? "text-white" : "text-zinc-900 dark:text-white";
  const readyColor = theme === "dark" ? "text-emerald-400" : "text-emerald-500";
  const dnfPlus2Color = "text-red-500";
  const okColor = theme === "dark" ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400";

  if (snapshot.phase === "inspection" || snapshot.phase === "ready") {
    const remaining = snapshot.inspectionRemainingMs ?? 0;
    const elapsed = INSPECTION_TOTAL_MS - remaining;
    if (remaining <= 0) {
      text = "+2";
      color = dnfPlus2Color;
    } else {
      text = Math.ceil(remaining / 1000).toString();
      color = elapsed >= 12_000 ? "text-red-500" : elapsed >= 8_000 ? "text-amber-400" : solvingColor;
    }
    if (snapshot.phase === "ready") color = readyColor;
  } else if (snapshot.phase === "solving") {
    text = formatTime(snapshot.timeMs);
    color = solvingColor;
    extraClass = "timer-solving-pulse";
  } else if (snapshot.phase === "stopped" && snapshot.result) {
    const inspP = snapshot.result.inspectionPenalty ?? "none";
    const manualP = pendingPenalty ?? snapshot.result.penalty ?? "none";
    const displaySolve: Solve = { time_ms: snapshot.result.time_ms, inspectionPenalty: inspP, penalty: manualP };
    text = formatSolve(displaySolve);
    const isDnf = inspP === "dnf" || manualP === "dnf";
    const isPlus2 = !isDnf && (inspP === "plus2" || manualP === "plus2");
    color = isDnf || isPlus2 ? dnfPlus2Color : okColor;
    extraClass = isDnf ? "timer-shake" : "timer-pop";
  } else {
    text = "0.00";
    color = idleColor;
  }

  return (
    <div
      key={popKey}
      className={`font-mono ${SIZE_CLASSES[size]} font-bold tabular-nums transition-colors ${color} ${extraClass}`}
    >
      {text}
    </div>
  );
}
