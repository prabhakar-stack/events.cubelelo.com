"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_IDS } from "@cubers/scramble-core";
import {
  createCompetition,
  duplicateCompetition,
  fetchAdminScrambles,
  fetchCompetition,
  fetchCompetitions,
  generateScrambles,
  openRound,
  closeRound,
  updateCompetition,
  type CompetitionDetail,
  type CompetitionSummary,
} from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

/* ── Admin sub-navigation tabs ── */
const ADMIN_TABS: Array<{
  label: string;
  href: string;
  active?: boolean;
  disabled?: boolean;
}> = [
  { label: "Dashboard", href: "/admin", disabled: true },
  { label: "Competitions", href: "/admin", active: true },
  { label: "Users", href: "/admin/users", disabled: true },
  { label: "Payments", href: "/admin/payments", disabled: true },
  { label: "Migration", href: "/admin/migration", disabled: true },
];

function AdminSubNav() {
  return (
    <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
      {ADMIN_TABS.map((tab) =>
        tab.disabled ? (
          <span
            key={tab.label}
            className="cursor-not-allowed rounded-md px-4 py-2 text-xs font-medium text-zinc-600"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.label}
            href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition ${
              tab.active
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
          >
            {tab.active ? `» ${tab.label}` : tab.label}
          </Link>
        ),
      )}
    </div>
  );
}

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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <AdminSubNav />

      {error && (
        <p className="mb-4 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Section 1: Competition creation */}
      <CompetitionCreator onCreated={load} />

      {/* Section 2: Scramble management */}
      <ScrambleManager comps={comps} onRefresh={load} />

      {/* Section 3: Old competitions */}
      <OldCompetitions comps={comps} onRefresh={load} />

      {/* Footer */}
      <footer className="mt-12 border-t border-zinc-800 py-8 text-center text-xs text-zinc-600">
        <p>
          © {new Date().getFullYear()} Cubelelo Events. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Section 1 — Competition Creation
   ════════════════════════════════════════════════════════════════════════════ */

interface EventSpec {
  eventType: string;
  roundCount: number;
  cutoffMs?: number;
  timeLimitMs?: number;
}

function CompetitionCreator({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rulesMd, setRulesMd] = useState("");
  const [type, setType] = useState<"free" | "paid">("free");
  const [baseFee, setBaseFee] = useState(0);
  const [perEventFee, setPerEventFee] = useState(0);
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [events, setEvents] = useState<EventSpec[]>([
    { eventType: "333", roundCount: 1 },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEvent = () =>
    setEvents((prev) => [...prev, { eventType: "333", roundCount: 1 }]);
  const removeEvent = (i: number) =>
    setEvents((prev) => prev.filter((_, idx) => idx !== i));
  const updateEvent = (i: number, patch: Partial<EventSpec>) =>
    setEvents((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const onSubmit = async (status: "draft" | "published") => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const body: Parameters<typeof createCompetition>[0] = {
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        rulesMd: rulesMd.trim() || undefined,
        baseFee: type === "paid" ? baseFee : 0,
        perEventFee: type === "paid" ? perEventFee : 0,
        registrationDeadline: registrationDeadline || undefined,
        events,
      };
      const { id } = await createCompetition(body);
      if (status !== "draft") {
        await updateCompetition(id, { status });
      }
      setTitle("");
      setDescription("");
      setRulesMd("");
      setType("free");
      setBaseFee(0);
      setPerEventFee(0);
      setRegistrationDeadline("");
      setEvents([{ eventType: "333", roundCount: 1 }]);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Create Competition
      </h2>

      {error && (
        <p className="mb-3 text-sm text-red-400">{error}</p>
      )}

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midweek Madness"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Description + Rules side by side */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for competitors..."
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Rules (markdown)</label>
            <textarea
              value={rulesMd}
              onChange={(e) => setRulesMd(e.target.value)}
              placeholder="WCA regulations apply..."
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Type + fees */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "free" | "paid")}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {type === "paid" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Base fee (paise)</label>
                <input
                  type="number"
                  min={0}
                  value={baseFee}
                  onChange={(e) => setBaseFee(Number(e.target.value))}
                  className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Per-event fee (paise)</label>
                <input
                  type="number"
                  min={0}
                  value={perEventFee}
                  onChange={(e) => setPerEventFee(Number(e.target.value))}
                  className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Registration deadline</label>
            <input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
        </div>

        {/* Events */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs text-zinc-500">Events</label>
            <button
              onClick={addEvent}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              + Add event
            </button>
          </div>
          <div className="space-y-2">
            {events.map((ev, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
              >
                <select
                  value={ev.eventType}
                  onChange={(e) => updateEvent(i, { eventType: e.target.value })}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
                >
                  {EVENT_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                  Rounds
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={ev.roundCount}
                    onChange={(e) =>
                      updateEvent(i, { roundCount: Number(e.target.value) })
                    }
                    className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                  />
                </label>
                {events.length > 1 && (
                  <button
                    onClick={() => removeEvent(i)}
                    className="ml-auto text-xs text-zinc-600 transition hover:text-red-400"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onSubmit("draft")}
            disabled={creating || !title.trim()}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {creating ? "Saving…" : "Save as Draft"}
          </button>
          <button
            onClick={() => onSubmit("published")}
            disabled={creating || !title.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {creating ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Section 2 — Scramble Management
   ════════════════════════════════════════════════════════════════════════════ */

function ScrambleManager({
  comps,
  onRefresh,
}: {
  comps: CompetitionSummary[];
  onRefresh: () => void;
}) {
  const published = comps.filter((c) =>
    ["published", "registration_open", "registration_closed", "live"].includes(c.status),
  );
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrambleView, setScrambleView] = useState<{
    roundId: string;
    scrambles: string[];
    locked: boolean;
  } | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetchCompetition(selectedId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [selectedId]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (selectedId) {
        const d = await fetchCompetition(selectedId);
        setDetail(d);
      }
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const viewScrambles = async (roundId: string) => {
    try {
      const data = await fetchAdminScrambles(roundId);
      setScrambleView({ roundId, scrambles: data.scrambles, locked: data.locked });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Scramble Management
      </h2>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Competition selector */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-zinc-500">
          Select published competition
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setScrambleView(null);
          }}
          className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">— Select —</option>
          {published.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.status})
            </option>
          ))}
        </select>
      </div>

      {/* Event / round table */}
      {detail && (
        <div className="space-y-4">
          {detail.events.map((ev) => (
            <div key={ev.id}>
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">
                {ev.eventType}
              </h3>
              <div className="space-y-2">
                {ev.rounds.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-zinc-300">
                      Round {r.roundNumber}
                    </span>
                    <StatusBadge status={r.status} />
                    <span
                      className={`text-xs ${
                        r.scrambleLocked ? "text-emerald-400" : "text-zinc-600"
                      }`}
                    >
                      {r.scrambleLocked ? "locked" : "no scrambles"}
                    </span>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {/* Generate */}
                      <button
                        disabled={r.scrambleLocked || busy === `gen-${r.id}`}
                        onClick={() =>
                          run(`gen-${r.id}`, () => generateScrambles(r.id, 5))
                        }
                        className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
                      >
                        {busy === `gen-${r.id}` ? "Generating…" : "Generate & Lock (5)"}
                      </button>

                      {/* View scrambles */}
                      <button
                        onClick={() => viewScrambles(r.id)}
                        className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        View
                      </button>

                      {/* Open / Close round */}
                      {r.status === "open" ? (
                        <button
                          disabled={busy === `close-${r.id}`}
                          onClick={() =>
                            run(`close-${r.id}`, () => closeRound(r.id))
                          }
                          className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-600 disabled:opacity-40"
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          disabled={!r.scrambleLocked || busy === `open-${r.id}`}
                          onClick={() =>
                            run(`open-${r.id}`, () => openRound(r.id))
                          }
                          title={
                            r.scrambleLocked ? "" : "Generate & lock scrambles first"
                          }
                          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Scramble preview panel */}
          {scrambleView && scrambleView.scrambles.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Scrambles — Round{" "}
                  {detail.events
                    .flatMap((e) => e.rounds)
                    .find((r) => r.id === scrambleView.roundId)?.roundNumber ?? "?"}
                </h4>
                <span
                  className={`text-xs ${
                    scrambleView.locked ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {scrambleView.locked ? "Locked" : "Unlocked"}
                </span>
              </div>
              <ol className="list-inside list-decimal space-y-1 font-mono text-xs text-zinc-300">
                {scrambleView.scrambles.map((s, i) => (
                  <li key={i} className="rounded px-2 py-1 hover:bg-zinc-900">
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {!selectedId && (
        <p className="text-sm text-zinc-600">
          Select a published competition to manage its scrambles.
        </p>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Section 3 — Old Competitions (history + duplicate)
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

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Competition History
      </h2>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        {(["all", "draft", "live", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Competition list */}
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
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
                className="border-t border-zinc-800 hover:bg-zinc-900/40"
              >
                <td className="px-4 py-2.5 font-medium text-zinc-200">
                  {c.title}
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{c.type}</td>
                <td className="px-4 py-2.5 text-zinc-400">
                  {c.eventTypes?.join(", ") ?? "—"}
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
                      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                      title="Duplicate with same scrambles"
                    >
                      {busy === c.id ? "…" : "Duplicate"}
                    </button>
                    <button
                      disabled={busy === c.id}
                      onClick={() => onDuplicate(c.id, false)}
                      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
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
