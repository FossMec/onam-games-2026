import { describe, expect, it } from "vite-plus/test";
import { type VoteRecord, eligiblePairCount, scoreVoters, voteTarget } from "./voters";

/** Three entries the crowd ended up ranking a ≫ b ≫ c. */
const ratings = new Map([
  ["a", 1500],
  ["b", 1200],
  ["c", 900],
]);

function votes(...records: [string, string, string][]): VoteRecord[] {
  return records.map(([voterId, winnerId, loserId]) => ({ voterId, winnerId, loserId }));
}

const noThreshold = { ratings, voteTarget: () => 1 };

describe("scoreVoters", () => {
  it("scores agreement with the final ordering above disagreement", () => {
    const rows = scoreVoters(votes(["agrees", "a", "c"], ["disagrees", "c", "a"]), noThreshold);
    const agrees = rows.find((row) => row.voterId === "agrees")!;
    const disagrees = rows.find((row) => row.voterId === "disagrees")!;
    expect(agrees.accuracy).toBeGreaterThan(disagrees.accuracy);
  });

  it("gives equal +1 score for agreeing with consensus regardless of pairing gap", () => {
    const [blowout] = scoreVoters(votes(["v", "a", "c"]), noThreshold);
    const [close] = scoreVoters(votes(["w", "a", "b"]), noThreshold);
    expect(blowout.accuracy).toBeCloseTo(close.accuracy);
  });

  it("scores exactly 50% on a tied matchup", () => {
    const evens = new Map([
      ["x", 1200],
      ["y", 1200],
    ]);
    const [row] = scoreVoters(votes(["v", "x", "y"]), {
      ratings: evens,
      voteTarget: () => 1,
    });
    // Tied matchup awards 0.5 score: (0.5 + 1) / (1 + 2) = 50%.
    expect(row.accuracy).toBeCloseTo(50, 6);
  });

  it("shrinks a short lucky streak toward the middle", () => {
    const lucky = scoreVoters(votes(["v", "a", "c"]), noThreshold)[0];
    const diligent = scoreVoters(
      votes(
        ["v", "a", "c"],
        ["v", "a", "b"],
        ["v", "b", "c"],
        ["v", "a", "c"],
        ["v", "a", "b"],
        ["v", "b", "c"],
      ),
      noThreshold,
    )[0];
    expect(diligent.accuracy).toBeGreaterThan(lucky.accuracy);
  });

  it("ignores votes on entries that left the pool", () => {
    const rows = scoreVoters(votes(["v", "a", "gone"], ["v", "a", "c"]), noThreshold);
    expect(rows[0].votes).toBe(1);
  });

  it("puts every qualified voter above every unqualified one", () => {
    const rows = scoreVoters(
      votes(["short", "a", "c"], ["long", "a", "c"], ["long", "a", "b"], ["long", "b", "c"]),
      { ratings, voteTarget: () => 3 },
    );
    expect(rows[0].voterId).toBe("long");
    expect(rows[0].qualified).toBe(true);
    expect(rows[1].qualified).toBe(false);
  });

  it("reports progress toward the target as a percentage", () => {
    const rows = scoreVoters(votes(["v", "a", "c"], ["v", "a", "b"]), {
      ratings,
      voteTarget: () => 4,
    });
    expect(rows[0].coveragePct).toBe(50);
  });

  it("numbers the ranks from one", () => {
    const rows = scoreVoters(votes(["v", "a", "c"], ["w", "c", "a"]), noThreshold);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });
});

describe("voteTarget", () => {
  /*
   * The point of the whole exercise: the bar has to grow like n·log n, not like
   * the pair count, or it becomes unreachable exactly when the contest succeeds.
   */
  it("grows far slower than the total pair count", () => {
    const tenPairs = eligiblePairCount(10, false);
    const twentyPairs = eligiblePairCount(20, false);
    expect(tenPairs).toBe(45);
    expect(twentyPairs).toBe(190);

    const ten = voteTarget(10, false, 100);
    const twenty = voteTarget(20, false, 100);
    expect(ten).toBe(34); // 10·log₂10 ≈ 33.2
    expect(twenty).toBe(87); // 20·log₂20 ≈ 86.4

    // Doubling the field roughly doubles the work, not quadruples it.
    expect(twenty / ten).toBeLessThan(3);
    expect(twentyPairs / tenPairs).toBeGreaterThan(4);
  });

  it("scales with the configured percentage", () => {
    expect(voteTarget(10, false, 50)).toBe(17);
    expect(voteTarget(10, false, 0)).toBe(1);
  });

  it("never asks for more votes than there are pairs", () => {
    // Four entries: 6 pairs total, but 4·log₂4 = 8 would overshoot.
    expect(voteTarget(4, false, 100)).toBe(6);
  });

  it("discounts the entrant's own pookalam, which they never see", () => {
    expect(voteTarget(10, true, 100)).toBeLessThan(voteTarget(10, false, 100));
  });

  it("asks for nothing when there is nothing to compare", () => {
    expect(voteTarget(1, false, 100)).toBe(0);
    expect(voteTarget(2, true, 100)).toBe(0);
  });
});

describe("eligiblePairCount", () => {
  it("counts every pair a voter may be shown", () => {
    expect(eligiblePairCount(5, false)).toBe(10);
    expect(eligiblePairCount(5, true)).toBe(6);
    expect(eligiblePairCount(1, false)).toBe(0);
  });
});
