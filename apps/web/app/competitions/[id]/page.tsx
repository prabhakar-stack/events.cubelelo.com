"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventDisplayName } from "@/lib/eventNames";
import { EventIcon } from "@/components/EventIcon";
import {
  assetUrl,
  fetchCompetition,
  fetchMyRegistrations,
  fetchMyProgress,
  fetchParticipants,
  fetchLiveRanking,
  fetchPublicPage,
  type CompetitionDetail,
  type RegistrationDto,
  type ParticipantEntry,
  type LiveRankingEntry,
  type RoundProgress,
  type RosterEntry,
} from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLobby } from "@/features/realtime/useLobby";
import { acquireSocket, releaseSocket } from "@/features/realtime/socket";
import { UserStatusBadge } from "@/features/competitions/UserStatusBadge";
import { StatusBadge } from "@/features/competitions/StatusBadge";
import { EventRoundPanel } from "@/features/competitions/detail/EventRoundPanel";
import type { EventPageData } from "@/lib/api";
import { formatTime } from "@cubers/timer-core";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { Countdown } from "@/components/Countdown";
import { Markdown } from "@/components/Markdown";

const NAV_ITEMS: { id: string; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "schedule", label: "Schedule" },
  { id: "events", label: "Events" },
  { id: "rules", label: "Rules" },
  { id: "participants", label: "Participants" },
  { id: "rankings", label: "Live Ranking" },
  { id: "faqs", label: "FAQs" },
  { id: "contact", label: "Contact Us" },
];

