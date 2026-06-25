import { TimerEngine } from "@cubers/timer-core";
import type { TimerInputMessage, TimerOutputMessage } from "@cubers/timer-core";

/**
 * Dedicated Web Worker that drives the TimerEngine off the main thread, so React
 * re-renders and GC pauses can never affect timing accuracy (PRD §2.2).
 */
const engine = new TimerEngine();
const ctx = self as unknown as Worker;
const now = (): number => performance.now();

function post(): void {
  const message: TimerOutputMessage = {
    type: "snapshot",
    snapshot: engine.snapshot(now()),
  };
  ctx.postMessage(message);
}

// ~125fps tick — drives arming promotion, inspection auto-DNF, and live display.
setInterval(() => {
  engine.tick(now());
  post();
}, 8);

ctx.onmessage = (event: MessageEvent<TimerInputMessage>): void => {
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
