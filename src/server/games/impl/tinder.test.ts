import { describe, expect, it } from "vite-plus/test";
import { TINDER_DECK_SIZE, checkPass, dealDeck, verify } from "./tinder";

/**
 * The verifier is the only thing standing between the leaderboard and a forged
 * POST, so the interesting tests here are the rejections, not the happy path.
 */

const SEED = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

/** Plays a perfect run: every card answered correctly on the first pass. */
function perfectRun(seed: string) {
  return { passes: [dealDeck(seed).map((card) => ({ id: card.id, open: card.open }))] };
}

describe("dealDeck", () => {
  it("is deterministic for a seed", () => {
    expect(dealDeck(SEED).map((c) => c.id)).toEqual(dealDeck(SEED).map((c) => c.id));
  });

  it("gives different players different decks", () => {
    expect(dealDeck(SEED).map((c) => c.id)).not.toEqual(
      dealDeck("different-seed").map((c) => c.id),
    );
  });

  it("deals the right number of distinct cards", () => {
    const deck = dealDeck(SEED);
    expect(deck).toHaveLength(TINDER_DECK_SIZE);
    expect(new Set(deck.map((c) => c.id)).size).toBe(TINDER_DECK_SIZE);
  });

  it("stays close to balanced so neither swipe direction wins by default", () => {
    for (const seed of ["one", "two", "three", "four", "five"]) {
      const open = dealDeck(seed).filter((c) => c.open).length;
      expect(Math.abs(open - TINDER_DECK_SIZE / 2)).toBeLessThanOrEqual(1);
    }
  });

  it("always includes brand-trap cards", () => {
    for (const seed of ["one", "two", "three"]) {
      expect(dealDeck(seed).filter((c) => c.tricky).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("checkPass", () => {
  it("reports only the cards that were actually wrong", () => {
    const deck = dealDeck(SEED);
    const decisions = deck.map((card, i) => ({
      id: card.id,
      open: i < 2 ? !card.open : card.open,
    }));
    const result = checkPass(
      SEED,
      deck.map((c) => c.id),
      decisions,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wrongIds).toEqual([deck[0].id, deck[1].id]);
  });

  it("rejects a pass played out of order", () => {
    const deck = dealDeck(SEED);
    const swapped = [deck[1], deck[0], ...deck.slice(2)];
    const result = checkPass(
      SEED,
      deck.map((c) => c.id),
      swapped.map((card) => ({ id: card.id, open: card.open })),
    );
    expect(result.ok).toBe(false);
  });
});

describe("verify", () => {
  const run = (submission: unknown) =>
    verify({ seed: SEED, difficulty: "normal", submission, durationMs: 30_000 });

  it("accepts a flawless single pass", () => {
    const result = run(perfectRun(SEED));
    expect(result.valid).toBe(true);
    expect(result.movesCount).toBe(TINDER_DECK_SIZE);
  });

  it("accepts a run where misses recycle and are then fixed", () => {
    const deck = dealDeck(SEED);
    const missed = deck.slice(0, 3);
    const result = run({
      passes: [
        // Get the first three wrong…
        deck.map((card, i) => ({ id: card.id, open: i < 3 ? !card.open : card.open })),
        // …then get them right on the second pass, in the same relative order.
        missed.map((card) => ({ id: card.id, open: card.open })),
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.movesCount).toBe(TINDER_DECK_SIZE + 3);
  });

  it("rejects a run that ends with cards still unsorted", () => {
    const deck = dealDeck(SEED);
    const result = run({
      passes: [deck.map((card, i) => ({ id: card.id, open: i === 0 ? !card.open : card.open }))],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a transcript for a different seed", () => {
    // The forged-payload case: a valid-looking run someone else played.
    expect(run(perfectRun("someone-elses-seed")).valid).toBe(false);
  });

  it("rejects a short pass that skips cards", () => {
    const deck = dealDeck(SEED);
    const result = run({
      passes: [deck.slice(0, 5).map((card) => ({ id: card.id, open: card.open }))],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects extra passes after the deck was already cleared", () => {
    const deck = dealDeck(SEED);
    const clean = deck.map((card) => ({ id: card.id, open: card.open }));
    expect(run({ passes: [clean, [{ id: deck[0].id, open: deck[0].open }]] }).valid).toBe(false);
  });

  it("rejects junk instead of crashing on it", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ passes: [] }).valid).toBe(false);
    expect(run({ passes: ["not-an-array"] }).valid).toBe(false);
  });

  it("bounds the work an attacker can buy with one request", () => {
    const flood = Array.from({ length: 500 }, () => []);
    expect(run({ passes: flood }).valid).toBe(false);
  });
});
