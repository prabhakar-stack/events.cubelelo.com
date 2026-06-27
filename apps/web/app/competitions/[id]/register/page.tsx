"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchCompetition,
  registerForCompetition,
  createPaymentOrder,
  type CompetitionDetail,
} from "@/lib/api";
import { RouteGuard } from "@/features/auth/RouteGuard";

function RegisterContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchCompetition(params.id).then(setComp).catch(() => {});
    }
  }, [params.id]);

  if (!comp) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  const baseFee = comp.baseFee ?? 0;
  const perEventFee = comp.perEventFee ?? 0;
  const totalFee = baseFee + perEventFee * selected.size;
  const isFree = comp.type === "free" || totalFee === 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRegister = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await registerForCompetition(comp.id, [...selected]);
      if (!isFree && reg.paymentStatus === "pending") {
        const order = await createPaymentOrder(reg.registrationId);
        // In production, open Razorpay checkout here with order.orderId
        // For now, just show the order ID
        setSuccess(true);
        setError(
          `Payment order created: ${order.orderId} (₹${(order.amount / 100).toFixed(2)}). ` +
            `In production, Razorpay checkout would open here.`,
        );
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (success && isFree) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-2xl font-bold text-emerald-400">Registered!</div>
        <p className="text-zinc-400">
          You're registered for {comp.title}. Head to the lobby when the round
          opens.
        </p>
        <button
          onClick={() => router.push(`/competitions/${comp.id}`)}
          className="rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-500"
        >
          Back to Competition
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">
        Register for {comp.title}
      </h1>
      <p className="mb-6 text-sm text-zinc-400">
        Select the events you want to compete in.
      </p>

      <div className="mb-6 space-y-2">
        {comp.events.map((ev) => (
          <label
            key={ev.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition ${
              selected.has(ev.id)
                ? "border-emerald-600 bg-emerald-900/20"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(ev.id)}
                onChange={() => toggle(ev.id)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-600"
              />
              <span className="font-semibold text-zinc-200">
                {ev.eventType}
              </span>
              <span className="text-xs text-zinc-500">
                {ev.roundCount} round{ev.roundCount > 1 ? "s" : ""}
              </span>
            </div>
            {perEventFee > 0 && (
              <span className="text-xs text-zinc-500">
                +₹{(perEventFee / 100).toFixed(0)}
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Base fee</span>
          <span className="text-zinc-200">
            {isFree ? "Free" : `₹${(baseFee / 100).toFixed(0)}`}
          </span>
        </div>
        {perEventFee > 0 && selected.size > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">
              {selected.size} event{selected.size > 1 ? "s" : ""} × ₹
              {(perEventFee / 100).toFixed(0)}
            </span>
            <span className="text-zinc-200">
              ₹{((perEventFee * selected.size) / 100).toFixed(0)}
            </span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-zinc-800 pt-2 font-semibold">
          <span className="text-zinc-300">Total</span>
          <span className="text-zinc-100">
            {isFree ? "Free" : `₹${(totalFee / 100).toFixed(0)}`}
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-amber-400">{error}</p>
      )}

      <button
        onClick={handleRegister}
        disabled={busy || selected.size === 0}
        className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy
          ? "Registering…"
          : isFree
            ? "Register (Free)"
            : `Pay ₹${(totalFee / 100).toFixed(0)}`}
      </button>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <RouteGuard>
      <RegisterContent />
    </RouteGuard>
  );
}
