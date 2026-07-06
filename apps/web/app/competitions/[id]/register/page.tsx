"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { eventDisplayName } from "@/lib/eventNames";
import { eventIcon } from "@/lib/eventIcons";
import {
  fetchCompetition,
  registerForCompetition,
  createPaymentOrder,
  validatePromoCode,
  type CompetitionDetail,
} from "@/lib/api";
import { RouteGuard } from "@/features/auth/RouteGuard";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/Skeleton";

function RegisterContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentPending, setPaymentPending] = useState<{ orderId: string; amount: number } | null>(null);
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
      <main className="mx-auto max-w-lg px-6 py-10">
        <Skeleton className="mb-2 h-8 w-2/3" />
        <Skeleton className="mb-6 h-4 w-1/2" />
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
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
    if (user && (!user.emailVerified || !user.mobileVerified)) {
      setShowVerifyPopup(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reg = await registerForCompetition(comp.id, [...selected]);
      if (!isFree && reg.paymentStatus === "pending") {
        // Online checkout isn't wired up yet — the registration exists but is
        // NOT complete, so this must never be shown as a success state.
        const order = await createPaymentOrder(reg.registrationId);
        setPaymentPending({ orderId: order.orderId, amount: order.amount });
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (paymentPending) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-xl font-bold text-amber-500">Payment Pending</div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your spot for {comp.title} is being held, but online checkout isn&apos;t available yet — your registration
          is <strong className="text-zinc-700 dark:text-zinc-200">not complete</strong> until payment (₹
          {(paymentPending.amount / 100).toFixed(2)}) is confirmed. Contact support with order ID{" "}
          <span className="font-mono text-zinc-700 dark:text-zinc-300">{paymentPending.orderId}</span> to finish
          paying.
        </p>
        <Button variant="secondary" onClick={() => router.push(`/competitions/${comp.id}`)}>
          Back to Competition
        </Button>
      </main>
    );
  }

  if (success && isFree) {
    return (
      <main className="fade-slide-in mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-2xl font-bold text-accent-primary">Registered!</div>
        <p className="text-zinc-500 dark:text-zinc-400">
          You're registered for {comp.title}. Head to the lobby when the round
          opens.
        </p>
        <Button onClick={() => router.push(`/competitions/${comp.id}`)}>Back to Competition</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Register for {comp.title}
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Select the events you want to compete in.
      </p>

      <div className="mb-6 space-y-2">
        {comp.events.map((ev) => (
          <label
            key={ev.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition ${
              selected.has(ev.id)
                ? "border-accent-primary/60 bg-accent-primary/10"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(ev.id)}
                onChange={() => toggle(ev.id)}
                className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
              />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {eventIcon(ev.eventType).emoji} {eventDisplayName(ev.eventType)}
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

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Base fee</span>
          <span className="text-zinc-800 dark:text-zinc-200">
            {isFree ? "Free" : `₹${(baseFee / 100).toFixed(0)}`}
          </span>
        </div>
        {perEventFee > 0 && selected.size > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">
              {selected.size} event{selected.size > 1 ? "s" : ""} × ₹
              {(perEventFee / 100).toFixed(0)}
            </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              ₹{((perEventFee * selected.size) / 100).toFixed(0)}
            </span>
          </div>
        )}
        {/* Promo code */}
        {comp.type !== "free" && (
          <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="flex gap-2">
              <Input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={applyPromo}
                disabled={promoChecking || !promoInput.trim()}
              >
                {promoChecking ? "…" : "Apply"}
              </Button>
            </div>
            {promoError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{promoError}</p>
            )}
            {promoApplied && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-accent-primary">
                  {promoApplied.code} applied
                  {promoApplied.discountType === "percentage"
                    ? ` (${promoApplied.discountValue}% off)`
                    : ` (-₹${(promoApplied.discountValue / 100).toFixed(0)})`}
                </span>
                <button
                  onClick={() => { setPromoApplied(null); setPromoInput(""); }}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
          <span className="text-zinc-700 dark:text-zinc-300">Total</span>
          <span className="text-zinc-900 dark:text-zinc-100">
            {isFree ? "Free" : `₹${(totalFee / 100).toFixed(0)}`}
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{error}</p>
      )}

      <Button
        fullWidth
        size="lg"
        onClick={handleRegister}
        loading={busy}
        disabled={selected.size === 0}
      >
        {isFree ? "Register (Free)" : `Pay ₹${(totalFee / 100).toFixed(0)}`}
      </Button>

      {/* Email verification popup */}
      <Modal open={showVerifyPopup} onClose={() => setShowVerifyPopup(false)} title="Verification Required" size="sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          You need to verify both your email and mobile number before you can register for competitions. Go to
          Settings to complete verification.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowVerifyPopup(false)}>
            Cancel
          </Button>
          <Button fullWidth onClick={() => router.push("/settings")}>
            Go to Settings
          </Button>
        </div>
      </Modal>
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
