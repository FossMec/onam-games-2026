import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { logActivity } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import {
  pookalamReviews,
  pookalamStandings,
  pookalamSubmissions,
  pookalamVotes,
  users,
} from "~/server/db/schema";
import { getSettings } from "~/server/settings/service";
import { invalidateShared, requestMemo, sharedRead } from "~/server/cache";
import { applyResult, pairKey } from "./elo";
import { decodeSubmissionImage, deleteStoredImage, storeSubmissionImage } from "./image";
import { candidatePairs, type PoolEntry, samplePair } from "./pairing";
import { eligiblePairCount, scoreVoters, voteTarget } from "./voters";
import { type PhaseState, parseIstDateTime, resolvePhase } from "./window";

/**
 * Code-a-Pookalam: the whole seven-day arc.
 *
 *   days 1-6   the entry form is open; entrants upload a square render and a
 *              repo link, and can edit until the deadline
 *   day 6      submissions close. Testers and admins like/dislike and comment
 *              on every entry, and an admin shortlists the top N
 *   day 7      the public Elo arena: anonymous head-to-heads, smart pairing,
 *              two deliberately-lagged leaderboards
 *   after      the winner, the authors and the code are revealed
 *
 * Timing comes from `window.ts` (IST windows in `app_settings`, with manual
 * force overrides). The maths lives in `elo.ts`, `pairing.ts` and `voters.ts`,
 * all database-free and unit tested. This file is the part that talks to
 * Postgres and enforces the rules that must not be trusted to a browser.
 */

/* --------------------------------------------------------------- phases */

export interface PookalamPhases {
  submissions: PhaseState;
  voting: PhaseState;
  results: PhaseState;
}

/** Backward-compatible flat view, still what most callers actually want. */
export interface PookalamGates {
  submissionsOpen: boolean;
  votingOpen: boolean;
  resultsPublic: boolean;
}

const SETTING_KEYS = [
  "pookalam.submissions_open",
  "pookalam.submissions_open_at",
  "pookalam.submissions_close_at",
  "pookalam.voting_open",
  "pookalam.voting_open_at",
  "pookalam.voting_close_at",
  "pookalam.results_public",
  "pookalam.results_at",
  "pookalam.shortlist_size",
  "pookalam.voter_target_pct",
  "pookalam.leaderboard_delay_ms",
  "pookalam.aspect_tolerance_pct",
];

interface PookalamConfig extends PookalamPhases {
  shortlistSize: number;
  voterTargetPct: number;
  leaderboardDelayMs: number;
  aspectTolerancePct: number;
}

/**
 * Every pookalam setting, resolved against one instant.
 *
 * One `Date.now()` for all three phases on purpose: resolving them separately
 * lets a render straddle a boundary and claim that submissions have closed
 * while voting has not yet opened, in the same breath, for the same second.
 */
async function computeConfig(): Promise<PookalamConfig> {
  const values = await getSettings(SETTING_KEYS);
  const flag = (key: string) => values.get(key) === true;
  const at = (key: string) => parseIstDateTime(values.get(key));
  const num = (key: string, fallback: number) => {
    const raw = Number(values.get(key));
    return Number.isFinite(raw) ? raw : fallback;
  };
  const now = Date.now();

  return {
    submissions: resolvePhase(
      now,
      flag("pookalam.submissions_open"),
      at("pookalam.submissions_open_at"),
      at("pookalam.submissions_close_at"),
    ),
    voting: resolvePhase(
      now,
      flag("pookalam.voting_open"),
      at("pookalam.voting_open_at"),
      at("pookalam.voting_close_at"),
    ),
    results: resolvePhase(now, flag("pookalam.results_public"), at("pookalam.results_at"), null),
    shortlistSize: num("pookalam.shortlist_size", 10),
    voterTargetPct: num("pookalam.voter_target_pct", 60),
    leaderboardDelayMs: num("pookalam.leaderboard_delay_ms", 60_000),
    aspectTolerancePct: num("pookalam.aspect_tolerance_pct", 5),
  };
}

export function getConfig(): Promise<PookalamConfig> {
  return sharedRead("pookalam:config", computeConfig, 5_000);
}

export async function getGates(): Promise<PookalamGates> {
  const config = await getConfig();
  return {
    submissionsOpen: config.submissions.open,
    votingOpen: config.voting.open,
    resultsPublic: config.results.open,
  };
}

/* ---------------------------------------------------------------- entry */

export interface SubmissionInput {
  /**
   * Optional. The entry form stopped asking for one - a title is never shown
   * while voting is open, so it was a required field that bought the entrant
   * nothing and gave them one more way to accidentally identify themselves.
   * Older entries keep the titles they already have.
   */
  title?: string;
  sourceUrl: string;
  /** Data URL from `preparePookalamImage`. Omitted when editing text only. */
  imageDataUrl?: string;
  notes?: string;
}

export interface MySubmission {
  id: string;
  title: string;
  sourceUrl: string;
  imageUrl: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  shortlisted: boolean;
  reviewNote: string | null;
}

