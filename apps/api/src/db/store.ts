import { randomUUID } from "node:crypto";
import { generateScrambleSet } from "@cubers/scramble-core";
import type {
  Competition,
  CompetitionEvent,
  Round,
  ScrambleSet,
  Result,
} from "./types";

/** The in-memory database. Swap this for a Postgres repository later. */
export interface Db {
  competitions: Map<string, Competition>;
  events: Map<string, CompetitionEvent>;
  rounds: Map<string, Round>;
  scrambleSets: Map<string, ScrambleSet>;
  results: Map<string, Result>;
}

export function createDb(): Db {
  return {
    competitions: new Map(),
    events: new Map(),
    rounds: new Map(),
    scrambleSets: new Map(),
    results: new Map(),
  };
}

/**
 * Seed a demo competition: one 3x3 event, round 1 already OPEN with a locked
 * scramble set, so the web terminal at /competitions/demo/round/1 works
 * end-to-end without an admin first generating scrambles.
 */
export async function seed(db: Db): Promise<void> {
  const now = new Date().toISOString();

  const competition: Competition = {
    id: "demo",
    title: "Demo Open",
    type: "free",
    status: "live",
  };
  db.competitions.set(competition.id, competition);

  const event: CompetitionEvent = {
    id: randomUUID(),
    competitionId: competition.id,
    eventType: "333",
    roundCount: 1,
  };
  db.events.set(event.id, event);

  const round: Round = {
    id: randomUUID(),
    competitionEventId: event.id,
    roundNumber: 1,
    status: "open",
    opensAt: now,
  };
  db.rounds.set(round.id, round);

  const scrambles = await generateScrambleSet("333", 5);
  const set: ScrambleSet = {
    id: randomUUID(),
    roundId: round.id,
    scrambles,
    generatedAt: now,
    lockedAt: now,
    lockedBy: "seed",
  };
  db.scrambleSets.set(set.id, set);
}

// ── lookup helpers ──
export function roundsForCompetition(db: Db, competitionId: string): Round[] {
  const eventIds = new Set(
    [...db.events.values()]
      .filter((e) => e.competitionId === competitionId)
      .map((e) => e.id),
  );
  return [...db.rounds.values()].filter((r) =>
    eventIds.has(r.competitionEventId),
  );
}

export function eventForRound(db: Db, round: Round): CompetitionEvent | undefined {
  return db.events.get(round.competitionEventId);
}

export function scrambleSetForRound(db: Db, roundId: string): ScrambleSet | undefined {
  return [...db.scrambleSets.values()].find((s) => s.roundId === roundId);
}

export function resultsForRound(db: Db, roundId: string): Result[] {
  return [...db.results.values()].filter((r) => r.roundId === roundId);
}
