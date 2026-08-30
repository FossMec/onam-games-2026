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

/**
 * Bradley-Terry Maximum Likelihood Rating Estimation.
 *
 * Rather than sequential path-dependent updates, Bradley-Terry fits a global
 * maximum likelihood model across all pairwise comparisons simultaneously.
 *
 * Gamma parameters are mapped to a standard 1200-centered Elo scale via:
 *   Rating = 1200 + 400 * log10(gamma_i)
 */
export interface WeightedVote {
  winnerId: string;
  loserId: string;
  weight?: number;
}

export function computeBradleyTerryRatings(
  itemIds: string[],
  votes: WeightedVote[],
  iterations = 50,
  epsilon = 1e-4,
): Map<string, { rating: number; wins: number; matches: number }> {
  const winMatrix = new Map<string, Map<string, number>>();
  const stats = new Map<string, { wins: number; matches: number }>();

  for (const id of itemIds) {
    winMatrix.set(id, new Map());
    stats.set(id, { wins: 0, matches: 0 });
  }

  for (const v of votes) {
    if (!winMatrix.has(v.winnerId) || !winMatrix.has(v.loserId)) continue;
    const w = v.weight ?? 1.0;
    if (w <= 0) continue;

    const row = winMatrix.get(v.winnerId)!;
    row.set(v.loserId, (row.get(v.loserId) ?? 0) + w);

    stats.get(v.winnerId)!.wins += 1;
    stats.get(v.winnerId)!.matches += 1;
    stats.get(v.loserId)!.matches += 1;
  }

  // Initial gamma values
  const gamma = new Map<string, number>();
  for (const id of itemIds) {
    gamma.set(id, 1.0);
  }

  // Minorization-Maximization (MM) iterations
  for (let iter = 0; iter < iterations; iter++) {
    const nextGamma = new Map<string, number>();
    let maxDiff = 0;

    for (const i of itemIds) {
      let sum = 0;
      let totalWins = 0;
      const rowI = winMatrix.get(i)!;

      for (const j of itemIds) {
        if (i === j) continue;
        const w_ij = rowI.get(j) ?? 0;
        const w_ji = winMatrix.get(j)?.get(i) ?? 0;
        const n_ij = w_ij + w_ji;
        totalWins += w_ij;

        if (n_ij > 0) {
          sum += n_ij / (gamma.get(i)! + gamma.get(j)!);
        }
      }

      const val = sum > 0 ? (totalWins + epsilon) / (sum + epsilon) : 1.0;
      nextGamma.set(i, val);
      maxDiff = Math.max(maxDiff, Math.abs(val - gamma.get(i)!));
    }

    // Geometric mean normalization so average gamma = 1
    let sumLog = 0;
    for (const id of itemIds) {
      sumLog += Math.log(Math.max(1e-9, nextGamma.get(id)!));
    }
    const geomMean = Math.exp(sumLog / (itemIds.length || 1));

    for (const id of itemIds) {
      gamma.set(id, nextGamma.get(id)! / (geomMean || 1.0) || 1.0);
    }

    if (maxDiff < 1e-6) break;
  }

  const result = new Map<string, { rating: number; wins: number; matches: number }>();
  for (const id of itemIds) {
    const g = gamma.get(id) ?? 1.0;
    // Map gamma to Elo scale centered around START_RATING (1200)
    const rating = START_RATING + 400 * Math.log10(Math.max(1e-6, g));
    const s = stats.get(id)!;
    result.set(id, {
      rating,
      wins: s.wins,
      matches: s.matches,
    });
  }

  return result;
}
