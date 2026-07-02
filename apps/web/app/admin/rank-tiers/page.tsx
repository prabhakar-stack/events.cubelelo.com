"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchRankTiers,
  createRankTier,
  deleteRankTier,
  type RankTierDto,
} from "@/lib/api";

const TABS = [
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
  { label: "Verification", href: "/admin/verification" },
];

const EVENT_TYPES = ["3x3", "2x2", "4x4", "5x5", "pyraminx", "megaminx", "skewb", "sq1", "clock", "3x3oh", "3x3bld"];

function formatMs(ms: number) {
  const s = ms / 1000;
  const min = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return min > 0 ? `${min}:${sec.padStart(5, "0")}` : `${sec}s`;
}

export default function AdminRankTiersPage() {
  const [tiers, setTiers] = useState<RankTierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    eventType: "3x3",
    maxAo5Ms: "",
    color: "#4f46e5",
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchRankTiers()
      .then(setTiers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name.trim() || !form.maxAo5Ms) return;
    try {
      await createRankTier({
        name: form.name.trim(),
        eventType: form.eventType,
        maxAo5Ms: Number(form.maxAo5Ms),
        color: form.color,
      });
      setForm({ name: "", eventType: "3x3", maxAo5Ms: "", color: "#4f46e5" });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRankTier(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const grouped = tiers.reduce<Record<string, RankTierDto[]>>((acc, t) => {
    (acc[t.eventType] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/rank-tiers" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Rank Tiers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {showForm ? "Cancel" : "+ New Tier"}
        </button>
      </div>

      <p className="mb-6 text-sm text-zinc-500">
        Configure rank tiers for each event. A tier represents a skill bracket (e.g., &quot;Sub-10&quot; for 3x3 with maxAo5 = 10000ms).
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      {showForm && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
          <h2 className="mb-3 font-medium text-zinc-900 dark:text-white">New Rank Tier</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              placeholder="Tier Name (e.g. Sub-10)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {EVENT_TYPES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Max Ao5 (ms)"
              value={form.maxAo5Ms}
              onChange={(e) => setForm({ ...form, maxAo5Ms: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-zinc-700"
              />
              <button
                onClick={handleCreate}
                className="flex-1 rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-10 text-center text-zinc-500">No rank tiers configured yet.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([eventType, eventTiers]) => (
              <div key={eventType}>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">{eventType}</h3>
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Color</th>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Max Ao5</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventTiers.map((tier) => (
                        <tr key={tier.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40">
                          <td className="px-4 py-2">
                            <span
                              className="inline-block h-4 w-4 rounded"
                              style={{ backgroundColor: tier.color }}
                            />
                          </td>
                          <td className="px-4 py-2 text-zinc-900 dark:text-white">{tier.name}</td>
                          <td className="px-4 py-2 font-mono text-zinc-700 dark:text-zinc-300">
                            {formatMs(tier.maxAo5Ms)}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleDelete(tier.id)}
                              className="rounded bg-red-900/30 px-3 py-1 text-xs text-red-400 hover:bg-red-900/50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
