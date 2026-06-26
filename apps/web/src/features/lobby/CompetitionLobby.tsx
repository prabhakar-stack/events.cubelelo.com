"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEvent, isEventId, type EventId } from "@cubers/scramble-core";
import { fetchCompetition, type CompetitionDetail } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLobby } from "@/features/realtime/useLobby";

interface CompetitionLobbyProps {
  competitionId: string;
  round: string;
  eventId: EventId;
}

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
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCompetition(competitionId)
      .then((c) => {
        const ev = c.events.find((e) => e.eventType === eventId) ?? c.events[0];
        const rnd =
          ev?.rounds.find((r) => r.roundNumber === Number(round)) ?? ev?.rounds[0];
        if (!ev || !rnd) throw new Error("Round not found");
        if (!active) return;
        setComp(c);
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
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
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
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* ── Competition details banner (full width) ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-100">
            {comp?.title ?? competitionId}
          </h1>
          <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs uppercase tracking-wide text-zinc-400">
            {event.name}
          </span>
          <span className="text-sm text-zinc-500">Round {round}</span>
          <RoundStatusBadge status={status} />
        </div>
        {comp?.description && (
          <p className="mt-2 text-sm text-zinc-400">{comp.description}</p>
        )}
      </div>

      {/* ── Two-column grid ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left top — Countdown timer */}
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
              <div className="mt-2 font-mono text-4xl text-zinc-500">—</div>
            </div>
          ) : (
            <>
              <div className="text-sm uppercase tracking-wider text-zinc-500">
                {remaining === null ? "Waiting for organiser" : "Round begins in"}
              </div>
              <div className="mt-3 font-mono text-6xl font-bold tabular-nums text-amber-400">
                {remaining === null ? "--:--" : formatCountdown(remaining)}
              </div>
            </>
          )}
        </div>

        {/* Right top — Competitor stats */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Competitors
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-zinc-100">
              {roster.length}
            </span>
            <span className="text-sm text-zinc-500">checked in</span>
          </div>
          {comp && (
            <div className="mt-4 space-y-2 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Registered</span>
                <span className="font-mono text-zinc-200">
                  {comp.registrationCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Events</span>
                <span className="font-mono text-zinc-200">
                  {comp.events.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Entry fee</span>
                <span className="font-mono text-zinc-200">
                  {(comp.baseFee ?? 0) === 0
                    ? "Free"
                    : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Left bottom — Competition details & rules */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="mb-3 text-[11px] uppercase tracking-wider text-zinc-500">
            Details &amp; Rules
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-zinc-300">
            <p>{rulesMd ?? "Rules will be posted by the organiser."}</p>

            {comp && (
              <div className="space-y-2 border-t border-zinc-800 pt-4 text-zinc-400">
                {comp.events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between">
                    <span className="font-mono text-zinc-300">{ev.eventType}</span>
                    <span className="text-xs">
                      {ev.roundCount} round{ev.roundCount > 1 ? "s" : ""}
                      {ev.cutoffMs ? ` · cutoff ${(ev.cutoffMs / 1000).toFixed(0)}s` : ""}
                      {ev.timeLimitMs ? ` · limit ${(ev.timeLimitMs / 1000).toFixed(0)}s` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right bottom — Competitors list (scrollable) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">
              Competitors
            </span>
            <span className="font-mono text-xs text-zinc-500">
              {roster.length} online
            </span>
          </div>
          {roster.length === 0 ? (
            <p className="text-sm text-zinc-600">Waiting for competitors…</p>
          ) : (
            <ul className="max-h-[40vh] space-y-1 overflow-y-auto pr-1 font-mono text-sm">
              {roster.map((c, i) => (
                <li
                  key={c.userId}
                  className={`flex items-center justify-between rounded px-3 py-2 ${
                    c.userId === user?.clId
                      ? "bg-emerald-900/30"
                      : i % 2 === 0
                        ? "bg-zinc-800/20"
                        : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs text-zinc-600">
                      {i + 1}
                    </span>
                    <span className="text-zinc-200">
                      {c.name}
                      {c.userId === user?.clId && (
                        <span className="ml-1 text-xs text-emerald-400">(you)</span>
                      )}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-600">{c.userId}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function RoundStatusBadge({ status }: { status: string }) {
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
