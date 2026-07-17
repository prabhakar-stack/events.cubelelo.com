import type { RoundStatus } from "@cubers/types";
import type { Repository } from "../db/repo";
import type { Realtime } from "../sockets/realtime";
import type { Round } from "../db/types";
import { getQueue } from "./jobQueue";
import { registerWorker } from "./jobQueue";
import { closeRound } from "./roundLifecycle";
import { ensureScramblesGenerated } from "./roundLifecycle";

let _repo: Repository | null = null;
let _realtime: Realtime | null = null;

export function initRoundScheduler(repo: Repository, realtime: Realtime): void {
  _repo = repo;
  _realtime = realtime;

  registerWorker("round:open", async (data) => {
    const { roundId } = data as { roundId: string };
    const repo = _repo!;
    const realtime = _realtime!;

    const round = await repo.rounds.findById(roundId);
    if (!round) return;
    if (round.status !== "pending") return;

    await ensureScramblesGenerated(repo, round);
    await repo.rounds.update(round.id, { status: "open" });
    realtime.emitRoundStatus(round.id, "open" as RoundStatus, round.opensAt);
    console.log(`⏱ Round ${round.id} scheduled-open`);
  });

  registerWorker("round:close", async (data) => {
    const { roundId } = data as { roundId: string };
    const repo = _repo!;
    const realtime = _realtime!;

    const round = await repo.rounds.findById(roundId);
    if (!round) return;
    if (round.status !== "open" && round.status !== "pending") return;

    await closeRound(repo, realtime, round);
    console.log(`⏱ Round ${round.id} scheduled-close`);
  });
}

export async function scheduleRoundJobs(round: Round): Promise<void> {
  const queue = await getQueue();
  const now = Date.now();

  if (round.opensAt) {
    const openAt = new Date(round.opensAt).getTime();
    const delay = Math.max(0, openAt - now);
    await queue.remove(`round:open:${round.id}`);
    if (round.status === "pending" && openAt > now) {
      await queue.add("round:open", { roundId: round.id }, {
        delay,
        jobId: `round:open:${round.id}`,
      });
    }
  }

  if (round.closesAt) {
    const closeAt = new Date(round.closesAt).getTime();
    const delay = Math.max(0, closeAt - now);
    await queue.remove(`round:close:${round.id}`);
    if ((round.status === "pending" || round.status === "open") && closeAt > now) {
      await queue.add("round:close", { roundId: round.id }, {
        delay,
        jobId: `round:close:${round.id}`,
      });
    }
  }
}

export async function cancelRoundJobs(roundId: string): Promise<void> {
  const queue = await getQueue();
  await queue.remove(`round:open:${roundId}`);
  await queue.remove(`round:close:${roundId}`);
}
