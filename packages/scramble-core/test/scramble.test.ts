import { describe, it, expect } from "vitest";
import { generateScramble, generateScrambleSet } from "../src/scramble.js";
import { EVENT_IDS, isEventId } from "../src/events.js";

describe("event registry", () => {
  it("has 3x3 as a valid event", () => {
    expect(isEventId("333")).toBe(true);
    expect(isEventId("not-an-event")).toBe(false);
  });
});

describe("generateScramble", () => {
  it("produces a non-empty scramble string for 3x3", async () => {
    const scramble = await generateScramble("333");
    expect(typeof scramble).toBe("string");
    expect(scramble.trim().length).toBeGreaterThan(0);
  });

  // The "must-have" events must all generate without throwing (PRD Module 1 §2.1).
  const mustEvents = EVENT_IDS.filter((id) =>
    ["333", "222", "444", "pyram", "skewb", "minx"].includes(id),
  );

  it.each(mustEvents)("generates a scramble for %s", async (id) => {
    const scramble = await generateScramble(id);
    expect(scramble.trim().length).toBeGreaterThan(0);
  });
});

describe("generateScrambleSet", () => {
  it("returns exactly N scrambles", async () => {
    const set = await generateScrambleSet("333", 5);
    expect(set).toHaveLength(5);
    set.forEach((s) => expect(s.trim().length).toBeGreaterThan(0));
  });

  it("rejects a count below 1", async () => {
    await expect(generateScrambleSet("333", 0)).rejects.toThrow();
  });
});
