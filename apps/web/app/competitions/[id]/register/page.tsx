"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { eventDisplayName } from "@/lib/eventNames";
import {
  fetchCompetition,
  registerForCompetition,
  createPaymentOrder,
  validatePromoCode,
  type CompetitionDetail,
} from "@/lib/api";
import { RouteGuard } from "@/features/auth/RouteGuard";
import { useAuth } from "@/features/auth/AuthProvider";

function RegisterContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discountType: string;
    discountValue: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

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
  const subtotal = baseFee + perEventFee * selected.size;
  const discount = promoApplied
    ? promoApplied.discountType === "percentage"
      ? Math.round(subtotal * promoApplied.discountValue / 100)
      : Math.min(promoApplied.discountValue, subtotal)
    : 0;
  const totalFee = Math.max(0, subtotal - discount);
  const isFree = comp.type === "free" || totalFee === 0;

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      const res = await validatePromoCode(promoInput.trim(), comp.id);
      setPromoApplied(res);
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : "Invalid code");
      setPromoApplied(null);
    } finally {
      setPromoChecking(false);
    }
  };

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
    if (user && !user.emailVerified) {
      setShowVerifyPopup(true);
      return;
    }
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
                {eventDisplayName(ev.eventType)}
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
        {/* Promo code */}
        {comp.type !== "free" && (
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <button
                onClick={applyPromo}
                disabled={promoChecking || !promoInput.trim()}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
              >
                {promoChecking ? "…" : "Apply"}
              </button>
            </div>
            {promoError && (
              <p className="mt-1 text-xs text-red-400">{promoError}</p>
            )}
            {promoApplied && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-emerald-400">
                  {promoApplied.code} applied
                  {promoApplied.discountType === "percentage"
                    ? ` (${promoApplied.discountValue}% off)`
                    : ` (-₹${(promoApplied.discountValue / 100).toFixed(0)})`}
                </span>
                <button
                  onClick={() => { setPromoApplied(null); setPromoInput(""); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Remove
                </button>
              </div>
            )}
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

      {/* Email verification popup */}
      {showVerifyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-zinc-900 dark:text-white">
              Email Not Verified
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              You need to verify your email before you can register for competitions. Go to Settings to verify with Google.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowVerifyPopup(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => router.push("/settings")}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}
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
