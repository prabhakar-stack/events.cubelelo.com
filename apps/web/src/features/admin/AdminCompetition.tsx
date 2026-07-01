"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  cancelRound,
  downloadCertificatesZip,
  exportCompetitionCSV,
  sendBulkEmail,
  sendRoundNotification,
  fetchCompetition,
  fetchVerificationQueue,
  generateScrambles,
  updateCompetition,
  updateRound,
  verifyResult,
  type AdvancementCriteria,
  type CompetitionDetail,
  type FlaggedResultDto,
  type RoundRef,
} from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { StatusBadge } from "./StatusBadge";

// Only statuses that are manually set — the others are auto-computed from schedule
const MANUAL_STATUSES = ["draft", "published", "cancelled", "completed"];

const ADMIN_TABS = [
  { label: "Competitions", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Promo Codes", href: "/admin/promo-codes" },
  { label: "Appeals", href: "/admin/appeals" },
  { label: "WCA Queue", href: "/admin/wca-queue" },
  { label: "Rank Tiers", href: "/admin/rank-tiers" },
  { label: "Merge", href: "/admin/merge" },
  { label: "CMS", href: "/admin/cms" },
  { label: "Migration", href: "/admin/migration" },
  { label: "Content", href: "/admin/content" },
  { label: "Details", href: "/admin/faq" },
  { label: "Staff", href: "/admin/staff" },
];

function AdminSubNav() {
  return (
    <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className="rounded-md px-4 py-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function toLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toISO(val: string): string | null {
  return val ? new Date(val).toISOString() : null;
}

export function AdminCompetition({ id }: { id: string }) {
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [queue, setQueue] = useState<FlaggedResultDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Schedule editor local state — synced from detail on load
  const [regOpens, setRegOpens] = useState("");
  const [regCloses, setRegCloses] = useState("");
  const [compStarts, setCompStarts] = useState("");
  const [compEnds, setCompEnds] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);

  const load = useCallback(() => {
    fetchCompetition(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    fetchVerificationQueue(id)
      .then(setQueue)
      .catch(() => setQueue([]));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync schedule inputs whenever detail refreshes
  useEffect(() => {
    if (detail) {
      setRegOpens(toLocal(detail.registrationOpensAt));
      setRegCloses(toLocal(detail.registrationDeadline));
      setCompStarts(toLocal(detail.startsAt));
      setCompEnds(toLocal(detail.endsAt));
    }
  }, [detail]);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setBusy(key);
      setError(null);
      setValidationErrors([]);
      try {
        await fn();
        load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const jsonMatch = msg.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.errors && Array.isArray(parsed.errors)) {
              setValidationErrors(parsed.errors);
              setError(parsed.error ?? "Validation failed");
            } else {
              setError(parsed.error ?? msg);
            }
          } catch {
            setError(msg);
          }
        } else {
          setError(msg);
        }
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (error && !detail) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminSubNav />
        <Link href="/admin" className="text-emerald-500 hover:underline">
          ← Back
        </Link>
        <div className="mt-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminSubNav />
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <AdminSubNav />

      {/* ── Competition details banner ── */}
      <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30 p-6">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/admin"
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            ← All competitions
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={detail.status} />
            <select
              value={MANUAL_STATUSES.includes(detail.status) ? detail.status : ""}
              onChange={(e) => {
                const newStatus = e.target.value;
                if (!newStatus) return;
                if (newStatus === "cancelled") {
                  const reason = prompt("Enter cancellation reason (required):");
                  if (!reason?.trim()) return;
                  run("status", () =>
                    updateCompetition(id, { status: newStatus, cancellationReason: reason.trim() }),
                  );
                } else {
                  run("status", () => updateCompetition(id, { status: newStatus }));
                }
              }}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              title="Manually override status (registration_open / live / etc. are auto-computed from schedule)"
            >
              <option value="">— auto —</option>
              {MANUAL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">{detail.title}</h1>
        {detail.description && (
          <p className="mb-2 text-sm text-zinc-400">{detail.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span>Type: {detail.type}</span>
          <span>
            Events: {detail.events.map((e) => e.eventType).join(", ")}
          </span>
          <span>Registered: {detail.registrationCount ?? 0}</span>
          {detail.type !== "free" && (
            <span>
              Fee: ₹{((detail.baseFee ?? 0) / 100).toFixed(0)} + ₹
              {((detail.perEventFee ?? 0) / 100).toFixed(0)}/event
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowEmailModal(true)}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Send Email
            </button>
            <button
              disabled={busy === "certs"}
              onClick={() => run("certs", () => downloadCertificatesZip(id))}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy === "certs" ? "Generating…" : "Certificates"}
            </button>
            <button
              disabled={busy === "export"}
              onClick={() => run("export", () => exportCompetitionCSV(id))}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy === "export" ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <p>{error}</p>
            {validationErrors.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* ── Schedule editor ── */}
        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Schedule
            </h3>
            <p className="text-xs text-zinc-600">
              Status auto-transitions based on these times
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { label: "Registration opens", value: regOpens, set: setRegOpens },
                { label: "Registration closes", value: regCloses, set: setRegCloses },
                { label: "Competition starts", value: compStarts, set: setCompStarts },
                { label: "Competition ends", value: compEnds, set: setCompEnds },
              ] as const
            ).map(({ label, value, set }) => (
              <div key={label}>
                <label className="mb-1 block text-xs text-zinc-500">{label}</label>
                <input
                  type="datetime-local"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            ))}
          </div>
          <button
            disabled={busy === "schedule"}
            onClick={() =>
              run("schedule", () =>
                updateCompetition(id, {
                  registrationOpensAt: toISO(regOpens),
                  registrationDeadline: toISO(regCloses),
                  startsAt: toISO(compStarts),
                  endsAt: toISO(compEnds),
                }),
              )
            }
            className="mt-3 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-600 disabled:opacity-50"
          >
            {busy === "schedule" ? "Saving…" : "Save Schedule"}
          </button>
        </div>

        {/* Rounds management */}
        {detail.events.map((ev) => (
          <div key={ev.id} className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {ev.eventType} — {ev.roundCount} round
              {ev.roundCount !== 1 ? "s" : ""}
            </h3>
            <div className="space-y-2">
              {ev.rounds.map((r) => (
                <RoundRow
                  key={r.id}
                  round={r}
                  competitionId={id}
                  busy={busy}
                  onRun={run}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Verification Queue (inline) ── */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Verification Queue
        </h2>

        {queue.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-8 text-center">
            <p className="text-zinc-500">No flagged results to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((r) => (
              <FlaggedResultCard
                key={r.id}
                result={r}
                competitionId={id}
                busy={busy}
                onAction={(action, reason) =>
                  run(`verify-${r.id}`, () => verifyResult(r.id, action, reason))
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Bulk Email Modal ── */}
      {showEmailModal && (
        <BulkEmailModal
          competitionId={id}
          onClose={() => setShowEmailModal(false)}
        />
      )}

    </div>
  );
}

/* ── Bulk email modal ── */

function BulkEmailModal({
  competitionId,
  onClose,
}: {
  competitionId: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: boolean;
    message: string;
    recipientCount: number;
    recipients: string[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setErr(null);
    try {
      const res = await sendBulkEmail(competitionId, { subject, bodyHtml });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100">Send Bulk Email</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
              <p className="text-sm text-emerald-300">{result.message}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {result.recipientCount} recipient{result.recipientCount !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-zinc-700 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-600"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Round 1 results are out!"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Body (HTML supported)
              </label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={6}
                placeholder="Write your email content here..."
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            {err && <div className="rounded bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{err}</div>}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                disabled={sending || !subject.trim() || !bodyHtml.trim()}
                onClick={handleSend}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send to All Registrants"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Round row with inline schedule editor ── */

function RoundRow({
  round,
  competitionId,
  busy,
  onRun,
}: {
  round: RoundRef;
  competitionId: string;
  busy: string | null;
  onRun: (key: string, fn: () => Promise<unknown>) => void;
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [opensAt, setOpensAt] = useState(toLocal(round.opensAt));
  const [closesAt, setClosesAt] = useState(toLocal(round.closesAt));
  const [duration, setDuration] = useState<string>("");
  const [criteriaMethod, setCriteriaMethod] = useState<"none" | "rank" | "time">(
    round.advancementCriteria?.method ?? "none",
  );
  const [criteriaLimit, setCriteriaLimit] = useState<string>(
    round.advancementCriteria?.method === "rank"
      ? String(round.advancementCriteria.rankLimit ?? "")
      : round.advancementCriteria?.method === "time"
        ? String((round.advancementCriteria.timeLimitMs ?? 0) / 1000)
        : "",
  );

  // Keep local inputs in sync when parent refreshes
  useEffect(() => {
    setOpensAt(toLocal(round.opensAt));
    setClosesAt(toLocal(round.closesAt));
  }, [round.opensAt, round.closesAt]);

  // Auto-compute closesAt when opensAt + duration are set
  useEffect(() => {
    if (opensAt && duration && Number(duration) > 0) {
      const open = new Date(opensAt);
      const close = new Date(open.getTime() + Number(duration) * 60_000);
      setClosesAt(toLocal(close.toISOString()));
    }
  }, [opensAt, duration]);

  const buildCriteria = (): AdvancementCriteria | null => {
    if (criteriaMethod === "rank" && Number(criteriaLimit) > 0)
      return { method: "rank", rankLimit: Number(criteriaLimit) };
    if (criteriaMethod === "time" && Number(criteriaLimit) > 0)
      return { method: "time", timeLimitMs: Number(criteriaLimit) * 1000 };
    return null;
  };

  const saveSchedule = () =>
    onRun(`sched-${round.id}`, () =>
      updateRound(round.id, {
        opensAt: toISO(opensAt),
        closesAt: toISO(closesAt),
        advancementCriteria: buildCriteria(),
        ...(duration ? { durationMinutes: Number(duration) } : {}),
      }),
    );

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="font-mono text-sm text-zinc-300">R{round.roundNumber}</span>
        <StatusBadge status={round.status} />
        <span className={`text-xs ${round.scrambleLocked ? "text-emerald-400" : "text-zinc-600"}`}>
          {round.scrambleLocked ? "locked" : "no scrambles"}
        </span>

        {/* Show scheduled times if set */}
        {(round.opensAt || round.closesAt) && (
          <span className="text-xs text-zinc-500">
            {round.opensAt ? `opens ${new Date(round.opensAt).toLocaleString()}` : ""}
            {round.opensAt && round.closesAt ? " · " : ""}
            {round.closesAt ? `closes ${new Date(round.closesAt).toLocaleString()}` : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Schedule toggle */}
          <button
            onClick={() => setShowSchedule((v) => !v)}
            className={`rounded border px-2.5 py-1.5 text-xs font-medium transition ${
              showSchedule
                ? "border-emerald-700 bg-emerald-900/40 text-emerald-300"
                : round.opensAt || round.closesAt
                  ? "border-emerald-800 text-emerald-500 hover:bg-emerald-900/30 hover:text-emerald-300"
                  : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            title="Set open / close times — round auto-transitions when the time is reached"
          >
            ⏱ {round.opensAt || round.closesAt ? "Edit Times" : "Set Times"}
          </button>

          {/* Generate scrambles */}
          <button
            disabled={round.scrambleLocked || busy === `gen-${round.id}`}
            onClick={() => onRun(`gen-${round.id}`, () => generateScrambles(round.id, 5))}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {busy === `gen-${round.id}` ? "Generating…" : "Generate & Lock"}
          </button>

          {/* Cancel round */}
          {round.status !== "cancelled" && round.status !== "advanced" && round.status !== "closed" && (
            <button
              disabled={busy === `cancel-${round.id}`}
              onClick={() => onRun(`cancel-${round.id}`, () => cancelRound(round.id))}
              className="rounded border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/30 disabled:opacity-40"
            >
              {busy === `cancel-${round.id}` ? "Cancelling…" : "Cancel"}
            </button>
          )}

          <button
            disabled={busy === `notify-${round.id}`}
            onClick={() => onRun(`notify-${round.id}`, () => sendRoundNotification(round.id))}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {busy === `notify-${round.id}` ? "Sending…" : "Notify"}
          </button>

          <Link href={`/competitions/${competitionId}/round/${round.roundNumber}`}
            className="text-xs text-zinc-500 hover:text-zinc-300">
            Terminal
          </Link>
        </div>
      </div>

      {/* Collapsible schedule editor */}
      {showSchedule && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="mb-3 text-xs font-semibold text-zinc-400">
            Round {round.roundNumber} — Open &amp; Close Times
          </p>
          <p className="mb-2 text-xs text-zinc-500">
            The round status changes automatically when each time is reached.
            The manual Open / Close buttons above override this at any time.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Opens at</label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="—"
                className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Closes at</label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => { setClosesAt(e.target.value); setDuration(""); }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="w-full" />
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Shortlist Method</label>
              <select
                value={criteriaMethod}
                onChange={(e) => { setCriteriaMethod(e.target.value as "none" | "rank" | "time"); setCriteriaLimit(""); }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="none">None</option>
                <option value="rank">Rank Based (Top N)</option>
                <option value="time">Time Based (ao5 ≤ X)</option>
              </select>
            </div>
            {criteriaMethod !== "none" && (
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  {criteriaMethod === "rank" ? "Top N" : "Time limit (seconds)"}
                </label>
                <input
                  type="number"
                  min={1}
                  value={criteriaLimit}
                  onChange={(e) => setCriteriaLimit(e.target.value)}
                  placeholder={criteriaMethod === "rank" ? "e.g. 10" : "e.g. 30"}
                  className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            )}
            <button
              disabled={busy === `sched-${round.id}`}
              onClick={saveSchedule}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-600 disabled:opacity-50"
            >
              {busy === `sched-${round.id}` ? "Saving…" : "Save"}
            </button>
            {(opensAt || closesAt) && (
              <button
                onClick={() => {
                  setOpensAt("");
                  setClosesAt("");
                  onRun(`sched-${round.id}`, () =>
                    updateRound(round.id, { opensAt: null, closesAt: null }),
                  );
                }}
                className="text-xs text-zinc-600 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Flagged result card ── */

function formatSolve(solve: { time_ms: number; penalty: string }) {
  const base = formatTime(solve.time_ms);
  if (solve.penalty === "dnf") return `DNF(${base})`;
  if (solve.penalty === "plus2") return `${formatTime(solve.time_ms + 2000)}+`;
  return base;
}

function FlaggedResultCard({
  result,
  competitionId,
  busy,
  onAction,
}: {
  result: FlaggedResultDto;
  competitionId: string;
  busy: string | null;
  onAction: (action: string, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isBusy = busy === `verify-${result.id}`;

  const handleAction = (action: string) => {
    onAction(action, reason.trim() || undefined);
    setReason("");
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-zinc-900/40 p-5">
      {/* Header: user info */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/profile/${result.userClId}`}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
          >
            {result.userName}
          </Link>
          <span className="font-mono text-xs text-zinc-500">
            {result.userClId}
          </span>
          <StatusBadge status={result.flagStatus} />
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{result.eventType}</span>
          <span>Round {result.roundNumber ?? "?"}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-3 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-zinc-500">ao5: </span>
          <span className="font-mono text-zinc-200">
            {result.ao5Ms !== null ? formatTime(result.ao5Ms) : "DNF"}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Best: </span>
          <span className="font-mono text-zinc-200">
            {result.bestSingleMs !== null
              ? formatTime(result.bestSingleMs)
              : "DNF"}
          </span>
        </div>
        {result.videoUrl && (
          <a
            href={result.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            Video
          </a>
        )}
      </div>

      {/* Individual solves */}
      {result.solves.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-zinc-500">Solves: </span>
          <span className="font-mono text-xs text-zinc-300">
            {result.solves.map((s, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {formatSolve(s)}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Suspicion reasons */}
      {result.suspicionReasons.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-900/30 bg-amber-950/20 px-3 py-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
            Reason for flag
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-300/80">
            {result.suspicionReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Reason input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-zinc-500">
          Judge reason (required before action)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for your decision..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction("verified")}
          disabled={isBusy || !reason.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          Verify
        </button>
        <button
          onClick={() => handleAction("plus2")}
          disabled={isBusy || !reason.trim()}
          className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
        >
          +2
        </button>
        <button
          onClick={() => handleAction("dnf")}
          disabled={isBusy || !reason.trim()}
          className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50"
        >
          DNF
        </button>
        <button
          onClick={() => handleAction("disqualified")}
          disabled={isBusy || !reason.trim()}
          className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
        >
          Disqualify
        </button>
      </div>
    </div>
  );
}
