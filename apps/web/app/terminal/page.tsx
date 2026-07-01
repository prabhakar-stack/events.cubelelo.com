"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EVENTS,
  EVENT_IDS,
  getEvent,
  generateScramble,
  type EventId,
} from "@cubers/scramble-core";
import {
  ao5,
  ao12,
  bestSingle,
  formatSolve,
  formatTime,
  effectiveTime,
} from "@cubers/timer-core";
import type { Solve, SolvePenalty } from "@cubers/types";
import { useTimer } from "@/features/timer/useTimer";
import { TwistyPlayer } from "@/features/scramble/TwistyPlayer";

const STORAGE_KEY = "cubers_practice_sessions";
const TARGET_KEY = "cubers_target_times";

interface ExtendedSolve extends Solve {
  note?: string;
  scramble?: string;
}

function loadSession(eventId: EventId): ExtendedSolve[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions: Record<string, ExtendedSolve[]> = JSON.parse(raw);
    return sessions[eventId] ?? [];
  } catch {
    return [];
  }
}

function saveSession(eventId: EventId, solves: ExtendedSolve[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const sessions: Record<string, ExtendedSolve[]> = raw ? JSON.parse(raw) : {};
    sessions[eventId] = solves;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { }
}

function loadTargetTime(eventId: EventId): number | null {
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    const targets: Record<string, number> = JSON.parse(raw);
    return targets[eventId] ?? null;
  } catch {
    return null;
  }
}

function saveTargetTime(eventId: EventId, ms: number | null) {
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    const targets: Record<string, number> = raw ? JSON.parse(raw) : {};
    if (ms === null) delete targets[eventId];
    else targets[eventId] = ms;
    localStorage.setItem(TARGET_KEY, JSON.stringify(targets));
  } catch { }
}

