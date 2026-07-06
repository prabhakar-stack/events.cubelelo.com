"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_IDS } from "@cubers/scramble-core";
import {
  createCompetition,
  updateCompetition,
  type AdvancementCriteria,
} from "@/lib/api";
import { eventDisplayName } from "@/lib/eventNames";
import { EventIcon } from "@/components/EventIcon";

interface RoundSchedule {
  startTime?: string;
  durationMinutes?: number;
}

interface EventSpec {
  eventType: string;
  roundCount: number;
  cutoffMs?: number;
  timeLimitMs?: number;
  durationMinutes?: number;
  roundCriteria?: (AdvancementCriteria | undefined)[];
  roundSchedule?: (RoundSchedule | undefined)[];
}

const INPUT =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
const SMALL_INPUT =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const SELECT =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function CreateCompetitionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rulesMd, setRulesMd] = useState("");
  const [type, setType] = useState<"free" | "paid">("free");
  const [baseFee, setBaseFee] = useState(0);
  const [perEventFee, setPerEventFee] = useState(0);
  const [registrationOpensAt, setRegistrationOpensAt] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [events, setEvents] = useState<EventSpec[]>([
    { eventType: "333", roundCount: 1 },
  ]);
  const [featured, setFeatured] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const addEvent = () =>
    setEvents((prev) => [...prev, { eventType: "333", roundCount: 1 }]);
  const removeEvent = (i: number) =>
    setEvents((prev) => prev.filter((_, idx) => idx !== i));
  const updateEvent = (i: number, patch: Partial<EventSpec>) =>
    setEvents((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );

  const onSubmit = async (status: "draft" | "published") => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    setValidationErrors([]);
    try {
      const toISO = (v: string) =>
        v ? new Date(v).toISOString() : undefined;
      const body: Parameters<typeof createCompetition>[0] = {
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        rulesMd: rulesMd.trim() || undefined,
        baseFee: type === "paid" ? baseFee : 0,
        perEventFee: type === "paid" ? perEventFee : 0,
        registrationOpensAt: toISO(registrationOpensAt),
        registrationDeadline: toISO(registrationDeadline),
        startsAt: toISO(startsAt),
        endsAt: toISO(endsAt),
        events: events.map((ev) => ({
          ...ev,
          roundSchedule: ev.roundSchedule?.map((rs) =>
            rs
              ? {
                  ...rs,
                  startTime: rs.startTime
                    ? new Date(rs.startTime).toISOString()
                    : undefined,
                }
              : undefined,
          ),
        })),
      };
      const { id } = await createCompetition(body);
      const updates: Record<string, unknown> = {};
      if (status !== "draft") updates.status = status;
      if (featured) updates.featured = true;
      if (Object.keys(updates).length > 0) {
        await updateCompetition(
          id,
          updates as Parameters<typeof updateCompetition>[1],
        );
      }
      router.push("/admin");
    } catch (e: unknown) {
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
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Create Competition
      </h1>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <p>{error}</p>
          {validationErrors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {validationErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midweek Madness"
            className={INPUT}
          />
        </div>

        {/* Description + Rules */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for competitors..."
              rows={3}
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Rules (markdown)
            </label>
            <textarea
              value={rulesMd}
              onChange={(e) => setRulesMd(e.target.value)}
              placeholder="WCA regulations apply..."
              rows={3}
              className={INPUT}
            />
          </div>
        </div>

        {/* Type + fees + featured */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "free" | "paid")}
              className={SELECT}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Featured
            </label>
            <select
              value={featured ? "yes" : "no"}
              onChange={(e) => setFeatured(e.target.value === "yes")}
              className={SELECT}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {type === "paid" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Base fee (paise)
                </label>
                <input
                  type="number"
                  min={0}
                  value={baseFee}
                  onChange={(e) => setBaseFee(Number(e.target.value))}
                  className={`w-28 ${INPUT}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Per-event fee (paise)
                </label>
                <input
                  type="number"
                  min={0}
                  value={perEventFee}
                  onChange={(e) => setPerEventFee(Number(e.target.value))}
                  className={`w-28 ${INPUT}`}
                />
              </div>
            </>
          )}
        </div>

        {/* Schedule */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Schedule
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  label: "Registration opens",
                  value: registrationOpensAt,
                  set: setRegistrationOpensAt,
                },
                {
                  label: "Registration closes",
                  value: registrationDeadline,
                  set: setRegistrationDeadline,
                },
                {
                  label: "Competition starts",
                  value: startsAt,
                  set: setStartsAt,
                },
                {
                  label: "Competition ends",
                  value: endsAt,
                  set: setEndsAt,
                },
              ] as const
            ).map(({ label, value, set }) => (
              <div key={label}>
                <label className="mb-1 block text-xs text-zinc-500">
                  {label}
                </label>
                <input
                  type="datetime-local"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={INPUT}
                />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Status updates automatically once times are set.
          </p>
        </div>

        {/* Events */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-500">Events</label>
            <button
              onClick={addEvent}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              + Add event
            </button>
          </div>
          <div className="space-y-3">
            {events.map((ev, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <EventIcon eventId={ev.eventType} size={18} />
                    <select
                      value={ev.eventType}
                      onChange={(e) =>
                        updateEvent(i, { eventType: e.target.value })
                      }
                      className={SMALL_INPUT}
                    >
                      {EVENT_IDS.map((id) => (
                        <option key={id} value={id}>
                          {eventDisplayName(id)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    Rounds
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={ev.roundCount}
                      onChange={(e) =>
                        updateEvent(i, {
                          roundCount: Number(e.target.value),
                        })
                      }
                      className={`w-16 ${SMALL_INPUT}`}
                    />
                  </label>
                  {events.length > 1 && (
                    <button
                      onClick={() => removeEvent(i)}
                      className="ml-auto text-xs text-zinc-500 transition hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Per-round config */}
                <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  {Array.from({ length: ev.roundCount }, (_, ri) => {
                    const isLast = ri === ev.roundCount - 1;
                    const criteria = ev.roundCriteria?.[ri];
                    const schedule = ev.roundSchedule?.[ri];
                    const updateRoundCriteria = (
                      c: AdvancementCriteria | undefined,
                    ) => {
                      const arr = [
                        ...(ev.roundCriteria ??
                          new Array(ev.roundCount).fill(undefined)),
                      ];
                      while (arr.length < ev.roundCount) arr.push(undefined);
                      arr[ri] = c;
                      updateEvent(i, { roundCriteria: arr });
                    };
                    const updateRoundSchedule = (
                      patch: Partial<RoundSchedule>,
                    ) => {
                      const arr = [
                        ...(ev.roundSchedule ??
                          new Array(ev.roundCount).fill(undefined)),
                      ];
                      while (arr.length < ev.roundCount) arr.push(undefined);
                      arr[ri] = { ...(arr[ri] ?? {}), ...patch };
                      updateEvent(i, { roundSchedule: arr });
                    };
                    return (
                      <div
                        key={ri}
                        className="rounded-lg border border-zinc-100 bg-white/50 px-3 py-2 dark:border-zinc-800/60 dark:bg-zinc-900/30"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-24 text-xs font-medium text-zinc-400">
                            Round {ri + 1}
                            {isLast ? " (Final)" : ""}
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                            Start
                            <input
                              type="datetime-local"
                              value={schedule?.startTime ?? ""}
                              onChange={(e) =>
                                updateRoundSchedule({
                                  startTime: e.target.value || undefined,
                                })
                              }
                              className={SMALL_INPUT}
                            />
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                            Duration (min)
                            <input
                              type="number"
                              min={1}
                              value={schedule?.durationMinutes ?? ""}
                              onChange={(e) =>
                                updateRoundSchedule({
                                  durationMinutes: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              placeholder="—"
                              className={`w-20 ${SMALL_INPUT}`}
                            />
                          </label>
                          {ev.roundCount > 1 && (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                                {isLast ? "Top Finishers" : "Shortlist"}
                                <select
                                  value={criteria?.method ?? "none"}
                                  onChange={(e) => {
                                    const m = e.target.value;
                                    if (m === "none")
                                      updateRoundCriteria(undefined);
                                    else
                                      updateRoundCriteria({
                                        method: m as "rank" | "time",
                                      });
                                  }}
                                  className={SMALL_INPUT}
                                >
                                  <option value="none">None</option>
                                  <option value="rank">Top N</option>
                                  <option value="time">ao5 ≤ X</option>
                                </select>
                              </label>
                              {criteria?.method === "rank" && (
                                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                                  N
                                  <input
                                    type="number"
                                    min={1}
                                    value={criteria.rankLimit ?? ""}
                                    onChange={(e) =>
                                      updateRoundCriteria({
                                        method: "rank",
                                        rankLimit: Number(e.target.value),
                                      })
                                    }
                                    placeholder="10"
                                    className={`w-16 ${SMALL_INPUT}`}
                                  />
                                </label>
                              )}
                              {criteria?.method === "time" && (
                                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                                  Limit (s)
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      criteria.timeLimitMs
                                        ? criteria.timeLimitMs / 1000
                                        : ""
                                    }
                                    onChange={(e) =>
                                      updateRoundCriteria({
                                        method: "time",
                                        timeLimitMs:
                                          Number(e.target.value) * 1000,
                                      })
                                    }
                                    placeholder="30"
                                    className={`w-20 ${SMALL_INPUT}`}
                                  />
                                </label>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            onClick={() => onSubmit("draft")}
            disabled={creating || !title.trim()}
            className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
    </div>
  );
}