/**
 * A repo link, and only a repo link.
 *
 * This is rendered into an `<a href>` on the results page, so `javascript:` and
 * `data:` are stored XSS with extra steps - allowing exactly two schemes is the
 * cheap, complete answer. The host allowlist is a separate, softer rule: the
 * contest is about code, and "submit your source" has to mean somewhere the
 * source can actually be read.
 */
const SOURCE_HOSTS = [
  "github.com",
  "gist.github.com",
  "gitlab.com",
  "codeberg.org",
  "bitbucket.org",
  "codepen.io",
  "replit.com",
  "observablehq.com",
  "glitch.com",
  "codesandbox.io",
];

function normalizeSourceUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("The source link must be a full URL, starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The source link must be an http or https link.");
  }
  if (url.username || url.password) {
    throw new Error("The source link must not contain a username or password.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const allowed = SOURCE_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
  if (!allowed) {
    throw new Error(
      `Host your code somewhere it can be read - GitHub, a Gist, GitLab, Codeberg, CodePen or similar. We could not accept ${host}.`,
    );
  }
  return url.toString();
}

/**
 * The caller's own entry, once per request.
 *
 * Two unrelated readers want this on the same page - `getPookalamState` for
 * the entry card, and `getMyPookalamNotice` for the shortlist popup that lives
 * in the app shell - and neither knows about the other, so every render of the
 * landing page, `/games` and `/code-a-pookalam` was two identical selects.
 *
 * Memoised on the request rather than the instance: this is one specific
 * person's row, and a process-level cache would hand it to the next visitor.
 */
export function getMySubmission(userId: string): Promise<MySubmission | null> {
  return requestMemo(`pookalam:mine:${userId}`, async () => {
    const [row] = await getDb()
      .select({
        id: pookalamSubmissions.id,
        title: pookalamSubmissions.title,
        sourceUrl: pookalamSubmissions.sourceUrl,
        imageUrl: pookalamSubmissions.imageUrl,
        notes: pookalamSubmissions.notes,
        status: pookalamSubmissions.status,
        shortlisted: pookalamSubmissions.shortlisted,
        reviewNote: pookalamSubmissions.reviewNote,
      })
      .from(pookalamSubmissions)
      .where(eq(pookalamSubmissions.userId, userId))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Creates or replaces the caller's entry.
 *
 * Editing an approved entry sends it back to `pending` and drops it off the
 * shortlist. Otherwise an entrant could get a plain design approved and shortlisted,
 * then swap the artwork once voting is live, and both the review and the
 * shortlist would have meant nothing.
 */
export async function upsertSubmission(userId: string, input: SubmissionInput): Promise<void> {
  const config = await getConfig();
  if (!config.submissions.open) throw new Error("Submissions are closed.");

  /*
   * A title is optional and no longer asked for. When one does arrive - from an
   * older client, or an admin tool - it is still length-checked; when it does
   * not, an edit must not wipe the title an entry already had, so the existing
   * value is kept and only a brand new row falls back to the placeholder.
   */
  const submitted = input.title?.trim();
  if (
    submitted !== undefined &&
    submitted !== "" &&
    (submitted.length < 3 || submitted.length > 80)
  ) {
    throw new Error("A title has to be between 3 and 80 characters.");
  }
  const notes = input.notes?.trim().slice(0, 500) || null;
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);

  const db = getDb();
  const existing = await getExistingImage(userId);

  // A first entry must bring artwork; an edit may keep what is already stored.
  if (!input.imageDataUrl && !existing) {
    throw new Error("Upload a square render of your pookalam.");
  }

  /*
   * `undefined` means "leave whatever is there alone", which is what an edit
   * from the current form always wants. Only a first entry needs a value at
   * all, and nothing displays it before results are public.
   */
  const title = submitted || undefined;

  let stored: { url: string; path: string; width: number; height: number } | null = null;
  if (input.imageDataUrl) {
    stored = await storeSubmissionImage(
      decodeSubmissionImage(input.imageDataUrl, config.aspectTolerancePct),
    );
  }

  /*
   * The insert branch always has fresh artwork - a first entry without an image
   * was rejected above - but these values are built before Postgres decides
   * which branch runs, so they fall back to what is already stored rather than
   * dereferencing a null on every plain text edit.
   */
  await db
    .insert(pookalamSubmissions)
    .values({
      userId,
      // The column is NOT NULL and the form no longer asks, so a first entry
      // gets a neutral placeholder. It is never rendered while voting is open.
      title: title ?? "Untitled pookalam",
      sourceUrl,
      imageUrl: stored?.url ?? existing?.imageUrl ?? "",
      imagePath: stored?.path ?? existing?.imagePath ?? null,
      imageWidth: stored?.width ?? null,
      imageHeight: stored?.height ?? null,
      notes,
    })
    .onConflictDoUpdate({
      target: pookalamSubmissions.userId,
      set: {
        // Absent title means "keep what is stored" - an edit from the current
        // form carries no title at all and must not blank an older one.
        ...(title ? { title } : {}),
        sourceUrl,
        notes,
        // Only overwrite the artwork when new artwork actually arrived, so a
        // link fix does not require re-uploading the render.
        ...(stored
          ? {
              imageUrl: stored.url,
              imagePath: stored.path,
              imageWidth: stored.width,
              imageHeight: stored.height,
            }
          : {}),
        status: "pending" as const,
        shortlisted: false,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      },
    });

  // Only after the row points at the new object - a delete before the write
  // would leave a broken image if the upsert failed.
  if (stored && existing?.imagePath && existing.imagePath !== stored.path) {
    await deleteStoredImage(existing.imagePath);
  }
}

async function getExistingImage(
  userId: string,
): Promise<{ imagePath: string | null; imageUrl: string } | null> {
  const [row] = await getDb()
    .select({ imagePath: pookalamSubmissions.imagePath, imageUrl: pookalamSubmissions.imageUrl })
    .from(pookalamSubmissions)
    .where(eq(pookalamSubmissions.userId, userId))
    .limit(1);
  return row ?? null;
}

/* -------------------------------------------------------------- pairing */

/** What a voter sees. Deliberately missing the author and the source link. */
export interface PairEntry {
  id: string;
  title: string;
  imageUrl: string;
}

export interface VotingPair {
  left: PairEntry;
  right: PairEntry;
  pairKey: string;
  /** Votes this voter has cast, and how many make a full shift. */
  progress: { votes: number; target: number; remaining: number };
}

/** The field for the public round: approved *and* shortlisted by an admin. */
function shortlistedFilter() {
  return and(eq(pookalamSubmissions.status, "approved"), eq(pookalamSubmissions.shortlisted, true));
}

/**
 * The number that actually ranks an entry: crowd Elo plus admin correction.
 *
 * Every board and the final results order by this, never by `rating` alone -
 * an adjustment that did not change the placing would be decorative. The Elo
 * maths in `castVote` still reads and writes the raw `rating`, so a correction
 * shifts where an entry sits without distorting how future votes move it.
 */
const effectiveRating = sql<number>`(${pookalamSubmissions.rating} + ${pookalamSubmissions.adjustment})`;

/**
 * Raw Elo here, not the effective score.
 *
 * The pairing weights by how undecided *the crowd* is about a matchup, so it
 * has to read the crowd's own numbers. Feeding it an admin correction would
 * change which pairs get served on the strength of a human's thumb, which is
 * the opposite of what the correction is for.
 */
async function loadPool(): Promise<PoolEntry[]> {
  return sharedRead(
    "pookalam:pool",
    () =>
      getDb()
        .select({
          id: pookalamSubmissions.id,
          title: pookalamSubmissions.title,
          imageUrl: pookalamSubmissions.imageUrl,
          rating: pookalamSubmissions.rating,
          matches: pookalamSubmissions.matches,
        })
        .from(pookalamSubmissions)
        .where(shortlistedFilter())
        .orderBy(asc(pookalamSubmissions.matches), asc(pookalamSubmissions.id)),
    10_000,
  );
}

/**
 * Picks the next matchup for this voter.
 *
 * The choice is delegated to `pairing.ts`, which weights pairs by how undecided
 * the crowd currently is about them - that is what lets a voter settle a
 * ranking in far fewer taps than judging every pair, without ever being told
 * they are done early. Everything this function does is fetch the three inputs
 * that weighting needs and remove the pairs this voter must not see.
 *
 * Returns null when they have judged every pair available to them, which is a
 * finish line rather than a failure.
 */
export async function nextPairs(voterId: string, count = 5): Promise<VotingPair[]> {
  const db = getDb();
  const [pool, judgedRows, pairCountRows, config, [mine]] = await Promise.all([
    loadPool(),
    db
      .select({ pairKey: pookalamVotes.pairKey })
      .from(pookalamVotes)
      .where(eq(pookalamVotes.voterId, voterId)),
    sharedRead(
      "pookalam:pair_counts",
      () =>
        db
          .select({ pairKey: pookalamVotes.pairKey, n: sql<number>`count(*)::int` })
          .from(pookalamVotes)
          .groupBy(pookalamVotes.pairKey),
      5_000,
    ),
    getConfig(),
    db
      .select({ id: pookalamSubmissions.id })
      .from(pookalamSubmissions)
      .where(eq(pookalamSubmissions.userId, voterId))
      .limit(1),
  ]);

  const visible = pool.filter((entry) => entry.id !== mine?.id);
  if (visible.length < 2) return [];

  const judged = new Set(judgedRows.map((row) => row.pairKey));
  const timesJudged = new Map(pairCountRows.map((row) => [row.pairKey, row.n]));
  const candidates = candidatePairs(visible, judged, timesJudged, pairKey);
  if (candidates.length === 0) return [];

  const target = voteTarget(
    pool.length,
    !!mine && pool.some((entry) => entry.id === mine.id),
    config.voterTargetPct,
  );
  let currentVotes = judged.size;

  const result: VotingPair[] = [];
  const chosenKeys = new Set<string>();

  for (let i = 0; i < count; i++) {
    const available = candidates.filter((c) => !chosenKeys.has(pairKey(c.a.id, c.b.id)));
    if (available.length === 0) break;
    const picked = samplePair(available);
    if (!picked) break;
    chosenKeys.add(pairKey(picked.a.id, picked.b.id));

    const [left, right] = Math.random() < 0.5 ? [picked.a, picked.b] : [picked.b, picked.a];
    currentVotes++;
    result.push({
      left: { id: left.id, title: left.title, imageUrl: left.imageUrl },
      right: { id: right.id, title: right.title, imageUrl: right.imageUrl },
      pairKey: pairKey(picked.a.id, picked.b.id),
      progress: {
        votes: currentVotes - 1,
        target,
        remaining: Math.max(0, target - (currentVotes - 1)),
      },
    });
  }

  return result;
}

export async function nextPair(voterId: string): Promise<VotingPair | null> {
  const list = await nextPairs(voterId, 1);
  return list[0] ?? null;
}

/* ----------------------------------------------------------------- vote */

export type VoteResult = { ok: true; nextPair: VotingPair | null } | { ok: false; reason: string };

/**
 * Records a decided match and moves both ratings, immediately.
 *
 * Everything that makes this fair is enforced here rather than trusted from the
 * client: voting must be open, both entries must be shortlisted, neither may
 * belong to the voter, and the (voter, pair) unique constraint is what actually
 * stops double voting - the check below only exists to word the error.
 */
export async function castVote(
  voterId: string,
  winnerId: string,
  loserId: string,
): Promise<VoteResult> {
  const config = await getConfig();
  if (!config.voting.open) return { ok: false, reason: "Voting is not open." };
  if (winnerId === loserId) return { ok: false, reason: "Those are the same entry." };

  const db = getDb();
  const rows = await db
    .select({
      id: pookalamSubmissions.id,
      userId: pookalamSubmissions.userId,
      rating: pookalamSubmissions.rating,
      matches: pookalamSubmissions.matches,
      status: pookalamSubmissions.status,
      shortlisted: pookalamSubmissions.shortlisted,
    })
    .from(pookalamSubmissions)
    .where(inArray(pookalamSubmissions.id, [winnerId, loserId]));

  const winner = rows.find((row) => row.id === winnerId);
  const loser = rows.find((row) => row.id === loserId);
  if (!winner || !loser) return { ok: false, reason: "That entry no longer exists." };
  if (!winner.shortlisted || !loser.shortlisted) {
    return { ok: false, reason: "One of those entries is not in the running." };
  }
  if (winner.status !== "approved" || loser.status !== "approved") {
    return { ok: false, reason: "One of those entries is not in the running." };
  }
  if (winner.userId === voterId || loser.userId === voterId) {
    return { ok: false, reason: "You cannot vote on your own pookalam. Nice try." };
  }

  const key = pairKey(winnerId, loserId);
  const inserted = await db
    .insert(pookalamVotes)
    .values({ voterId, winnerId, loserId, pairKey: key })
    // The unique index is the real guard. Doing nothing on conflict means a
    // double-submitted form is idempotent instead of counting twice.
    .onConflictDoNothing({ target: [pookalamVotes.voterId, pookalamVotes.pairKey] })
    .returning({ id: pookalamVotes.id });

  if (inserted.length === 0) {
    return { ok: false, reason: "You have already judged this pair." };
  }

  const next = applyResult(winner.rating, winner.matches, loser.rating, loser.matches);
  await Promise.all([
    db
      .update(pookalamSubmissions)
      .set({
        rating: next.winner,
        matches: sql`${pookalamSubmissions.matches} + 1`,
        wins: sql`${pookalamSubmissions.wins} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(pookalamSubmissions.id, winnerId)),
    db
      .update(pookalamSubmissions)
      .set({
        rating: next.loser,
        matches: sql`${pookalamSubmissions.matches} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(pookalamSubmissions.id, loserId)),
  ]);

  const upcoming = await nextPair(voterId);
  return { ok: true, nextPair: upcoming };
}

export async function countMyVotes(voterId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(pookalamVotes)
    .where(eq(pookalamVotes.voterId, voterId));
  return row?.n ?? 0;
}

/** The voter's own progress bar, without fetching a pair. */
export async function getMyVotingProgress(
  voterId: string,
): Promise<{ votes: number; target: number; poolSize: number; totalPairs: number }> {
  const db = getDb();
  const [pool, votes, config, [mine]] = await Promise.all([
    db
      .select({ id: pookalamSubmissions.id, userId: pookalamSubmissions.userId })
      .from(pookalamSubmissions)
      .where(shortlistedFilter()),
    countMyVotes(voterId),
    getConfig(),
    db
      .select({ id: pookalamSubmissions.id })
      .from(pookalamSubmissions)
      .where(
        and(eq(pookalamSubmissions.userId, voterId), eq(pookalamSubmissions.shortlisted, true)),
      )
      .limit(1),
  ]);
  return {
    votes,
    target: voteTarget(pool.length, !!mine, config.voterTargetPct),
    poolSize: pool.length,
    totalPairs: eligiblePairCount(pool.length, !!mine),
  };
}

/* ----------------------------------------------------------- standings */

export interface VoterStanding {
  rank: number;
  name: string;
  avatarUrl: string | null;
  votes: number;
  accuracy: number;
  coveragePct: number;
  qualified: boolean;
}

export interface Standings<T> {
  rows: T[];
  computedAt: string;
  /** Seconds until the cached copy is considered stale. Drives the "next update" line. */
  nextUpdateInMs: number;
}

/**
 * Reads a board, recomputing it only once the configured lag has elapsed.
 *
 * The staleness is the product decision - see `pookalamStandings` - and the
 * caching is what makes it affordable. Two requests racing past the deadline
 * both recompute and both write; they compute the same thing from the same
 * rows, so the loser of the race costs one wasted query and nothing else. That
 * is much cheaper than a lock held across a table scan on the busiest day.
 */
async function readCached<T>(
  key: "entries" | "voters",
  delayMs: number,
  compute: () => Promise<T[]>,
): Promise<Standings<T>> {
  const db = getDb();
  const [cached] = await db
    .select()
    .from(pookalamStandings)
    .where(eq(pookalamStandings.key, key))
    .limit(1);

  const age = cached ? Date.now() - cached.computedAt.getTime() : Number.POSITIVE_INFINITY;
  if (cached && age < delayMs) {
    return {
      rows: cached.payload as T[],
      computedAt: cached.computedAt.toISOString(),
      nextUpdateInMs: delayMs - age,
    };
  }

  const rows = await compute();
  const computedAt = new Date();
  await db
    .insert(pookalamStandings)
    .values({ key, payload: rows as never, computedAt })
    .onConflictDoUpdate({
      target: pookalamStandings.key,
      set: { payload: rows as never, computedAt },
    });
  return { rows, computedAt: computedAt.toISOString(), nextUpdateInMs: delayMs };
}

/*
 * There is deliberately no ranked board here that carries `imageUrl`.
 *
 * The live standings during voting are `getEntrantStandings`, which selects
 * artwork out entirely - see the note there for why that single omission is
 * what keeps the round honest. Artwork appears next to a rank only in
 * `getResults`, which refuses to return anything until results are public.
 */

/** The voters' board: who judged well. See `voters.ts` for what "well" means. */
export async function getVoterStandings(limit = 50): Promise<Standings<VoterStanding>> {
  const config = await getConfig();
  return readCached<VoterStanding>("voters", config.leaderboardDelayMs, async () => {
    const db = getDb();
    const [pool, votes] = await Promise.all([
      db
        // Raw Elo: a voter is scored on whether they agreed with the crowd,
        // not with the admin. Grading them against a corrected ranking would
        // penalise people for calling a brigaded matchup correctly.
        .select({
          id: pookalamSubmissions.id,
          userId: pookalamSubmissions.userId,
          rating: pookalamSubmissions.rating,
        })
        .from(pookalamSubmissions)
        .where(shortlistedFilter()),
      db
        .select({
          voterId: pookalamVotes.voterId,
          winnerId: pookalamVotes.winnerId,
          loserId: pookalamVotes.loserId,
        })
        .from(pookalamVotes),
    ]);

    const ratings = new Map(pool.map((entry) => [entry.id, entry.rating]));
    const entrants = new Set(pool.map((entry) => entry.userId));
    const scored = scoreVoters(votes, {
      ratings,
      voteTarget: (voterId) =>
        voteTarget(pool.length, entrants.has(voterId), config.voterTargetPct),
    }).slice(0, limit);
    if (scored.length === 0) return [];

    // One lookup for the names, after the ranking is settled - joining users
    // into the vote scan would drag a row per vote through the aggregation.
    const profiles = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(
        inArray(
          users.id,
          scored.map((row) => row.voterId),
        ),
      );
    const byId = new Map(profiles.map((row) => [row.id, row]));

    return scored.map((row) => ({
      rank: row.rank,
      name: byId.get(row.voterId)?.name ?? "Someone",
      avatarUrl: byId.get(row.voterId)?.avatarUrl ?? null,
      votes: row.votes,
      accuracy: Math.round(row.accuracy * 10) / 10,
      coveragePct: Math.round(row.coveragePct),
      qualified: row.qualified,
    }));
  });
}

export interface Entrant {
  rank: number;
  name: string;
  avatarUrl: string | null;
  title: string;
  rating: number;
  matches: number;
  wins: number;
}

/**
 * The live standings during voting: ranked, with Elo - but no artwork.
 *
 * WHAT IS WITHHELD AND WHY IT IS ENOUGH
 *
 * The bandwagon this guards against is specific: a voter looking at two
 * pookalams, recognising one as the current leader, and backing it for that
 * reason. That requires mapping a *rank to an image*. Withholding `imageUrl`
 * breaks the mapping at the source, so the two pictures on the voting page stay
 * exactly as anonymous as they were - knowing that someone leads on 1340 tells
 * you nothing about which of the two in front of you is theirs.
 *
 * The title rides along for the same reason it is safe: the voting page renders
 * no titles either, so there is nothing to match it against until results open.
 *
 * The residual leak, stated plainly: rank is now tied to a *person*. Anyone who
 * already knows whose pookalam is whose - told by a friend, or recognising a
 * style - can vote the leader up. That is a much narrower hole than publishing
 * the images, and it is the deliberate trade for having a live board at all.
 *
 * Served from the lagged cache like the voters' board: it is the busiest day
 * and a minute-old ranking is indistinguishable from a live one to a reader.
 */
export async function getEntrantStandings(): Promise<Standings<Entrant>> {
  const config = await getConfig();
  return readCached<Entrant>("entries", config.leaderboardDelayMs, async () => {
    const rows = await getDb()
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
        title: pookalamSubmissions.title,
        rating: effectiveRating,
        matches: pookalamSubmissions.matches,
        wins: pookalamSubmissions.wins,
      })
      .from(pookalamSubmissions)
      .innerJoin(users, eq(users.id, pookalamSubmissions.userId))
      .where(shortlistedFilter())
      .orderBy(desc(effectiveRating));

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      rating: Math.round(row.rating),
    }));
  });
}

