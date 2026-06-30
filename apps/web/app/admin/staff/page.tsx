"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminUsers,
  updateAdminUser,
  createStaff,
  type AdminUserDto,
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
];

const STAFF_ROLES = ["judge", "moderator"] as const;

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "judge" as "judge" | "moderator" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminUsers()
      .then((users) => setStaff(users.filter((u) => u.role === "judge" || u.role === "moderator" || u.role === "admin")))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      setError("Email and name are required.");
      return;
    }
    setBusy("create");
    setError(null);
    setSuccess(null);
    try {
      const result = await createStaff(form);
      setSuccess(`Created ${result.role} account for ${result.email} (${result.clId})`);
      setForm({ email: "", name: "", role: "judge" });
      setCreating(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (user: AdminUserDto, newRole: string) => {
    if (newRole === user.role) return;
    setBusy(user.id);
    setError(null);
    try {
      await updateAdminUser(user.id, { role: newRole });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const demote = async (user: AdminUserDto) => {
    if (!confirm(`Demote ${user.name} from ${user.role} to regular user?`)) return;
    setBusy(`demote-${user.id}`);
    try {
      await updateAdminUser(user.id, { role: "user" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "admin": return "text-red-400 bg-red-900/30";
      case "moderator": return "text-purple-400 bg-purple-900/30";
      case "judge": return "text-blue-400 bg-blue-900/30";
      default: return "text-zinc-400 bg-zinc-800";
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/staff" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Staff Management</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create and manage judge and moderator accounts. Judges can verify results; moderators can manage competitions.
          </p>
        </div>
        {!creating && (
          <button onClick={() => { setCreating(true); setError(null); setSuccess(null); }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            + Create Staff
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
      {success && <div className="mb-4 rounded bg-emerald-100 px-4 py-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{success}</div>}

      {creating && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Create Staff Account</h2>
          <p className="mb-4 text-xs text-zinc-500">
            If the email matches an existing user, their role will be updated. Otherwise a new account is created.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Email</label>
                <input value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="judge@cubelelo.com"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Name</label>
                <input value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Role</label>
              <div className="flex gap-3">
                {STAFF_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <input type="radio" name="role" value={r} checked={form.role === r}
                      onChange={() => setForm((f) => ({ ...f, role: r }))}
                      className="accent-emerald-500" />
                    <span className="capitalize">{r}</span>
                    <span className="text-[10px] text-zinc-600">
                      {r === "judge" ? "(verify results only)" : "(manage competitions + verify)"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleCreate} disabled={busy === "create"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy === "create" ? "Creating..." : "Create"}
              </button>
              <button onClick={() => { setCreating(false); setError(null); }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-10 text-center text-zinc-500">
          No staff accounts found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">CL ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40">
                  <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200">{u.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{u.clId}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleColor(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.role !== "admin" && (
                      <div className="flex gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          disabled={busy === u.id}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          <option value="judge">Judge</option>
                          <option value="moderator">Moderator</option>
                        </select>
                        <button onClick={() => demote(u)} disabled={busy === `demote-${u.id}`}
                          className="rounded border border-red-900/40 px-2 py-1 text-xs text-red-500 hover:bg-red-950/30 disabled:opacity-40">
                          Remove
                        </button>
                      </div>
                    )}
                    {u.role === "admin" && (
                      <span className="text-xs text-zinc-600">System admin</span>
                    )}
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