export default function CompetitionDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [myReg, setMyReg] = useState<RegistrationDto | null>(null);
  const [myProgress, setMyProgress] = useState<RoundProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("lobby");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventPageCache] = useState(() => new Map<string, EventPageData>());

  const refreshComp = useCallback(() => {
    if (!params.id) return;
    fetchCompetition(params.id)
      .then(setComp)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    fetchCompetition(params.id)
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
      .catch(() => { });
    fetchMyProgress(params.id)
      .then((p) => setMyProgress(p.rounds))
      .catch(() => { });
  }, [user, params.id]);

  const allRoundIds = useMemo(() => {
    if (!comp) return [];
    return comp.events.flatMap((ev) => ev.rounds.map((r) => r.id));
  }, [comp?.id, comp?.events.length]);

  useEffect(() => {
    if (allRoundIds.length === 0) return;

    const socket = acquireSocket();
    for (const rid of allRoundIds) {
      socket.emit("join", { roundId: rid });
    }

    const handler = (p: { roundId: string; status: string }) => {
      if (allRoundIds.includes(p.roundId)) {
        refreshComp();
        if (p.status === "open") {
          toast.show("A round is now open — you can enter!", "success");
        }
      }
    };
    socket.on("round:status", handler);

    return () => {
      socket.off("round:status", handler);
      releaseSocket();
    };
  }, [allRoundIds, refreshComp, toast]);

  // IntersectionObserver to highlight active nav link on scroll
  useEffect(() => {
    const ids = NAV_ITEMS.map((n) => n.id);
    const elements = ids.map((id) => document.getElementById(`section-${id}`)).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "");
            setActiveSection(id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [comp]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Hash deep-linking: #event-{eventId} auto-expands and scrolls
  useEffect(() => {
    if (!comp) return;
    const hash = window.location.hash;
    const match = hash.match(/^#event-(.+)$/);
    if (match) {
      const eid = match[1];
      const found = comp.events.find((e) => e.id === eid);
      if (found) {
        setExpandedEventId(eid);
        setTimeout(() => scrollTo("events"), 100);
      }
    }
  }, [comp, scrollTo]);

  const handleExpandEvent = useCallback((eventId: string) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
    setTimeout(() => scrollTo("events"), 100);
  }, [scrollTo]);

  const activeRoundId = useMemo(() => {
    if (!comp) return null;
    for (const ev of comp.events) {
      const open = ev.rounds.find((r) => r.status === "open");
      if (open) return open.id;
    }
    for (const ev of comp.events) {
      const pending = ev.rounds.find((r) => r.status === "pending");
      if (pending) return pending.id;
    }
    return comp.events[0]?.rounds[0]?.id ?? null;
  }, [comp]);

  const me = useMemo(
    () => user ? { userId: user.clId, name: user.name } : { userId: "guest", name: "Guest" },
    [user],
  );
  const lobby = useLobby(activeRoundId, me);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Skeleton className="mb-4 h-5 w-24" />
        <Skeleton className="mb-2 h-9 w-2/3" />
        <Skeleton className="mb-6 h-4 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error || !comp) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-500 dark:text-red-400">
        {error ?? "Competition not found"}
      </main>
    );
  }

  const isRegOpen = comp.status === "registration_open";
  const isLive = comp.status === "live";

  const countdownTarget =
    comp.status === "registration_open" ? comp.registrationDeadline
      : comp.status === "upcoming" || comp.status === "published" || comp.status === "registration_closed" ? comp.startsAt
        : null;
  const countdownLabel = comp.status === "registration_open" ? "Registration closes in" : "Starts in";

  const feeText =
    comp.type === "free"
      ? "Free entry"
      : `₹${((comp.baseFee ?? 0) / 100).toFixed(2)} base + ₹${((comp.perEventFee ?? 0) / 100).toFixed(2)}/event`;

  return (
    <>
      {/* ══ Sidebar nav — scroll checkpoints ══ */}
      <nav className="flex gap-1.5 overflow-x-auto px-6 pb-2 pt-4 lg:fixed lg:left-0 lg:top-14 lg:z-30 lg:h-[calc(100vh-56px)] lg:w-56 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-visible lg:border-r lg:border-zinc-200 lg:bg-white lg:px-3 lg:py-6 dark:lg:border-zinc-800 dark:lg:bg-zinc-950">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className={`block shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full lg:shrink ${activeSection === item.id
                ? "bg-accent-primary/10 font-semibold text-accent-primary"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
          >
            {item.label}
          </button>
        ))}

        <div className="mt-auto hidden pt-4 lg:block">
          <ShareCard title={comp?.title ?? ""} />
        </div>
      </nav>

      <div className="lg:pl-56">
        <main className="mx-auto max-w-6xl px-6 py-10">
          {/* Cover hero */}
          {comp.coverUrl && (
            <div
              className="relative mb-6 h-56 overflow-hidden rounded-2xl bg-cover bg-center md:h-64"
              style={{ backgroundImage: `url(${assetUrl(comp.coverUrl)})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="mb-2 flex items-center gap-3">
                  <UserStatusBadge comp={comp} isRegistered={!!myReg} />
                  <span className="text-xs text-zinc-200">{comp.type}</span>
                </div>
                <h1 className="text-3xl font-bold text-white">{comp.title}</h1>
              </div>
            </div>
          )}

          {/* Banner hero (when no cover image) */}
          {!comp.coverUrl && (comp.bannerUrl || comp.mobileBannerUrl) && (
            <div className="mb-6 w-full overflow-hidden rounded-2xl">
              {comp.bannerUrl && (
                <img
                  src={assetUrl(comp.bannerUrl)}
                  alt={comp.title}
                  className={`aspect-[3/1] w-full rounded-2xl object-cover object-top ${comp.mobileBannerUrl ? "hidden sm:block" : ""}`}
                />
              )}
              {comp.mobileBannerUrl && (
                <img
                  src={assetUrl(comp.mobileBannerUrl)}
                  alt={comp.title}
                  className={`aspect-[3/2] w-full rounded-2xl object-cover object-top ${comp.bannerUrl ? "sm:hidden" : ""}`}
                />
              )}
            </div>
          )}

          {/* Header (no cover or banner) */}
          {!comp.coverUrl && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <UserStatusBadge comp={comp} isRegistered={!!myReg} />
                <span className="text-xs text-zinc-500">{comp.type}</span>
              </div>
              <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{comp.title}</h1>
            </>
          )}
          {comp.description && <p className="mb-6 text-zinc-500 dark:text-zinc-400">{comp.description}</p>}

          {comp.status === "cancelled" && comp.cancellationReason && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">
                This competition has been cancelled
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">{comp.cancellationReason}</p>
            </div>
          )}

          {/* ══ Registration CTA bar ══ */}
          <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            {myReg ? (
              <>
                <RegistrationSteps paymentStatus={myReg.paymentStatus} />
                {isLive && (
                  <Button size="sm" onClick={() => scrollTo("lobby")}>
                    Go to Lobby
                  </Button>
                )}
              </>
            ) : isRegOpen ? (
              user ? (
                <>
                  <RegistrationSteps paymentStatus={null} />
                  <Link href={`/competitions/${comp.id}/register`}>
                    <Button size="sm">Register Now</Button>
                  </Link>
                </>
              ) : (
                <Link href="/login" className="text-sm text-accent-primary underline hover:brightness-110">
                  Sign in to register
                </Link>
              )
            ) : (
              <p className="text-sm text-zinc-500">Registration is not currently open.</p>
            )}

            {countdownTarget && (
              <div className="ml-auto flex items-center gap-2 rounded-full bg-accent-warn/10 px-3 py-1.5 text-sm text-accent-warn">
                ⏳ {countdownLabel} <Countdown target={countdownTarget} className="font-mono font-semibold" />
              </div>
            )}
          </div>

          {/* ══ All sections stacked ══ */}
          <div className="space-y-12">
            <section id="section-lobby" className="scroll-mt-20">
              <HomeTab comp={comp} feeText={feeText} myProgress={myProgress} isRegistered={!!myReg} roster={lobby.roster} user={user} onExpandEvent={handleExpandEvent} />
            </section>

            <section id="section-schedule" className="scroll-mt-20">
              <SectionHeading>Schedule</SectionHeading>
              <div className="space-y-6">
                <ScheduleTimeline comp={comp} />
                <DetailedSchedule comp={comp} />
              </div>
            </section>

            <section id="section-events" className="scroll-mt-20">
              <SectionHeading>Events</SectionHeading>
              <EventsTab
                comp={comp}
                expandedEventId={expandedEventId}
                onToggleEvent={handleExpandEvent}
                eventPageCache={eventPageCache}
              />
            </section>

            <section id="section-rules" className="scroll-mt-20">
              <SectionHeading>Rules</SectionHeading>
              <RulesTab comp={comp} />
            </section>

            <section id="section-participants" className="scroll-mt-20">
              <SectionHeading>Participants</SectionHeading>
              <ParticipantsTab compId={comp.id} />
            </section>

            <section id="section-rankings" className="scroll-mt-20">
              <SectionHeading>Live Ranking</SectionHeading>
              <RankingsTab comp={comp} showResultsLink={["results_pending", "completed", "live"].includes(comp.status)} />
            </section>

            <section id="section-faqs" className="scroll-mt-20">
              <SectionHeading>FAQs</SectionHeading>
              <ContentPageTab slug="faqs" />
            </section>

            <section id="section-contact" className="scroll-mt-20">
              <SectionHeading>Contact Us</SectionHeading>
              <ContentPageTab slug="contact-us" />
            </section>
          </div>

          {/* Share — mobile only (desktop share is in left sidebar) */}
          <div className="mt-8 lg:hidden">
            <ShareCard title={comp.title} />
          </div>
        </main>
      </div>
    </>
  );
}

