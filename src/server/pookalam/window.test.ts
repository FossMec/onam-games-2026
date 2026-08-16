import { describe, expect, it } from "vite-plus/test";
import { IST_OFFSET_MS, parseIstDateTime, resolvePhase } from "./window";

const MINUTE = 60 * 1000;

describe("parseIstDateTime", () => {
  it("reads a bare datetime as IST, not as UTC", () => {
    const parsed = parseIstDateTime("2026-08-20T18:30")!;
    expect(parsed.toISOString()).toBe("2026-08-20T13:00:00.000Z");
  });

  it("accepts a space separator and optional seconds", () => {
    expect(parseIstDateTime("2026-08-20 18:30")!.toISOString()).toBe("2026-08-20T13:00:00.000Z");
    expect(parseIstDateTime("2026-08-20T18:30:45")!.toISOString()).toBe("2026-08-20T13:00:45.000Z");
  });

  it("is exactly IST_OFFSET_MS behind the same wall clock in UTC", () => {
    const ist = parseIstDateTime("2026-08-20T00:00")!;
    expect(Date.UTC(2026, 7, 20) - ist.getTime()).toBe(IST_OFFSET_MS);
  });

  it("rejects anything it cannot read rather than guessing", () => {
    expect(parseIstDateTime("")).toBeNull();
    expect(parseIstDateTime("tomorrow")).toBeNull();
    expect(parseIstDateTime("2026-08-20")).toBeNull();
    expect(parseIstDateTime(undefined)).toBeNull();
    expect(parseIstDateTime(1_755_000_000_000)).toBeNull();
  });
});

describe("resolvePhase", () => {
  const now = Date.UTC(2026, 7, 20, 12, 0);
  const before = new Date(now - 10 * MINUTE);
  const after = new Date(now + 10 * MINUTE);

  it("is shut with nothing configured, so a half-set-up deploy shows nothing", () => {
    const state = resolvePhase(now, false, null, null);
    expect(state.open).toBe(false);
    expect(state.reason).toBe("unscheduled");
  });

  it("opens once the start has passed", () => {
    expect(resolvePhase(now, false, before, after).open).toBe(true);
    expect(resolvePhase(now, false, after, null).reason).toBe("not_yet");
  });

  it("closes at the deadline", () => {
    const state = resolvePhase(now, false, before, before);
    expect(state.open).toBe(false);
    expect(state.reason).toBe("over");
  });

  it("stays open forever when no deadline is set", () => {
    expect(resolvePhase(now, false, before, null).open).toBe(true);
  });

  it("lets the force flag open a phase that is not scheduled yet", () => {
    const state = resolvePhase(now, true, after, null);
    expect(state.open).toBe(true);
    expect(state.forced).toBe(true);
  });

  it("lets the force flag reopen a phase that has already closed", () => {
    // The 11pm switch: the deadline passed and one entrant has a real excuse.
    expect(resolvePhase(now, true, before, before).open).toBe(true);
  });

  it("reports the configured instants even while shut, for the countdown", () => {
    const state = resolvePhase(now, false, after, null);
    expect(state.opensAt).toBe(after);
    expect(state.open).toBe(false);
  });
});