/** Drops both cached boards so the next read recomputes. Used after admin edits. */
export async function invalidateStandings(): Promise<void> {
  invalidateShared("pookalam:pool");
  await getDb().delete(pookalamStandings);
}

/* -------------------------------------------------------------- results */

export interface ResultRow {
  id: string;
  rank: number;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  authorName: string;
  notes: string | null;
  rating: number;
  matches: number;
  wins: number;
}

/**
 * The final standings. Authors are revealed here and nowhere else - the whole
 * point of anonymous pairing is that nobody votes for a name.
 *
 * Read live rather than from the cached board: once voting has closed nothing
 * moves, so there is no bandwagon left to prevent and no reason to serve a copy
 * that is a minute behind the truth.
 */
export async function getResults(isAdmin: boolean): Promise<ResultRow[] | null> {
  const config = await getConfig();
  if (!config.results.open && !isAdmin) return null;

  const rows = await getDb()
    .select({
      id: pookalamSubmissions.id,
      title: pookalamSubmissions.title,
      imageUrl: pookalamSubmissions.imageUrl,
      sourceUrl: pookalamSubmissions.sourceUrl,
      authorName: users.name,
      notes: pookalamSubmissions.notes,
      rating: effectiveRating,
      matches: pookalamSubmissions.matches,
      wins: pookalamSubmissions.wins,
    })
    .from(pookalamSubmissions)
    .innerJoin(users, eq(users.id, pookalamSubmissions.userId))
    .where(shortlistedFilter())
    .orderBy(desc(effectiveRating));

  return rows.map((row, index) => ({
    ...row,
    rating: Math.round(row.rating),
    rank: index + 1,
  }));
}

