import { describe, expect, it } from "vite-plus/test";
import { pointsForRank, rankField, streakBonusFor } from "./settle";

/**
 * These two functions decide who wins the week. Everything else in the app can
 * be eyeballed; this cannot, because a subtle error here quietly hands the
 * prize to the wrong person and nobody notices until it is too late.
 */

describe("pointsForRank", () => {
  it("gives the winner the full 1050 and the last place the floor", () => {
    expect(pointsForRank(1, 200)).toBe(1050);
    expect(pointsForRank(200, 200)).toBe(50);
  });

  it("treats a field of one as full marks — there is nobody to lose to", () => {
    expect(pointsForRank(1, 1)).toBe(1050);
  });

  it("never increases as rank gets worse", () => {
    const field = 50;
    for (let rank = 2; rank <= field; rank += 1) {
      expect(pointsForRank(rank, field)).toBeLessThanOrEqual(pointsForRank(rank - 1, field));
    }
  });

  it("always beats not playing at all", () => {
    // The completion floor is the whole reason a slow finish still matters.
    for (const field of [2, 10, 500]) {
      expect(pointsForRank(field, field)).toBeGreaterThan(0);
    }
  });

  it("makes the podium worth chasing", () => {
    // With a linear curve, 1st vs 5th out of 300 would be worth ~13 points and
    // nobody would sprint. The exponent has to make that gap meaningful.
    const gapAtTop = pointsForRank(1, 300) - pointsForRank(5, 300);
    const gapAtMiddle = pointsForRank(150, 300) - pointsForRank(154, 300);
    expect(gapAtTop).toBeGreaterThan(gapAtMiddle);
  });

  it("is scale-free: the same relative finish is worth the same", () => {
    // Beating 50% of the field should pay the same in a small or large game,
    // which is what makes days with different turnout comparable.
    const small = pointsForRank(51, 101);
    const large = pointsForRank(501, 1001);
    expect(Math.abs(small - large)).toBeLessThanOrEqual(1);
  });
});

describe("rankField", () => {
  const row = (id: string, durationMs: number | null, score: number | null) => ({
    id,
    userId: id,
    durationMs,
    score,
  });

  it("ranks time games fastest-first", () => {
    const result = rankField(
      [row("slow", 3000, null), row("fast", 1000, null), row("mid", 2000, null)],
      "time",
    );
    expect(result.map((r) => r.id)).toEqual(["fast", "mid", "slow"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("ranks score games highest-first", () => {
    const result = rankField(
      [row("low", null, 100), row("high", null, 900), row("mid", null, 500)],
      "score",
    );
    expect(result.map((r) => r.id)).toEqual(["high", "mid", "low"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("shares a rank on ties, then skips — 1, 2, 2, 4", () => {
    const result = rankField(
      [row("a", 1000, null), row("b", 2000, null), row("c", 2000, null), row("d", 3000, null)],
      "time",
    );
    expect(result.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("sorts an empty field without complaining", () => {
    expect(rankField([], "time")).toEqual([]);
  });
});

describe("streakBonusFor", () => {
  it("pays nothing below the threshold and the top tier at a full week", () => {
    expect(streakBonusFor(0)).toBe(0);
    expect(streakBonusFor(2)).toBe(0);
    expect(streakBonusFor(3)).toBe(50);
    expect(streakBonusFor(6)).toBe(300);
  });

  it("does not shrink as the streak grows", () => {
    for (let streak = 1; streak <= 10; streak += 1) {
      expect(streakBonusFor(streak)).toBeGreaterThanOrEqual(streakBonusFor(streak - 1));
    }
  });

  it("stays capped past the end of the event", () => {
    expect(streakBonusFor(99)).toBe(streakBonusFor(6));
  });
});
