"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  type AdminUserDto,
} from "@/lib/api";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/EmptyState";


const STAGES = ["active", "migrated_stub", "suspended", "banned"];

const STAGE_COLOR: Record<string, string> = {
  active: "text-emerald-400",
  migrated_stub: "text-amber-400",
  suspended: "text-orange-400",
  banned: "text-red-400",
};

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<{ user: AdminUserDto; stage: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserDto | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminUsers({ search: search || undefined, stage: stageFilter || undefined })
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [search, stageFilter]);

  useEffect(() => { load(); }, [load]);

  const requestStageChange = (user: AdminUserDto, stage: string) => {
    if (stage === user.accountStage) return;
    setPendingStage({ user, stage });
  };

  const confirmStageChange = async () => {
    if (!pendingStage) return;
    const { user, stage } = pendingStage;
    setConfirmBusy(true);
    try {
      await updateAdminUser(user.id, { accountStage: stage });
      toast.show(`${user.name} is now ${stage}`, "success");
      setPendingStage(null);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setConfirmBusy(true);
    try {
      await deleteAdminUser(deleteTarget.id);
      toast.show(`Deleted user ${deleteTarget.name}`, "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      {/* Sub-nav */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Users</h1>
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
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600">
          Search
        </button>
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : users.length === 0 ? (
        <EmptyState icon="🔍" title="No users found" description="Try adjusting your search or stage filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">CL ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40">
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400">
                    <Link href={`/profile/${u.clId}`} className="hover:underline">{u.clId}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.accountStage}
                      disabled={busy === u.id}
                      onChange={(e) => requestStageChange(u, e.target.value)}
                      className={`rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900 ${STAGE_COLOR[u.accountStage] ?? "text-zinc-400"} disabled:opacity-50`}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${u.clId}`}
                        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                        View →
                      </Link>
                      <button
                        disabled={busy === u.id}
                        onClick={() => setDeleteTarget(u)}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!pendingStage}
        onClose={() => setPendingStage(null)}
        onConfirm={confirmStageChange}
        loading={confirmBusy}
        destructive={pendingStage?.stage === "banned" || pendingStage?.stage === "suspended"}
        title="Change account stage?"
        description={
          <>
            Set <strong>{pendingStage?.user.name}</strong>&apos;s account to{" "}
            <strong>{pendingStage?.stage}</strong>? This changes what they can access immediately.
          </>
        }
        confirmLabel="Confirm"
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteUser}
        loading={confirmBusy}
        title="Delete user?"
        description={
          <>
            Permanently delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})? This cannot be undone.
          </>
        }
        confirmLabel="Delete user"
      />
    </div>
  );
}
