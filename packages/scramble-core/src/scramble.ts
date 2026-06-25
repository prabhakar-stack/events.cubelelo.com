import { randomScrambleForEvent } from "cubing/scramble";
import { EVENTS, type EventId } from "./events.js";

/**
 * Generate a single WCA-compliant scramble for an event.
 * Used client-side for practice and server-side for competition set generation.
 */
export async function generateScramble(eventId: EventId): Promise<string> {
  const event = EVENTS[eventId];
  const alg = await randomScrambleForEvent(event.wcaEvent);
  return alg.toString();
}

/**
 * Generate a batch of scrambles for an event (e.g. 5 solves per round).
 * Backend uses this to build a locked scramble set per round.
 */
export async function generateScrambleSet(
  eventId: EventId,
  count: number,
): Promise<string[]> {
  if (count < 1) throw new Error(`count must be >= 1, got ${count}`);
  const scrambles: string[] = [];
  for (let i = 0; i < count; i++) {
    scrambles.push(await generateScramble(eventId));
  }
  return scrambles;
}
