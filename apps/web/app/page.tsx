"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchCompetitions, fetchPublicBanners, assetUrl, type CompetitionSummary, type BannerDto } from "@/lib/api";
import { StatusBadge } from "@/features/competitions/StatusBadge";
import { EventIcon } from "@/components/EventIcon";
import { SkeletonCard, Skeleton } from "@/components/Skeleton";
import { Hero } from "@/features/competitions/Hero";

export default function Home() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitions()
      .then(setComps)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const live = comps.filter((c) => c.status === "live");
  const upcoming = comps.filter((c) =>
    ["draft", "published", "registration_open", "registration_closed"].includes(c.status),
  );
  const past = comps.filter((c) =>
    ["results_pending", "completed"].includes(c.status),
  );
  const featured = comps.find((c) => c.featured) ?? live[0] ?? upcoming[0];

  if (loading) {
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Skeleton className="mb-4 h-40 w-full rounded-xl" />
        <section className="mt-8">
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="flex gap-4 overflow-hidden">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <BannerSlider />

      {featured && <Hero comp={featured} />}

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

function BannerSlider() {
  const [banners, setBanners] = useState<BannerDto[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetchPublicBanners()
      .then((b) => setBanners(b.sort((a, z) => a.order - z.order)))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const current = banners[idx];
  const href = current.linkUrl || current.ctaLink;

  const image = (
    <div key={idx} className="fade-slide-in w-full overflow-hidden rounded-xl">
      {current.imageUrl && (
        <img
          src={assetUrl(current.imageUrl)}
          alt={current.title}
          className={`aspect-[3/1] w-full rounded-xl object-cover object-top ${current.mobileImageUrl ? "hidden sm:block" : ""}`}
        />
      )}
      {current.mobileImageUrl && (
        <img
          src={assetUrl(current.mobileImageUrl)}
          alt={current.title}
          className="aspect-[3/2] w-full rounded-xl object-cover object-top sm:hidden"
        />
      )}
    </div>
  );

  return (
    <div className="relative mb-4">
      {href ? <Link href={href}>{image}</Link> : image}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + banners.length) % banners.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            aria-label="Previous"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % banners.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            aria-label="Next"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-2 bg-white/50"
                  }`}
              />
            ))}
          </div>
        </>
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
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(2)}+`;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group relative flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/70 p-5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-accent-primary/40"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="shimmer-sweep pointer-events-none absolute inset-0" />
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {comp.status === "live" && (
            <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
          )}
          <StatusBadge status={comp.status} />
        </div>
        <span className="text-xs text-zinc-500">{feeLabel}</span>
      </div>
      <h3 className="relative mb-1 text-base font-semibold text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white">
        {comp.title}
      </h3>
      {comp.description && (
        <p className="relative mb-3 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {comp.description}
        </p>
      )}
      {comp.eventTypes && comp.eventTypes.length > 0 && (
        <div className="relative mb-3 flex flex-wrap gap-1">
          {comp.eventTypes.slice(0, 6).map((et) => (
            <span
              key={et}
              title={et}
              className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800"
            >
              <EventIcon eventId={et} size={14} />
            </span>
          ))}
        </div>
      )}
      {comp.status === "registration_open" && comp.registrationDeadline && (
        <RegistrationCountdown deadline={comp.registrationDeadline} />
      )}
      <div className="relative mt-auto flex items-center justify-between text-xs text-zinc-500">
        <span>
          {comp.eventTypes?.length ?? 0} event
          {(comp.eventTypes?.length ?? 0) !== 1 ? "s" : ""}
        </span>
        <span>{comp.registrationCount ?? 0} registered</span>
      </div>
    </Link>
  );
}

function RegistrationCountdown({ deadline }: { deadline: string }) {
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
    <div className="relative mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-accent-warn/10 px-2 py-0.5 text-xs font-medium text-accent-warn">
      ⏳ {label}
    </div>
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
