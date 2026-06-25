"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CONFIG,
  type TimerConfig,
  type TimerSnapshot,
  type TimerOutputMessage,
} from "@cubers/timer-core";

const IDLE_SNAPSHOT: TimerSnapshot = {
  phase: "idle",
  timeMs: 0,
  inspectionRemainingMs: null,
  armed: false,
  result: null,
};

/**
 * React binding for the timer Web Worker. Owns the worker lifecycle, mirrors its
 * snapshots into state, and exposes the input actions (down/up/reset).
 */
export function useTimer(config?: Partial<TimerConfig>) {
  const workerRef = useRef<Worker | null>(null);
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(IDLE_SNAPSHOT);

  useEffect(() => {
    const worker = new Worker(new URL("./timer.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<TimerOutputMessage>) => {
      if (event.data.type === "snapshot") setSnapshot(event.data.snapshot);
    };
    worker.postMessage({ type: "config", config: { ...DEFAULT_CONFIG, ...config } });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // Config is applied once at mount; the terminal uses a stable config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const down = useCallback(() => workerRef.current?.postMessage({ type: "down" }), []);
  const up = useCallback(() => workerRef.current?.postMessage({ type: "up" }), []);
  const reset = useCallback(() => workerRef.current?.postMessage({ type: "reset" }), []);

  return { snapshot, down, up, reset };
}
