"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEvent, isEventId, type EventId } from "@cubers/scramble-core";
import { fetchCompetition } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLobby } from "@/features/realtime/useLobby";

interface CompetitionLobbyProps {
  competitionId: string;
  round: string;
  eventId: EventId;
}

/** Live ms remaining until `target`, or null if no target. Ticks each second. */
function useCountdown(target: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  return Math.max(0, new Date(target).getTime() - now);
}

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CompetitionLobby({
  competitionId,
  round,
  eventId,
}: CompetitionLobbyProps) {
  const { user } = useAuth();
  const [roundId, setRoundId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventId>(eventId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCompetition(competitionId)
      .then((comp) => {
        const ev = comp.events.find((e) => e.eventType === eventId) ?? comp.events[0];
        const rnd =
          ev?.rounds.find((r) => r.roundNumber === Number(round)) ?? ev?.rounds[0];
        if (!ev || !rnd) throw new Error("Round not found");
        if (!active) return;
        setRoundId(rnd.id);
        setEventType(isEventId(ev.eventType) ? ev.eventType : "333");
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [competitionId, round, eventId]);

  const me = useMemo(
    () =>
      user
        ? { userId: user.clId, name: user.name }
        : { userId: "guest", name: "Guest" },
    [user],
  );
  const { roster, status, opensAt, rulesMd } = useLobby(roundId, me);
  const remaining = useCountdown(opensAt);
  const event = getEvent(eventType);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="text-center">
          <p className="text-red-400">Could not load the lobby.</p>
          <p className="mt-1 font-mono text-xs text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  const isOpen = status === "open";
  const isClosed = status === "closed";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs uppercase tracking-wide text-zinc-400">
            Comp {competitionId}
          </span>
          <span className="font-semibold">{event.name}</span>
          <span className="text-zinc-500">Round {round} · Lobby</span>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-2">
        {/* Countdown + rules */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
            {isOpen ? (
              <>
                <div className="text-sm uppercase tracking-wider text-emerald-400">
                  Round is live
                </div>
                <Link
                  href={`/competitions/${competitionId}/round/${round}`}
                  className="mt-4 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
                >
                  Enter round →
                </Link>
              </>
            ) : isClosed ? (
              <div className="text-center">
                <div className="text-sm uppercase tracking-wider text-zinc-500">
                  Round closed
                </div>
                <div className="mt-2 font-mono text-3xl text-zinc-400">—</div>
              </div>
            ) : (
              <>
                <div className="text-sm uppercase tracking-wider text-zinc-500">
                  {remaining === null ? "Waiting for organiser" : "Scramble reveal in"}
                </div>
                <div className="mt-2 font-mono text-6xl font-bold tabular-nums text-amber-400">
                  {remaining === null ? "--:--" : formatCountdown(remaining)}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
              Round rules
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">
              {rulesMd ?? "Rules will be posted by the organiser."}
            </p>
          </div>
        </div>

        {/* Live roster */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-zinc-400">Competitors checked in</span>
            <span className="font-mono text-zinc-100">{roster.length}</span>
          </div>
          {roster.length === 0 ? (
            <p className="text-sm text-zinc-600">Waiting for competitors…</p>
          ) : (
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto font-mono text-sm">
              {roster.map((c) => (
                <li
                  key={c.userId}
                  className={`flex items-center justify-between rounded px-2 py-1 ${
                    c.userId === user?.clId ? "bg-emerald-900/30" : ""
                  }`}
                >
                  <span className="text-zinc-200">
                    {c.name}
                    {c.userId === user?.clId ? " (you)" : ""}
                  </span>
                  <span className="text-zinc-600">{c.userId.slice(0, 6)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-emerald-900/40 text-emerald-300",
    pending: "bg-amber-900/40 text-amber-300",
    closed: "bg-zinc-800 text-zinc-400",
    advanced: "bg-blue-900/40 text-blue-300",
  };
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
        map[status] ?? "bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}
