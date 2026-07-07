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

/** Live-updating "starts in Xh Ym" label. Ticks every second once under a minute away. */
export function Countdown({ target, className = "" }: { target: string; className?: string }) {
  const [label, setLabel] = useState(() => formatRemaining(new Date(target).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setLabel(formatRemaining(new Date(target).getTime() - Date.now()));
    tick();
    const diff = new Date(target).getTime() - Date.now();
    const interval = setInterval(tick, diff < 60_000 ? 1000 : 30_000);
    return () => clearInterval(interval);
  }, [target]);

  return <span className={className}>{label}</span>;
}
