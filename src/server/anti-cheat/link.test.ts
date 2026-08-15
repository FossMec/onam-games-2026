import { describe, expect, it } from "vite-plus/test";
import {
  REVIEW_THRESHOLD,
  STRONG_THRESHOLD,
  matchSignals,
  scoreLink,
  type DeviceSignals,
} from "./link";

const blank: DeviceSignals = {
  fpVisitorId: null,
  hardwareHash: null,
  canvasHash: null,
  webglHash: null,
  fontHash: null,
  screenHash: null,
  lastIp: null,
};

describe("matchSignals", () => {
  it("never matches on a missing signal", () => {
    // Two privacy-hardened browsers that refused canvas and WebGL agree on
    // nothing but their own silence. Treating that as evidence would link
    // every such player to every other one.
    expect(matchSignals(blank, blank)).toEqual([]);
    expect(matchSignals({ ...blank, canvasHash: "" }, { ...blank, canvasHash: "" })).toEqual([]);
  });

  it("reports each signal the two devices agree on", () => {
    const a: DeviceSignals = { ...blank, fpVisitorId: "v1", canvasHash: "c1", lastIp: "1.2.3.4" };
    const b: DeviceSignals = { ...blank, fpVisitorId: "v1", canvasHash: "c9", lastIp: "1.2.3.4" };
    expect(matchSignals(a, b).sort()).toEqual(["fpVisitor", "ip"]);
  });
});

describe("scoreLink", () => {
  it("does not flag a household sharing one address", () => {
    // Two siblings, two laptops, one router. This is the single most common
    // shape of an innocent collision and it must stay below review.
    const verdict = scoreLink(["ip"]);
    expect(verdict.confidence).toBeLessThan(REVIEW_THRESHOLD);
    expect(verdict.severity).toBe("info");
    expect(verdict.trustPenalty).toBe(0);
  });

  it("does not flag a shared address plus a common screen size", () => {
    expect(scoreLink(["ip", "screen"]).confidence).toBeLessThan(REVIEW_THRESHOLD);
  });

  it("treats a FingerprintJS match as near-certain", () => {
    // Same browser, storage cleared: precisely the move being looked for.
    expect(scoreLink(["fpVisitor"]).confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(scoreLink(["fpVisitor"]).severity).toBe("warn");
    expect(scoreLink(["fpVisitor", "ip"]).confidence).toBeGreaterThanOrEqual(STRONG_THRESHOLD);
  });

  it("escalates a second browser on the same machine", () => {
    // Different browser, same GPU, same fonts, same router.
    const verdict = scoreLink(["hardware", "webgl", "fonts", "ip"]);
    expect(verdict.confidence).toBeGreaterThanOrEqual(STRONG_THRESHOLD);
    expect(verdict.severity).toBe("critical");
  });

  it("never exceeds 100 or double-counts a repeated signal", () => {
    const all = scoreLink(["fpVisitor", "hardware", "canvas", "webgl", "fonts", "screen", "ip"]);
    expect(all.confidence).toBe(100);
    expect(scoreLink(["canvas", "canvas", "canvas"]).confidence).toBe(
      scoreLink(["canvas"]).confidence,
    );
  });
});
