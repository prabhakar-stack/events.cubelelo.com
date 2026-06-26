"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchCompetitions, type CompetitionSummary } from "@/lib/api";
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
      {/* ── Announcements slider ── */}
      <AnnouncementSlider />

      {/* ── Featured competition ── */}
      {featured && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
            Featured
          </h2>
          <Link
            href={`/competitions/${featured.id}`}
            className="group block rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 transition hover:border-zinc-700 md:p-8"
          >
            <div className="mb-3 flex items-center gap-3">
              <StatusBadge status={featured.status} />
              {featured.type !== "free" && (
                <span className="text-xs text-zinc-500">
                  ₹{((featured.baseFee ?? 0) / 100).toFixed(0)}+
                </span>
              )}
            </div>
            <h3 className="mb-1 text-2xl font-bold text-zinc-100 group-hover:text-white md:text-3xl">
              {featured.title}
            </h3>
            {featured.description && (
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
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

      {/* ── Upcoming competitions — horizontal scroll ── */}
      {upcoming.length > 0 && (
        <HorizontalSection title="Upcoming Competitions" href="/competitions?status=upcoming">
          {upcoming.map((c) => (
            <ScrollCard key={c.id} comp={c} />
          ))}
        </HorizontalSection>
      )}

      {/* ── Past competitions — horizontal scroll ── */}
      {past.length > 0 && (
        <HorizontalSection title="Past Competitions" href="/competitions?status=past">
          {past.map((c) => (
            <ScrollCard key={c.id} comp={c} />
          ))}
        </HorizontalSection>
      )}

      {/* ── Blogs placeholder ── */}
      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
          Blog
        </h2>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-10 text-center">
          <p className="text-zinc-500">Blog posts coming soon.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-zinc-800 py-8 text-center text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} Cubelelo Events. All rights reserved.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/competitions" className="transition hover:text-zinc-400">
            Competitions
          </Link>
          <span className="cursor-not-allowed text-zinc-700">Rankings</span>
          <span className="cursor-not-allowed text-zinc-700">Practice</span>
        </div>
      </footer>
    </main>
  );
}

/* ── Announcement slides ── */
const ANNOUNCEMENTS = [
  "Welcome to Cubelelo Events — India's premier speedcubing platform!",
  "Register for upcoming competitions and compete with cubers across the country.",
  "New features: anti-cheat flagging, live leaderboards, and more.",
];

function AnnouncementSlider() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ANNOUNCEMENTS.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => (i - 1 + ANNOUNCEMENTS.length) % ANNOUNCEMENTS.length)}
          className="mr-3 rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Previous"
        >
          <ChevronLeft />
        </button>
        <p className="flex-1 text-center text-sm text-zinc-300">
          {ANNOUNCEMENTS[idx]}
        </p>
        <button
          onClick={() => setIdx((i) => (i + 1) % ANNOUNCEMENTS.length)}
          className="ml-3 rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Next"
        >
          <ChevronRight />
        </button>
      </div>
      {/* dots */}
      <div className="mt-2 flex justify-center gap-1.5">
        {ANNOUNCEMENTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-4 bg-emerald-500" : "w-1.5 bg-zinc-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Horizontal scroll section ── */
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
            className="rounded p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Scroll right"
          >
            <ChevronRight />
          </button>
          <Link
            href={href}
            className="ml-2 text-xs text-zinc-500 transition hover:text-zinc-300"
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

/* ── Horizontal scroll card ── */
function ScrollCard({ comp }: { comp: CompetitionSummary }) {
  const feeLabel =
    comp.type === "free"
      ? "Free"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(0)}+`;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group flex w-72 flex-shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/60"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={comp.status} />
        <span className="text-xs text-zinc-500">{feeLabel}</span>
      </div>
      <h3 className="mb-1 text-base font-semibold text-zinc-100 group-hover:text-white">
        {comp.title}
      </h3>
      {comp.description && (
        <p className="mb-3 line-clamp-2 text-xs text-zinc-400">
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

/* ── Icons ── */
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
