"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPromoCodes,
  fetchCompetitions,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  type PromoCodeDto,
  type CompetitionSummary,
} from "@/lib/api";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/EmptyState";


export default function AdminPromoCodesPage() {
  const toast = useToast();
  const [codes, setCodes] = useState<PromoCodeDto[]>([]);
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCompId, setFilterCompId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PromoCodeDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchPromoCodes(), fetchCompetitions()])
      .then(([promos, competitions]) => {
        setCodes(promos);
        setComps(competitions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCodes = filterCompId
    ? codes.filter((c) => c.competitionId === filterCompId)
    : codes;

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMaxUses("");
    setCompetitionId("");
    setValidFrom("");
    setValidTo("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPromoCode({
        code,
        discountType,
        discountValue: Number(discountValue),
        maxUses: maxUses ? Number(maxUses) : undefined,
        competitionId: competitionId || undefined,
        validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
        validTo: validTo ? new Date(validTo).toISOString() : undefined,
      });
      resetForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (promo: PromoCodeDto) => {
    try {
      await updatePromoCode(promo.id, { active: !promo.active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePromoCode(deleteTarget.id);
      toast.show(`Deleted promo code ${deleteTarget.code}`, "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Promo Codes</h1>
          <select
            value={filterCompId}
            onChange={(e) => setFilterCompId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="">All competitions</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          {showForm ? "Cancel" : "+ New Code"}
        </button>
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {showForm && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Create Promo Code</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CUBELELO20"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percentage" | "flat")}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (paise)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Discount Value {discountType === "percentage" ? "(%)" : "(paise)"}
              </label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 10000"}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Max Uses (0 = unlimited)</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Competition</label>
              <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">All competitions</option>
                {comps.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Valid From</label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Valid To</label>
              <input
                type="datetime-local"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <button
            disabled={saving || !code.trim() || !discountValue}
            onClick={handleCreate}
            className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            {saving ? "Creating…" : "Create Code"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : filteredCodes.length === 0 ? (
        <EmptyState icon="🏷️" title="No promo codes yet" description={'Click "+ New Code" to create one.'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Competition</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3 text-center">Usage</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40">
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {p.code}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {comps.find((c) => c.id === p.competitionId)?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {p.discountType === "percentage"
                      ? `${p.discountValue}%`
                      : `₹${(p.discountValue / 100).toFixed(0)}`}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-400">
                    {p.usedCount}{p.maxUses > 0 ? ` / ${p.maxUses}` : " / ∞"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {p.validFrom ? new Date(p.validFrom).toLocaleDateString() : "—"}
                    {" → "}
                    {p.validTo ? new Date(p.validTo).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
                    }`}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActive(p)}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {p.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="rounded border border-red-900/50 px-2 py-1 text-xs text-red-400 transition hover:bg-red-900/30"
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
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete promo code?"
        description={
          <>
            This permanently deletes <strong className="font-mono">{deleteTarget?.code}</strong>. Anyone with this
            code will no longer be able to use it. This cannot be undone.
          </>
        }
        confirmLabel="Delete code"
      />
    </div>
  );
}