/* ------------------------------------------------------- tester review */

export interface ReviewEntry {
  id: string;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  shortlisted: boolean;
  likes: number;
  dislikes: number;
  /** Every reviewer's verdict and reason. Named - these are not anonymous. */
  comments: { reviewerName: string; verdict: "like" | "dislike"; comment: string | null }[];
  /** This reviewer's own verdict, so the page can show it selected. */
  myVerdict: "like" | "dislike" | null;
  myComment: string | null;
}

/**
 * The shortlisting gallery, for testers and admins.
 *
 * Authors are *not* shown, even here. Testers are drawn from the same club as
 * the entrants, and a shortlist chosen by people who could see the names would
 * be exactly the popularity contest the anonymous round is designed to avoid.
 * The admin queue reveals authors; this does not.
 */
export async function listForTesterReview(reviewerId: string): Promise<ReviewEntry[]> {
  const db = getDb();
  const [entries, reviews] = await Promise.all([
    db
      .select({
        id: pookalamSubmissions.id,
        title: pookalamSubmissions.title,
        imageUrl: pookalamSubmissions.imageUrl,
        sourceUrl: pookalamSubmissions.sourceUrl,
        notes: pookalamSubmissions.notes,
        status: pookalamSubmissions.status,
        shortlisted: pookalamSubmissions.shortlisted,
      })
      .from(pookalamSubmissions)
      .where(ne(pookalamSubmissions.status, "rejected"))
      .orderBy(desc(pookalamSubmissions.createdAt)),
    db
      .select({
        submissionId: pookalamReviews.submissionId,
        reviewerId: pookalamReviews.reviewerId,
        reviewerName: users.name,
        verdict: pookalamReviews.verdict,
        comment: pookalamReviews.comment,
      })
      .from(pookalamReviews)
      .innerJoin(users, eq(users.id, pookalamReviews.reviewerId))
      .orderBy(desc(pookalamReviews.updatedAt)),
  ]);

  const byEntry = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = byEntry.get(review.submissionId) ?? [];
    list.push(review);
    byEntry.set(review.submissionId, list);
  }

  return entries.map((entry) => {
    const list = byEntry.get(entry.id) ?? [];
    const mine = list.find((review) => review.reviewerId === reviewerId);
    return {
      ...entry,
      likes: list.filter((review) => review.verdict === "like").length,
      dislikes: list.filter((review) => review.verdict === "dislike").length,
      comments: list.map((review) => ({
        reviewerName: review.reviewerName,
        verdict: review.verdict,
        comment: review.comment,
      })),
      myVerdict: mine?.verdict ?? null,
      myComment: mine?.comment ?? null,
    };
  });
}

