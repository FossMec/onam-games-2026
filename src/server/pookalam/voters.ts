/**
 * The voters' leaderboard: who judged well, not who judged most.
 *
 * WHAT "WELL" MEANS
 *
 * A vote is scored against where the crowd finally landed. If you picked the
 * entry that ended up rated higher, you agreed with the room; if you picked the
 * other one, you did not. That is the only ground truth available - there is no
 * external answer key for "which pookalam is better".
 *
 * EQUAL HEAD-TO-HEAD WEIGHT
 *
 * Every head-to-head vote carries equal weight (+1 for picking the consensus winner),
 * ensuring neither early nor late voters have an unfair advantage.
 * Scores are smoothed toward 50% by a uniform prior (2 baseline votes), so a 3-vote
 * streak cannot outrank a full, consistent voting shift.
 *
 * Pure functions. `service.ts` supplies the votes and the settled ratings.
 */

export interface VoteRecord {
  voterId: string;
  winnerId: string;
  loserId: string;
}

export interface VoterRow {
  voterId: string;
  /** Votes that counted - both entries still in the pool. */
  votes: number;
  /** Weighted agreement with the final ordering, 0–100. */
  accuracy: number;
  /** Progress toward this voter's qualifying target, 0–100 (uncapped above). */
  coveragePct: number;
  /** Cleared the qualifying target and so is eligible for the prize. */
  qualified: boolean;
  rank: number;
}

/**
 * Pseudo-votes of pure 50/50 mixed in before dividing.
 *
 * Two is enough to stop a three-vote streak reading as a perfect score, and
 * small enough that it barely touches anyone who did a real session.
 */
const PRIOR_WEIGHT = 2;

export interface ScoreVotersOptions {
  /** Final ratings by submission id. Votes on unknown ids are ignored. */
  ratings: ReadonlyMap<string, number>;
  /** Votes this voter must cast to qualify. See `voteTarget`. */
  voteTarget: (voterId: string) => number;
}

export function scoreVoters(votes: readonly VoteRecord[], options: ScoreVotersOptions): VoterRow[] {
  const tally = new Map<string, { votes: number; score: number }>();

  for (const vote of votes) {
    const chosen = options.ratings.get(vote.winnerId);
    const other = options.ratings.get(vote.loserId);
    // An entry pulled from the pool after the fact takes its votes with it -
    // scoring somebody against a rating that no longer exists is not a judgement
    // about them.
    if (chosen === undefined || other === undefined) continue;

    const entry = tally.get(vote.voterId) ?? { votes: 0, score: 0 };
    entry.votes += 1;
    if (chosen > other) {
      entry.score += 1;
    } else if (chosen === other) {
      entry.score += 0.5;
    }
    tally.set(vote.voterId, entry);
  }

  const rows: VoterRow[] = [];
  for (const [voterId, entry] of tally) {
    const accuracy = ((entry.score + PRIOR_WEIGHT * 0.5) / (entry.votes + PRIOR_WEIGHT)) * 100;
    const target = Math.max(0, options.voteTarget(voterId));
    const coveragePct = target > 0 ? (entry.votes / target) * 100 : 0;
    rows.push({
      voterId,
      votes: entry.votes,
      accuracy,
      coveragePct,
      qualified: target > 0 && entry.votes >= target,
      rank: 0,
    });
  }

  /*
   * Qualified voters occupy the whole top of the board - an unqualified voter
   * with a great score is still someone who judged four pairs, and letting them
   * outrank a qualified voter would make the threshold decorative. Ties break on
   * volume, then on id so the order is stable across recomputations.
   */
  rows.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.voterId < b.voterId ? -1 : 1;
  });
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}

/** Every pair a voter is allowed to see - the full run, if they want it. */
export function eligiblePairCount(poolSize: number, hasOwnEntry: boolean): number {
  const n = visibleEntries(poolSize, hasOwnEntry);
  return n < 2 ? 0 : (n * (n - 1)) / 2;
}

function visibleEntries(poolSize: number, hasOwnEntry: boolean): number {
  return Math.max(0, hasOwnEntry ? poolSize - 1 : poolSize);
}

/**
 * How many votes a voter must cast to make the leaderboard.
 *
 * The target is a share of **n·log₂n**, not of the C(n,2) pair count, and that
 * distinction is the whole reason the sampler exists. A percentage of every
 * pair scales quadratically: 60% of ten entries is 27 taps, but 60% of twenty
 * is 114, so the bar silently becomes unreachable exactly when the contest gets
 * popular. n·log₂n is the information-theoretic cost of *sorting* n things by
 * comparison - the real amount of work a ranking needs - and it grows gently:
 * 33 comparisons at ten entries, 86 at twenty.
 *
 * Voters are never capped at the target. Every remaining pair stays available
 * to anyone who wants to keep going; this only decides who counts as having
 * done a full shift. Clamped to the total pair count so a small pool cannot ask
 * for more votes than exist.
 */
export function voteTarget(poolSize: number, hasOwnEntry: boolean, targetPct: number): number {
  const n = visibleEntries(poolSize, hasOwnEntry);
  if (n < 2) return 0;
  const totalPairs = (n * (n - 1)) / 2;
  const sortingBudget = n * Math.log2(n);
  const target = Math.ceil((sortingBudget * Math.max(0, targetPct)) / 100);
  return Math.max(1, Math.min(totalPairs, target));
}
