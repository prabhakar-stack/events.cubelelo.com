"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchCompetitions, fetchPublicAnnouncements, assetUrl, type CompetitionSummary, type AnnouncementDto } from "@/lib/api";
import { StatusBadge } from "@/features/competitions/StatusBadge";

export default function Home() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitions()
      .then(setComps)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const live = comps.filter((c) => c.status === "live");
  const upcoming = comps.filter((c) =>
    ["draft", "published", "registration_open", "registration_closed"].includes(c.status),
  );
  const past = comps.filter((c) =>
    ["results_pending", "completed"].includes(c.status),
  );
  const featured = live[0] ?? upcoming[0];

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <AnnouncementSlider />

      {featured && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
            Featured
          </h2>
          <Link
            href={`/competitions/${featured.id}`}
            className="group block rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-100 to-white p-6 transition hover:border-zinc-300 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 dark:hover:border-zinc-700 md:p-8"
          >
            <div className="mb-3 flex items-center gap-3">
              <StatusBadge status={featured.status} />
              {featured.type !== "free" && (
                <span className="text-xs text-zinc-500">
                  ₹{((featured.baseFee ?? 0) / 100).toFixed(0)}+
                </span>
              )}
            </div>
            <h3 className="mb-1 text-2xl font-bold text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white md:text-3xl">
              {featured.title}
            </h3>
            {featured.description && (
              <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                {featured.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
              <span>
                {featured.eventTypes?.length ?? 0} event
                {(featured.eventTypes?.length ?? 0) !== 1 ? "s" : ""}
              </span>
              <span>{featured.registrationCount ?? 0} registered</span>
              {featured.status === "live" && (
                <span className="rounded bg-emerald-600/20 px-2 py-0.5 text-emerald-400">
                  Live now
                </span>
              )}
            </div>
          </Link>
        </section>
      )}

      {upcoming.length > 0 && (
        <HorizontalSection title="Upcoming Competitions" href="/competitions?status=upcoming">
          {upcoming.map((c) => (
            <ScrollCard key={c.id} comp={c} />
          ))}
        </HorizontalSection>
      )}

      {past.length > 0 && (
        <HorizontalSection title="Past Competitions" href="/competitions?status=past">
          {past.map((c) => (
            <ScrollCard key={c.id} comp={c} />
          ))}
        </HorizontalSection>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
          Blog
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-zinc-500">Blog posts coming soon.</p>
        </div>
      </section>
    </main>
  );
}

function AnnouncementSlider() {
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetchPublicAnnouncements().then(setAnnouncements).catch(() => {});
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % announcements.length), 5000);
    return () => clearInterval(t);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const current = announcements[idx];

  const inner = (
    <div className="flex flex-1 flex-col items-center gap-2">
      {current.imageUrl && (
        <img src={assetUrl(current.imageUrl)} alt={current.title} className="max-h-16 rounded object-contain" />
      )}
      <p className="text-center text-sm text-zinc-700 dark:text-zinc-300">{current.title}</p>
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => (i - 1 + announcements.length) % announcements.length)}
          className="mr-3 shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Previous"
        >
          <ChevronLeft />
        </button>
        {current.redirectUrl ? (
          <Link href={current.redirectUrl} className="flex flex-1 justify-center">{inner}</Link>
        ) : (
          inner
        )}
        <button
          onClick={() => setIdx((i) => (i + 1) % announcements.length)}
          className="ml-3 shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Next"
        >
          <ChevronRight />
        </button>
      </div>
      {announcements.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {announcements.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-4 bg-emerald-500" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HorizontalSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Scroll right"
          >
            <ChevronRight />
          </button>
          <Link
            href={href}
            className="ml-2 text-xs text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-300"
          >
            View more →
          </Link>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {children}
      </div>
    </section>
  );
}

function ScrollCard({ comp }: { comp: CompetitionSummary }) {
  const feeLabel =
    comp.type === "free"
      ? "Free"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)}+`;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group flex w-72 flex-shrink-0 flex-col rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={comp.status} />
        <span className="text-xs text-zinc-500">{feeLabel}</span>
      </div>
      <h3 className="mb-1 text-base font-semibold text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white">
        {comp.title}
      </h3>
      {comp.description && (
        <p className="mb-3 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {comp.description}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-zinc-500">
        <span>
          {comp.eventTypes?.length ?? 0} event
          {(comp.eventTypes?.length ?? 0) !== 1 ? "s" : ""}
        </span>
        <span>{comp.registrationCount ?? 0} registered</span>
      </div>
    </Link>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
