/// <reference lib="webworker" />
import { TimerEngine } from "./engine.js";
import type { TimerInputMessage, TimerOutputMessage } from "./types.js";

/**
 * Web Worker entry. Runs the timer engine off the main thread so React
 * re-renders, GC pauses, and UI events cannot affect timing accuracy
 * (PRD §2.2 "non-negotiable"). The main thread only sends input messages and
 * renders the snapshots it posts back.
 *
 * Wire up from the app with:
 *   new Worker(new URL("@cubers/timer-core/worker", import.meta.url), { type: "module" })
 */
const engine = new TimerEngine();
const now = (): number => performance.now();

const post = (): void => {
  const message: TimerOutputMessage = { type: "snapshot", snapshot: engine.snapshot(now()) };
  (self as DedicatedWorkerGlobalScope).postMessage(message);
};

// ~120fps tick: drives arming promotion, inspection auto-DNF, and live display.
const TICK_MS = 8;
setInterval(() => {
  engine.tick(now());
  post();
}, TICK_MS);

self.onmessage = (event: MessageEvent<TimerInputMessage>): void => {
  const msg = event.data;
  switch (msg.type) {
    case "config":
      engine.setConfig(msg.config);
      break;
    case "down":
      engine.down(now());
      break;
    case "up":
      engine.up(now());
      break;
    case "reset":
      engine.reset();
      break;
  }
  post();
};
