"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventDisplayName } from "@/lib/eventNames";
import {
  fetchEventPage,
  fetchLeaderboard,
  fetchVerifiedResults,
  updateResultVideo,
  type EventPageData,
  type EventRoundInfo,
  type EventUserRound,
  type ResultDto,
} from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLeaderboard } from "@/features/realtime/useLeaderboard";
import { useRoundStatus } from "@/features/realtime/useRoundStatus";
import { StatusBadge } from "@/features/competitions/StatusBadge";
import { formatTime } from "@cubers/timer-core";

type RoundTab = "live" | "verified" | "participants";

export default function EventPage() {
  const params = useParams<{ id: string; eventId: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<EventPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoundIdx, setSelectedRoundIdx] = useState<number>(-1);
  const [roundTab, setRoundTab] = useState<RoundTab>("live");

  useEffect(() => {
    if (!params.id || !params.eventId) return;
    setLoading(true);
    fetchEventPage(params.id, params.eventId)
      .then((d) => {
        setData(d);
        // Default to latest non-pending round, or last round
        const latestIdx = [...d.rounds]
          .reverse()
          .findIndex((r) => r.status !== "pending");
        setSelectedRoundIdx(
          latestIdx >= 0 ? d.rounds.length - 1 - latestIdx : d.rounds.length - 1,
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.id, params.eventId]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-400">
        {error ?? "Event not found"}
      </main>
    );
  }

  const { competition, event, rounds, userStatus, finalStandings } = data;
  const selectedRound = rounds[selectedRoundIdx] ?? null;
  const userRound = userStatus?.rounds.find(
    (r) => r.roundId === selectedRound?.id,
  );

  // Find next round for countdown
  const nextRound =
    selectedRound && selectedRoundIdx < rounds.length - 1
      ? rounds[selectedRoundIdx + 1]
      : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Back link */}
      <Link
        href={`/competitions/${competition.id}`}
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← {competition.title}
      </Link>

      {/* Event header */}
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {eventDisplayName(event.eventType)}
        </h1>
        <span className="text-sm text-zinc-500">
          {event.roundCount} round{event.roundCount > 1 ? "s" : ""}
        </span>
      </div>

      {/* Event details */}
      <div className="mb-6 flex flex-wrap gap-4 text-xs text-zinc-500">
        {event.cutoffMs && <span>Cutoff: {(event.cutoffMs / 1000).toFixed(1)}s</span>}
        {event.timeLimitMs && <span>Time limit: {(event.timeLimitMs / 1000).toFixed(1)}s</span>}
        <StatusBadge status={competition.status} />
      </div>

      {/* Cancellation banner */}
      {competition.status === "cancelled" && competition.cancellationReason && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">
            This competition has been cancelled
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            {competition.cancellationReason}
          </p>
        </div>
      )}

      {/* Round selector pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {rounds.map((r, idx) => (
          <button
            key={r.id}
            onClick={() => {
              setSelectedRoundIdx(idx);
              setRoundTab("live");
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              selectedRoundIdx === idx
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            R{r.roundNumber}
            <StatusBadge status={r.status} />
          </button>
        ))}
      </div>

      {/* Selected round content */}
      {selectedRound && (
        <SelectedRoundView
          round={selectedRound}
          userRound={userRound ?? null}
          userStatus={userStatus}
          nextRound={nextRound}
          isLastRound={selectedRoundIdx === rounds.length - 1}
          finalStandings={selectedRoundIdx === rounds.length - 1 ? finalStandings : null}
          competitionId={competition.id}
          eventType={event.eventType}
          roundTab={roundTab}
          setRoundTab={setRoundTab}
          videoDeadlineMinutes={competition.videoDeadlineMinutes}
          onVideoUpdate={() => {
            fetchEventPage(params.id!, params.eventId!).then(setData).catch(() => {});
          }}
        />
      )}

      {/* Rules */}
      {competition.rulesMd && (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Rules
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {competition.rulesMd}
          </p>
        </div>
      )}
    </main>
  );
}

