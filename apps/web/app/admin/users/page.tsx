"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminUsers,
  updateAdminUser,
  type AdminUserDto,
} from "@/lib/api";

const TABS = [
  { label: "Competitions", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Migration", href: "/admin/migration" },
];

const ROLES = ["user", "judge", "moderator", "admin"];
const STAGES = ["active", "migrated_stub", "suspended", "banned"];

const STAGE_COLOR: Record<string, string> = {
  active: "text-emerald-400",
  migrated_stub: "text-amber-400",
  suspended: "text-orange-400",
  banned: "text-red-400",
};
const ROLE_COLOR: Record<string, string> = {
  admin: "text-purple-400",
  moderator: "text-blue-400",
  judge: "text-sky-400",
  user: "text-zinc-400",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminUsers({ search: search || undefined, role: roleFilter || undefined, stage: stageFilter || undefined })
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [search, roleFilter, stageFilter]);

  useEffect(() => { load(); }, [load]);

  const update = async (id: string, body: { role?: string; accountStage?: string }) => {
    setBusy(id);
    setError(null);
    try {
      await updateAdminUser(id, body);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Sub-nav */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-800/50 hover:text-zinc-200 ${
              tab.href === "/admin/users" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-100">Users</h1>
        <span className="text-sm text-zinc-500">{users.length} result{users.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name, email, CL ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-600">
          Search
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-500">
          No users found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">CL ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400">
                    <Link href={`/profile/${u.clId}`} className="hover:underline">{u.clId}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-200">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busy === u.id}
                      onChange={(e) => update(u.id, { role: e.target.value })}
                      className={`rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-semibold ${ROLE_COLOR[u.role] ?? "text-zinc-400"} disabled:opacity-50`}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.accountStage}
                      disabled={busy === u.id}
                      onChange={(e) => update(u.id, { accountStage: e.target.value })}
                      className={`rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-semibold ${STAGE_COLOR[u.accountStage] ?? "text-zinc-400"} disabled:opacity-50`}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/profile/${u.clId}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
