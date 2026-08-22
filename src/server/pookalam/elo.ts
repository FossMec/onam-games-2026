/**
 * Elo for Code-a-Pookalam judging.
 *
 * WHY ELO AND NOT STARS
 *
 * Rating art on a 1-5 scale does not work with a crowd: everybody uses a
 * different part of the scale, the first few voters anchor everyone after them,
 * and entries posted late get systematically fewer ratings. Head-to-head asks a
 * question people can actually answer - "which of these two is better?" - and
 * Elo turns those answers into an ordering without anyone ever seeing a number.
 *
 * Kept as pure functions with no database in sight so the maths is testable on
 * its own; `service.ts` owns persistence.
 */

/** Conventional Elo starting point. Also the schema default. */
export const START_RATING = 1200;

/** Constant K-factor: every single vote carries equal weight. */
export const K_FACTOR = 32;

/**
 * How far a rating can move on one result.
 *
 * Set to a constant K=32 so every single vote carries identical mathematical
 * weight regardless of whether it is cast early or late.
 */
export function kFactor(_matches?: number): number {
  return K_FACTOR;
}

/** Probability the first entry wins, per the logistic Elo curve. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export interface EloOutcome {
  winner: number;
  loser: number;
}

/** New ratings after a decided match. Draws are not offered to voters. */
export function applyResult(
  winnerRating: number,
  winnerMatches: number,
  loserRating: number,
  loserMatches: number,
): EloOutcome {
  const expected = expectedScore(winnerRating, loserRating);
  return {
    winner: winnerRating + kFactor(winnerMatches) * (1 - expected),
    loser: loserRating - kFactor(loserMatches) * (1 - expected),
  };
}

/**
 * Canonical key for an unordered pair, so "A vs B" and "B vs A" are the same
 * matchup. Backs the unique constraint that stops a voter judging one pair
 * twice - refreshing until you get your friend's entry again is otherwise a
 * complete bypass of one-person-one-vote.
 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
