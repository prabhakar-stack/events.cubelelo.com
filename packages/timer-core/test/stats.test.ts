import { describe, it, expect } from "vitest";
import type { Solve } from "@cubers/types";
import {
  effectiveTime,
  bestSingle,
  mean,
  median,
  average,
  ao5,
  ao12,
} from "../src/stats.js";

const s = (time_ms: number, penalty: Solve["penalty"] = "none", inspectionPenalty: Solve["inspectionPenalty"] = "none"): Solve => ({
  time_ms,
  inspectionPenalty,
  penalty,
});

describe("effectiveTime", () => {
  it("adds 2000ms for +2 and returns Infinity for DNF", () => {
    expect(effectiveTime(s(10_000))).toBe(10_000);
    expect(effectiveTime(s(10_000, "plus2"))).toBe(12_000);
    expect(effectiveTime(s(10_000, "dnf"))).toBe(Infinity);
  });
});

describe("bestSingle", () => {
  it("returns the fastest valid single", () => {
    expect(bestSingle([s(10_000), s(9_000), s(11_000)])).toBe(9_000);
  });
  it("ignores DNFs but counts +2 time", () => {
    expect(bestSingle([s(8_000, "dnf"), s(9_000, "plus2")])).toBe(11_000);
  });
  it("returns null when all DNF", () => {
    expect(bestSingle([s(8_000, "dnf"), s(9_000, "dnf")])).toBeNull();
  });
});

describe("ao5 (WCA trimming)", () => {
  it("drops best and worst, averages the middle three", () => {
    expect(ao5([s(10_000), s(12_000), s(11_000), s(9_000), s(13_000)])).toBe(11_000);
  });
  it("a single DNF is treated as the worst and trimmed away", () => {
    expect(ao5([s(10_000), s(12_000), s(11_000), s(9_000, "dnf"), s(9_000)])).toBe(11_000);
  });
  it("two or more DNFs make the average a DNF (null)", () => {
    expect(ao5([s(10_000, "dnf"), s(12_000), s(11_000), s(9_000, "dnf"), s(13_000)])).toBeNull();
  });
  it("applies +2 before trimming", () => {
    // 9s+2 = 11s; set {10,11,11,12,13} → trim 10 & 13 → mean(11,11,12)=11333
    expect(ao5([s(10_000), s(12_000), s(11_000), s(9_000, "plus2"), s(13_000)])).toBe(11_333);
  });
  it("returns null with fewer than 5 solves", () => {
    expect(ao5([s(10_000), s(11_000)])).toBeNull();
  });
});

describe("ao12", () => {
  it("averages the middle 10 of 12", () => {
    const solves = Array.from({ length: 12 }, (_, i) => s((i + 1) * 1000));
    // trim 1000 & 12000 → mean(2000..11000) = 6500
    expect(ao12(solves)).toBe(6_500);
  });
});

describe("mean & median", () => {
  it("mean is DNF (null) if any solve is DNF", () => {
    expect(mean([s(10_000), s(12_000, "dnf"), s(11_000)])).toBeNull();
  });
  it("mean averages all when valid", () => {
    expect(mean([s(10_000), s(12_000), s(11_000)])).toBe(11_000);
  });
  it("median of odd count", () => {
    expect(median([s(10_000), s(12_000), s(11_000)])).toBe(11_000);
  });
});

describe("average uses only the last N solves", () => {
  it("rolls over the most recent 5", () => {
    const solves = [s(99_000), s(10_000), s(12_000), s(11_000), s(9_000), s(13_000)];
    expect(average(solves, 5)).toBe(11_000); // ignores the leading 99s
  });
});
