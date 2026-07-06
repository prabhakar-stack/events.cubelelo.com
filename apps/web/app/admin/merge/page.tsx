"use client";

import { useState } from "react";
import Link from "next/link";
import { mergeAccounts, type MergeResult } from "@/lib/api";


export default function AdminMergePage() {
  const [keepId, setKeepId] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MergeResult | null>(null);

  async function handleMerge() {
    if (!keepId.trim() || !mergeId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await mergeAccounts(keepId.trim(), mergeId.trim());
      setResult(r);
      setKeepId("");
      setMergeId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">Merge Duplicate Accounts</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Merge two user accounts into one. The &quot;keep&quot; account retains its profile. All registrations
        and results from the &quot;merge&quot; account are moved to the keep account, and the merge account is suspended.
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      {result && (
        <div className="mb-4 rounded bg-emerald-100 px-4 py-3 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <p className="font-medium">Merge complete!</p>
          <p className="text-sm">
            Kept: {result.kept.name} ({result.kept.clId}) | Merged: {result.merged.name} ({result.merged.clId})
          </p>
          <p className="text-sm">
            Moved {result.movedRegistrations} registrations and {result.movedResults} results.
          </p>
        </div>
      )}

      <div className="max-w-lg rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
        <div className="mb-4">
          <label className="mb-1 block text-sm text-zinc-500">Keep Account (User ID)</label>
          <input
            value={keepId}
            onChange={(e) => setKeepId(e.target.value)}
            placeholder="UUID of account to keep"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          <p className="mt-1 text-xs text-zinc-500">This account&apos;s profile will be preserved.</p>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-zinc-500">Merge Account (User ID)</label>
          <input
            value={mergeId}
            onChange={(e) => setMergeId(e.target.value)}
            placeholder="UUID of account to merge"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          <p className="mt-1 text-xs text-zinc-500">This account will be suspended after merging.</p>
        </div>
        <button
          onClick={handleMerge}
          disabled={loading || !keepId.trim() || !mergeId.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Merging..." : "Merge Accounts"}
        </button>
      </div>
    </div>
  );
}
