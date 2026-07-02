"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMigrationStats, sendMigrationEmails, type MigrationStats } from "@/lib/api";

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

export default function AdminMigrationPage() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMigrationStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Sub-nav */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/migration" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">Legacy Migration</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Manage the import of historical cubelelo-event data. The ETL script populates
        <code className="mx-1 rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">migrated_stub</code>
        accounts for every legacy user. Users claim their stub at{" "}
        <Link href="/register/migrate" className="text-emerald-400 hover:underline">/register/migrate</Link>.
      </p>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : stats ? (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total users", value: stats.totalUsers, color: "text-zinc-900 dark:text-zinc-100" },
              { label: "Active accounts", value: stats.activeUsers, color: "text-emerald-400" },
              { label: "Unclaimed stubs", value: stats.unclaimedStubs, color: stats.unclaimedStubs > 0 ? "text-amber-400" : "text-zinc-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 p-5 text-center">
                <div className={`font-mono text-3xl font-bold ${color}`}>{value}</div>
                <div className="mt-1 text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </div>

          {/* ETL instructions */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Running the ETL</h2>
            <p className="mb-3 text-xs text-zinc-400">
              The ETL script lives at{" "}
              <code className="rounded bg-zinc-200 px-1 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">packages/database/etl/</code>.
              It takes a legacy cubelelo-event CSV or DB dump and creates <code className="rounded bg-zinc-200 px-1 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">migrated_stub</code> user rows.
            </p>
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-3 font-mono text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <p className="text-zinc-600"># 1. Export legacy data</p>
              <p>pg_dump cubelelo_event &gt; legacy_dump.sql</p>
              <p className="mt-2 text-zinc-600"># 2. Run ETL</p>
              <p>DATABASE_URL=... node packages/database/etl/import.js --input legacy_dump.sql</p>
              <p className="mt-2 text-zinc-600"># 3. Refresh stats above</p>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              ETL script is deferred (sprint 11 in the build order). The claim flow at{" "}
              <code className="rounded bg-zinc-200 px-1 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">/register/migrate</code>{" "}
              is already live and ready to accept stub claims once ETL runs.
            </p>
          </div>

          {/* Migration email campaign */}
          {stats.stubs.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-5">
              <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email Campaign</h2>
              <p className="mb-3 text-xs text-zinc-400">
                Send personalized claim emails to all {stats.stubs.length} unclaimed stub accounts.
              </p>
              <button
                onClick={async () => {
                  if (!confirm(`Send migration emails to ${stats.stubs.length} unclaimed accounts?`)) return;
                  try {
                    const result = await sendMigrationEmails();
                    alert(`Sent ${result.sentCount} of ${result.totalStubs} emails.`);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : String(e));
                  }
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Send Migration Emails
              </button>
            </div>
          )}

          {/* Unclaimed stubs */}
          {stats.stubs.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Unclaimed stubs ({stats.stubs.length})
              </h2>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">CL ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Imported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.stubs.map((u) => (
                      <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40">
                        <td className="px-4 py-2.5 font-mono text-xs text-amber-400">{u.clId}</td>
                        <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{u.name}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{u.email}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-600">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stats.stubs.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center text-zinc-500">
              No unclaimed stubs. ETL has not been run yet, or all legacy users have claimed their accounts.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
