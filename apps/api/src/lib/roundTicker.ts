import type { RoundStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import type { Realtime } from "../sockets/realtime";
import { effectiveRoundStatus, effectiveCompStatus } from "./statusUtils";
import { closeRound, shortlistRound } from "./roundLifecycle";

const TICK_INTERVAL_MS = 10_000;

export function startRoundTicker(repo: Repository, realtime: Realtime): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const rounds = await repo.rounds.findAll();
      for (const round of rounds) {
        if (round.status === "advanced" || round.status === "cancelled") continue;
        if (!round.opensAt) continue;

        const effective = effectiveRoundStatus(round);
        if (effective === round.status) continue;

        if (effective === "open" && round.status === "pending") {
          await repo.rounds.update(round.id, { status: "open" });
          realtime.emitRoundStatus(round.id, "open" as RoundStatus, round.opensAt);
          console.log(`⏱ Round ${round.id} auto-opened`);
        }

        if (effective === "closed" && (round.status === "open" || round.status === "pending")) {
          await closeRound(repo, realtime, round);
          console.log(`⏱ Round ${round.id} auto-closed`);
        }
      }

      await checkVerificationComplete(repo, realtime, rounds);
      await checkCompetitionCompletion(repo, realtime);
    } catch (err) {
      console.error("Round ticker error:", err);
    } finally {
      running = false;
    }
  };

  tick();
  const handle = setInterval(tick, TICK_INTERVAL_MS);
  return () => clearInterval(handle);
}

async function checkVerificationComplete(
  repo: Repository,
  realtime: Realtime,
  rounds: Awaited<ReturnType<typeof repo.rounds.findAll>>,
): Promise<void> {
  for (const round of rounds) {
    if (round.status !== "closed") continue;
    if (!round.advancementCriteria && !round.advancementCount) continue;

    const results = await repo.results.findByRound(round.id);
    if (results.length === 0) continue;
    if (results.some((r) => r.flagStatus === "flagged")) continue;

    await shortlistRound(repo, realtime, round);
    console.log(`⏱ Round ${round.id} auto-shortlisted (all results verified)`);
  }
}

async function checkCompetitionCompletion(repo: Repository, realtime: Realtime): Promise<void> {
  const comps = await repo.competitions.findAll();
  for (const comp of comps) {
    if (effectiveCompStatus(comp) !== "results_pending") continue;

    const events = await repo.competitionEvents.findByCompetition(comp.id);
    if (events.length === 0) continue;

    const rounds = await repo.rounds.findByCompetition(comp.id);
    let allResolved = true;

    for (const event of events) {
      const eventRounds = rounds
        .filter((r) => r.competitionEventId === event.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);
      const finalRound = eventRounds[eventRounds.length - 1];
      if (!finalRound) { allResolved = false; break; }

      const results = await repo.results.findByRound(finalRound.id);
      if (results.length === 0) { allResolved = false; break; }
      if (results.some((r) => r.flagStatus === "flagged")) { allResolved = false; break; }
    }

    if (allResolved) {
      await repo.competitions.update(comp.id, { status: "completed" });
      realtime.emitCompStatus(comp.id, "completed");
      console.log(`⏱ Competition ${comp.id} auto-completed`);
    }
  }
}