/* ── Section heading ── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 border-b border-zinc-200 pb-2 text-lg font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
      {children}
    </h2>
  );
}

/* ── Home tab (Lobby) ── */

function HomeTab({
  comp,
  feeText,
  myProgress,
  isRegistered,
  roster,
  user,
  onExpandEvent,
}: {
  comp: CompetitionDetail;
  feeText: string;
  myProgress: RoundProgress[];
  isRegistered: boolean;
  roster: RosterEntry[];
  user: { clId: string; name: string } | null;
  onExpandEvent: (eventId: string) => void;
}) {
  const now = Date.now();

  const milestones: { label: string; at: string | null | undefined }[] = [
    { label: "Registration opens", at: comp.registrationOpensAt },
    { label: "Registration closes", at: comp.registrationDeadline },
    { label: "Competition starts", at: comp.startsAt },
    { label: "Competition ends", at: comp.endsAt },
  ];
  const nextMilestone = milestones.find((s) => s.at && new Date(s.at).getTime() > now);

  const isLive = comp.status === "live";
  const isUpcoming = ["published", "registration_open", "registration_closed", "upcoming"].includes(comp.status);

  // Join animation tracking
  const prevRosterSize = useRef(roster.length);
  const [justJoined, setJustJoined] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (roster.length > prevRosterSize.current) {
      const newIds = new Set(roster.slice(prevRosterSize.current).map((c) => c.userId));
      setJustJoined(newIds);
      const t = setTimeout(() => setJustJoined(new Set()), 900);
      return () => clearTimeout(t);
    }
    prevRosterSize.current = roster.length;
  }, [roster]);

  return (
    <div className="space-y-6">
      {/* Highlight stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{feeText}</div>
          <div className="text-xs text-zinc-500">Entry</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{comp.events.length}</div>
          <div className="text-xs text-zinc-500">Events</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{comp.registrationCount ?? 0}</div>
          <div className="text-xs text-zinc-500">Registered</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{roster.length}</div>
          <div className="text-xs text-zinc-500">Online Now</div>
        </div>
      </div>

      {/* What's next milestone */}
      {nextMilestone && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="text-lg">{isLive ? "🔴" : "⏳"}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {isLive ? "Competition Live" : "What's Next"}
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold">{nextMilestone.label}</span>{" "}
              {new Date(nextMilestone.at!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </div>
      )}

      {/* Live round cards — one per event */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          {isLive ? "Live Rounds" : "Event Rounds"}
        </h2>
        <div className="space-y-3">
          {comp.events.map((ev) => {
            const activeRound =
              ev.rounds.find((r) => r.status === "open") ??
              ev.rounds.find((r) => r.status === "pending") ??
              [...ev.rounds].reverse().find((r) => r.status === "closed" || r.status === "advanced");

            if (!activeRound) {
              return (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex items-center gap-3">
                    <EventIcon eventId={ev.eventType} size={20} className="text-zinc-400" />
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {eventDisplayName(ev.eventType)}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">No rounds scheduled</span>
                </div>
              );
            }

            const roundOpen = activeRound.status === "open";
            const roundPending = activeRound.status === "pending";
            const roundClosed = activeRound.status === "closed" || activeRound.status === "advanced";

            const userRound = myProgress.find((p) => p.roundId === activeRound.id);
            const submitted = userRound?.userStatus === "submitted";

            return (
              <div
                key={ev.id}
                className={`rounded-xl border px-5 py-4 transition ${roundOpen
                    ? "border-accent-primary/40 bg-accent-primary/5 dark:border-accent-primary/30 dark:bg-accent-primary/5"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {roundOpen && <span className="live-dot h-2 w-2 rounded-full bg-red-500" />}
                    <EventIcon eventId={ev.eventType} size={20} className={roundOpen ? "text-accent-primary" : "text-zinc-400"} />
                    <div>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {eventDisplayName(ev.eventType)}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        Round {activeRound.roundNumber} of {ev.roundCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={activeRound.status} />
                    {roundOpen && isRegistered && !submitted && (
                      <Link href={`/competitions/${comp.id}/round/${activeRound.roundNumber}?eventId=${ev.eventType}`}>
                        <Button size="sm">Enter Round</Button>
                      </Link>
                    )}
                    {submitted && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Submitted
                      </span>
                    )}
                    <button
                      onClick={() => onExpandEvent(ev.id)}
                      className="text-xs text-zinc-400 underline hover:text-zinc-200"
                    >
                      Details
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                  {roundOpen && activeRound.closesAt && (
                    <span>
                      Closes {new Date(activeRound.closesAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  )}
                  {roundPending && activeRound.opensAt && (
                    <span className="flex items-center gap-1">
                      Starts in <Countdown target={activeRound.opensAt} className="font-mono font-semibold text-amber-500" />
                    </span>
                  )}
                  {roundClosed && <span>Round completed</span>}
                </div>
                {submitted && userRound?.result && (
                  <div className="mt-2 flex gap-4 text-xs">
                    {userRound.result.ao5Ms !== null && (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        ao5: <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{formatTime(userRound.result.ao5Ms)}</span>
                      </span>
                    )}
                    {userRound.result.bestSingleMs !== null && (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Best: <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{formatTime(userRound.result.bestSingleMs)}</span>
                      </span>
                    )}
                    {userRound.result.rank !== null && (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Rank: <span className="font-semibold text-zinc-800 dark:text-zinc-200">#{userRound.result.rank}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time competitors online */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Competitors Online
          <span className="ml-2 font-mono text-xs font-normal text-zinc-400">{roster.length}</span>
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
          {roster.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
              Waiting for competitors to check in…
            </p>
          ) : (
            <ul className="max-h-[300px] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800/60">
              {roster.map((c, i) => (
                <li
                  key={c.userId}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${justJoined.has(c.userId) ? "row-count-in bg-accent-primary/10" : ""
                    } ${c.userId === user?.clId ? "bg-accent-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-zinc-400">{i + 1}</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {c.name}
                      {c.userId === user?.clId && (
                        <span className="ml-1 text-xs text-accent-primary">(you)</span>
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-zinc-400">{c.userId}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Your progress summary */}
      {isRegistered && myProgress.length > 0 && myProgress.some((p) => p.userStatus === "submitted") && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Your Progress</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Event</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Round</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">ao5</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Best</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Rank</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {myProgress
                  .filter((p) => p.userStatus === "submitted")
                  .map((p) => (
                    <tr key={p.roundId} className="bg-white dark:bg-zinc-900/40">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                          {p.eventType && <EventIcon eventId={p.eventType} size={14} />}
                          {eventDisplayName(p.eventType ?? "")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">R{p.roundNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {p.result?.ao5Ms != null ? formatTime(p.result.ao5Ms) : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {p.result?.bestSingleMs != null ? formatTime(p.result.bestSingleMs) : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {p.result?.rank != null ? `#${p.result.rank}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {p.status === "advanced" ? "Advanced" : "Done"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pre-competition placeholder */}
      {isUpcoming && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The competition hasn&apos;t started yet. Rounds will appear here once the competition goes live.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Events tab ── */

function EventsTab({
  comp,
  expandedEventId,
  onToggleEvent,
  eventPageCache,
}: {
  comp: CompetitionDetail;
  expandedEventId: string | null;
  onToggleEvent: (id: string) => void;
  eventPageCache: Map<string, EventPageData>;
}) {
  const handleCache = useCallback(
    (eventId: string) => (data: EventPageData) => {
      eventPageCache.set(eventId, data);
    },
    [eventPageCache],
  );

  return (
    <div className="space-y-4">
      {comp.events.map((ev) => {
        const isExpanded = expandedEventId === ev.id;
        const latestRound = [...ev.rounds]
          .reverse()
          .find((r) => r.status !== "pending") ?? ev.rounds[0];

        return (
          <div key={ev.id}>
            <button
              onClick={() => onToggleEvent(ev.id)}
              className={`group relative flex w-full flex-col overflow-hidden rounded-xl border p-5 text-left transition ${
                isExpanded
                  ? "border-accent-primary/40 bg-accent-primary/5 dark:border-accent-primary/30"
                  : "border-zinc-200 bg-white/70 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-accent-primary/40"
              }`}
            >
              <div className="shimmer-sweep pointer-events-none absolute inset-0" />
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-semibold text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white">
                  <EventIcon eventId={ev.eventType} size={18} />
                  {eventDisplayName(ev.eventType)}
                </span>
                <div className="flex items-center gap-2">
                  {latestRound && <StatusBadge status={latestRound.status} />}
                  <span className="text-zinc-400 transition group-hover:text-zinc-200">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>
              <div className="relative mt-1 flex items-center gap-3 text-xs text-zinc-500">
                <span>{ev.roundCount} round{ev.roundCount > 1 ? "s" : ""}</span>
                {ev.cutoffMs && <span>Cutoff: {(ev.cutoffMs / 1000).toFixed(1)}s</span>}
                {ev.timeLimitMs && <span>Limit: {(ev.timeLimitMs / 1000).toFixed(1)}s</span>}
              </div>
            </button>

            {isExpanded && (
              <EventRoundPanel
                compId={comp.id}
                eventId={ev.id}
                eventType={ev.eventType}
                videoDeadlineMinutes={comp.videoDeadlineMinutes ?? 1440}
                cached={eventPageCache.get(ev.id) ?? null}
                onCache={handleCache(ev.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Rules tab ── */

function RulesTab({ comp }: { comp: CompetitionDetail }) {
  if (!comp.rulesMd) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        No rules have been posted for this competition yet.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {comp.rulesMd}
      </p>
    </div>
  );
}

/* ── FAQs / Contact Us tabs — shared site content, embedded in-page ── */

function ContentPageTab({ slug }: { slug: string }) {
  const [page, setPage] = useState<{ title: string; bodyMd: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetchPublicPage(slug)
      .then(setPage)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (notFound || !page) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        This page hasn&apos;t been set up yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <Markdown>{page.bodyMd}</Markdown>
    </div>
  );
}

/* ── Schedule timeline ── */

function ScheduleTimeline({ comp }: { comp: CompetitionDetail }) {
  const steps: { label: string; at: string | null | undefined }[] = [
    { label: "Registration opens", at: comp.registrationOpensAt },
    { label: "Registration closes", at: comp.registrationDeadline },
    { label: "Competition starts", at: comp.startsAt },
    { label: "Competition ends", at: comp.endsAt },
  ];

  if (steps.every((s) => !s.at)) return null;

  const now = Date.now();
  let activeIndex = -1;
  steps.forEach((s, i) => {
    if (s.at && now >= new Date(s.at).getTime()) activeIndex = i;
  });

  return (
    <div className="mb-8 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex min-w-[560px] items-start">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-start">
            <div className="flex flex-col items-center text-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= activeIndex
                    ? "bg-accent-primary text-zinc-950"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                  }`}
              >
                {i < activeIndex ? "✓" : i + 1}
              </div>
              <p className={`mt-2 max-w-[110px] text-xs font-medium ${i <= activeIndex ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"}`}>
                {s.label}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {s.at ? new Date(s.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className={`mt-3.5 h-0.5 flex-1 ${i < activeIndex ? "bg-accent-primary" : "bg-zinc-200 dark:bg-zinc-800"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Detailed schedule — every timed event (rounds, video deadlines) in order ── */

type ScheduleKind = "registration" | "competition" | "round-open" | "round-close" | "video-deadline";

interface ScheduleEntry {
  at: string;
  label: string;
  kind: ScheduleKind;
  eventType?: string;
}

const KIND_TAG: Record<ScheduleKind, { label: string; className: string }> = {
  registration: { label: "Registration", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  competition: { label: "Competition", className: "bg-accent-primary/10 text-accent-primary" },
  "round-open": { label: "Round Opens", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  "round-close": { label: "Round Closes", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  "video-deadline": { label: "Video Deadline", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function buildScheduleEntries(comp: CompetitionDetail): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  if (comp.registrationOpensAt) entries.push({ at: comp.registrationOpensAt, label: "Registration opens", kind: "registration" });
  if (comp.registrationDeadline) entries.push({ at: comp.registrationDeadline, label: "Registration closes", kind: "registration" });
  if (comp.startsAt) entries.push({ at: comp.startsAt, label: "Competition starts", kind: "competition" });
  if (comp.endsAt) entries.push({ at: comp.endsAt, label: "Competition ends", kind: "competition" });

  const videoDeadlineMinutes = comp.videoDeadlineMinutes ?? 1440;
  for (const ev of comp.events) {
    const name = eventDisplayName(ev.eventType);
    for (const r of ev.rounds) {
      if (r.opensAt) {
        entries.push({ at: r.opensAt, label: `${name} — Round ${r.roundNumber} opens`, kind: "round-open", eventType: ev.eventType });
      }
      if (r.closesAt) {
        entries.push({ at: r.closesAt, label: `${name} — Round ${r.roundNumber} closes`, kind: "round-close", eventType: ev.eventType });
        const deadline = new Date(new Date(r.closesAt).getTime() + videoDeadlineMinutes * 60_000).toISOString();
        entries.push({ at: deadline, label: `${name} — Round ${r.roundNumber} video submission deadline`, kind: "video-deadline", eventType: ev.eventType });
      }
    }
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function DetailedSchedule({ comp }: { comp: CompetitionDetail }) {
  const entries = buildScheduleEntries(comp);
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        No schedule has been set for this competition yet.
      </div>
    );
  }

  const now = Date.now();

  const groups: { dateKey: string; label: string; entries: ScheduleEntry[] }[] = [];
  for (const entry of entries) {
    const d = new Date(entry.at);
    const dateKey = d.toDateString();
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      group = {
        dateKey,
        label: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }),
        entries: [],
      };
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Full Schedule</h2>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.dateKey}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              {group.label}
            </p>
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              {group.entries.map((entry, i) => {
                const isPast = new Date(entry.at).getTime() <= now;
                const tag = KIND_TAG[entry.kind];
                return (
                  <div
                    key={`${entry.label}-${entry.at}`}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""
                      } ${isPast ? "bg-zinc-50 dark:bg-zinc-900/20" : "bg-white dark:bg-zinc-900/40"}`}
                  >
                    <span className="w-20 shrink-0 font-mono text-sm text-zinc-500">
                      {new Date(entry.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    {entry.eventType && <EventIcon eventId={entry.eventType} size={16} className="shrink-0 text-zinc-400" />}
                    <span className={`flex-1 text-sm ${isPast ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-800 dark:text-zinc-200"}`}>
                      {entry.label}
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag.className}`}>
                      {tag.label}
                    </span>
                    {isPast && <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Share card ── */

function ShareCard({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  }, [title]);

  return (
    <button
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      {copied ? "Copied to clipboard! ✓" : "Share this competition ↗"}
    </button>
  );
}

/* ── Registration progress steps ── */

function RegistrationSteps({ paymentStatus }: { paymentStatus: string | null }) {
  const steps = ["Select Events", "Pay", "Confirmed"];
  const activeIndex = paymentStatus === null ? 0 : paymentStatus === "paid" ? 2 : 1;

  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${i < activeIndex
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : i === activeIndex
                  ? "bg-accent-primary text-zinc-950"
                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
              }`}
          >
            {i < activeIndex ? "✓" : i + 1} {label}
          </span>
          {i < steps.length - 1 && <span className="text-zinc-300 dark:text-zinc-700">→</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Participants Tab ── */

function ParticipantsTab({ compId }: { compId: string }) {
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParticipants(compId)
      .then((d) => {
        setParticipants(d.participants);
        setCount(d.count);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [compId]);

  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        No participants yet.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-500">{count} participant{count !== 1 ? "s" : ""}</p>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-500">#</th>
              <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
              <th className="px-4 py-3 font-medium text-zinc-500">CL ID</th>
              <th className="px-4 py-3 font-medium text-zinc-500">Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {participants.map((p, i) => (
              <tr key={p.userId} className="row-count-in bg-white dark:bg-zinc-900/40" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                <td className="px-4 py-3 text-zinc-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {p.clId}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.eventTypes.map((e) => (
                      <span
                        key={e}
                        title={eventDisplayName(e)}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        <EventIcon eventId={e} size={16} /> {eventDisplayName(e)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Rankings Tab ── */

function RankingsTab({ comp, showResultsLink }: { comp: CompetitionDetail; showResultsLink: boolean }) {
  const eventTypes = comp.events.map((e) => e.eventType);
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0] ?? "");
  const [ranking, setRanking] = useState<LiveRankingEntry[]>([]);
  const [roundInfo, setRoundInfo] = useState<{ roundNumber: number | null }>({ roundNumber: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    fetchLiveRanking(comp.id, selectedEvent)
      .then((d) => {
        setRanking(d.ranking);
        setRoundInfo({ roundNumber: d.roundNumber });
      })
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, [comp.id, selectedEvent]);

  return (
    <div>
      {showResultsLink && (
        <div className="mb-4">
          <Link
            href={`/competitions/${comp.id}/results`}
            className="text-sm text-accent-primary underline hover:brightness-110"
          >
            View Full Results
          </Link>
        </div>
      )}

      {/* Event selector */}
      {eventTypes.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {eventTypes.map((e) => (
            <button
              key={e}
              onClick={() => setSelectedEvent(e)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${selectedEvent === e
                  ? "bg-accent-primary text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
            >
              <span><EventIcon eventId={e} size={16} /></span>
              {eventDisplayName(e)}
            </button>
          ))}
        </div>
      )}

      {roundInfo.roundNumber && (
        <p className="mb-3 text-xs text-zinc-500">Round {roundInfo.roundNumber}</p>
      )}

      {loading ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={4} />
              ))}
            </tbody>
          </table>
        </div>
      ) : ranking.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
          No results yet for this event.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-500">Rank</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-500">ao5</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Best</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ranking.map((r, i) => (
                <tr key={r.userId} className="row-count-in bg-white dark:bg-zinc-900/40" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                  <td className="px-4 py-3 font-mono text-zinc-400">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (r.rank ?? "—")}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {r.ao5Ms !== null ? formatTime(r.ao5Ms) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {r.bestSingleMs !== null ? formatTime(r.bestSingleMs) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
