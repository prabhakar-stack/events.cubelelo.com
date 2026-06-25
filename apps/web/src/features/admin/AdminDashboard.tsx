"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_IDS } from "@cubers/scramble-core";
import {
  createCompetition,
  fetchCompetitions,
  type CompetitionSummary,
} from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

export function AdminDashboard() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("333");
  const [type, setType] = useState("free");
  const [roundCount, setRoundCount] = useState(1);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetchCompetitions()
      .then(setComps)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createCompetition({ title: title.trim(), type, eventType, roundCount });
      setTitle("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [title, type, eventType, roundCount, load]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Admin · Competitions</h1>

      {error && (
        <p className="mb-4 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Create */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-300">
          Create competition
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Midweek Madness"
              className="w-56 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Event
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            >
              {EVENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            >
              <option value="free">free</option>
              <option value="paid">paid</option>
              <option value="practice">practice</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Rounds
            <input
              type="number"
              min={1}
              max={10}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
              className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <button
            onClick={onCreate}
            disabled={creating || !title.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.id} className="border-t border-zinc-800">
                <td className="px-4 py-2 font-medium">{c.title}</td>
                <td className="px-4 py-2 text-zinc-400">{c.type}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/competitions/${c.id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {comps.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-600">
                  No competitions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