export default function PracticeTerminalPage() {
  const [eventId, setEventId] = useState<EventId>("333");
  const [solves, setSolves] = useState<ExtendedSolve[]>([]);
  const [scramble, setScramble] = useState<string>("");
  const [scrambleLoading, setScrambleLoading] = useState(true);
  const [pendingPenalty, setPendingPenalty] = useState<SolvePenalty>("none");
  const [pendingNote, setPendingNote] = useState("");
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const { snapshot, down, up, reset } = useTimer({ useInspection: true });
  const event = useMemo(() => getEvent(eventId), [eventId]);

  useEffect(() => {
    setSolves(loadSession(eventId));
    setTargetTime(loadTargetTime(eventId));
  }, [eventId]);

  const genScramble = useCallback(async () => {
    setScrambleLoading(true);
    try {
      const s = await generateScramble(eventId);
      setScramble(s);
    } catch {
      setScramble("Error generating scramble");
    } finally {
      setScrambleLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    genScramble();
  }, [genScramble]);

  useEffect(() => {
    if (snapshot.phase === "stopped" && snapshot.result) {
      setPendingPenalty(snapshot.result.penalty);
    }
  }, [snapshot.phase, snapshot.result]);

  const confirmSolve = useCallback(() => {
    if (!snapshot.result) return;
    const newSolve: ExtendedSolve = {
      time_ms: snapshot.result.time_ms,
      penalty: pendingPenalty,
      note: pendingNote.trim() || undefined,
      scramble,
    };
    setSolves((prev) => {
      const next = [...prev, newSolve];
      saveSession(eventId, next);
      return next;
    });
    setPendingNote("");
    reset();
    genScramble();
  }, [snapshot.result, pendingPenalty, pendingNote, scramble, reset, genScramble, eventId]);

  const deleteSolve = useCallback(
    (index: number) => {
      setSolves((prev) => {
        const next = prev.filter((_, i) => i !== index);
        saveSession(eventId, next);
        return next;
      });
    },
    [eventId],
  );

  const clearSession = useCallback(() => {
    setSolves([]);
    saveSession(eventId, []);
  }, [eventId]);

  // Keyboard controls
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
      } else if (e.key === "d" || e.key === "D") {
        if (snapshot.phase === "stopped" && snapshot.result) {
          setPendingPenalty((p) => (p === "dnf" ? "none" : "dnf"));
        }
      } else if (e.key === "p" || e.key === "P") {
        if (snapshot.phase === "stopped" && snapshot.result) {
          setPendingPenalty((p) => (p === "plus2" ? "none" : "plus2"));
        }
      } else if (e.key === "Enter") {
        if (snapshot.phase === "stopped" && snapshot.result) {
          confirmSolve();
        }
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
  }, [snapshot.phase, snapshot.result, down, up, reset, confirmSolve]);

  // Touch controls
  const onPointerDown = useCallback(() => {
    if (snapshot.phase === "stopped") return;
    down();
  }, [snapshot.phase, down]);
  const onPointerUp = useCallback(() => {
    if (snapshot.phase === "stopped") return;
    up();
  }, [snapshot.phase, up]);

  const currentAo5 = ao5(solves as Solve[]);
  const currentAo12 = ao12(solves as Solve[]);
  const best = bestSingle(solves as Solve[]);

  const currentPb = useMemo(() => {
    if (solves.length === 0) return null;
    const times = solves.map(effectiveTime).filter((t) => t !== Infinity);
    return times.length ? Math.min(...times) : null;
  }, [solves]);

  const isNewPb = useMemo(() => {
    if (solves.length < 2 || !snapshot.result) return false;
    const lastSolve = solves[solves.length - 1];
    if (!lastSolve || lastSolve.penalty === "dnf") return false;
    const lastTime = effectiveTime(lastSolve);
    const prevSolves = solves.slice(0, -1);
    const prevBest = prevSolves.map(effectiveTime).filter((t) => t !== Infinity);
    if (prevBest.length === 0) return true;
    return lastTime < Math.min(...prevBest);
  }, [solves, snapshot.result]);

  const beatTarget = useMemo(() => {
    if (!targetTime || solves.length === 0) return false;
    const last = solves[solves.length - 1];
    if (!last || last.penalty === "dnf") return false;
    return effectiveTime(last) <= targetTime;
  }, [targetTime, solves]);

  const handleSetTarget = useCallback(() => {
    const parts = targetInput.trim().split(":").map(Number);
    let ms = 0;
    if (parts.length === 2) ms = (parts[0] * 60 + parts[1]) * 1000;
    else if (parts.length === 1) ms = parts[0] * 1000;
    if (ms > 0) {
      setTargetTime(ms);
      saveTargetTime(eventId, ms);
    }
    setShowTargetInput(false);
    setTargetInput("");
  }, [targetInput, eventId]);

  const clearTarget = useCallback(() => {
    setTargetTime(null);
    saveTargetTime(eventId, null);
  }, [eventId]);

  const focusMode =
    snapshot.phase === "inspection" ||
    snapshot.phase === "ready" ||
    snapshot.phase === "solving";

  if (focusMode) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <TimerDisplay snapshot={snapshot} pendingPenalty={pendingPenalty} />
        <p className="mt-4 text-sm text-zinc-500">{instruction(snapshot.phase)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 select-none sm:px-6">
      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Practice Terminal</h1>
        <div className="flex items-center gap-3">
          <select
            value={eventId}
            onChange={(e) => {
              reset();
              setEventId(e.target.value as EventId);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
          >
            {EVENT_IDS.map((id) => (
              <option key={id} value={id}>
                {EVENTS[id].name}
              </option>
            ))}
          </select>
          <button
            onClick={clearSession}
            disabled={solves.length === 0}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-red-500 disabled:opacity-30 dark:border-zinc-700"
          >
            Clear session
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Solves" value={String(solves.length)} />
        <StatCard label="Best" value={best !== null ? formatTime(best) : "—"} highlight={isNewPb} />
        <StatCard label="ao5" value={currentAo5 !== null ? formatTime(currentAo5) : "—"} />
        <StatCard label="ao12" value={currentAo12 !== null ? formatTime(currentAo12) : "—"} />
      </div>

      {/* Target time */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {targetTime ? (
          <>
            <span className="text-zinc-500">Target:</span>
            <span className={`font-mono font-semibold ${beatTarget ? "text-emerald-500" : "text-amber-500"}`}>
              {formatTime(targetTime)}
            </span>
            {beatTarget && <span className="text-emerald-500">Hit!</span>}
            <button onClick={clearTarget} className="text-xs text-zinc-400 hover:text-red-400">Clear</button>
          </>
        ) : showTargetInput ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSetTarget(); }} className="flex items-center gap-2">
            <input
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="e.g. 15 or 1:30"
              className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              autoFocus
            />
            <span className="text-xs text-zinc-400">seconds</span>
            <button type="submit" className="text-xs text-emerald-600">Set</button>
            <button type="button" onClick={() => setShowTargetInput(false)} className="text-xs text-zinc-400">Cancel</button>
          </form>
        ) : (
          <button onClick={() => setShowTargetInput(true)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            + Set target time
          </button>
        )}
      </div>

      {/* Main content: scramble + visualizer + timer */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Scramble */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Scramble
              </span>
              <button
                onClick={genScramble}
                disabled={scrambleLoading}
                className="text-xs text-zinc-400 transition hover:text-emerald-500 disabled:opacity-50"
              >
                New scramble
              </button>
            </div>
            {scrambleLoading ? (
              <p className="font-mono text-lg text-zinc-400">Generating…</p>
            ) : (
              <p className="font-mono text-lg leading-relaxed">{scramble}</p>
            )}
          </div>

          {/* Visualizer */}
          <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <TwistyPlayer
              puzzle={event.puzzle}
              scramble={scramble}
              className="h-48 w-full sm:h-64"
            />
          </div>

          {/* Timer area */}
          <div
            className="flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900/40"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <TimerDisplay snapshot={snapshot} pendingPenalty={pendingPenalty} />
            {snapshot.phase === "stopped" && snapshot.result ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <PenaltyButtons value={pendingPenalty} onChange={setPendingPenalty} />
                  <button
                    onClick={confirmSolve}
                    className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setPendingNote(""); reset(); }}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-500 transition hover:text-zinc-700 dark:border-zinc-700 dark:hover:text-zinc-300"
                  >
                    Discard
                  </button>
                </div>
                <input
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-full max-w-xs rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  onKeyDown={(e) => { if (e.key === "Enter") confirmSolve(); }}
                />
              </div>
            ) : (
              <p className="h-10 text-center text-sm text-zinc-500">
                {instruction(snapshot.phase)}
              </p>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="flex flex-wrap gap-3 text-xs text-zinc-400 dark:text-zinc-600">
            <span><kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono dark:border-zinc-700">Space</kbd> Start/Stop</span>
            <span><kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono dark:border-zinc-700">Enter</kbd> Save</span>
            <span><kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono dark:border-zinc-700">D</kbd> DNF</span>
            <span><kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono dark:border-zinc-700">P</kbd> +2</span>
            <span><kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono dark:border-zinc-700">Esc</kbd> Reset</span>
          </div>
        </div>

        {/* Solve history sidebar */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Solve History</span>
            <span className="text-xs text-zinc-500">{solves.length} solve{solves.length !== 1 ? "s" : ""}</span>
          </div>
          {solves.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No solves yet. Press Space to start!</p>
          ) : (
            <ol className="max-h-[60vh] space-y-1 overflow-y-auto font-mono text-sm">
              {[...solves].reverse().map((s, ri) => {
                const i = solves.length - 1 - ri;
                const hitTarget = targetTime && s.penalty !== "dnf" && effectiveTime(s) <= targetTime;
                return (
                  <li
                    key={i}
                    className="group rounded px-2 py-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">{i + 1}.</span>
                      <span className={`${s.penalty === "dnf" ? "text-red-500" : s.penalty === "plus2" ? "text-orange-400" : ""} ${hitTarget ? "text-emerald-500" : ""}`}>
                        {formatSolve(s)}
                      </span>
                      <button
                        onClick={() => deleteSolve(i)}
                        className="invisible text-zinc-400 transition hover:text-red-400 group-hover:visible"
                        title="Delete solve"
                      >
                        ×
                      </button>
                    </div>
                    {s.note && (
                      <p className="ml-6 text-[11px] font-sans text-zinc-400">{s.note}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${highlight
        ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/20"
        : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`font-mono text-lg font-bold ${highlight ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {value}
      </div>
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
  let color = "";

  if (snapshot.phase === "inspection" || snapshot.phase === "ready") {
    const remaining = snapshot.inspectionRemainingMs ?? 0;
    if (remaining <= 0) {
      text = "+2";
      color = "text-red-500";
    } else {
      text = Math.ceil(remaining / 1000).toString();
      color = "text-amber-400";
    }
    if (snapshot.phase === "ready") color = "text-emerald-500";
  } else if (snapshot.phase === "solving") {
    text = formatTime(snapshot.timeMs);
    color = "text-zinc-900 dark:text-white";
  } else if (snapshot.phase === "stopped" && snapshot.result) {
    text = formatSolve({ time_ms: snapshot.result.time_ms, penalty: pendingPenalty });
    color =
      pendingPenalty === "dnf"
        ? "text-red-500"
        : pendingPenalty === "plus2"
          ? "text-orange-400"
          : "text-emerald-600 dark:text-emerald-400";
  } else {
    text = "0.00";
    color = "text-zinc-400 dark:text-zinc-600";
  }

  return (
    <div className={`font-mono text-7xl font-bold tabular-nums sm:text-8xl ${color}`}>{text}</div>
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
    <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-4 py-2 text-sm font-semibold transition ${value === o.key
              ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function instruction(phase: string): string {
  switch (phase) {
    case "idle":
      return "click space to begin inspection";
    case "inspection":
      return "Hold Space to arm — release to start";
    case "ready":
      return "Release to start solving";
    case "solving":
      return "Press any key to stop";
    default:
      return "";
  }
}
