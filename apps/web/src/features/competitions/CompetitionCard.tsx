"use client";

import Link from "next/link";
import { assetUrl, type CompetitionSummary } from "@/lib/api";
import { EventIcon } from "@/components/EventIcon";

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

export function CompetitionCard({ comp }: { comp: CompetitionSummary }) {
  const hasBanner = comp.bannerUrl || comp.mobileBannerUrl;
  const dateLabel = formatDate(comp.startsAt);
  const timeLabel = formatTime(comp.startsAt);
  const eventCount = comp.eventTypes?.length ?? 0;
  const iconSize = eventCount > 10 ? 10 : eventCount > 6 ? 12 : 16;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group relative flex h-40 flex-row overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-accent-primary/40 sm:h-48"
    >
      {/* Banner — always 60% width */}
      {hasBanner ? (
        <div className="relative h-full w-[60%] shrink-0 overflow-hidden">
          {comp.bannerUrl && (
            <img
              src={assetUrl(comp.bannerUrl)}
              alt=""
              className={`h-full w-full object-cover ${comp.mobileBannerUrl ? "hidden sm:block" : ""}`}
            />
          )}
          {comp.mobileBannerUrl && (
            <img
              src={assetUrl(comp.mobileBannerUrl)}
              alt=""
              className={`h-full w-full object-cover ${comp.bannerUrl ? "sm:hidden" : ""}`}
            />
          )}
          {comp.status === "live" && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" /> Live
            </span>
          )}
        </div>
      ) : (
        <div className="relative flex h-full w-[60%] shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
          <span className="text-4xl opacity-30">🧊</span>
          {comp.status === "live" && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" /> Live
            </span>
          )}
        </div>
      )}

      {/* Details — 40% */}
      <div className="relative flex w-[40%] flex-col justify-between p-3 sm:p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white sm:text-base">
            {comp.title}
          </h3>

          {comp.eventTypes && eventCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-0.5">
              {comp.eventTypes.map((et) => (
                <span key={et} title={et} className="text-zinc-500 dark:text-zinc-400">
                  <EventIcon eventId={et} size={iconSize} />
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          {dateLabel && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
              {dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}
            </p>
          )}
          <p className="mt-0.5 text-right text-[10px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[11px]">
            {comp.registrationCount ?? 0} registered
          </p>
        </div>
      </div>
    </Link>
  );
}
