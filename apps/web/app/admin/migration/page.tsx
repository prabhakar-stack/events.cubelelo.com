"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMigrationStats, type MigrationStats } from "@/lib/api";

const TABS = [
  { label: "Competitions", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Migration", href: "/admin/migration" },
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
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Sub-nav */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-800/50 hover:text-zinc-200 ${
              tab.href === "/admin/migration" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <h1 className="mb-2 text-xl font-bold text-zinc-100">Legacy Migration</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Manage the import of historical cubelelo-event data. The ETL script populates
        <code className="mx-1 rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">migrated_stub</code>
        accounts for every legacy user. Users claim their stub at{" "}
        <Link href="/register/migrate" className="text-emerald-400 hover:underline">/register/migrate</Link>.
      </p>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : stats ? (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total users", value: stats.totalUsers, color: "text-zinc-100" },
              { label: "Active accounts", value: stats.activeUsers, color: "text-emerald-400" },
              { label: "Unclaimed stubs", value: stats.unclaimedStubs, color: stats.unclaimedStubs > 0 ? "text-amber-400" : "text-zinc-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-center">
                <div className={`font-mono text-3xl font-bold ${color}`}>{value}</div>
                <div className="mt-1 text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </div>

          {/* ETL instructions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">Running the ETL</h2>
            <p className="mb-3 text-xs text-zinc-400">
              The ETL script lives at{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">packages/database/etl/</code>.
              It takes a legacy cubelelo-event CSV or DB dump and creates <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">migrated_stub</code> user rows.
            </p>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-400">
              <p className="text-zinc-600"># 1. Export legacy data</p>
              <p>pg_dump cubelelo_event &gt; legacy_dump.sql</p>
              <p className="mt-2 text-zinc-600"># 2. Run ETL</p>
              <p>DATABASE_URL=... node packages/database/etl/import.js --input legacy_dump.sql</p>
              <p className="mt-2 text-zinc-600"># 3. Refresh stats above</p>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              ETL script is deferred (sprint 11 in the build order). The claim flow at{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">/register/migrate</code>{" "}
              is already live and ready to accept stub claims once ETL runs.
            </p>
          </div>

          {/* Unclaimed stubs */}
          {stats.stubs.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                Unclaimed stubs ({stats.stubs.length})
              </h2>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">CL ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Imported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.stubs.map((u) => (
                      <tr key={u.id} className="border-b border-zinc-800/50">
                        <td className="px-4 py-2.5 font-mono text-xs text-amber-400">{u.clId}</td>
                        <td className="px-4 py-2.5 text-zinc-300">{u.name}</td>
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
            <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
              No unclaimed stubs. ETL has not been run yet, or all legacy users have claimed their accounts.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
