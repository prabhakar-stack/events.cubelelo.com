import type { RoundStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import type { Realtime } from "../sockets/realtime";
import { effectiveRoundStatus } from "./statusUtils";
import { closeRound, shortlistRound } from "./roundLifecycle";
import { scheduleRoundJobs } from "./roundScheduler";

const TICK_INTERVAL_MS = 60_000;

export function startRoundTicker(repo: Repository, realtime: Realtime): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const rounds = await repo.rounds.findActive();
      for (const round of rounds) {
        if (!round.opensAt) continue;

        const effective = effectiveRoundStatus(round);
        if (effective === round.status) continue;

        if (effective === "open" && round.status === "pending") {
          await repo.rounds.update(round.id, { status: "open" });
          realtime.emitRoundStatus(round.id, "open" as RoundStatus, round.opensAt);
          await scheduleRoundJobs(round);
          console.log(`⏱ Round ${round.id} recovery-opened`);
        }

        if (effective === "closed" && (round.status === "open" || round.status === "pending")) {
          await closeRound(repo, realtime, round);
          console.log(`⏱ Round ${round.id} recovery-closed`);
        }
      }

      await checkVerificationComplete(repo, realtime, rounds);
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
  rounds: Awaited<ReturnType<typeof repo.rounds.findActive>>,
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
