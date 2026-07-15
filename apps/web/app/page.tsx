"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchCompetitions, fetchPublicBanners, assetUrl, type CompetitionSummary, type BannerDto } from "@/lib/api";
import { StatusBadge } from "@/features/competitions/StatusBadge";
import { EventIcon } from "@/components/EventIcon";
import { Skeleton } from "@/components/Skeleton";
import { Hero } from "@/features/competitions/Hero";

export default function Home() {
  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [banners, setBanners] = useState<BannerDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCompetitions().catch(() => [] as CompetitionSummary[]),
      fetchPublicBanners().then((b) => b.sort((a, z) => a.order - z.order)).catch(() => [] as BannerDto[]),
    ]).then(([c, b]) => {
      setComps(c);
      setBanners(b);
    }).finally(() => setLoading(false));
  }, []);

  const live = comps.filter((c) => c.status === "live");
  const upcoming = comps.filter((c) =>
    ["registration_open", "registration_closed"].includes(c.status),
  );
  const past = comps.filter((c) =>
    ["results_pending", "completed"].includes(c.status),
  );
  const featured = comps.find((c) => c.featured) ?? live[0] ?? upcoming[0];

  if (loading) {
    return (
      <main className="relative z-[1] mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
        </div>
        <Skeleton className="mb-6 h-[140px] rounded-xl" />
        <Skeleton className="mb-3 h-5 w-48" />
        <div className="flex gap-4 overflow-hidden">
          <Skeleton className="h-[280px] w-[calc((100%-4.5rem)/4.5)] shrink-0 rounded-[14px]" />
          <Skeleton className="h-[280px] w-[calc((100%-4.5rem)/4.5)] shrink-0 rounded-[14px]" />
          <Skeleton className="h-[280px] w-[calc((100%-4.5rem)/4.5)] shrink-0 rounded-[14px]" />
          <Skeleton className="h-[280px] w-[calc((100%-4.5rem)/4.5)] shrink-0 rounded-[14px]" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-[1] mx-auto max-w-[1400px] px-6 py-8">
      {banners.length > 0 && <BannerSlider banners={banners} />}

      {featured && <Hero comp={featured} />}

      {live.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="live-dot h-2 w-2 rounded-full bg-accent-danger shadow-[0_0_8px_var(--accent-danger)]" />
            <h2 className="text-lg font-bold text-accent-danger">Live Now</h2>
          </div>
          <div className="flex flex-col gap-3">
            {live.map((c) => (
              <LiveCard key={c.id} comp={c} />
            ))}
          </div>
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

      {comps.length === 0 && banners.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl py-20 text-center">
          <span className="mb-4 text-5xl opacity-20">🧊</span>
          <p className="text-lg font-semibold text-[var(--text-secondary)]">No competitions yet</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">Check back soon — something exciting is coming!</p>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════
   Banner Slider
   ═══════════════════════════════════════════════════════ */

function BannerSlider({ banners }: { banners: BannerDto[] }) {
  const [idx, setIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const len = banners.length;
  const showPair = len > 1;
  const step = len <= 2 ? 1 : 2;

  useEffect(() => {
    if (!showPair) return;
    const t = setInterval(() => setIdx((i) => (i + step) % len), 5000);
    return () => clearInterval(t);
  }, [len, showPair, step, tick]);

  const leftIdx = idx;
  const rightIdx = (idx + 1) % len;
  const left = banners[leftIdx];
  const right = showPair && leftIdx !== rightIdx ? banners[rightIdx] : null;

  return (
    <div className="relative mb-6 w-full">
      <div
        className="mx-auto grid gap-2"
        style={{
          width: "95vw",
          gridTemplateColumns: showPair && right ? "1fr 1fr" : "1fr",
          height: showPair && right ? "calc(95vw / 6)" : "calc(95vw / 3)",
        }}
      >
        <BannerSlide key={left.id} banner={left} />
        {right && <BannerSlide key={right.id} banner={right} />}
      </div>
      {len > 1 && (
        <>
          <button
            onClick={() => { setIdx((i) => (i - 1 + len) % len); setTick((t) => t + 1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/50 hover:text-white"
            aria-label="Previous"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => { setIdx((i) => (i + step) % len); setTick((t) => t + 1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/50 hover:text-white"
            aria-label="Next"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIdx(i); setTick((t) => t + 1); }}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-5 bg-gradient-to-r from-accent-primary to-[var(--accent-secondary)]" : "w-2 bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BannerSlide({ banner }: { banner: BannerDto }) {
  const href = banner.linkUrl || banner.ctaLink;
  const desktopSrc = banner.imageUrl ? assetUrl(banner.imageUrl) : null;
  const mobileSrc = banner.mobileImageUrl ? assetUrl(banner.mobileImageUrl) : null;
  const src = desktopSrc || mobileSrc;

  if (!src) return <div className="h-full w-full rounded-xl bg-[var(--bg-surface)]" />;

  const img = <img src={src} alt={banner.title} className="h-full w-full object-cover object-center" />;

  if (href) {
    return (
      <Link href={href} className="block h-full w-full overflow-hidden rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface-dim)]">
        {img}
      </Link>
    );
  }
  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface-dim)]">
      {img}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Live Card
   ═══════════════════════════════════════════════════════ */

function LiveCard({ comp }: { comp: CompetitionSummary }) {
  const hasBanner = comp.bannerUrl || comp.mobileBannerUrl;

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group relative grid min-h-[170px] grid-cols-1 overflow-hidden rounded-[14px] border border-accent-danger/20 bg-[var(--bg-card)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-accent-danger/40 hover:shadow-[0_12px_40px_rgba(255,71,87,0.08)] sm:grid-cols-2"
    >
      <div className="relative h-[120px] overflow-hidden bg-gradient-to-br from-[#1a0f18] to-[#120a15] sm:h-full">
        {hasBanner ? (
          <img
            src={assetUrl((comp.bannerUrl || comp.mobileBannerUrl)!)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-[0.06]">🧊</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--bg-card)] sm:block hidden" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-accent-danger px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_2px_12px_rgba(255,71,87,0.3)]">
          <span className="live-dot h-[5px] w-[5px] rounded-full bg-white" />
          Live
        </div>
      </div>
      <div className="flex flex-col justify-center p-5">
        <h3 className="mb-2 text-base font-bold leading-snug text-[var(--text-primary)] sm:text-lg">{comp.title}</h3>
        {comp.eventTypes && comp.eventTypes.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {comp.eventTypes.slice(0, 8).map((et) => (
              <span
                key={et}
                title={et}
                className="flex h-[24px] w-[24px] items-center justify-center rounded-md border border-accent-primary/10 bg-accent-primary/10 text-accent-primary"
              >
                <EventIcon eventId={et} size={12} />
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            <span className="font-semibold text-[var(--text-primary)]">{comp.registrationCount ?? 0}</span> competing
          </span>
        </div>
      </div>
      <span className="absolute bottom-4 right-5 rounded-lg bg-accent-danger px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(255,71,87,0.25)] transition group-hover:shadow-[0_6px_20px_rgba(255,71,87,0.35)]">
        Watch Live →
      </span>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════
   Horizontal Section
   ═══════════════════════════════════════════════════════ */

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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-glass)] p-1.5 text-[var(--text-tertiary)] backdrop-blur-sm transition hover:border-[var(--border-hover)] hover:text-accent-primary md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => scroll("right")}
            className="hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-glass)] p-1.5 text-[var(--text-tertiary)] backdrop-blur-sm transition hover:border-[var(--border-hover)] hover:text-accent-primary md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight />
          </button>
          <Link
            href={href}
            className="ml-1 text-xs text-[var(--text-tertiary)] transition hover:text-accent-primary"
          >
            View all →
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

/* ═══════════════════════════════════════════════════════
   Scroll Card
   ═══════════════════════════════════════════════════════ */

function formatCardDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
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

function ScrollCard({ comp }: { comp: CompetitionSummary }) {
  const feeLabel =
    comp.type === "free"
      ? "Free"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(2)}+`;
  const hasBanner = comp.bannerUrl || comp.mobileBannerUrl;
  const dateLabel = formatCardDate(comp.startsAt);
  const imgRef = useRef<HTMLImageElement>(null);
  const [glowColor, setGlowColor] = useState<string | null>(null);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      const color = extractBottomColor(imgRef.current);
      if (color) setGlowColor(color);
    }
  }, []);

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group flex w-[calc((100%-3rem)/2)] flex-shrink-0 flex-col overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-md transition hover:-translate-y-[3px] hover:border-[var(--border-hover)] hover:shadow-[0_12px_32px_var(--accent-glow)] sm:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-4.5rem)/4.5)]"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[var(--bg-surface-dim)] to-[var(--bg-surface)]">
        <div className="aspect-[3/1]">
          {hasBanner ? (
            <img
              ref={imgRef}
              src={assetUrl((comp.bannerUrl || comp.mobileBannerUrl)!)}
              alt=""
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-4xl opacity-[0.06]">🧊</span>
            </div>
          )}
        </div>
        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between">
          <StatusBadge status={comp.status} />
          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {feeLabel}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col p-3.5 pt-3">
        {glowColor && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-full transition-opacity duration-500"
            style={{
              background: `linear-gradient(to bottom, rgba(${glowColor}, 0.35) 0%, rgba(${glowColor}, 0.12) 30%, transparent 100%)`,
            }}
          />
        )}
        <h3 className="relative mb-1 line-clamp-2 text-[15px] font-bold leading-snug text-[var(--text-primary)] group-hover:text-accent-primary">
          {comp.title}
        </h3>
        {comp.description && (
          <p className="relative mb-2.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
            {comp.description}
          </p>
        )}
        {comp.eventTypes && comp.eventTypes.length > 0 && (
          <div className="relative mb-3 flex flex-wrap gap-1">
            {comp.eventTypes.slice(0, 7).map((et) => (
              <span
                key={et}
                title={et}
                className="flex h-[24px] w-[24px] items-center justify-center rounded-md border border-accent-primary/10 bg-accent-primary/10 text-accent-primary"
              >
                <EventIcon eventId={et} size={12} />
              </span>
            ))}
          </div>
        )}
        {comp.status === "registration_open" && comp.registrationDeadline && (
          <RegistrationCountdown deadline={comp.registrationDeadline} />
        )}
        <div className="relative mt-auto flex items-center justify-between border-t border-[var(--border-dim)] pt-2.5">
          {dateLabel && (
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
              <CalendarIcon />
              {dateLabel}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-tertiary)]">
            <UsersIcon />
            {comp.registrationCount ?? 0}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════
   Small Components
   ═══════════════════════════════════════════════════════ */

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
    <div className="relative mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-accent-warn/15 bg-accent-warn/10 px-2.5 py-0.5 text-xs font-medium text-accent-warn">
      ⏳ {label}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
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
