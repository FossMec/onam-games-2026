import { describe, expect, it } from "vite-plus/test";
import { pairKey } from "./elo";
import {
  type PoolEntry,
  candidatePairs,
  exposureWeight,
  infoWeight,
  noveltyWeight,
  pairWeight,
  samplePair,
} from "./pairing";

function entry(id: string, rating: number, matches = 0): PoolEntry {
  return { id, title: id, imageUrl: `/${id}.webp`, rating, matches };
}

describe("infoWeight", () => {
  it("peaks on an even matchup", () => {
    expect(infoWeight(1200, 1200)).toBeCloseTo(1, 6);
  });

  it("collapses toward the floor as the gap widens", () => {
    const even = infoWeight(1200, 1200);
    const near = infoWeight(1300, 1200);
    const far = infoWeight(1900, 1200);
    expect(near).toBeLessThan(even);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
  });

  it("is symmetric", () => {
    expect(infoWeight(1400, 1100)).toBeCloseTo(infoWeight(1100, 1400), 10);
  });

  /*
   * The transitivity shortcut, stated as a test. Once the crowd has put A well
   * above B and B well above C, "A or C?" is the question worth asking least -
   * its answer is already implied by the other two.
   */
  it("ranks a derivable comparison below the ones it was derived from", () => {
    const a = 1500;
    const b = 1200;
    const c = 900;
    expect(infoWeight(a, c)).toBeLessThan(infoWeight(a, b));
    expect(infoWeight(a, c)).toBeLessThan(infoWeight(b, c));
  });
});

describe("exposureWeight", () => {
  it("favours the entry nobody has seen", () => {
    expect(exposureWeight(0)).toBe(1);
    expect(exposureWeight(4)).toBeLessThan(exposureWeight(0));
    expect(exposureWeight(40)).toBeLessThan(exposureWeight(4));
  });

  it("never reaches zero, so a well-seen entry stays reachable", () => {
    expect(exposureWeight(10_000)).toBeGreaterThan(0);
  });
});

describe("noveltyWeight", () => {
  it("halves on the first repeat and keeps falling", () => {
    expect(noveltyWeight(0)).toBe(1);
    expect(noveltyWeight(1)).toBe(0.5);
    expect(noveltyWeight(9)).toBeCloseTo(0.1, 10);
  });
});

describe("pairWeight", () => {
  it("prefers a close, unseen pair over a settled, over-shown one", () => {
    const close = pairWeight(entry("a", 1200), entry("b", 1205), 0);
    const settled = pairWeight(entry("c", 1900, 30), entry("d", 900, 30), 12);
    expect(close).toBeGreaterThan(settled);
  });

  it("keeps every pair strictly reachable", () => {
    // Maximally settled, maximally over-exposed, judged by a hundred people.
    expect(pairWeight(entry("a", 3000, 500), entry("b", 100, 500), 100)).toBeGreaterThan(0);
  });

  it("boosts a pair containing a barely-seen entry", () => {
    const withNewcomer = pairWeight(entry("a", 1200, 0), entry("b", 1200, 20), 0);
    const bothSettled = pairWeight(entry("c", 1200, 20), entry("d", 1200, 20), 0);
    expect(withNewcomer).toBeGreaterThan(bothSettled);
  });
});

describe("candidatePairs", () => {
  const pool = [entry("a", 1200), entry("b", 1200), entry("c", 1200)];

  it("enumerates every unordered pair", () => {
    const pairs = candidatePairs(pool, new Set(), new Map(), pairKey);
    expect(pairs).toHaveLength(3);
  });

  it("drops the pairs this voter has already judged", () => {
    const judged = new Set([pairKey("a", "b")]);
    const pairs = candidatePairs(pool, judged, new Map(), pairKey);
    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => pairKey(pair.a.id, pair.b.id) !== pairKey("a", "b"))).toBe(true);
  });

  it("returns nothing once everything is judged - the finish line", () => {
    const judged = new Set([pairKey("a", "b"), pairKey("a", "c"), pairKey("b", "c")]);
    expect(candidatePairs(pool, judged, new Map(), pairKey)).toHaveLength(0);
  });

  it("discounts pairs other voters have already covered", () => {
    const counts = new Map([[pairKey("a", "b"), 8]]);
    const pairs = candidatePairs(pool, new Set(), counts, pairKey);
    const covered = pairs.find((pair) => pairKey(pair.a.id, pair.b.id) === pairKey("a", "b"))!;
    const fresh = pairs.find((pair) => pairKey(pair.a.id, pair.b.id) !== pairKey("a", "b"))!;
    expect(covered.weight).toBeLessThan(fresh.weight);
  });
});

describe("samplePair", () => {
  it("returns null on an empty candidate set", () => {
    expect(samplePair([])).toBeNull();
  });

  it("lands in the first bucket when the draw is at the bottom", () => {
    const candidates = [
      { a: entry("a", 1200), b: entry("b", 1200), weight: 1 },
      { a: entry("c", 1200), b: entry("d", 1200), weight: 99 },
    ];
    expect(samplePair(candidates, () => 0.001)?.a.id).toBe("a");
  });

  it("lands in the heavy bucket when the draw is anywhere above it", () => {
    const candidates = [
      { a: entry("a", 1200), b: entry("b", 1200), weight: 1 },
      { a: entry("c", 1200), b: entry("d", 1200), weight: 99 },
    ];
    expect(samplePair(candidates, () => 0.5)?.a.id).toBe("c");
  });

  it("still returns something when every weight is zero", () => {
    const candidates = [{ a: entry("a", 1200), b: entry("b", 1200), weight: 0 }];
    expect(samplePair(candidates, () => 0.9)).not.toBeNull();
  });

  /*
   * The fairness guarantee. A greedy argmax sampler would show the same settled
   * pair to nobody, ever; over many draws every pair has to come up.
   */
  it("eventually draws even the least informative pair", () => {
    const pool = [entry("a", 2000, 50), entry("b", 1200, 0), entry("c", 400, 50)];
    const candidates = candidatePairs(pool, new Set(), new Map(), pairKey);
    const seen = new Set<string>();
    let seed = 1;
    for (let i = 0; i < 5000; i += 1) {
      // Deterministic LCG so the test cannot flake.
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const picked = samplePair(candidates, () => seed / 2147483648)!;
      seen.add(pairKey(picked.a.id, picked.b.id));
    }
    expect(seen.size).toBe(3);
  });
});
