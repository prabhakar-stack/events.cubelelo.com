"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteCompetition,
  duplicateCompetition,
  fetchCompetitions,
  type CompetitionSummary,
} from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { eventDisplayName } from "@/lib/eventNames";

/* ── Main admin dashboard ── */
export function AdminDashboard() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchCompetitions()
      .then(setComps)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <OldCompetitions comps={comps} onRefresh={load} />

    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Competition History
   ════════════════════════════════════════════════════════════════════════════ */

function OldCompetitions({
  comps,
  onRefresh,
}: {
  comps: CompetitionSummary[];
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "live" | "completed" | "draft">(
    "all",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered =
    filter === "all" ? comps : comps.filter((c) => c.status === filter);

  const onDuplicate = async (
    id: string,
    reuseScrambles: boolean,
    newType?: string,
  ) => {
    setBusy(id);
    setError(null);
    try {
      await duplicateCompetition(id, {
        reuseScrambles,
        type: newType,
      });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (comp: CompetitionSummary) => {
    if (!confirm(`Permanently delete "${comp.title}"? This cannot be undone.`)) return;
    setBusy(comp.id);
    setError(null);
    try {
      await deleteCompetition(comp.id);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-8 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Competition History
      </h2>

      {error && <div className="mb-3 rounded bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        {(["all", "draft", "live", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Competition list */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Events</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
              >
                <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                  {c.title}
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{c.type}</td>
                <td className="px-4 py-2.5 text-zinc-400">
                  {c.eventTypes?.map(eventDisplayName).join(", ") ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/competitions/${c.id}`}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Manage
                    </Link>
                    <button
                      disabled={busy === c.id}
                      onClick={() => onDuplicate(c.id, true)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40"
                      title="Duplicate with same scrambles"
                    >
                      {busy === c.id ? "…" : "Duplicate"}
                    </button>
                    <button
                      disabled={busy === c.id}
                      onClick={() => onDuplicate(c.id, false)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40"
                      title="Duplicate with new scrambles"
                    >
                      New scrambles
                    </button>
                    {c.type === "paid" && (
                      <button
                        disabled={busy === c.id}
                        onClick={() => onDuplicate(c.id, true, "free")}
                        className="rounded border border-amber-800/50 px-2 py-1 text-xs text-amber-400 transition hover:bg-amber-900/30 disabled:opacity-40"
                        title="Duplicate as free"
                      >
                        → Free
                      </button>
                    )}
                    <button
                      disabled={busy === c.id}
                      onClick={() => onDelete(c)}
                      className="rounded border border-red-800/50 px-2 py-1 text-xs text-red-400 transition hover:bg-red-900/30 disabled:opacity-40"
                      title="Permanently delete"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-zinc-600"
                >
                  No competitions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
