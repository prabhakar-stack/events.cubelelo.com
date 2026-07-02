"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchAllAppeals, resolveAppeal, type AppealDto } from "@/lib/api";

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

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<AppealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  const load = useCallback(() => {
    setLoading(true);
    fetchAllAppeals()
      .then(setAppeals)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(id: string, action: "accepted" | "rejected") {
    setResolving(id);
    try {
      await resolveAppeal(id, action, responseText[id]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(null);
    }
  }

  const filtered = filter === "all" ? appeals : appeals.filter((a) => a.status === filter);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/appeals" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <h1 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">Appeals</h1>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      <div className="mb-4 flex gap-2">
        {(["all", "pending", "accepted", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-sm capitalize ${
              filter === f ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-10 text-center text-zinc-500">No appeals found.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-white">{a.userName ?? "Unknown"}</span>
                    <span className="text-sm text-zinc-500">{a.userClId}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[a.status] ?? ""}`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">{a.reason}</p>
                  <p className="text-xs text-zinc-500">
                    Result: {a.resultId.slice(0, 8)}... | Flag: {a.flagStatus ?? "—"} |{" "}
                    {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                  {a.adminResponse && (
                    <p className="mt-2 rounded bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Admin: {a.adminResponse}
                    </p>
                  )}
                </div>
              </div>

              {a.status === "pending" && (
                <div className="mt-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                  <textarea
                    placeholder="Response (optional)"
                    value={responseText[a.id] ?? ""}
                    onChange={(e) =>
                      setResponseText((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    className="mb-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={resolving === a.id}
                      onClick={() => handleResolve(a.id, "accepted")}
                      className="rounded bg-emerald-700 px-4 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      disabled={resolving === a.id}
                      onClick={() => handleResolve(a.id, "rejected")}
                      className="rounded bg-red-700 px-4 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
