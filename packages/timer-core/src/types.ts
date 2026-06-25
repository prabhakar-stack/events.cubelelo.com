import type { Solve } from "@cubers/types";

/**
 * The WCA timer state machine phases.
 *  idle       → nothing happening, waiting for first interaction
 *  inspection → WCA inspection countdown running (competition: mandatory)
 *  ready      → user is holding (armed / "green"), about to release & solve
 *  solving    → timer running
 *  stopped    → solve finished, `result` is populated
 */
export type TimerPhase = "idle" | "inspection" | "ready" | "solving" | "stopped";

export interface TimerConfig {
  /** Inspection is mandatory in Competition Mode (PRD §2.3). */
  useInspection: boolean;
  /** Solve started after this many ms of inspection → +2 penalty (WCA: 15s). */
  inspectionPlus2Ms: number;
  /** Solve started after this many ms of inspection → DNF (WCA: 17s). */
  inspectionDnfMs: number;
  /** Required hold duration before the timer arms ("green"). 0 = instant. */
  holdToStartMs: number;
}

/** Competition-mode defaults: inspection on, WCA 15s/17s thresholds. */
export const DEFAULT_CONFIG: TimerConfig = {
  useInspection: true,
  inspectionPlus2Ms: 15_000,
  inspectionDnfMs: 17_000,
  holdToStartMs: 0,
};

/** A read-only view of the engine's current state, safe to render. */
export interface TimerSnapshot {
  phase: TimerPhase;
  /** Solve elapsed time in ms (live while solving, final once stopped). */
  timeMs: number;
  /** Countdown remaining in ms during inspection (can go negative → +2 zone); null otherwise. */
  inspectionRemainingMs: number | null;
  /** True while armed ("green"). */
  armed: boolean;
  /** The recorded solve, present only when phase === "stopped". */
  result: Solve | null;
}

/** Messages the host (main thread) sends into the worker. */
export type TimerInputMessage =
  | { type: "config"; config: Partial<TimerConfig> }
  | { type: "down" }
  | { type: "up" }
  | { type: "reset" };

/** Messages the worker posts back to the host. */
export type TimerOutputMessage = { type: "snapshot"; snapshot: TimerSnapshot };