/** One verdict per reviewer per entry, rewritten when they change their mind. */
export async function setReviewVerdict(
  reviewerId: string,
  submissionId: string,
  verdict: "like" | "dislike",
  comment?: string,
): Promise<void> {
  const trimmed = comment?.trim().slice(0, 500) || null;
  await getDb()
    .insert(pookalamReviews)
    .values({ submissionId, reviewerId, verdict, comment: trimmed })
    .onConflictDoUpdate({
      target: [pookalamReviews.submissionId, pookalamReviews.reviewerId],
      set: { verdict, comment: trimmed, updatedAt: new Date() },
    });
}

/* ---------------------------------------------------------------- admin */

export interface AdminRow extends ReviewEntry {
  authorName: string;
  authorEmail: string;
  /** Raw crowd Elo, before any correction. */
  rating: number;
  /** Admin correction. Zero for an untouched entry. */
  adjustment: number;
  adjustmentNote: string | null;
  /** `rating + adjustment` - the number that actually ranks. */
  effectiveRating: number;
  matches: number;
  wins: number;
  reviewNote: string | null;
}

export async function listForAdmin(limit = 100, offset = 0): Promise<AdminRow[]> {
  const db = getDb();
  const [rows, reviews] = await Promise.all([
    db
      .select({
        id: pookalamSubmissions.id,
        title: pookalamSubmissions.title,
        imageUrl: pookalamSubmissions.imageUrl,
        sourceUrl: pookalamSubmissions.sourceUrl,
        notes: pookalamSubmissions.notes,
        status: pookalamSubmissions.status,
        shortlisted: pookalamSubmissions.shortlisted,
        reviewNote: pookalamSubmissions.reviewNote,
        authorName: users.name,
        authorEmail: users.email,
        // All three, separately: the crowd's verdict, the correction applied to
        // it, and what actually ranks. Showing only the total would hide the
        // fact that a human moved it.
        rating: pookalamSubmissions.rating,
        adjustment: pookalamSubmissions.adjustment,
        adjustmentNote: pookalamSubmissions.adjustmentNote,
        matches: pookalamSubmissions.matches,
        wins: pookalamSubmissions.wins,
      })
      .from(pookalamSubmissions)
      .innerJoin(users, eq(users.id, pookalamSubmissions.userId))
      .orderBy(asc(pookalamSubmissions.status), desc(pookalamSubmissions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        submissionId: pookalamReviews.submissionId,
        reviewerName: users.name,
        verdict: pookalamReviews.verdict,
        comment: pookalamReviews.comment,
      })
      .from(pookalamReviews)
      .innerJoin(users, eq(users.id, pookalamReviews.reviewerId)),
  ]);

  const byEntry = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = byEntry.get(review.submissionId) ?? [];
    list.push(review);
    byEntry.set(review.submissionId, list);
  }

  return rows.map((row) => {
    const list = byEntry.get(row.id) ?? [];
    return {
      ...row,
      rating: Math.round(row.rating),
      adjustment: Math.round(row.adjustment),
      effectiveRating: Math.round(row.rating + row.adjustment),
      likes: list.filter((review) => review.verdict === "like").length,
      dislikes: list.filter((review) => review.verdict === "dislike").length,
      comments: list.map((review) => ({
        reviewerName: review.reviewerName,
        verdict: review.verdict,
        comment: review.comment,
      })),
      myVerdict: null,
      myComment: null,
    };
  });
}

