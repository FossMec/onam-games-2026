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
  audioHash: null,
  localIp: null,
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

  it("flags two browsers on one phone via the private LAN address", () => {
    // Chrome and Firefox on the same handset: different localStorage ids, so
    // different device hashes, but the machine's own address is the machine's.
    // Public + private address together is one device on one network.
    const verdict = scoreLink(["ip", "localIp"]);
    expect(verdict.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(verdict.severity).toBe("warn");
  });

  it("treats an audio match as corroboration, not proof", () => {
    // Alone it is below review — audio stacks are shared by every device of a
    // given model and OS. With the hardware signature behind it (55) it reaches
    // review and gets flagged, but stays short of the near-certain band, which
    // is reserved for evidence that survives a deliberate attempt to hide.
    expect(scoreLink(["audio"]).confidence).toBeLessThan(REVIEW_THRESHOLD);
    const corroborated = scoreLink(["audio", "hardware"]);
    expect(corroborated.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(corroborated.confidence).toBeLessThan(STRONG_THRESHOLD);
    expect(corroborated.severity).toBe("warn");
  });

  it("never exceeds 100 or double-counts a repeated signal", () => {
    const all = scoreLink([
      "fpVisitor",
      "hardware",
      "canvas",
      "audio",
      "localIp",
      "webgl",
      "fonts",
      "screen",
      "ip",
    ]);
    expect(all.confidence).toBe(100);
    expect(scoreLink(["canvas", "canvas", "canvas"]).confidence).toBe(
      scoreLink(["canvas"]).confidence,
    );
  });
});
