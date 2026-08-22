import { describe, expect, it } from "vite-plus/test";
import {
  SHARE_MEMES,
  aside,
  brag,
  buildCaption,
  figureFor,
  memeFor,
  spriteFor,
  taunt,
  tierFor,
  type ShareTier,
} from "./share-copy";

describe("tierFor", () => {
  it("reads the top of the board", () => {
    expect(tierFor({ rank: 1, fieldSize: 40, afterDeadline: false })).toBe("champion");
    expect(tierFor({ rank: 3, fieldSize: 40, afterDeadline: false })).toBe("podium");
  });

  it("splits the field on the same cuts the win modal uses", () => {
    // 41 players: rank 5 is the 90th percentile, rank 21 is the median.
    expect(tierFor({ rank: 5, fieldSize: 41, afterDeadline: false })).toBe("sharp");
    expect(tierFor({ rank: 21, fieldSize: 41, afterDeadline: false })).toBe("middle");
    expect(tierFor({ rank: 22, fieldSize: 41, afterDeadline: false })).toBe("tail");
  });

  it("treats a run with no board position as unranked, not as last", () => {
    expect(tierFor({ rank: null, fieldSize: null, afterDeadline: false })).toBe("unranked");
    expect(tierFor({ rank: 4, fieldSize: null, afterDeadline: false })).toBe("unranked");
  });

  it("puts a late run in its own tier however good it was", () => {
    expect(tierFor({ rank: 1, fieldSize: 90, afterDeadline: true })).toBe("late");
  });

  it("does not divide by zero in a field of one", () => {
    expect(tierFor({ rank: 1, fieldSize: 1, afterDeadline: false })).toBe("champion");
  });
});

const TIERS: ShareTier[] = ["champion", "podium", "sharp", "middle", "tail", "late", "unranked"];

describe("copy", () => {
  it("has a taunt, a brag and a sprite for every tier", () => {
    for (const tier of TIERS) {
      expect(taunt(tier, "seed").length).toBeGreaterThan(0);
      expect(brag(tier, "seed").length).toBeGreaterThan(0);
      expect(spriteFor(tier, "seed").length).toBeGreaterThan(0);
    }
  });

  it("picks the same words for the same run every time", () => {
    const seed = "maveli-jump-0-482";
    expect(taunt("sharp", seed)).toBe(taunt("sharp", seed));
    expect(aside(seed)).toBe(aside(seed));
    expect(memeFor(seed)).toBe(memeFor(seed));
  });

  it("only ever picks a meme that exists on disk", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      expect(SHARE_MEMES).toContain(memeFor(seed));
    }
  });
});

describe("figureFor", () => {
  it("reports height for score games and seconds for timed ones", () => {
    expect(figureFor({ metric: "score", score: 1482, durationMs: null })).toEqual({
      value: "1,482",
      label: "M ABOVE PAATHALAM",
    });
    expect(figureFor({ metric: "time", score: null, durationMs: 12_400 }).value).toBe("12s");
    expect(figureFor({ metric: "fcfs", score: null, durationMs: 9_000 }).value).toBe("9s");
  });

  it("survives a missing number rather than printing NaN", () => {
    expect(figureFor({ metric: "score", score: null, durationMs: null }).value).toBe("0");
    expect(figureFor({ metric: "time", score: null, durationMs: null }).value).toBe("0s");
  });
});

describe("buildCaption", () => {
  const base = {
    playerName: "Ann",
    gameTitle: "Maveli Jump",
    day: 3,
    figure: "482",
    seed: "seed",
    origin: "https://onam.example",
  };

  it("carries the standing and the link", () => {
    const caption = buildCaption({ ...base, rank: 3, fieldSize: 47, tier: "podium" });
    expect(caption).toContain("#3 of 47");
    expect(caption).toContain("Day 3 · Maveli Jump");
    expect(caption).toContain("https://onam.example");
  });

  it("says something true when there is no rank", () => {
    const caption = buildCaption({ ...base, rank: null, fieldSize: null, tier: "unranked" });
    expect(caption).not.toContain("#");
    expect(caption).toContain("just for the fun of it");
  });
});
