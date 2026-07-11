"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_IDS } from "@cubers/scramble-core";
import {
  fetchSystemSettings,
  updateSystemSettings,
  type SystemSettingsDto,
} from "@/lib/api";
import { eventDisplayName } from "@/lib/eventNames";
import { EventIcon } from "@/components/EventIcon";

const INPUT =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local edit state
  const [eventDurations, setEventDurations] = useState<Record<string, number>>({});
  const [regDays, setRegDays] = useState(5);
  const [gapMinutes, setGapMinutes] = useState(0);
  const [defaultDuration, setDefaultDuration] = useState(20);
  const [videoDeadline, setVideoDeadline] = useState(1440);

  const load = useCallback(() => {
    setLoading(true);
    fetchSystemSettings()
      .then((s) => {
        setSettings(s);
        setEventDurations(s.eventDurations);
        setRegDays(s.registrationDurationDays);
        setGapMinutes(s.gapBetweenEventsMinutes);
        setDefaultDuration(s.defaultRoundDurationMinutes);
        setVideoDeadline(s.videoDeadlineMinutes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateSystemSettings({
        eventDurations,
        registrationDurationDays: regDays,
        gapBetweenEventsMinutes: gapMinutes,
        defaultRoundDurationMinutes: defaultDuration,
        videoDeadlineMinutes: videoDeadline,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-zinc-500">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          System Settings
        </h1>
        <Link href="/admin" className="text-xs text-zinc-500 transition hover:text-zinc-300">
          ← Back
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* ── Scheduling Defaults ── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Scheduling Defaults
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            These values are used by the auto-scheduler when creating or editing competitions.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Registration Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={regDays}
                  onChange={(e) => setRegDays(Number(e.target.value))}
                  className={`w-20 ${INPUT}`}
                />
                <span className="text-xs text-zinc-400">days</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Gap between registration open and close
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Gap Between Events
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={gapMinutes}
                  onChange={(e) => setGapMinutes(Number(e.target.value))}
                  className={`w-20 ${INPUT}`}
                />
                <span className="text-xs text-zinc-400">min</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Break between back-to-back events
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Default Round Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(Number(e.target.value))}
                  className={`w-20 ${INPUT}`}
                />
                <span className="text-xs text-zinc-400">min</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Fallback if no per-event duration is set
              </p>
            </div>
          </div>
        </section>

        {/* ── Per-Event Durations ── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Event Round Durations
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            How long each round lasts per event type. Used by the auto-scheduler.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EVENT_IDS.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800/60 dark:bg-zinc-900/50"
              >
                <EventIcon eventId={id} size={18} />
                <span className="min-w-[5rem] text-sm text-zinc-700 dark:text-zinc-300">
                  {eventDisplayName(id)}
                </span>
                <input
                  type="number"
                  min={1}
                  value={eventDurations[id] ?? defaultDuration}
                  onChange={(e) =>
                    setEventDurations((prev) => ({
                      ...prev,
                      [id]: Number(e.target.value),
                    }))
                  }
                  className={`w-16 ${INPUT}`}
                />
                <span className="text-xs text-zinc-400">min</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Competition Defaults ── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Competition Defaults
          </h2>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Video Upload Deadline
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={videoDeadline}
                onChange={(e) => setVideoDeadline(Number(e.target.value))}
                className={`w-24 ${INPUT}`}
              />
              <span className="text-xs text-zinc-400">minutes</span>
              <span className="text-xs text-zinc-500">
                ({Math.floor(videoDeadline / 60)}h {videoDeadline % 60}m after round closes)
              </span>
            </div>
          </div>
        </section>

        {/* ── Save ── */}
        <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400">Settings saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
