"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventDisplayName } from "@/lib/eventNames";
import {
  fetchCompetition,
  fetchMyRegistrations,
  type CompetitionDetail,
  type RegistrationDto,
} from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { UserStatusBadge } from "@/features/competitions/UserStatusBadge";
import { StatusBadge } from "@/features/competitions/StatusBadge";

export default function CompetitionDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [myReg, setMyReg] = useState<RegistrationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    setLoading(true);
    fetchCompetition(id)
      .then(setComp)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!user || !params.id) return;
    fetchMyRegistrations()
      .then((regs) => {
        const reg = regs.find((r) => r.competitionId === params.id) ?? null;
        setMyReg(reg);
      })
      .catch(() => {});
  }, [user, params.id]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  if (error || !comp) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-400">
        {error ?? "Competition not found"}
      </main>
    );
  }

  const isRegOpen = comp.status === "registration_open";
  const isLive = comp.status === "live";
  const feeText =
    comp.type === "free"
      ? "Free entry"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)} base + ₹${((comp.perEventFee ?? 0) / 100).toFixed(0)}/event`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <UserStatusBadge comp={comp} isRegistered={!!myReg} />
        <span className="text-xs text-zinc-500">{comp.type}</span>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{comp.title}</h1>
      {comp.description && (
        <p className="mb-6 text-zinc-400">{comp.description}</p>
      )}

      {comp.status === "cancelled" && comp.cancellationReason && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">
            This competition has been cancelled
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            {comp.cancellationReason}
          </p>
        </div>
      )}

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        {/* Info card */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Details
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Entry Fee</dt>
              <dd className="text-zinc-800 dark:text-zinc-200">{feeText}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Registered</dt>
              <dd className="text-zinc-800 dark:text-zinc-200">{comp.registrationCount ?? 0}</dd>
            </div>
            {comp.registrationDeadline && (
              <div className="flex justify-between">
                <dt className="text-zinc-400">Deadline</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">
                  {new Date(comp.registrationDeadline).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Action card */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 p-5">
          {myReg ? (
            <div className="text-center">
              <div className="mb-2 text-sm text-emerald-400">Registered ✓</div>
              <StatusBadge status={myReg.paymentStatus} />
              {isLive && (
                <Link
                  href={`/competitions/${comp.id}/lobby`}
                  className="mt-4 block rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
                >
                  Enter Lobby →
                </Link>
              )}
            </div>
          ) : isRegOpen ? (
            user ? (
              <Link
                href={`/competitions/${comp.id}/register`}
                className="rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-500"
              >
                Register Now
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm text-emerald-400 underline hover:text-emerald-300"
              >
                Sign in to register
              </Link>
            )
          ) : isLive ? (
            <Link
              href={`/competitions/${comp.id}/lobby`}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
            >
              Enter Lobby →
            </Link>
          ) : (
            <span className="text-sm text-zinc-500">
              Registration is not open
            </span>
          )}
        </div>
      </div>

      {/* Rules */}
      {comp.rulesMd && (
        <div className="mb-8 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Rules
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {comp.rulesMd}
          </p>
        </div>
      )}

      {/* Events */}
      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Events
        </h2>
        <div className="space-y-3">
          {comp.events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 px-4 py-3"
            >
              <div>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {eventDisplayName(ev.eventType)}
                </span>
                <span className="ml-3 text-xs text-zinc-500">
                  {ev.roundCount} round{ev.roundCount > 1 ? "s" : ""}
                </span>
                {ev.cutoffMs && (
                  <span className="ml-3 text-xs text-zinc-500">
                    Cutoff: {(ev.cutoffMs / 1000).toFixed(1)}s
                  </span>
                )}
                {ev.timeLimitMs && (
                  <span className="ml-3 text-xs text-zinc-500">
                    Limit: {(ev.timeLimitMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {ev.rounds.map((r) => (
                  <Link
                    key={r.id}
                    href={
                      r.status === "open"
                        ? `/competitions/${comp.id}/round/${r.roundNumber}`
                        : `/competitions/${comp.id}/lobby`
                    }
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    R{r.roundNumber}{" "}
                    <StatusBadge status={r.status} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results link */}
      {["results_pending", "completed", "live"].includes(comp.status) && (
        <Link
          href={`/competitions/${comp.id}/results`}
          className="text-sm text-emerald-400 underline hover:text-emerald-300"
        >
          View Results →
        </Link>
      )}
    </main>
  );
}
