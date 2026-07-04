import { randomUUID } from "node:crypto";
import { generateScrambleSet } from "@cubers/scramble-core";
import type { Repository } from "./repo";

export const SEED_ADMIN_EMAIL = "admin@cubelelo.com";
export const SEED_ADMIN_ID = "00000000-0000-0000-0000-0000000000ad";
export const SEED_DEMO_COMP_ID = "00000000-0000-0000-0000-000000000001";

/** Idempotent dev seed — skips if admin already exists or in production. */
export async function seed(repo: Repository): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const existing = await repo.users.findByEmail(SEED_ADMIN_EMAIL);
  if (existing) return;

  const now = new Date().toISOString();
  const clId = await repo.users.nextClId();
  const adminId = SEED_ADMIN_ID;

  await repo.users.create({
    id: adminId,
    clId,
    email: SEED_ADMIN_EMAIL,
    name: "Demo Admin",
    role: "admin",
    wcaVerified: false,
    emailVerified: true,
    mobileVerified: false,
    profilePrivacy: "public",
    accountStage: "active",
    createdAt: now,
  });

  const compId = SEED_DEMO_COMP_ID;
  await repo.competitions.create({
    id: compId,
    title: "Demo Open",
    type: "free",
    status: "registration_open",
    description: "A demo competition to test the platform end-to-end.",
    rulesMd:
      "WCA regulations apply. 15s inspection (mandatory). ao5 format — best and worst trimmed. Penalties: +2 / DNF per the WCA guidelines.",
    baseFee: 0,
    perEventFee: 0,
    featured: true,
    videoDeadlineMinutes: 1440,
    createdBy: adminId,
    createdAt: now,
  });

  const eventId = randomUUID();
  await repo.competitionEvents.create({
    id: eventId,
    competitionId: compId,
    eventType: "333",
    roundCount: 1,
  });

  const roundId = randomUUID();
  await repo.rounds.create({
    id: roundId,
    competitionEventId: eventId,
    roundNumber: 1,
    status: "open",
    opensAt: now,
  });

  const scrambles = await generateScrambleSet("333", 5);
  await repo.scrambleSets.upsert({
    id: randomUUID(),
    roundId,
    scrambles,
    generatedAt: now,
    lockedAt: now,
    lockedBy: undefined,
  });
}
