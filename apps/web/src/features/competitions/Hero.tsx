"use client";

import Link from "next/link";
import type { CompetitionSummary } from "@/lib/api";
import { assetUrl } from "@/lib/api";
import { EventIcon } from "@/components/EventIcon";

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function statusLabel(status: string): string {
  switch (status) {
    case "live": return "Live";
    case "completed": return "Results";
    case "results_pending": return "Results Pending";
    case "registration_open": return "Register";
    default: return "View Details";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "live": return "bg-red-500 hover:bg-red-600";
    case "completed":
    case "results_pending": return "bg-orange-500 hover:bg-orange-600";
    case "registration_open": return "bg-emerald-600 hover:bg-emerald-500";
    default: return "bg-accent-primary hover:opacity-90";
  }
}

export function Hero({ comp }: { comp: CompetitionSummary }) {
  const events = comp.eventTypes ?? [];
  const banner = comp.bannerUrl || comp.mobileBannerUrl;
  const date = formatDate(comp.startsAt);
  const descriptionTruncated = comp.description && comp.description.length > 200
    ? comp.description.slice(0, 200) + " …"
    : comp.description;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        Featured Competition
      </h2>
      <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
        {/* Mobile: stacked, banner keeps 3:1 */}
        {/* Desktop: side-by-side, row height driven by the banner's 3:1 at half-width */}
        <div className="flex flex-col md:h-[220px] md:flex-row">
          {/* Banner — always 3:1 */}
          {banner ? (
            <div className="relative shrink-0 md:w-1/2">
              <div className="aspect-[3/1] w-full md:aspect-auto md:h-full md:min-h-[200px]" />
              <img
                src={assetUrl(banner)}
                alt={comp.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="relative flex shrink-0 items-center justify-center bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 md:w-1/2">
              <div className="aspect-[3/1] w-full md:aspect-auto md:h-full md:min-h-[200px]" />
              <span className="absolute text-4xl font-bold text-accent-primary/20">{comp.title}</span>
            </div>
          )}

          {/* Content — fills the height set by the banner */}
          <div className="flex flex-1 flex-col justify-center overflow-hidden px-5 py-4 md:px-7 md:py-4">
            <h3 className="truncate text-lg font-bold text-[var(--text-primary)] md:text-xl">{comp.title}</h3>

            {descriptionTruncated && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-tertiary)] md:text-sm">
                {descriptionTruncated}
              </p>
            )}

            {date && (
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {date}
              </p>
            )}

            {events.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {events.slice(0, 8).map((et) => (
                  <EventIcon key={et} eventId={et} size={20} className="text-[var(--text-primary)]" />
                ))}
              </div>
            )}

            <div className="mt-3">
              <Link
                href={`/competitions/${comp.id}`}
                className={`inline-block rounded-full px-5 py-2 text-sm font-semibold text-white transition ${statusColor(comp.status)}`}
              >
                {statusLabel(comp.status)}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
