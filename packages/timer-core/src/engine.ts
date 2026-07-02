import type { Solve, SolvePenalty } from "@cubers/types";
import {
  DEFAULT_CONFIG,
  type TimerConfig,
  type TimerPhase,
  type TimerSnapshot,
} from "./types.js";

/**
 * The WCA timer state machine — pure and clock-injected.
 *
 * It owns no timers and reads no global clock: the host passes the current time
 * (ms, from `performance.now()` in the worker, or a fake clock in tests) into
 * every method. This keeps timing fully deterministic and unit-testable.
 *
 * Input model (works for spacebar and two-finger touch alike):
 *   down(now)  — key/finger pressed
 *   up(now)    — key/finger released
 *   tick(now)  — periodic advance (drives arming promotion + inspection auto-DNF)
 *   reset()    — back to idle for the next attempt
 *
 * Competition flow (useInspection = true):
 *   idle --down--> inspection --up--> (waiting)
 *        --down(again)--> arming --(hold)--> ready ("green")
 *        --up--> solving --down--> stopped
 */
export class TimerEngine {
  private config: TimerConfig;

  private phase: TimerPhase = "idle";
  private armed = false;
  private arming = false;
  /** After starting inspection we must see a release before the next hold can arm. */
  private awaitingRelease = false;

  private inspectionStart = 0;
  private holdStart = 0;
  private solveStart = 0;
  private pendingPenalty: SolvePenalty = "none";
  private result: Solve | null = null;

  constructor(config: Partial<TimerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<TimerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.phase = "idle";
    this.armed = false;
    this.arming = false;
    this.awaitingRelease = false;
    this.inspectionStart = 0;
    this.holdStart = 0;
    this.solveStart = 0;
    this.pendingPenalty = "none";
    this.result = null;
  }

  down(now: number): void {
    switch (this.phase) {
      case "idle":
        if (this.config.useInspection) {
          this.phase = "inspection";
          this.inspectionStart = now;
          this.awaitingRelease = true;
        } else {
          this.beginArming(now);
        }
        break;
      case "inspection":
        if (!this.awaitingRelease && !this.arming && !this.armed) {
          this.beginArming(now);
        }
        break;
      case "solving":
        this.stopSolve(now);
        break;
      // ready / stopped: ignore presses
    }
  }

  up(now: number): void {
    switch (this.phase) {
      case "inspection":
        this.awaitingRelease = false;
        if (this.arming && !this.armed) this.arming = false; // released too early
        break;
      case "idle":
        if (this.arming && !this.armed) this.arming = false; // released too early
        break;
      case "ready":
        this.startSolve(now);
        break;
      // solving / stopped: ignore releases
    }
  }

  tick(now: number): void {
    // Promote a long-enough hold into the armed ("ready") state.
    if (this.arming && !this.armed && now - this.holdStart >= this.config.holdToStartMs) {
      this.arming = false;
      this.armed = true;
      this.phase = "ready";
    }
    // Inspection auto-DNF at 17s if the solve never started.
    if (
      this.config.useInspection &&
      (this.phase === "inspection" || this.phase === "ready") &&
      now - this.inspectionStart >= this.config.inspectionDnfMs
    ) {
      this.phase = "stopped";
      this.armed = false;
      this.arming = false;
      this.result = { time_ms: 0, inspectionPenalty: "dnf", penalty: "none" };
    }
  }

  snapshot(now: number): TimerSnapshot {
    let timeMs = 0;
    let inspectionRemainingMs: number | null = null;

    if (this.phase === "solving") {
      timeMs = now - this.solveStart;
    } else if (this.phase === "stopped" && this.result) {
      timeMs = this.result.time_ms;
    } else if (
      this.config.useInspection &&
      (this.phase === "inspection" || this.phase === "ready")
    ) {
      inspectionRemainingMs =
        this.config.inspectionPlus2Ms - (now - this.inspectionStart);
    }

    return {
      phase: this.phase,
      timeMs: Math.round(timeMs),
      inspectionRemainingMs:
        inspectionRemainingMs === null ? null : Math.round(inspectionRemainingMs),
      armed: this.armed,
      result: this.result,
    };
  }

  // ── internals ──
  private beginArming(now: number): void {
    this.arming = true;
    this.holdStart = now;
    if (this.config.holdToStartMs <= 0) {
      this.arming = false;
      this.armed = true;
      this.phase = "ready";
    }
  }

  private startSolve(now: number): void {
    this.phase = "solving";
    this.solveStart = now;
    this.armed = false;
    this.arming = false;
    this.pendingPenalty = this.inspectionPenaltyAt(now);
  }

  private stopSolve(now: number): void {
    this.phase = "stopped";
    this.armed = false;
    this.result = {
      time_ms: Math.round(now - this.solveStart),
      inspectionPenalty: this.pendingPenalty,
      penalty: "none",
    };
  }

  /** Determine the inspection penalty based on elapsed inspection time at solve start. */
  private inspectionPenaltyAt(now: number): SolvePenalty {
    if (!this.config.useInspection) return "none";
    const elapsed = now - this.inspectionStart;
    if (elapsed > this.config.inspectionDnfMs) return "dnf";
    if (elapsed > this.config.inspectionPlus2Ms) return "plus2";
    return "none";
  }
}
