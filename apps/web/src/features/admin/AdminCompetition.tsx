"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  closeRound,
  fetchCompetition,
  generateScrambles,
  openRound,
  updateCompetition,
  type CompetitionDetail,
} from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

const COMP_STATUSES = [
  "draft",
  "published",
  "registration_open",
  "registration_closed",
  "cancelled",
  "live",
  "results_pending",
  "completed",
];

export function AdminCompetition({ id }: { id: string }) {
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchCompetition(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setBusy(key);
      setError(null);
      try {
        await fn();
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (error && !detail) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-zinc-400">
        <Link href="/admin" className="text-emerald-400 hover:underline">
          ← Admin
        </Link>
        <p className="mt-4 text-red-400">{error}</p>
      </div>
    );
  }
  if (!detail) {
    return <div className="px-6 py-8 text-zinc-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/admin" className="text-sm text-emerald-400 hover:underline">
        ← Admin
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{detail.title}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={detail.status} />
          <select
            value={detail.status}
            onChange={(e) =>
              run("status", () => updateCompetition(id, { status: e.target.value }))
            }
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          >
            {COMP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4">
        <Link
          href={`/admin/competitions/${id}/queue`}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Verification Queue →
        </Link>
      </div>

      {detail.events.map((ev) => (
        <div key={ev.id} className="mt-6">
          <div className="mb-2 text-sm font-semibold text-zinc-300">
            Event: {ev.eventType}
          </div>
          <div className="space-y-3">
            {ev.rounds.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <span className="font-mono text-sm text-zinc-300">
                  Round {r.roundNumber}
                </span>
                <StatusBadge status={r.status} />
                <span
                  className={`text-xs ${
                    r.scrambleLocked ? "text-emerald-400" : "text-zinc-500"
                  }`}
                >
                  {r.scrambleLocked ? "scrambles locked" : "no scrambles"}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    disabled={r.scrambleLocked || busy === `gen-${r.id}`}
                    onClick={() =>
                      run(`gen-${r.id}`, () => generateScrambles(r.id, 5))
                    }
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
                  >
                    Generate &amp; lock (5)
                  </button>
                  {r.status === "open" ? (
                    <button
                      disabled={busy === `close-${r.id}`}
                      onClick={() => run(`close-${r.id}`, () => closeRound(r.id))}
                      className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-600 disabled:opacity-40"
                    >
                      Close round
                    </button>
                  ) : (
                    <button
                      disabled={!r.scrambleLocked || busy === `open-${r.id}`}
                      onClick={() => run(`open-${r.id}`, () => openRound(r.id))}
                      title={r.scrambleLocked ? "" : "Lock scrambles first"}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                    >
                      Open round
                    </button>
                  )}
                  <Link
                    href={`/competitions/${id}/lobby`}
                    className="text-xs text-zinc-400 hover:underline"
                  >
                    Lobby
                  </Link>
                  <Link
                    href={`/competitions/${id}/round/${r.roundNumber}`}
                    className="text-xs text-zinc-400 hover:underline"
                  >
                    Terminal
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
