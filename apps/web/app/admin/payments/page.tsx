"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchAdminPayments, downloadInvoice, confirmPayment, type AdminPaymentDto } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";


const STATUSES = ["pending", "paid", "failed", "refunded", "refund_pending"];

const STATUS_COLOR: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  refund_pending: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function fmt(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminPayments(statusFilter || undefined)
      .then(setPayments)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const total = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  const handleConfirm = async () => {
    if (!confirmingId) return;
    setConfirming(true);
    try {
      await confirmPayment(confirmingId, "Manual confirmation by admin");
      setConfirmingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      {/* Sub-nav */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Payments</h1>
        {!statusFilter && (
          <span className="font-mono text-sm text-emerald-400">
            Total collected: {fmt(total)}
          </span>
        )}
      </div>

      {/* Summary chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {["", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              statusFilter === s
                ? "border-zinc-400 bg-zinc-800 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
            }`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : payments.length === 0 ? (
        <EmptyState icon="💳" title="No payments found" description="Payment records will appear here once competitors start registering." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Competition</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Razorpay Order</th>
                <th className="px-4 py-3">Razorpay Payment</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-800 dark:text-zinc-200">{p.userName}</div>
                    <div className="font-mono text-xs text-zinc-500">{p.userClId}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.competitionTitle}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {fmt(p.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[p.status] ?? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 max-w-[140px] truncate">
                    {p.razorpayOrderId ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 max-w-[140px] truncate">
                    {p.razorpayPaymentId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.status === "pending" && (
                        <button
                          onClick={() => setConfirmingId(p.id)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Confirm
                        </button>
                      )}
                      {p.status === "paid" && (
                        <button
                          onClick={() => downloadInvoice(p.id)}
                          className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Invoice
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmingId}
        onClose={() => setConfirmingId(null)}
        onConfirm={handleConfirm}
        loading={confirming}
        title="Confirm payment?"
        description="This marks the payment as paid and completes the registration. Use this for offline/cash payments. This action is logged."
        confirmLabel="Confirm Payment"
      />
    </div>
  );
}
