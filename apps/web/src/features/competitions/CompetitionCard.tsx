"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { assetUrl, type CompetitionSummary } from "@/lib/api";
import { EventIcon } from "@/components/EventIcon";
import { StatusBadge } from "@/features/competitions/StatusBadge";

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function extractBottomColor(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, img.naturalHeight - img.naturalHeight * 0.15, img.naturalWidth, img.naturalHeight * 0.15, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return `${r}, ${g}, ${b}`;
  } catch {
    return null;
  }
}

export function CompetitionCard({ comp }: { comp: CompetitionSummary }) {
  const hasBanner = comp.bannerUrl || comp.mobileBannerUrl;
  const dateLabel = formatDate(comp.startsAt);
  const timeLabel = formatTime(comp.startsAt);
  const eventCount = comp.eventTypes?.length ?? 0;
  const feeLabel =
    comp.type === "free"
      ? "Free"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(2)}+`;

  const imgRef = useRef<HTMLImageElement>(null);
  const [glowColor, setGlowColor] = useState<string | null>(null);

  const handleImageLoad = () => {
    if (imgRef.current) {
      const color = extractBottomColor(imgRef.current);
      if (color) setGlowColor(color);
    }
  };

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[var(--border-hover)] hover:shadow-[0_12px_32px_var(--accent-glow)]"
    >
      {/* Banner — 3:2 on mobile, 3:1 on desktop */}
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-[var(--bg-surface-dim)] to-[var(--bg-surface)]">
        <div className="aspect-[3/2] sm:aspect-[3/1]">
          {hasBanner ? (
            <>
              {comp.bannerUrl && (
                <img
                  ref={!comp.mobileBannerUrl ? imgRef : undefined}
                  src={assetUrl(comp.bannerUrl)}
                  alt=""
                  crossOrigin="anonymous"
                  onLoad={!comp.mobileBannerUrl ? handleImageLoad : undefined}
                  className={`h-full w-full object-cover ${comp.mobileBannerUrl ? "hidden sm:block" : ""}`}
                />
              )}
              {comp.mobileBannerUrl && (
                <img
                  ref={imgRef}
                  src={assetUrl(comp.mobileBannerUrl)}
                  alt=""
                  crossOrigin="anonymous"
                  onLoad={handleImageLoad}
                  className={`h-full w-full object-cover ${comp.bannerUrl ? "sm:hidden" : ""}`}
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-4xl opacity-[0.06]">🧊</span>
            </div>
          )}
        </div>
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge status={comp.status} />
        </div>
      </div>

      {/* Details */}
      <div className="relative flex flex-1 flex-col justify-between gap-2 p-3.5">
        {glowColor && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-full transition-opacity duration-500"
            style={{
              background: `linear-gradient(to bottom, rgba(${glowColor}, 0.35) 0%, rgba(${glowColor}, 0.12) 30%, transparent 100%)`,
            }}
          />
        )}
        <div className="relative">
          <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-[var(--text-primary)] group-hover:text-accent-primary sm:text-[15px]">
            {comp.title}
          </h3>
          {comp.eventTypes && eventCount > 0 && (
            <div className="flex flex-wrap gap-1">
              {comp.eventTypes.map((et) => (
                <span
                  key={et}
                  title={et}
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-md border border-accent-primary/10 bg-accent-primary/10 text-accent-primary sm:h-[24px] sm:w-[24px]"
                >
                  <EventIcon eventId={et} size={eventCount > 10 ? 10 : eventCount > 6 ? 11 : 12} />
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative space-y-1">
          {comp.status === "registration_open" && comp.registrationDeadline && (
            <CardCountdown deadline={comp.registrationDeadline} />
          )}
          {dateLabel && (
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-tertiary)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {comp.registrationLimit != null && comp.registrationLimit > 0
                ? `${comp.registrationCount ?? 0}/${comp.registrationLimit}`
                : (comp.registrationCount ?? 0)} registered
            </span>
            <span className="text-[11px] font-semibold text-accent-primary">
              {feeLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CardCountdown({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("Closing soon");
        return;
      }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`);
    }
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [deadline]);

  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-accent-warn/15 bg-accent-warn/10 px-2 py-0.5 text-[11px] font-semibold text-accent-warn">
      ⏳ {label}
    </span>
  );
}
