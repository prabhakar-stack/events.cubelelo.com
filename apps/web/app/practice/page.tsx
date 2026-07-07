"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchPracticeSessions,
  fetchPracticeStats,
  deletePracticeSession,
  createPracticeSession,
  type PracticeSessionDto,
  type PracticeStatsDto,
} from "@/lib/api";
import { EVENT_IDS, EVENTS, type EventId } from "@cubers/scramble-core";
import { formatTime } from "@cubers/timer-core";
import { eventDisplayName } from "@/lib/eventNames";
import { EventIcon } from "@/components/EventIcon";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function PracticePage() {
  const toast = useToast();
  const router = useRouter();
  const [sessions, setSessions] = useState<PracticeSessionDto[]>([]);
  const [stats, setStats] = useState<PracticeStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PracticeSessionDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newEventId, setNewEventId] = useState<EventId>("333");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([fetchPracticeSessions(), fetchPracticeStats()])
      .then(([s, st]) => { setSessions(s); setStats(st); })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const session = await createPracticeSession(newEventId);
      setSessions((prev) => [session, ...prev]);
      setShowNewSession(false);
      toast.show("Session created", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to create session", "error");
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePracticeSession(deleteTarget.id);
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.show("Session deleted", "success");
      setDeleteTarget(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Practice</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Track your sessions, personal bests, and progress across all events.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/daily-challenge">
            <Button
              variant="secondary"
              className="!border-amber-500 !text-amber-600 hover:!bg-amber-50 dark:!text-amber-400 dark:hover:!bg-amber-900/20"
            >
              Daily Challenge
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => setShowNewSession(true)}>
            + New Session
          </Button>
          <Link href="/terminal">
            <Button>Open Terminal</Button>
          </Link>
        </div>
      </div>

      {/* New Session Picker */}
      {showNewSession && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Create New Session</h3>
            <button onClick={() => setShowNewSession(false)} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
            {EVENT_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setNewEventId(id)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                  newEventId === id
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                }`}
              >
                <EventIcon eventId={id} size={20} />
                {eventDisplayName(id)}
              </button>
            ))}
          </div>
          <Button onClick={handleCreateSession} loading={creating} className="w-full sm:w-auto">
            Start {eventDisplayName(newEventId)} Session
          </Button>
        </div>
      )}

      {/* Stats Overview */}
      {loading ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : (
        stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Sessions" value={stats.totalSessions} />
            <StatCard label="Total Solves" value={stats.totalSolves} />
            <StatCard
              label="Total Time"
              value={null}
              display={stats.totalTimeMs > 0 ? formatTotalTime(stats.totalTimeMs) : "—"}
            />
            <StatCard label="Events Practiced" value={Object.keys(stats.eventBests).length} />
          </div>
        )
      )}

      {/* PB Grid */}
      {stats && Object.keys(stats.eventBests).length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Personal Bests (Practice)</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Object.entries(stats.eventBests)
              .sort(([, a], [, b]) => a - b)
              .map(([event, time]) => (
                <div
                  key={event}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="text-xs text-zinc-500">
                    <EventIcon eventId={event} size={14} className="mr-1" /> {eventDisplayName(event)}
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatTime(time)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Session List */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Sessions</h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
            <div className="mb-2 text-3xl">🧊</div>
            <p className="text-zinc-500 dark:text-zinc-400">
              No saved sessions yet. Open the terminal to start practicing!
            </p>
            <Link
              href="/terminal"
              className="mt-4 inline-block text-accent-primary underline hover:brightness-110"
            >
              Go to Terminal
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className="row-count-in flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
                style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
              >
                <div className="min-w-0">
                  <Link
                    href={`/practice/${s.id}`}
                    className="font-medium hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    <EventIcon eventId={s.eventType} size={16} className="mr-1" /> {s.name || "Untitled Session"}
                  </Link>
                  <div className="flex gap-3 text-xs text-zinc-500">
                    <span>{eventDisplayName(s.eventType)}</span>
                    <span>{s.solveCount ?? 0} solves</span>
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.endedAt && (
                    <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Ended
                    </span>
                  )}
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete session?"
        description={
          <>
            This permanently deletes <strong>{deleteTarget?.name || "this session"}</strong> and all of its solves.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete session"
      />
    </main>
  );
}

function StatCard({ label, value, display }: { label: string; value: number | null; display?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      {value !== null ? (
        <CountUp value={value} className="font-mono text-xl font-bold" />
      ) : (
        <div className="font-mono text-xl font-bold">{display}</div>
      )}
    </div>
  );
}

function formatTotalTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
