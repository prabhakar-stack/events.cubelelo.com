import { describe, it, expect } from "vitest";
import { TimerEngine } from "../src/engine.js";

describe("TimerEngine — practice mode (no inspection)", () => {
  it("runs a basic solve: hold → release → stop", () => {
    const e = new TimerEngine({ useInspection: false, holdToStartMs: 0 });
    e.down(0); // arm
    expect(e.snapshot(0).phase).toBe("ready");
    expect(e.snapshot(0).armed).toBe(true);
    e.up(0); // start solving
    expect(e.snapshot(2_000).phase).toBe("solving");
    expect(e.snapshot(2_000).timeMs).toBe(2_000); // live elapsed
    e.down(5_123); // stop
    const snap = e.snapshot(5_123);
    expect(snap.phase).toBe("stopped");
    expect(snap.result).toEqual({ time_ms: 5_123, inspectionPenalty: "none", penalty: "none" });
  });

  it("requires a full hold before arming when holdToStartMs > 0", () => {
    const e = new TimerEngine({ useInspection: false, holdToStartMs: 500 });
    e.down(0);
    expect(e.snapshot(100).phase).toBe("idle"); // not armed yet
    e.up(200); // released too early → cancels arming
    expect(e.snapshot(300).phase).toBe("idle");

    e.down(1_000);
    e.tick(1_600); // held long enough
    expect(e.snapshot(1_600).phase).toBe("ready");
    e.up(1_700);
    expect(e.snapshot(1_700).phase).toBe("solving");
  });
});

describe("TimerEngine — competition mode (inspection on)", () => {
  function startInspection(e: TimerEngine, t: number) {
    e.down(t); // begins inspection
    e.up(t); // release; next hold can arm
  }

  it("no penalty when solve starts within 15s", () => {
    const e = new TimerEngine(); // defaults: inspection on, 15s/17s
    startInspection(e, 0);
    expect(e.snapshot(5_000).phase).toBe("inspection");
    e.down(5_000); // arm
    e.up(5_000); // start solving
    e.down(12_000); // stop
    expect(e.snapshot(12_000).result).toEqual({ time_ms: 7_000, inspectionPenalty: "none", penalty: "none" });
  });

  it("+2 when solve starts between 15s and 17s", () => {
    const e = new TimerEngine();
    startInspection(e, 0);
    e.down(16_000); // arm at 16s
    e.up(16_000); // start solving → +2
    e.down(20_000); // stop
    expect(e.snapshot(20_000).result).toEqual({ time_ms: 4_000, inspectionPenalty: "plus2", penalty: "none" });
  });

  it("auto-DNF if inspection passes 17s without starting the solve", () => {
    const e = new TimerEngine();
    startInspection(e, 0);
    e.tick(17_001);
    const snap = e.snapshot(17_001);
    expect(snap.phase).toBe("stopped");
    expect(snap.result).toEqual({ time_ms: 0, inspectionPenalty: "dnf", penalty: "none" });
  });

  it("exposes inspection countdown remaining", () => {
    const e = new TimerEngine();
    startInspection(e, 0);
    expect(e.snapshot(3_000).inspectionRemainingMs).toBe(12_000); // 15s - 3s
  });

  it("reset returns to idle", () => {
    const e = new TimerEngine();
    startInspection(e, 0);
    e.down(2_000);
    e.up(2_000);
    e.down(5_000);
    expect(e.snapshot(5_000).phase).toBe("stopped");
    e.reset();
    expect(e.snapshot(6_000).phase).toBe("idle");
    expect(e.snapshot(6_000).result).toBeNull();
  });
});
