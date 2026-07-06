"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventDisplayName } from "@/lib/eventNames";
import { EventIcon } from "@/components/EventIcon";
import {
  fetchCompetition,
  fetchMyRegistrations,
  fetchParticipants,
  fetchLiveRanking,
  type CompetitionDetail,
  type RegistrationDto,
  type ParticipantEntry,
  type LiveRankingEntry,
} from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { UserStatusBadge } from "@/features/competitions/UserStatusBadge";
import { StatusBadge } from "@/features/competitions/StatusBadge";
import { formatTime } from "@cubers/timer-core";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";

type Tab = "overview" | "participants" | "rankings";

export default function CompetitionDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [myReg, setMyReg] = useState<RegistrationDto | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    setLoading(true);
    fetchCompetition(id)
      .then(setComp)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!user || !params.id) return;
    fetchMyRegistrations()
      .then((regs) => {
        const reg = regs.find((r) => r.competitionId === params.id) ?? null;
        setMyReg(reg);
      })
      .catch(() => {});
  }, [user, params.id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="mb-4 h-5 w-24" />
        <Skeleton className="mb-2 h-9 w-2/3" />
        <Skeleton className="mb-6 h-4 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error || !comp) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-500 dark:text-red-400">
        {error ?? "Competition not found"}
      </main>
    );
  }

  const isRegOpen = comp.status === "registration_open";
  const isLive = comp.status === "live";

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "participants", label: "Participants" },
    { id: "rankings", label: "Rankings" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <UserStatusBadge comp={comp} isRegistered={!!myReg} />
        <span className="text-xs text-zinc-500">{comp.type}</span>
      </div>
      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{comp.title}</h1>
      {comp.description && <p className="mb-4 text-zinc-500 dark:text-zinc-400">{comp.description}</p>}

      {comp.status === "cancelled" && comp.cancellationReason && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">
            This competition has been cancelled
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">{comp.cancellationReason}</p>
        </div>
      )}

      {/* Registration CTA */}
      <div className="mb-6">
        {myReg ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-accent-primary">Registered</span>
            <StatusBadge status={myReg.paymentStatus} />
            {isLive && (
              <Link href={`/competitions/${comp.id}/lobby`}>
                <Button size="md">Enter Lobby</Button>
              </Link>
            )}
          </div>
        ) : isRegOpen ? (
          user ? (
            <Link href={`/competitions/${comp.id}/register`}>
              <Button size="lg">Register Now</Button>
            </Link>
          ) : (
            <Link href="/login" className="text-sm text-accent-primary underline hover:brightness-110">
              Sign in to register
            </Link>
          )
        ) : null}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-accent-primary text-zinc-950"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab comp={comp} />}
      {tab === "participants" && <ParticipantsTab compId={comp.id} />}
      {tab === "rankings" && <RankingsTab comp={comp} />}

      {/* Results link */}
      {["results_pending", "completed", "live"].includes(comp.status) && (
        <div className="mt-8">
          <Link
            href={`/competitions/${comp.id}/results`}
            className="text-sm text-accent-primary underline hover:brightness-110"
          >
            View Full Results
          </Link>
        </div>
      )}
    </main>
  );
}

/* ── Overview Tab ── */

function OverviewTab({ comp }: { comp: CompetitionDetail }) {
  const feeText =
    comp.type === "free"
      ? "Free entry"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)} base + ₹${((comp.perEventFee ?? 0) / 100).toFixed(0)}/event`;

  return (
    <div>
      {/* Info row */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
        <span>{feeText}</span>
        <span>{comp.registrationCount ?? 0} registered</span>
        {comp.registrationDeadline && (
          <span>Deadline: {new Date(comp.registrationDeadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</span>
        )}
        {comp.startsAt && <span>Starts: {new Date(comp.startsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</span>}
      </div>

      {/* Rules */}
      {comp.rulesMd && (
        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Rules</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {comp.rulesMd}
          </p>
        </div>
      )}

      {/* Event cards */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Events</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comp.events.map((ev) => {
          const latestRound = [...ev.rounds]
            .reverse()
            .find((r) => r.status !== "pending") ?? ev.rounds[0];

          return (
            <Link
              key={ev.id}
              href={`/competitions/${comp.id}/event/${ev.id}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/70 p-5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-accent-primary/40"
            >
              <div className="shimmer-sweep pointer-events-none absolute inset-0" />
              <div className="relative mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-semibold text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white">
                  <EventIcon eventId={ev.eventType} size={18} />
                  {eventDisplayName(ev.eventType)}
                </span>
                {latestRound && <StatusBadge status={latestRound.status} />}
              </div>
              <div className="relative mt-auto flex items-center gap-3 text-xs text-zinc-500">
                <span>{ev.roundCount} round{ev.roundCount > 1 ? "s" : ""}</span>
                {ev.cutoffMs && <span>Cutoff: {(ev.cutoffMs / 1000).toFixed(1)}s</span>}
                {ev.timeLimitMs && <span>Limit: {(ev.timeLimitMs / 1000).toFixed(1)}s</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Participants Tab ── */

function ParticipantsTab({ compId }: { compId: string }) {
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParticipants(compId)
      .then((d) => {
        setParticipants(d.participants);
        setCount(d.count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [compId]);

  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        No participants yet.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-500">{count} participant{count !== 1 ? "s" : ""}</p>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-500">#</th>
              <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
              <th className="px-4 py-3 font-medium text-zinc-500">CL ID</th>
              <th className="px-4 py-3 font-medium text-zinc-500">Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {participants.map((p, i) => (
              <tr key={p.userId} className="row-count-in bg-white dark:bg-zinc-900/40" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                <td className="px-4 py-2.5 text-zinc-400">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                  {p.clId}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {p.eventTypes.map((e) => (
                      <span
                        key={e}
                        title={eventDisplayName(e)}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        <EventIcon eventId={e} size={16} /> {eventDisplayName(e)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Rankings Tab ── */

function RankingsTab({ comp }: { comp: CompetitionDetail }) {
  const eventTypes = comp.events.map((e) => e.eventType);
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0] ?? "");
  const [ranking, setRanking] = useState<LiveRankingEntry[]>([]);
  const [roundInfo, setRoundInfo] = useState<{ roundNumber: number | null }>({ roundNumber: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    fetchLiveRanking(comp.id, selectedEvent)
      .then((d) => {
        setRanking(d.ranking);
        setRoundInfo({ roundNumber: d.roundNumber });
      })
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, [comp.id, selectedEvent]);

  return (
    <div>
      {/* Event selector */}
      {eventTypes.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {eventTypes.map((e) => (
            <button
              key={e}
              onClick={() => setSelectedEvent(e)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selectedEvent === e
                  ? "bg-accent-primary text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              <span><EventIcon eventId={e} size={16} /></span>
              {eventDisplayName(e)}
            </button>
          ))}
        </div>
      )}

      {roundInfo.roundNumber && (
        <p className="mb-3 text-xs text-zinc-500">Round {roundInfo.roundNumber}</p>
      )}

      {loading ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
        </div>
      ) : ranking.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
          No results yet for this event.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-500">Rank</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-500">ao5</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Best</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ranking.map((r, i) => (
                <tr key={r.userId} className="row-count-in bg-white dark:bg-zinc-900/40" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                  <td className="px-4 py-2.5 font-mono text-zinc-400">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (r.rank ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                  <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                    {r.ao5Ms !== null ? formatTime(r.ao5Ms) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                    {r.bestSingleMs !== null ? formatTime(r.bestSingleMs) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