export async function reviewSubmission(
  adminId: string,
  submissionId: string,
  status: "approved" | "rejected",
  reviewNote?: string,
): Promise<void> {
  await getDb()
    .update(pookalamSubmissions)
    .set({
      status,
      // A rejected entry cannot stay on the shortlist. Leaving it there would
      // put it back in the pairing the moment voting opened.
      ...(status === "rejected" ? { shortlisted: false } : {}),
      reviewNote: reviewNote?.trim().slice(0, 300) || null,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pookalamSubmissions.id, submissionId));
  await invalidateStandings();
}

/** Widest correction a single call may apply, in Elo points. */
const MAX_ADJUSTMENT_STEP = 400;

/**
 * Applies an admin correction to one entry's score.
 *
 * The escape hatch for what the maths cannot see: a ring of sockpuppets sinking
 * one entry, or a friend group farming one up. Elo has no notion of a vote cast
 * in bad faith - every vote is equally real to it - so when a human establishes
 * that a block of them were not, this is how the standing gets put back.
 *
 * Three properties make this safe enough to ship in a prize contest:
 *
 *   it is additive     `delta` moves the existing correction rather than
 *                      setting it, so two admins acting on the same report
 *                      cannot silently overwrite one another - and passing the
 *                      negative of the current value is a clean full undo.
 *   it is separate     `rating` keeps the untouched crowd verdict, so the
 *                      intervention can always be measured and reversed.
 *   it is on record    the reason is required, and every call lands in
 *                      `activity_logs` with the admin, the entry and both
 *                      numbers. A silent adjustment would make the whole
 *                      result unannounceable.
 *
 * Capped per call so a typo cannot bury an entry a thousand points deep. Apply
 * it twice if a bigger move is genuinely warranted.
 */
