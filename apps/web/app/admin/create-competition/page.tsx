"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_IDS } from "@cubers/scramble-core";
import {
  createCompetition,
  updateCompetition,
  uploadCompetitionBanner,
  uploadCompetitionMobileBanner,
  fetchSchedulingDefaults,
  type AdvancementCriteria,
  type SchedulingDefaults,
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
  fee?: number;
  durationMinutes?: number;
  roundCriteria?: (AdvancementCriteria | undefined)[];
  roundSchedule?: (RoundSchedule | undefined)[];
}

const FALLBACK_EVENT_DURATION: Record<string, number> = {
  "222": 15, "333": 20, "444": 25, "555": 30, "666": 35, "777": 40,
  pyram: 15, skewb: 15, minx: 30, "333oh": 20, "333bf": 25, sq1: 20,
  clock: 15, "444bf": 40, "555bf": 50, "333mbf": 60, fto: 25, "333fm": 60,
};
const FALLBACK_DURATION = 20;
const FALLBACK_REG_DAYS = 5;

type ScheduleField = "regOpens" | "regClose" | "compStart" | "compEnd";

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeRoundSchedules(
  compStart: Date,
  events: EventSpec[],
  gapMinutes: number,
  durationOverrides: Record<string, number>,
): { schedules: RoundSchedule[][]; endsAt: Date } {
  if (events.length === 0) return { schedules: [], endsAt: compStart };
  const maxRounds = Math.max(...events.map((e) => e.roundCount));
  const schedules: RoundSchedule[][] = events.map(() => []);
  let lastEnd = new Date(compStart);

  for (let dayOffset = 0; dayOffset < maxRounds; dayOffset++) {
    const dayBase =
      dayOffset === 0
        ? new Date(compStart)
        : new Date(
            compStart.getFullYear(),
            compStart.getMonth(),
            compStart.getDate() + dayOffset,
            compStart.getHours(),
            compStart.getMinutes(),
          );

    let cursor = new Date(dayBase);

    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei]!;
      if (dayOffset >= ev.roundCount) continue;

      const dur =
        durationOverrides[ev.eventType] ??
        FALLBACK_EVENT_DURATION[ev.eventType] ??
        FALLBACK_DURATION;

      schedules[ei]![dayOffset] = {
        startTime: toLocalDatetime(cursor),
        durationMinutes: dur,
      };

      const roundEnd = new Date(cursor.getTime() + dur * 60000);
      if (roundEnd > lastEnd) lastEnd = roundEnd;
      cursor = new Date(roundEnd.getTime() + gapMinutes * 60000);
    }
  }

  return { schedules, endsAt: lastEnd };
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
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [mobileBannerFile, setMobileBannerFile] = useState<File | null>(null);
  const [featured, setFeatured] = useState(false);
  const [gapMinutes, setGapMinutes] = useState(0);
  const [regDays, setRegDays] = useState(FALLBACK_REG_DAYS);
  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load scheduling defaults from system settings
  useEffect(() => {
    fetchSchedulingDefaults()
      .then((s) => {
        setRegDays(s.registrationDurationDays);
        setGapMinutes(s.gapBetweenEventsMinutes);
        setDurationOverrides(s.eventDurations);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  // Track which schedule fields the admin has manually set
  const userSetRef = useRef<Set<ScheduleField>>(new Set());

  // Cascade: derive all downstream fields that the user hasn't manually set.
  // changedField = the field the user just edited (anchor point).
  // All fields downstream of it that aren't in userSetRef get auto-derived.
  const cascade = useCallback(
    (
      changedField: ScheduleField,
      vals: { regOpens: string; regClose: string; compStart: string; compEnd: string },
      currentEvents: EventSpec[],
      gap: number,
      durOverrides: Record<string, number>,
    ): RoundSchedule[][] | null => {
      const pinned = userSetRef.current;
      let roundSchedulesOut: RoundSchedule[][] | null = null;

      // ── Forward cascade (downstream) ──

      // regOpens → regClose (+5 days)
      if (changedField === "regOpens" && vals.regOpens && !pinned.has("regClose")) {
        const d = new Date(new Date(vals.regOpens).getTime() + regDays * 86400000);
        vals.regClose = toLocalDatetime(d);
      }

      // regClose → compStart (same time) — only if compStart not pinned
      if ((changedField === "regOpens" || changedField === "regClose") && vals.regClose && !pinned.has("compStart")) {
        vals.compStart = vals.regClose;
      }

      // ── Backward cascade (upstream adjustments) ──

      // If compStart was set and it's before regClose, pull regClose back (if not pinned)
      if (changedField === "compStart" && vals.compStart && vals.regClose && !pinned.has("regClose")) {
        if (new Date(vals.compStart) < new Date(vals.regClose)) {
          vals.regClose = vals.compStart;
        }
      }

      // If regClose was set and it's before regOpens, pull regOpens back (if not pinned)
      if ((changedField === "regClose" || changedField === "compStart") && vals.regClose && vals.regOpens && !pinned.has("regOpens")) {
        if (new Date(vals.regClose) < new Date(vals.regOpens)) {
          vals.regOpens = vals.regClose;
          setRegistrationOpensAt(vals.regOpens);
        }
      }

      // ── Round schedules + compEnd (always recompute from compStart) ──

      if (vals.compStart && currentEvents.length > 0) {
        const { schedules, endsAt } = computeRoundSchedules(
          new Date(vals.compStart),
          currentEvents,
          gap,
          durOverrides,
        );
        roundSchedulesOut = schedules;
        // compEnd always follows round schedules unless admin explicitly set it
        if (!pinned.has("compEnd")) {
          vals.compEnd = toLocalDatetime(endsAt);
        }
      }

      setRegistrationDeadline(vals.regClose);
      setStartsAt(vals.compStart);
      setEndsAt(vals.compEnd);
      return roundSchedulesOut;
    },
    [regDays],
  );

  const handleScheduleChange = (field: ScheduleField, value: string) => {
    userSetRef.current.add(field);
    const vals = {
      regOpens: field === "regOpens" ? value : registrationOpensAt,
      regClose: field === "regClose" ? value : registrationDeadline,
      compStart: field === "compStart" ? value : startsAt,
      compEnd: field === "compEnd" ? value : endsAt,
    };
    if (field === "regOpens") setRegistrationOpensAt(value);
    const schedules = cascade(field, vals, events, gapMinutes, durationOverrides);
    if (schedules) {
      setEvents((prev) =>
        prev.map((ev, i) => ({
          ...ev,
          roundSchedule: schedules[i] ?? ev.roundSchedule,
        })),
      );
    }
  };

  // Re-cascade when events, gap, or durations change (recompute round schedules + compEnd)
  const recascadeRounds = useCallback(
    (newEvents: EventSpec[], gap: number, durOverrides: Record<string, number>) => {
      if (!startsAt || newEvents.length === 0) return;
      const { schedules, endsAt: newEnd } = computeRoundSchedules(
        new Date(startsAt),
        newEvents,
        gap,
        durOverrides,
      );
      setEvents((prev) =>
        prev.map((ev, i) => ({
          ...ev,
          roundSchedule: schedules[i] ?? ev.roundSchedule,
        })),
      );
      // compEnd always follows when rounds change (events/durations/gap),
      // since those directly define when the competition actually finishes
      setEndsAt(toLocalDatetime(newEnd));
      userSetRef.current.delete("compEnd");
    },
    [startsAt],
  );

  const addEvent = () => {
    const next = [...events, { eventType: "333", roundCount: 1 }];
    setEvents(next);
    recascadeRounds(next, gapMinutes, durationOverrides);
  };
  const removeEvent = (i: number) => {
    const next = events.filter((_, idx) => idx !== i);
    setEvents(next);
    recascadeRounds(next, gapMinutes, durationOverrides);
  };
  const updateEvent = (i: number, patch: Partial<EventSpec>) => {
    const next = events.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    setEvents(next);
    if ("roundCount" in patch || "eventType" in patch) {
      recascadeRounds(next, gapMinutes, durationOverrides);
    }
  };

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
        baseFee: type === "paid" ? Math.round(baseFee * 100) : 0,
        perEventFee: type === "paid" ? Math.round(perEventFee * 100) : 0,
        registrationOpensAt: toISO(registrationOpensAt),
        registrationDeadline: toISO(registrationDeadline),
        startsAt: toISO(startsAt),
        endsAt: toISO(endsAt),
        events: events.map((ev) => ({
          ...ev,
          fee: ev.fee != null ? Math.round(ev.fee * 100) : undefined,
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
      if (bannerFile) await uploadCompetitionBanner(id, bannerFile);
      if (mobileBannerFile) await uploadCompetitionMobileBanner(id, mobileBannerFile);
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

        {/* Banners */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Desktop Banner <span className="text-zinc-400">(1200×400 recommended)</span>
            </label>
            {bannerFile && (
              <p className="mb-1 text-xs text-emerald-500">Selected: {bannerFile.name}</p>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
              className={INPUT + " file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Mobile Banner <span className="text-zinc-400">(600×400 recommended)</span>
            </label>
            {mobileBannerFile && (
              <p className="mb-1 text-xs text-emerald-500">Selected: {mobileBannerFile.name}</p>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => setMobileBannerFile(e.target.files?.[0] ?? null)}
              className={INPUT + " file:mr-3 file:rounded file:border-0 file:bg-zinc-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"}
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
                  Base Fee (₹)
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
                  Per-Event Fee (₹)
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
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Schedule
            </label>
            <button
              type="button"
              onClick={() => {
                userSetRef.current.clear();
                userSetRef.current.add("regOpens");
                if (registrationOpensAt) {
                  const vals = {
                    regOpens: registrationOpensAt,
                    regClose: "",
                    compStart: "",
                    compEnd: "",
                  };
                  const schedules = cascade("regOpens", vals, events, gapMinutes, durationOverrides);
                  if (schedules) {
                    setEvents((prev) =>
                      prev.map((ev, i) => ({
                        ...ev,
                        roundSchedule: schedules[i] ?? ev.roundSchedule,
                      })),
                    );
                  }
                }
              }}
              className="text-xs text-indigo-400 transition hover:text-indigo-300"
            >
              Reset to auto
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { label: "Registration opens", field: "regOpens" as ScheduleField, value: registrationOpensAt },
                { label: "Registration closes", field: "regClose" as ScheduleField, value: registrationDeadline },
                { label: "Competition starts", field: "compStart" as ScheduleField, value: startsAt },
                { label: "Competition ends", field: "compEnd" as ScheduleField, value: endsAt },
              ] as const
            ).map(({ label, field, value }) => (
              <div key={field}>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  {label}
                  {field !== "regOpens" && userSetRef.current.has(field) && (
                    <span className="rounded bg-indigo-900/30 px-1.5 py-0.5 text-[10px] text-indigo-400">
                      manual
                    </span>
                  )}
                  {field !== "regOpens" && !userSetRef.current.has(field) && value && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                      auto
                    </span>
                  )}
                </label>
                <input
                  type="datetime-local"
                  value={value}
                  onChange={(e) => handleScheduleChange(field, e.target.value)}
                  className={INPUT}
                />
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Dates auto-fill as you go. Override any field and everything downstream adjusts.
            Durations and gaps are configured in <a href="/admin/settings" className="text-emerald-400 hover:underline">System Settings</a>.
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
                  {type === "paid" && (
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                      Fee (₹)
                      <input
                        type="number"
                        min={0}
                        value={ev.fee ?? ""}
                        placeholder="default"
                        onChange={(e) =>
                          updateEvent(i, {
                            fee: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className={`w-24 ${SMALL_INPUT}`}
                      />
                    </label>
                  )}
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
