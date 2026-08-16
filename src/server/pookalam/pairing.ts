import { expectedScore } from "./elo";

/**
 * Which two pookalams to show a voter next.
 *
 * THE PROBLEM
 *
 * Ranking n entries by showing every pair to every voter is n(n-1)/2 taps - 45
 * for ten entries, 190 for twenty. Nobody does 190 taps, so a naive round-robin
 * gets abandoned halfway and the entries that happened to be drawn late end up
 * ranked on two votes each.
 *
 * THE WAY OUT
 *
 * Most pairs are not worth asking about. If the crowd has already put A well
 * above B and B well above C, then "A or C?" is a formality - the answer is
 * already implied, and spending a tap on it buys nothing. What actually moves
 * the ranking is a pair the crowd is *undecided* about, because that is where
 * the current ordering might be wrong.
 *
 * Elo gives that for free. `expectedScore` is the crowd's current belief that
 * one entry beats the other, and `p·(1−p)` is the variance of that belief:
 * maximal at p = 0.5 (a genuine coin flip, ask it) and near zero at p = 0.99
 * (the derived answer, skip it). That single term is the transitivity shortcut,
 * stated as maths rather than as a special case - it never needs to know that
 * A > B > C, it just notices that A vs C is a settled question.
 *
 * Three more factors ride along:
 *
 *   exposure  an entry with two matches has a rating that is mostly noise, so
 *             pairs touching it are worth more than pairs between two entries
 *             with forty matches each. Without this the first entries drawn
 *             soak up every match and the tail is never really judged.
 *
 *   novelty   a pair many *other* voters have already judged has had its
 *             question answered; showing it again mostly re-measures the same
 *             thing.
 *
 *   floor     every factor is floored above zero and an epsilon is added at the
 *             end, so no pair is ever unreachable. Fairness beats optimality
 *             here: an entrant whose pookalam only ever appeared in "settled"
 *             pairings would have a real grievance, and a purely greedy sampler
 *             is also trivially predictable - a voter who works out the
 *             ordering rule can farm it.
 *
 * The result is a weighted random draw, not an argmax. It converges on a
 * correct ordering in far fewer votes than round-robin while still giving every
 * entry and every voter a fair share of the attention.
 *
 * Pure functions; `service.ts` supplies the pool and persists the outcome.
 */

export interface PoolEntry {
  id: string;
  title: string;
  imageUrl: string;
  rating: number;
  matches: number;
}

/** Lowest share of the weight a completely settled pair can fall to. */
const INFO_FLOOR = 0.12;
/** Matches at which an entry counts as fully exposed for weighting purposes. */
const EXPOSURE_SCALE = 12;
/** Keeps every pair reachable no matter how settled and how over-shown. */
const EPSILON = 1e-4;

/**
 * How much is still unknown about this matchup, in [INFO_FLOOR, 1].
 *
 * `4·p·(1−p)` is the variance of a coin with bias p, rescaled so an even
 * matchup scores 1. A 400-point Elo gap is p ≈ 0.91, which lands near 0.3 -
 * already mostly answered.
 */
export function infoWeight(ratingA: number, ratingB: number): number {
  const p = expectedScore(ratingA, ratingB);
  return INFO_FLOOR + (1 - INFO_FLOOR) * 4 * p * (1 - p);
}

/**
 * How badly an entry still needs matches, in (0, 1].
 *
 * Decays like 1/√matches, which is roughly how fast the standard error of a
 * rating actually falls - so the weight tracks real remaining uncertainty
 * rather than an arbitrary quota.
 */
export function exposureWeight(matches: number): number {
  return Math.sqrt(EXPOSURE_SCALE / (EXPOSURE_SCALE + Math.max(0, matches)));
}

/** Decays as a pair gets judged by more voters. */
export function noveltyWeight(timesJudged: number): number {
  return 1 / (1 + Math.max(0, timesJudged));
}

export function pairWeight(a: PoolEntry, b: PoolEntry, timesJudged: number): number {
  const need = (exposureWeight(a.matches) + exposureWeight(b.matches)) / 2;
  return infoWeight(a.rating, b.rating) * need * noveltyWeight(timesJudged) + EPSILON;
}

export interface CandidatePair {
  a: PoolEntry;
  b: PoolEntry;
  weight: number;
}

/**
 * Every pair this voter has not already judged, with its weight.
 *
 * `judged` holds pair keys, and `timesJudged` the global count per pair key.
 * Enumerating is fine: the pool is the admin's shortlist, so tens of entries at
 * most, and enumerating is what makes "you have judged everything" a real
 * answer instead of a retry loop that eventually gives up.
 */
export function candidatePairs(
  pool: PoolEntry[],
  judged: ReadonlySet<string>,
  timesJudged: ReadonlyMap<string, number>,
  keyOf: (a: string, b: string) => string,
): CandidatePair[] {
  const out: CandidatePair[] = [];
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const key = keyOf(pool[i].id, pool[j].id);
      if (judged.has(key)) continue;
      out.push({
        a: pool[i],
        b: pool[j],
        weight: pairWeight(pool[i], pool[j], timesJudged.get(key) ?? 0),
      });
    }
  }
  return out;
}

/**
 * Draws one pair proportional to weight.
 *
 * `random` is injected so the tests can pin the draw; production passes
 * `Math.random`.
 */
export function samplePair(
  candidates: readonly CandidatePair[],
  random: () => number = Math.random,
): CandidatePair | null {
  if (candidates.length === 0) return null;
  let total = 0;
  for (const candidate of candidates) total += candidate.weight;
  if (!(total > 0)) return candidates[Math.floor(random() * candidates.length)] ?? null;

  let target = random() * total;
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate;
  }
  // Floating-point drift on the last step only. Falling off the end means the
  // accumulated subtraction lost the race to rounding, not that nothing matched.
  return candidates[candidates.length - 1];
}
