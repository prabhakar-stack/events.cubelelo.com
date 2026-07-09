"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  cancelRound,
  createPracticeEvent,
  downloadCertificatesZip,
  downloadCsvCertificates,
  exportCompetitionCSV,
  sendBulkEmail,
  sendRoundNotification,
  fetchCompetition,
  updateCompetition,
  uploadCompetitionBanner,
  uploadCompetitionMobileBanner,
  updateRound,
  type AdvancementCriteria,
  type CompetitionDetail,
  type RoundRef,
} from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { StatusBadge } from "./StatusBadge";
import { ConfirmModal } from "@/components/ui/Modal";
import { Countdown } from "@/components/Countdown";

// Only statuses that are manually set — the others are auto-computed from schedule
const MANUAL_STATUSES = ["draft", "published", "cancelled", "completed"];

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
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Detail editor local state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editBaseFee, setEditBaseFee] = useState("");
  const [editPerEventFee, setEditPerEventFee] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [mobileBannerFile, setMobileBannerFile] = useState<File | null>(null);

  // Schedule editor local state — synced from detail on load
  const [regOpens, setRegOpens] = useState("");
  const [regCloses, setRegCloses] = useState("");
  const [compStarts, setCompStarts] = useState("");
  const [compEnds, setCompEnds] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const csvCertRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchCompetition(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync all inputs whenever detail refreshes
  useEffect(() => {
    if (detail) {
      setEditTitle(detail.title);
      setEditDescription(detail.description ?? "");
      setEditRules(detail.rulesMd ?? "");
      setEditBaseFee(String((detail.baseFee ?? 0) / 100));
      setEditPerEventFee(String((detail.perEventFee ?? 0) / 100));
      setBannerFile(null);
      setMobileBannerFile(null);
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

  const handleCsvCertUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setError("CSV must have a header row and at least one data row");
          return;
        }
        const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = headers.indexOf("name");
        if (nameIdx === -1) {
          setError("CSV must have a 'name' column");
          return;
        }
        const clIdIdx = headers.indexOf("clid");
        const eventIdx = headers.indexOf("event");
        const rankIdx = headers.indexOf("rank");
        const bestIdx = headers.indexOf("bestsingle");
        const avgIdx = headers.indexOf("average");

        const winners = lines.slice(1).map((line) => {
          const cols = line.split(",").map((c) => c.trim());
          return {
            name: cols[nameIdx] ?? "",
            clId: clIdIdx >= 0 ? cols[clIdIdx] : undefined,
            event: eventIdx >= 0 ? cols[eventIdx] : undefined,
            rank: rankIdx >= 0 && cols[rankIdx] ? Number(cols[rankIdx]) : undefined,
            bestSingle: bestIdx >= 0 ? cols[bestIdx] : undefined,
            average: avgIdx >= 0 ? cols[avgIdx] : undefined,
          };
        }).filter((w) => w.name);

        if (winners.length === 0) {
          setError("No valid rows found in CSV");
          return;
        }
        run("csvCerts", () => downloadCsvCertificates(id, winners));
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [id, run],
  );

  if (error && !detail) {
    return (
      <div className="mx-auto max-w-[1400px] px-8 py-10">
        <Link href="/admin" className="text-emerald-500 hover:underline">
          ← Back
        </Link>
        <div className="mt-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-[1400px] px-8 py-10">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
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
            <button
              disabled={busy === "featured"}
              onClick={() =>
                run("featured", () =>
                  updateCompetition(id, { featured: !detail.featured }),
                )
              }
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                detail.featured
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
              title="Toggle featured status on homepage"
            >
              {detail.featured ? "★ Featured" : "☆ Feature"}
            </button>
          </div>
        </div>

        <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{detail.title}</h1>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span><span className="text-zinc-400 dark:text-zinc-500">Type</span> {detail.type}</span>
          <span>
            <span className="text-zinc-400 dark:text-zinc-500">Events</span>{" "}
            {detail.events.map((e) => e.eventType).join(", ")}
          </span>
          <span><span className="text-zinc-400 dark:text-zinc-500">Registered</span> {detail.registrationCount ?? 0}</span>
          {detail.publishedByName && (
            <span><span className="text-zinc-400 dark:text-zinc-500">Published by</span> {detail.publishedByName}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowEmailModal(true)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Send Email
            </button>
            <button
              disabled={busy === "certs"}
              onClick={() => run("certs", () => downloadCertificatesZip(id))}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy === "certs" ? "Generating…" : "Certificates"}
            </button>
            <input
              ref={csvCertRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvCertUpload}
            />
            <button
              disabled={busy === "csvCerts"}
              onClick={() => csvCertRef.current?.click()}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy === "csvCerts" ? "Generating…" : "CSV Certificates"}
            </button>
            <button
              disabled={busy === "export"}
              onClick={() => run("export", () => exportCompetitionCSV(id))}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy === "export" ? "Exporting…" : "Export CSV"}
            </button>
            <button
              onClick={() => setShowPracticeModal(true)}
              className="rounded border border-emerald-800/50 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-900/30"
            >
              Practice Event
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

        {/* ── Details editor ── */}
        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Details
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-500">Rules (Markdown)</label>
              <textarea
                value={editRules}
                onChange={(e) => setEditRules(e.target.value)}
                rows={6}
                placeholder="Competition rules — supports Markdown formatting"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            {detail.type !== "free" && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Base Fee (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={editBaseFee}
                    onChange={(e) => setEditBaseFee(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Per-Event Fee (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={editPerEventFee}
                    onChange={(e) => setEditPerEventFee(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Desktop Banner <span className="text-zinc-400 dark:text-zinc-500">(1200×400 recommended)</span></label>
              {detail.bannerUrl && !bannerFile && (
                <div className="mb-2">
                  <img src={detail.bannerUrl} alt="Current desktop banner" className="h-16 rounded-lg object-cover" />
                  <p className="mt-1 text-xs text-zinc-500">Current — upload a new one to replace</p>
                </div>
              )}
              {bannerFile && <p className="mb-1 text-xs text-emerald-500">Selected: {bannerFile.name}</p>}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Mobile Banner <span className="text-zinc-400 dark:text-zinc-500">(600×400 recommended)</span></label>
              {detail.mobileBannerUrl && !mobileBannerFile && (
                <div className="mb-2">
                  <img src={detail.mobileBannerUrl} alt="Current mobile banner" className="h-16 rounded-lg object-cover" />
                  <p className="mt-1 text-xs text-zinc-500">Current — upload a new one to replace</p>
                </div>
              )}
              {mobileBannerFile && <p className="mb-1 text-xs text-emerald-500">Selected: {mobileBannerFile.name}</p>}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => setMobileBannerFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 file:mr-3 file:rounded file:border-0 file:bg-zinc-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
              />
            </div>
          </div>
          <button
            disabled={busy === "details"}
            onClick={() =>
              run("details", async () => {
                await updateCompetition(id, {
                  title: editTitle,
                  description: editDescription,
                  rulesMd: editRules,
                  ...(detail.type !== "free" ? {
                    baseFee: Math.round(Number(editBaseFee) * 100),
                    perEventFee: Math.round(Number(editPerEventFee) * 100),
                  } : {}),
                });
                if (bannerFile) await uploadCompetitionBanner(id, bannerFile);
                if (mobileBannerFile) await uploadCompetitionMobileBanner(id, mobileBannerFile);
              })
            }
            className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          >
            {busy === "details" ? "Saving…" : "Save Details"}
          </button>
        </div>

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
            className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
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
              {ev.fee != null && (
                <span className="ml-2 normal-case tracking-normal text-emerald-500">
                  ₹{(ev.fee / 100).toFixed(0)}/event
                </span>
              )}
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

      {/* ── Bulk Email Modal ── */}
      {showEmailModal && (
        <BulkEmailModal
          competitionId={id}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {/* ── Practice Event Modal ── */}
      {showPracticeModal && (
        <PracticeEventModal
          competitionId={id}
          onClose={() => setShowPracticeModal(false)}
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
  const [csvRecipients, setCsvRecipients] = useState<Array<{ email: string; name: string }>>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setErr("CSV must have a header row and at least one data row");
        return;
      }
      const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
      const emailIdx = headers.indexOf("email");
      const nameIdx = headers.indexOf("name");
      if (emailIdx === -1) {
        setErr("CSV must have an 'email' column");
        return;
      }
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
          email: cols[emailIdx] ?? "",
          name: nameIdx >= 0 ? (cols[nameIdx] ?? "") : "",
        };
      }).filter((r) => r.email);

      if (parsed.length === 0) {
        setErr("No valid email rows found in CSV");
        return;
      }
      setCsvRecipients(parsed);
      setCsvFileName(file.name);
      setErr(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    setSending(true);
    setErr(null);
    try {
      const body: { subject: string; bodyHtml: string; recipients?: Array<{ email: string; name: string }> } = {
        subject,
        bodyHtml,
      };
      if (csvRecipients.length > 0) body.recipients = csvRecipients;
      const res = await sendBulkEmail(competitionId, body);
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Send Bulk Email</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
              <p className="text-sm text-emerald-300">{result.message}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {result.recipientCount} recipient{result.recipientCount !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-zinc-800 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Recipients</label>
              <div className="flex items-center gap-2">
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
                <button
                  type="button"
                  onClick={() => csvRef.current?.click()}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Upload CSV
                </button>
                {csvFileName ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    {csvFileName} ({csvRecipients.length} recipients)
                    <button
                      type="button"
                      onClick={() => { setCsvRecipients([]); setCsvFileName(null); }}
                      className="ml-1 text-zinc-500 hover:text-zinc-300"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">
                    All registrants (default)
                  </span>
                )}
              </div>
            </div>
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
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                disabled={sending || !subject.trim() || !bodyHtml.trim()}
                onClick={handleSend}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                {sending
                  ? "Sending…"
                  : csvRecipients.length > 0
                    ? `Send to ${csvRecipients.length} CSV Recipients`
                    : "Send to All Registrants"}
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
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [roundError, setRoundError] = useState<string | null>(null);
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

  const saveSchedule = async () => {
    setRoundError(null);
    try {
      await updateRound(round.id, {
        opensAt: toISO(opensAt),
        closesAt: toISO(closesAt),
        advancementCriteria: buildCriteria(),
        ...(duration ? { durationMinutes: Number(duration) } : {}),
      });
      onRun(`sched-${round.id}`, () => Promise.resolve());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        const jsonMatch = msg.match(/\{.*\}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setRoundError(
            parsed.errors?.join(", ") ?? parsed.error ?? msg,
          );
        } else {
          setRoundError(msg);
        }
      } catch {
        setRoundError(msg);
      }
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
        <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">R{round.roundNumber}</span>
        <StatusBadge status={round.status} domain="round" />

        {/* Show scheduled times if set */}
        {(round.opensAt || round.closesAt) && (
          <span className="text-xs text-zinc-500">
            {round.opensAt
              ? round.status === "pending"
                ? <>Starts in <Countdown target={round.opensAt} className="font-semibold text-accent-primary" /> ({new Date(round.opensAt).toLocaleString()})</>
                : `opens ${new Date(round.opensAt).toLocaleString()}`
              : ""}
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
                  : "border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
            title="Set open / close times — round auto-transitions when the time is reached"
          >
            ⏱ {round.opensAt || round.closesAt ? "Edit Times" : "Set Times"}
          </button>

          {/* Cancel round */}
          {round.status !== "cancelled" && round.status !== "advanced" && round.status !== "closed" && (
            <button
              disabled={busy === `cancel-${round.id}`}
              onClick={() => setConfirmingCancel(true)}
              className="rounded border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/30 disabled:opacity-40"
            >
              {busy === `cancel-${round.id}` ? "Cancelling…" : "Cancel"}
            </button>
          )}
          <ConfirmModal
            open={confirmingCancel}
            onClose={() => setConfirmingCancel(false)}
            onConfirm={() => {
              setConfirmingCancel(false);
              onRun(`cancel-${round.id}`, () => cancelRound(round.id));
            }}
            title="Cancel this round?"
            description="Competitors currently in this round will no longer be able to submit results. This cannot be undone."
            confirmLabel="Cancel round"
          />

          <button
            disabled={busy === `notify-${round.id}`}
            onClick={() => onRun(`notify-${round.id}`, () => sendRoundNotification(round.id))}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {busy === `notify-${round.id}` ? "Sending…" : "Notify"}
          </button>

        </div>
      </div>

      {/* Collapsible schedule editor */}
      {showSchedule && (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="mb-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Round {round.roundNumber} — Open &amp; Close Times
          </p>
          <p className="mb-2 text-xs text-zinc-500">
            The round status changes automatically when each time is reached.
            The manual Open / Close buttons above override this at any time.
          </p>
          {roundError && (
            <div className="mb-3 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {roundError}
            </div>
          )}
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
              className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
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

/* ── Practice event modal ── */

function PracticeEventModal({
  competitionId,
  onClose,
}: {
  competitionId: string;
  onClose: () => void;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ id: string; title: string; participantsCopied: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setErr(null);
    try {
      const res = await createPracticeEvent(competitionId, {
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Create Practice Event</h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Creates a practice competition with all registered participants automatically added.
        </p>

        {result ? (
          <div className="space-y-3">
            <div className="rounded bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
              Created &ldquo;{result.title}&rdquo; with {result.participantsCopied} participants.
            </div>
            <div className="flex justify-end gap-2">
              <a
                href={`/admin/competitions/${result.id}`}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Open Practice Event
              </a>
              <button
                onClick={onClose}
                className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {err && <div className="mb-3 rounded bg-red-900/30 px-4 py-2 text-sm text-red-300">{err}</div>}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Starts At</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Ends At</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                disabled={creating}
                onClick={handleCreate}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create Practice Event"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Flagged result card ── */

function formatSolve(solve: { time_ms: number; inspectionPenalty?: string; penalty: string }) {
  const insp = solve.inspectionPenalty ?? "none";
  const base = formatTime(solve.time_ms);
  if (insp === "dnf" || solve.penalty === "dnf") return `DNF(${base})`;
  let extra = 0;
  if (insp === "plus2") extra += 2000;
  if (solve.penalty === "plus2") extra += 2000;
  if (extra > 0) return `${formatTime(solve.time_ms + extra)}+`;
  return base;
}

