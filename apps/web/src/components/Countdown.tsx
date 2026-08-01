"use client";

import { useEffect, useState } from "react";

function formatRemaining(diffMs: number): string {
  if (diffMs <= 0) return "any moment now";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  const secs = Math.floor((diffMs % 60_000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function tickInterval(diffMs: number): number {
  if (diffMs <= 60_000) return 1000;
  if (diffMs <= 3_600_000) return 1000;
  return 30_000;
}

/** Live-updating countdown label. Ticks every second when under 1 hour. */
export function Countdown({ target, className = "" }: { target: string; className?: string }) {
  const [label, setLabel] = useState(() => formatRemaining(new Date(target).getTime() - Date.now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      setLabel(formatRemaining(diff));
      if (diff > 0) {
        timer = setTimeout(tick, tickInterval(diff));
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [target]);

  return <span className={className}>{label}</span>;
}

/** Hook returning remaining ms that ticks every second. */
export function useCountdownMs(target: string | null): number | null {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  return Math.max(0, new Date(target).getTime() - now);
}