export async function adjustRating(
  adminId: string,
  submissionId: string,
  delta: number,
  reason: string,
): Promise<void> {
  const note = reason.trim();
  if (note.length < 3) {
    throw new Error("Give a reason for the adjustment - it goes on the record.");
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("Adjustment must be a non-zero number.");
  }
  if (Math.abs(delta) > MAX_ADJUSTMENT_STEP) {
    throw new Error(`One adjustment can move a score by at most ${MAX_ADJUSTMENT_STEP} points.`);
  }

  const db = getDb();
  const [updated] = await db
    .update(pookalamSubmissions)
    .set({
      adjustment: sql`${pookalamSubmissions.adjustment} + ${delta}`,
      adjustmentNote: note.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(eq(pookalamSubmissions.id, submissionId))
    .returning({
      title: pookalamSubmissions.title,
      rating: pookalamSubmissions.rating,
      adjustment: pookalamSubmissions.adjustment,
    });
  if (!updated) throw new Error("That entry no longer exists.");

  await logActivity({
    userId: adminId,
    eventType: "pookalam_rating_adjusted",
    meta: {
      submissionId,
      title: updated.title,
      delta,
      rawRating: updated.rating,
      adjustmentAfter: updated.adjustment,
      effectiveAfter: updated.rating + updated.adjustment,
      reason: note,
    },
  });
  await invalidateStandings();
}

/**
 * Puts an entry into (or out of) the public Elo round.
 *
 * Shortlisting implies approval - the admin is saying this is one of the best,
 * which is a strictly stronger statement than "this is valid" - so it sets both
 * rather than making them do two clicks and forget one.
 */
export async function setShortlisted(
  adminId: string,
  submissionId: string,
  shortlisted: boolean,
): Promise<void> {
  await getDb()
    .update(pookalamSubmissions)
    .set({
      shortlisted,
      ...(shortlisted
        ? { status: "approved" as const, reviewedBy: adminId, reviewedAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(pookalamSubmissions.id, submissionId));
  await invalidateStandings();
}

/**
 * Shortlists the top N by tester likes, as a starting point.
 *
 * Ranked by likes minus dislikes, then by likes, then by newest. Explicitly a
 * suggestion the admin can then edit one entry at a time - a shortlist chosen
 * purely by a handful of tester taps is not a jury decision, and the copy in
 * /admin says so.
 */
export async function autoShortlist(adminId: string, count: number): Promise<number> {
  const db = getDb();
  const net = sql<number>`
    coalesce(sum(case when ${pookalamReviews.verdict} = 'like' then 1
                      when ${pookalamReviews.verdict} = 'dislike' then -1
                      else 0 end), 0)::int`;
  const likes = sql<number>`
    coalesce(sum(case when ${pookalamReviews.verdict} = 'like' then 1 else 0 end), 0)::int`;

  const scores = await db
    .select({ id: pookalamSubmissions.id, net, likes })
    .from(pookalamSubmissions)
    .leftJoin(pookalamReviews, eq(pookalamReviews.submissionId, pookalamSubmissions.id))
    .where(eq(pookalamSubmissions.status, "approved"))
    .groupBy(pookalamSubmissions.id, pookalamSubmissions.createdAt)
    .orderBy(desc(net), desc(likes), desc(pookalamSubmissions.createdAt))
    .limit(Math.max(1, Math.min(64, count)));

  const ids = scores.map((row) => row.id);
  await db
    .update(pookalamSubmissions)
    .set({ shortlisted: false, updatedAt: new Date() })
    .where(eq(pookalamSubmissions.shortlisted, true));
  if (ids.length > 0) {
    await db
      .update(pookalamSubmissions)
      .set({
        shortlisted: true,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(pookalamSubmissions.id, ids));
  }
  await invalidateStandings();
  return ids.length;
}
