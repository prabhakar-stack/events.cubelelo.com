"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPracticeSessions,
  fetchPracticeStats,
  deletePracticeSession,
  type PracticeSessionDto,
  type PracticeStatsDto,
} from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { eventDisplayName } from "@/lib/eventNames";

export default function PracticePage() {
  const [sessions, setSessions] = useState<PracticeSessionDto[]>([]);
  const [stats, setStats] = useState<PracticeStatsDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPracticeSessions(), fetchPracticeStats()])
      .then(([s, st]) => { setSessions(s); setStats(st); })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session and all its solves?")) return;
    await deletePracticeSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Practice</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Track your sessions, personal bests, and progress across all events.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/daily-challenge"
            className="rounded-lg border border-amber-500 px-5 py-2.5 font-semibold text-amber-600 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            Daily Challenge
          </Link>
          <Link
            href="/terminal"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
          >
            Open Terminal
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Sessions" value={String(stats.totalSessions)} />
          <StatCard label="Total Solves" value={String(stats.totalSolves)} />
          <StatCard
            label="Total Time"
            value={stats.totalTimeMs > 0 ? formatTotalTime(stats.totalTimeMs) : "—"}
          />
          <StatCard label="Events Practiced" value={String(Object.keys(stats.eventBests).length)} />
        </div>
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
                  <div className="text-xs text-zinc-500">{eventDisplayName(event)}</div>
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
          <p className="py-8 text-center text-zinc-500">Loading...</p>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400">
              No saved sessions yet. Open the terminal to start practicing!
            </p>
            <Link
              href="/terminal"
              className="mt-4 inline-block text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
            >
              Go to Terminal
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="min-w-0">
                  <Link
                    href={`/practice/${s.id}`}
                    className="font-medium hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    {s.name || "Untitled Session"}
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
                    onClick={() => handleDelete(s.id)}
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
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-mono text-xl font-bold">{value}</div>
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
