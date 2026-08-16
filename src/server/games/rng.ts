import { randomBytes } from "node:crypto";

/**
 * Deterministic PRNG shared by every game generator.
 *
 * Generation must be a pure function of the seed: `startAttempt` regenerates a
 * resumed attempt from the stored seed, and `finishAttempt` regenerates the
 * solution from that same seed to verify a submission. Nothing generated is
 * persisted, so the RNG has to be stable across processes and deploys - do not
 * swap the algorithm mid-event or every in-flight attempt breaks.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** Uniform element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates copy; the input is left untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct elements, in random order. */
  sample<T>(items: readonly T[], count: number): T[];
}

/** FNV-1a over the seed string, so any seed shape maps to a 32-bit state. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 - small, fast, and good enough for puzzle layout. */
export function createRng(seed: string): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle,
    sample: (items, count) => shuffle(items).slice(0, Math.min(count, items.length)),
  };
}

/** Fresh attempt seed. Hex so it round-trips through the DB text column. */
export function newSeed(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Derives an independent sub-seed from an attempt seed. Lets one attempt drive
 * several uncorrelated choices (deck order vs. board variant, say) without one
 * of them leaking information about the other.
 */
export function deriveSeed(seed: string, label: string): string {
  return `${seed}:${label}`;
}
