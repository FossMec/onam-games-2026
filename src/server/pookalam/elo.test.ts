import { describe, expect, it } from "vite-plus/test";
import {
  START_RATING,
  applyResult,
  computeBradleyTerryRatings,
  expectedScore,
  kFactor,
  pairKey,
} from "./elo";

describe("expectedScore", () => {
  it("is even between equals", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it("favours the higher rating, and the two add up to one", () => {
    const strong = expectedScore(1400, 1200);
    expect(strong).toBeGreaterThan(0.5);
    expect(strong + expectedScore(1200, 1400)).toBeCloseTo(1);
  });

  it("puts a 400-point lead at roughly 10:1", () => {
    // The defining property of the Elo curve - worth pinning so nobody
    // "simplifies" the formula into something with different behaviour.
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 3);
  });
});

describe("kFactor", () => {
  it("provides equal weight for every match", () => {
    expect(kFactor(0)).toBe(32);
    expect(kFactor(10)).toBe(32);
    expect(kFactor(100)).toBe(32);
  });
});

describe("applyResult", () => {
  it("moves the winner up and the loser down", () => {
    const next = applyResult(START_RATING, 10, START_RATING, 10);
    expect(next.winner).toBeGreaterThan(START_RATING);
    expect(next.loser).toBeLessThan(START_RATING);
  });

  it("conserves rating across all matches", () => {
    const next = applyResult(1300, 10, 1100, 10);
    expect(next.winner + next.loser).toBeCloseTo(1300 + 1100);
  });

  it("rewards an upset far more than an expected win", () => {
    const upset = applyResult(1000, 30, 1600, 30);
    const expected = applyResult(1600, 30, 1000, 30);
    expect(upset.winner - 1000).toBeGreaterThan(expected.winner - 1600);
  });

  it("treats all votes with equal K weight", () => {
    const early = applyResult(START_RATING, 0, START_RATING, 0);
    const late = applyResult(START_RATING, 50, START_RATING, 50);
    expect(early.winner - START_RATING).toBeCloseTo(late.winner - START_RATING);
  });

  it("orders a round-robin field by strength", () => {
    /*
     * End-to-end sanity: three entries where A always beats B and B always
     * beats C. After enough matches the ratings must agree with that order,
     * which is the only property the results page actually depends on.
     */
    const rating: Record<string, number> = { a: START_RATING, b: START_RATING, c: START_RATING };
    const matches: Record<string, number> = { a: 0, b: 0, c: 0 };
    const play = (winner: string, loser: string) => {
      const next = applyResult(rating[winner], matches[winner], rating[loser], matches[loser]);
      rating[winner] = next.winner;
      rating[loser] = next.loser;
      matches[winner] += 1;
      matches[loser] += 1;
    };
    for (let i = 0; i < 20; i += 1) {
      play("a", "b");
      play("b", "c");
      play("a", "c");
    }
    expect(rating.a).toBeGreaterThan(rating.b);
    expect(rating.b).toBeGreaterThan(rating.c);
  });
});

describe("computeBradleyTerryRatings", () => {
  it("computes accurate rankings for transitive preferences", () => {
    const itemIds = ["pookalam-a", "pookalam-b", "pookalam-c"];
    const votes = [
      // A beats B 10 times, B beats C 10 times, A beats C 10 times
      ...Array(10).fill({ winnerId: "pookalam-a", loserId: "pookalam-b" }),
      ...Array(10).fill({ winnerId: "pookalam-b", loserId: "pookalam-c" }),
      ...Array(10).fill({ winnerId: "pookalam-a", loserId: "pookalam-c" }),
    ];

    const ratings = computeBradleyTerryRatings(itemIds, votes);
    const rA = ratings.get("pookalam-a")!.rating;
    const rB = ratings.get("pookalam-b")!.rating;
    const rC = ratings.get("pookalam-c")!.rating;

    expect(rA).toBeGreaterThan(rB);
    expect(rB).toBeGreaterThan(rC);
  });

  it("handles equal win distribution symmetrically around 1200", () => {
    const itemIds = ["pookalam-x", "pookalam-y"];
    const votes = [
      ...Array(5).fill({ winnerId: "pookalam-x", loserId: "pookalam-y" }),
      ...Array(5).fill({ winnerId: "pookalam-y", loserId: "pookalam-x" }),
    ];

    const ratings = computeBradleyTerryRatings(itemIds, votes);
    expect(ratings.get("pookalam-x")!.rating).toBeCloseTo(1200, 1);
    expect(ratings.get("pookalam-y")!.rating).toBeCloseTo(1200, 1);
  });
});

describe("pairKey", () => {
  it("is the same whichever way round the pair is given", () => {
    expect(pairKey("aaa", "bbb")).toBe(pairKey("bbb", "aaa"));
  });

  it("separates different pairs", () => {
    expect(pairKey("aaa", "bbb")).not.toBe(pairKey("aaa", "ccc"));
  });
});
