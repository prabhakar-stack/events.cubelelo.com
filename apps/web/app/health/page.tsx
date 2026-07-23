"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { notFound } from "next/navigation";

interface HealthData {
  status: "ok" | "error";
  db: { backend: string; latencyMs: number } | null;
  redis: { status: string; latencyMs?: number } | null;
  websocket: { connections: number; uniqueUsers: number; rooms: number } | null;
  email: string;
  sms: string;
  error?: string;
}

interface CheckResult {
  data: HealthData | null;
  responseMs: number;
  checkedAt: Date;
  httpStatus: number;
}

const REFRESH_INTERVAL = 30_000;

export default function HealthPage() {
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CheckResult[]>([]);

  const check = useCallback(async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      const data: HealthData = await res.json();
      const entry: CheckResult = {
        data,
        responseMs: Math.round(performance.now() - t0),
        checkedAt: new Date(),
        httpStatus: res.status,
      };
      setResult(entry);
      setHistory((h) => [entry, ...h].slice(0, 20));
    } catch {
      const entry: CheckResult = {
        data: null,
        responseMs: Math.round(performance.now() - t0),
        checkedAt: new Date(),
        httpStatus: 0,
      };
      setResult(entry);
      setHistory((h) => [entry, ...h].slice(0, 20));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [check]);

  const isUp = result?.data?.status === "ok";
  const dbOk = result?.data?.db != null;

  if (authLoading) return null;
  if (!user || user.role !== "admin") return notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 font-[var(--font-sans)]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <p className="mt-1 text-sm text-white/40">
            Auto-refreshes every {REFRESH_INTERVAL / 1000}s
          </p>
        </div>
        <button
          onClick={check}
          disabled={loading}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`mb-6 rounded-xl border p-5 ${
          result === null
            ? "border-white/10 bg-white/5"
            : isUp
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-red-500/20 bg-red-500/5"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              result === null
                ? "bg-white/20"
                : isUp
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"
            }`}
          />
          <span className="text-lg font-semibold text-white">
            {result === null
              ? "Checking..."
              : isUp
                ? "All Systems Operational"
                : "Service Degraded"}
          </span>
        </div>
        {result && (
          <p className="mt-2 text-sm text-white/40">
            Response time: {result.responseMs}ms &middot; HTTP {result.httpStatus} &middot; Last
            checked {result.checkedAt.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Service Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ServiceCard
          label="API Server"
          status={result === null ? "loading" : isUp ? "ok" : "error"}
          detail={
            result
              ? isUp
                ? `${result.responseMs}ms response`
                : result.data?.error ?? "Unreachable"
              : undefined
          }
        />
        <ServiceCard
          label="Database"
          status={result === null ? "loading" : dbOk ? "ok" : "error"}
          detail={
            result?.data?.db
              ? `${result.data.db.backend} — ${result.data.db.latencyMs}ms`
              : result
                ? "Not connected"
                : undefined
          }
        />
        <ServiceCard
          label="Redis"
          status={
            result === null
              ? "loading"
              : result.data?.redis?.status === "ok"
                ? "ok"
                : result.data?.redis?.status === "not_configured"
                  ? "warn"
                  : "error"
          }
          detail={
            result?.data?.redis?.status === "ok"
              ? `${result.data.redis.latencyMs}ms latency`
              : result?.data?.redis?.status ?? undefined
          }
        />
        <ServiceCard
          label="WebSocket"
          status={result === null ? "loading" : result.data?.websocket ? "ok" : "warn"}
          detail={
            result?.data?.websocket
              ? `${result.data.websocket.connections} connections · ${result.data.websocket.uniqueUsers} users · ${result.data.websocket.rooms} rooms`
              : result
                ? "Not attached"
                : undefined
          }
        />
        <ServiceCard
          label="Email Service"
          status={
            result === null
              ? "loading"
              : result.data?.email && result.data.email !== "none"
                ? "ok"
                : "warn"
          }
          detail={result?.data?.email ?? undefined}
        />
        <ServiceCard
          label="SMS Service"
          status={
            result === null
              ? "loading"
              : result.data?.sms && result.data.sms !== "none"
                ? "ok"
                : "warn"
          }
          detail={result?.data?.sms ?? undefined}
        />
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/30">
            Recent Checks
          </h2>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-white/30">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Response</th>
                  <th className="px-4 py-2.5 font-medium text-right">DB</th>
                  <th className="px-4 py-2.5 font-medium text-right">Redis</th>
                  <th className="px-4 py-2.5 font-medium text-right">WS</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 last:border-0 text-white/60"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {h.checkedAt.toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.data?.status === "ok"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            h.data?.status === "ok" ? "bg-emerald-400" : "bg-red-400"
                          }`}
                        />
                        {h.data?.status === "ok" ? "OK" : "Error"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {h.responseMs}ms
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {h.data?.db?.latencyMs != null ? `${h.data.db.latencyMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {h.data?.redis?.latencyMs != null ? `${h.data.redis.latencyMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {h.data?.websocket ? h.data.websocket.connections : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  label,
  status,
  detail,
}: {
  label: string;
  status: "ok" | "error" | "warn" | "loading";
  detail?: string;
}) {
  const colors = {
    ok: "border-emerald-500/15 bg-emerald-500/5",
    error: "border-red-500/15 bg-red-500/5",
    warn: "border-amber-500/15 bg-amber-500/5",
    loading: "border-white/8 bg-white/[0.03]",
  };
  const dots = {
    ok: "bg-emerald-400",
    error: "bg-red-400",
    warn: "bg-amber-400",
    loading: "bg-white/20 animate-pulse",
  };
  const labels = {
    ok: "Operational",
    error: "Down",
    warn: "Not configured",
    loading: "Checking...",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[status]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              status === "ok"
                ? "text-emerald-400"
                : status === "error"
                  ? "text-red-400"
                  : status === "warn"
                    ? "text-amber-400"
                    : "text-white/30"
            }`}
          >
            {labels[status]}
          </span>
          <div className={`h-2 w-2 rounded-full ${dots[status]}`} />
        </div>
      </div>
      {detail && (
        <p className="mt-1.5 font-mono text-xs text-white/35">{detail}</p>
      )}
    </div>
  );
}
