import { randomUUID } from "node:crypto";
import { generateScrambleSet } from "@cubers/scramble-core";
import type {
  Competition,
  CompetitionEvent,
  Round,
  ScrambleSet,
  Result,
  User,
  Registration,
  RegistrationEvent,
  Payment,
  AuditLogEntry,
} from "./types";

/** The in-memory database. Swap this for a Postgres repository later. */
export interface Db {
  competitions: Map<string, Competition>;
  events: Map<string, CompetitionEvent>;
  rounds: Map<string, Round>;
  scrambleSets: Map<string, ScrambleSet>;
  results: Map<string, Result>;
  /** Ephemeral lobby roster: roundId -> (userId -> display name). */
  roster: Map<string, Map<string, string>>;
  users: Map<string, User>;
  registrations: Map<string, Registration>;
  registrationEvents: RegistrationEvent[];
  payments: Map<string, Payment>;
  auditLog: AuditLogEntry[];
  /** CL ID sequence per year. */
  clSeq: Map<number, number>;
}

export function createDb(): Db {
  return {
    competitions: new Map(),
    events: new Map(),
    rounds: new Map(),
    scrambleSets: new Map(),
    results: new Map(),
    roster: new Map(),
    users: new Map(),
    registrations: new Map(),
    registrationEvents: [],
    payments: new Map(),
    auditLog: [],
    clSeq: new Map(),
  };
}

/** Generate the next CL ID for the current year: CL-YYYY-0001, CL-YYYY-0002, … */
export function nextClId(db: Db): string {
  const year = new Date().getFullYear();
  const seq = (db.clSeq.get(year) ?? 0) + 1;
  db.clSeq.set(year, seq);
  return `CL-${year}-${String(seq).padStart(4, "0")}`;
}

export function userByEmail(db: Db, email: string): User | undefined {
  return [...db.users.values()].find((u) => u.email === email);
}

export function userByClId(db: Db, clId: string): User | undefined {
  return [...db.users.values()].find((u) => u.clId === clId);
}

/** Snapshot of the current lobby roster for a round. */
export function rosterSnapshot(
  db: Db,
  roundId: string,
): { userId: string; name: string }[] {
  const r = db.roster.get(roundId);
  if (!r) return [];
  return [...r.entries()].map(([userId, name]) => ({ userId, name }));
}

/** Email of the seeded admin — use it with /auth/dev-login to act as admin. */
export const SEED_ADMIN_EMAIL = "admin@cubelelo.com";

export async function seed(db: Db): Promise<void> {
  const now = new Date().toISOString();

  const admin: User = {
    id: "dev-admin",
    clId: nextClId(db),
    email: SEED_ADMIN_EMAIL,
    name: "Demo Admin",
    role: "admin",
    wcaVerified: false,
    accountStage: "active",
    createdAt: now,
  };
  db.users.set(admin.id, admin);

  const competition: Competition = {
    id: "demo",
    title: "Demo Open",
    type: "free",
    status: "live",
    description: "A demo competition to test the platform end-to-end.",
    rulesMd:
      "WCA regulations apply. 15s inspection (mandatory). ao5 format — best and worst trimmed. Penalties: +2 / DNF per the WCA guidelines.",
    baseFee: 0,
    perEventFee: 0,
    createdBy: admin.clId,
    createdAt: now,
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

export function registrationsForUser(db: Db, userId: string): Registration[] {
  return [...db.registrations.values()].filter((r) => r.userId === userId);
}

export function registrationsForCompetition(db: Db, competitionId: string): Registration[] {
  return [...db.registrations.values()].filter((r) => r.competitionId === competitionId);
}

export function eventsForRegistration(db: Db, registrationId: string): CompetitionEvent[] {
  const eventIds = db.registrationEvents
    .filter((re) => re.registrationId === registrationId)
    .map((re) => re.competitionEventId);
  return eventIds
    .map((id) => db.events.get(id))
    .filter((e): e is CompetitionEvent => e !== undefined);
}