/* ── Selected Round View ── */

function SelectedRoundView({
  round,
  userRound,
  userStatus,
  nextRound,
  isLastRound,
  finalStandings,
  competitionId,
  eventType,
  roundTab,
  setRoundTab,
  videoDeadlineMinutes,
  onVideoUpdate,
}: {
  round: EventRoundInfo;
  userRound: EventUserRound | null;
  userStatus: EventPageData["userStatus"];
  nextRound: EventRoundInfo | null;
  isLastRound: boolean;
  finalStandings: { rank: number; userId: string; displayName: string }[] | null;
  competitionId: string;
  eventType: string;
  roundTab: RoundTab;
  setRoundTab: (t: RoundTab) => void;
  videoDeadlineMinutes: number;
  onVideoUpdate: () => void;
}) {
  // Live round status via Socket.IO
  const { status: liveStatus } = useRoundStatus(round.id, round.status);

  const canEnter =
    liveStatus === "open" &&
    userStatus?.registered &&
    userRound?.userStatus !== "submitted" &&
    (round.roundNumber === 1 ||
      userRound?.userStatus === "active" ||
      userRound?.userStatus === "upcoming");

  const isLocked =
    round.roundNumber > 1 &&
    userRound?.userStatus === "locked";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      {/* Round header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Round {round.roundNumber}
        </span>
        <StatusBadge status={liveStatus} />

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{round.resultCount} result{round.resultCount !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{round.participantCount} participant{round.participantCount !== 1 ? "s" : ""}</span>
        </div>

        {/* User status badge */}
        {userRound && (
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${
              userRound.userStatus === "qualified"
                ? isLastRound
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : userRound.userStatus === "eliminated"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : userRound.userStatus === "submitted"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {userRound.userStatus === "qualified"
              ? isLastRound ? "Top Finisher" : "Qualified"
              : userRound.userStatus === "eliminated"
                ? isLastRound ? "Participated" : "Eliminated"
                : userRound.userStatus === "submitted"
                  ? "Submitted"
                  : userRound.userStatus === "active"
                    ? "Ready"
                    : userRound.userStatus === "locked"
                      ? "Not Shortlisted"
                      : userRound.userStatus.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Countdown / Enter Round */}
      <RoundActions
        round={round}
        liveStatus={liveStatus}
        canEnter={!!canEnter}
        isLocked={!!isLocked}
        isSubmitted={userRound?.userStatus === "submitted"}
        userRegistered={!!userStatus?.registered}
        competitionId={competitionId}
        eventType={eventType}
        nextRound={nextRound}
        isLastRound={isLastRound}
        userResult={userRound?.result ?? null}
        videoDeadlineMinutes={videoDeadlineMinutes}
        onVideoUpdate={onVideoUpdate}
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 px-5 dark:border-zinc-800">
        {(["live", "verified", "participants"] as RoundTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setRoundTab(t)}
            className={`px-4 py-2.5 text-xs font-medium transition ${
              roundTab === t
                ? "border-b-2 border-emerald-500 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "live"
              ? "Live Rankings"
              : t === "verified"
                ? "Verified Results"
                : "Participants"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {roundTab === "live" && <LiveRankingsPanel roundId={round.id} roundStatus={liveStatus} />}
        {roundTab === "verified" && <VerifiedResultsPanel roundId={round.id} />}
        {roundTab === "participants" && (
          <ParticipantsPanel roundId={round.id} roundStatus={liveStatus} />
        )}
      </div>

      {/* Final Standings for last round */}
      {isLastRound && finalStandings && finalStandings.length > 0 && (
        <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-500">
            Final Standings
          </h3>
          <div className="space-y-1">
            {finalStandings.map((entry) => (
              <div
                key={entry.userId}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                <span className={`w-8 text-center font-bold ${
                  entry.rank === 1 ? "text-amber-400" : entry.rank === 2 ? "text-zinc-400" : entry.rank === 3 ? "text-amber-600" : "text-zinc-500"
                }`}>
                  #{entry.rank}
                </span>
                <span className="text-zinc-200">{entry.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Round Actions (Countdown + Enter button) ── */

function useCountdown(target: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  return Math.max(0, new Date(target).getTime() - now);
}

function fmtCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RoundActions({
  round,
  liveStatus,
  canEnter,
  isLocked,
  isSubmitted,
  userRegistered,
  competitionId,
  eventType,
  nextRound,
  isLastRound,
  userResult,
  videoDeadlineMinutes,
  onVideoUpdate,
}: {
  round: EventRoundInfo;
  liveStatus: string;
  canEnter: boolean;
  isLocked: boolean;
  isSubmitted: boolean;
  userRegistered: boolean;
  competitionId: string;
  eventType: string;
  nextRound: EventRoundInfo | null;
  isLastRound: boolean;
  userResult: { id: string; rank: number | null; ao5Ms: number | null; bestSingleMs: number | null; videoUrl: string | null } | null;
  videoDeadlineMinutes: number;
  onVideoUpdate: () => void;
}) {
  const countdownTarget =
    liveStatus === "pending" && round.opensAt
      ? round.opensAt
      : liveStatus === "closed" && nextRound?.opensAt
        ? nextRound.opensAt
        : null;

  const remaining = useCountdown(countdownTarget);

  // Video deadline countdown
  const videoDeadlineTarget = round.closesAt
    ? new Date(new Date(round.closesAt).getTime() + videoDeadlineMinutes * 60 * 1000).toISOString()
    : null;
  const videoRemaining = useCountdown(
    userResult && (liveStatus === "closed" || liveStatus === "advanced") ? videoDeadlineTarget : null,
  );
  const videoDeadlinePassed = videoRemaining !== null && videoRemaining <= 0;
  const showVideoUpload = userResult && (liveStatus === "closed" || liveStatus === "advanced") && !videoDeadlinePassed;

  return (
    <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3">
        {/* Countdown */}
        {remaining !== null && remaining > 0 && (
          <div className="text-sm text-zinc-500">
            {liveStatus === "pending" ? "Opens in " : "Next round in "}
            <span className="font-mono font-semibold text-zinc-300">
              {fmtCountdown(remaining)}
            </span>
          </div>
        )}

        {liveStatus === "open" && (
          <span className="text-sm font-medium text-emerald-400">Round is live</span>
        )}

        {liveStatus === "closed" && !nextRound && (
          <span className="text-sm text-zinc-500">
            {isLastRound ? "Final round closed — awaiting results" : "Round closed"}
          </span>
        )}

        {liveStatus === "advanced" && (
          <span className="text-sm text-zinc-500">
            {isLastRound ? "Event complete — final standings available" : "Round complete — results finalized"}
          </span>
        )}

        {/* Enter Round button */}
        <div className="ml-auto">
          {liveStatus === "open" && userRegistered && (
            isSubmitted ? (
              <span className="rounded-lg bg-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                Response Submitted
              </span>
            ) : canEnter ? (
              <Link
                href={`/competitions/${competitionId}/round/${round.roundNumber}?eventId=${eventType}`}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Enter Round
              </Link>
            ) : isLocked ? (
              <span className="rounded-lg bg-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-400">
                Not Shortlisted
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Video upload section */}
      {showVideoUpload && (
        <VideoUploadSection
          resultId={userResult.id}
          currentVideoUrl={userResult.videoUrl}
          remaining={videoRemaining!}
          onUpdate={onVideoUpdate}
        />
      )}
    </div>
  );
}

function VideoUploadSection({
  resultId,
  currentVideoUrl,
  remaining,
  onUpdate,
}: {
  resultId: string;
  currentVideoUrl: string | null;
  remaining: number;
  onUpdate: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmitVideo = async () => {
    if (!videoUrl.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await updateResultVideo(resultId, videoUrl.trim());
      setMsg({ type: "ok", text: "Video URL saved!" });
      onUpdate();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {currentVideoUrl ? "Update Video Link" : "Submit Video Link"}
        </span>
        <span className="text-xs font-mono text-amber-500">
          {fmtCountdown(remaining)} left
        </span>
      </div>
      {currentVideoUrl && (
        <p className="mb-2 text-xs text-zinc-500">
          Current: <a href={currentVideoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{currentVideoUrl}</a>
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Paste video link (YouTube / Drive)"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          onClick={handleSubmitVideo}
          disabled={busy || !videoUrl.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : currentVideoUrl ? "Update" : "Submit"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.type === "ok" ? "text-emerald-500" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

/* ── Live Rankings Panel ── */

function LiveRankingsPanel({
  roundId,
  roundStatus,
}: {
  roundId: string;
  roundStatus: string;
}) {
  const board = useLeaderboard(roundId);

  if (roundStatus === "pending") {
    return <p className="text-sm text-zinc-500">Waiting for the round to open…</p>;
  }

  if (board.length === 0) {
    return <p className="text-sm text-zinc-500">No results yet.</p>;
  }

  return <ResultTable results={board} showFlagStatus />;
}

/* ── Verified Results Panel ── */

function VerifiedResultsPanel({ roundId }: { roundId: string }) {
  const [results, setResults] = useState<ResultDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerifiedResults(roundId)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [roundId]);

  if (loading) return <p className="text-sm text-zinc-500">Loading verified results…</p>;

  if (results.length === 0) {
    return <p className="text-sm text-zinc-500">No verified results yet.</p>;
  }

  return <ResultTable results={results} showFlagStatus={false} />;
}

/* ── Participants Panel ── */

function ParticipantsPanel({
  roundId,
  roundStatus,
}: {
  roundId: string;
  roundStatus: string;
}) {
  const [results, setResults] = useState<ResultDto[]>([]);
  const [loading, setLoading] = useState(true);

  const showResults =
    roundStatus === "closed" ||
    roundStatus === "advanced" ||
    roundStatus === "cancelled";

  useEffect(() => {
    if (!showResults) {
      setLoading(false);
      return;
    }
    fetchLeaderboard(roundId)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [roundId, showResults]);

  if (!showResults) {
    return (
      <p className="text-sm text-zinc-500">
        Participants will be shown after the round closes.
      </p>
    );
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading participants…</p>;

  if (results.length === 0) {
    return <p className="text-sm text-zinc-500">No participants found.</p>;
  }

  return <ResultTable results={results} showFlagStatus={false} />;
}

/* ── Shared Result Table ── */

function ResultTable({
  results,
  showFlagStatus,
}: {
  results: ResultDto[];
  showFlagStatus: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900/60">
          <tr>
            <th className="px-4 py-3 font-medium text-zinc-500">Rank</th>
            <th className="px-4 py-3 font-medium text-zinc-500">Competitor</th>
            <th className="px-4 py-3 font-medium text-zinc-500">ao5</th>
            <th className="px-4 py-3 font-medium text-zinc-500">Best</th>
            {showFlagStatus && (
              <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {results.map((r) => (
            <tr key={r.id} className="bg-white dark:bg-zinc-900/40">
              <td className="px-4 py-2.5 text-zinc-400">{r.rank ?? "—"}</td>
              <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                {r.userId}
              </td>
              <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                {r.ao5Ms !== null ? formatTime(r.ao5Ms) : "—"}
              </td>
              <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300">
                {r.bestSingleMs !== null ? formatTime(r.bestSingleMs) : "—"}
              </td>
              {showFlagStatus && (
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      r.flagStatus === "clean" || r.flagStatus === "verified"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : r.flagStatus === "flagged"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {r.flagStatus ?? "—"}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
