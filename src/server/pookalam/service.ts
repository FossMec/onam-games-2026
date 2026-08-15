import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { pookalamSubmissions, pookalamVotes, users } from "~/server/db/schema";
import { getSetting } from "~/server/settings/service";
import { applyResult, pairKey } from "./elo";

/**
 * Code-a-Pookalam: submissions, anonymous head-to-head pairing, Elo settlement.
 *
 * Three admin switches gate the whole thing, all defaulting to closed so a
 * half-configured deploy shows nothing rather than the wrong thing:
 *
 *   pookalam.submissions_open  — the entry form accepts new work
 *   pookalam.voting_open       — day 7; pairs are served and votes counted
 *   pookalam.results_public    — the ranked list is visible to everyone
 */

export interface PookalamGates {
  submissionsOpen: boolean;
  votingOpen: boolean;
  resultsPublic: boolean;
}

export async function getGates(): Promise<PookalamGates> {
  const [submissionsOpen, votingOpen, resultsPublic] = await Promise.all([
    getSetting("pookalam.submissions_open", false),
    getSetting("pookalam.voting_open", false),
    getSetting("pookalam.results_public", false),
  ]);
  return { submissionsOpen, votingOpen, resultsPublic };
}

/* ---------------------------------------------------------------- entry */

export interface SubmissionInput {
  title: string;
  sourceUrl: string;
  imageUrl: string;
  notes?: string;
}

export interface MySubmission {
  id: string;
  title: string;
  sourceUrl: string;
  imageUrl: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
}

/**
 * Only http(s), and no credentials in the URL.
 *
 * These links get rendered into an `<img src>` and an `<a href>` on a page
 * every voter sees, so a `javascript:` or `data:` URL here is stored XSS with
 * extra steps. Allowing exactly two schemes is the cheap, complete answer.
 */
function normalizeUrl(raw: string, label: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`${label} must be a full URL, starting with https://`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must be an http or https link.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not contain a username or password.`);
  }
  return url.toString();
}

export async function getMySubmission(userId: string): Promise<MySubmission | null> {
  const [row] = await getDb()
    .select({
      id: pookalamSubmissions.id,
      title: pookalamSubmissions.title,
      sourceUrl: pookalamSubmissions.sourceUrl,
      imageUrl: pookalamSubmissions.imageUrl,
      notes: pookalamSubmissions.notes,
      status: pookalamSubmissions.status,
      reviewNote: pookalamSubmissions.reviewNote,
    })
    .from(pookalamSubmissions)
    .where(eq(pookalamSubmissions.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Creates or replaces the caller's entry.
 *
 * Editing an approved entry sends it back to `pending`. Otherwise an entrant
 * could get a plain design approved and then swap the image URL for something
 * else once voting is live, and the review would have meant nothing.
 */
export async function upsertSubmission(userId: string, input: SubmissionInput): Promise<void> {
  const gates = await getGates();
  if (!gates.submissionsOpen) throw new Error("Submissions are closed.");

  const title = input.title.trim();
  if (title.length < 3 || title.length > 80) {
    throw new Error("Give it a title between 3 and 80 characters.");
  }
  const notes = input.notes?.trim().slice(0, 500) || null;
  const sourceUrl = normalizeUrl(input.sourceUrl, "The source link");
  const imageUrl = normalizeUrl(input.imageUrl, "The image link");

  await getDb()
    .insert(pookalamSubmissions)
    .values({ userId, title, sourceUrl, imageUrl, notes })
    .onConflictDoUpdate({
      target: pookalamSubmissions.userId,
      set: {
        title,
        sourceUrl,
        imageUrl,
        notes,
        status: "pending",
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      },
    });
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
}

/** Widest pool a single pairing query will consider. */
const POOL_SIZE = 24;

/**
 * Picks two entries for this voter to compare.
 *
 * The pool is ordered by match count so under-exposed entries get seen first —
 * without that, whichever entries happen to be drawn early accumulate all the
 * matches and the tail never gets a fair reading. Within the pool the pair is
 * chosen at random, then filtered against what this voter has already judged.
 *
 * Returns null when the voter has run out of pairs, which is a success state:
 * they have judged everything available to them.
 */
export async function nextPair(voterId: string): Promise<VotingPair | null> {
  const db = getDb();

  const pool = await db
    .select({
      id: pookalamSubmissions.id,
      title: pookalamSubmissions.title,
      imageUrl: pookalamSubmissions.imageUrl,
    })
    .from(pookalamSubmissions)
    .where(
      and(
        eq(pookalamSubmissions.status, "approved"),
        // Nobody judges their own entry.
        ne(pookalamSubmissions.userId, voterId),
      ),
    )
    .orderBy(asc(pookalamSubmissions.matches), asc(pookalamSubmissions.id))
    .limit(POOL_SIZE);

  if (pool.length < 2) return null;

  const judged = new Set(
    (
      await db
        .select({ pairKey: pookalamVotes.pairKey })
        .from(pookalamVotes)
        .where(eq(pookalamVotes.voterId, voterId))
    ).map((row) => row.pairKey),
  );

  /*
   * Every unjudged pair in the pool, cheapest-exposure first. The pool is at
   * most 24 entries, so this is a few hundred comparisons — not worth a
   * cleverer query, and enumerating means "no pair left" is a real answer
   * rather than a retry loop that gave up.
   */
  const candidates: [PairEntry, PairEntry][] = [];
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      if (judged.has(pairKey(pool[i].id, pool[j].id))) continue;
      candidates.push([pool[i], pool[j]]);
    }
  }
  if (candidates.length === 0) return null;

  // Bias toward the front of the list — that is where the least-seen entries
  // are — without making the sequence predictable enough to game.
  const weighted = Math.floor(Math.random() ** 2 * candidates.length);
  const [a, b] = candidates[weighted];
  // Which one shows on the left is a coin flip; a fixed side wins votes on its
  // own, which is a real and well-documented bias in pairwise judging.
  const [left, right] = Math.random() < 0.5 ? [a, b] : [b, a];
  return { left, right, pairKey: pairKey(a.id, b.id) };
}

/* ----------------------------------------------------------------- vote */

export interface VoteResult {
  ok: boolean;
  reason?: string;
}

/**
 * Records a decided match and moves both ratings.
 *
 * Everything that makes this fair is enforced here rather than trusted from the
 * client: voting must be open, both entries must be approved, neither may
 * belong to the voter, and the (voter, pair) unique constraint is what actually
 * stops double voting — the check below is only for the error message.
 */
export async function castVote(
  voterId: string,
  winnerId: string,
  loserId: string,
): Promise<VoteResult> {
  const gates = await getGates();
  if (!gates.votingOpen) return { ok: false, reason: "Voting is not open." };
  if (winnerId === loserId) return { ok: false, reason: "Those are the same entry." };

  const db = getDb();
  const rows = await db
    .select({
      id: pookalamSubmissions.id,
      userId: pookalamSubmissions.userId,
      rating: pookalamSubmissions.rating,
      matches: pookalamSubmissions.matches,
      status: pookalamSubmissions.status,
    })
    .from(pookalamSubmissions)
    .where(inArray(pookalamSubmissions.id, [winnerId, loserId]));

  const winner = rows.find((row) => row.id === winnerId);
  const loser = rows.find((row) => row.id === loserId);
  if (!winner || !loser) return { ok: false, reason: "That entry no longer exists." };
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

  return { ok: true };
}

export async function countMyVotes(voterId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(pookalamVotes)
    .where(eq(pookalamVotes.voterId, voterId));
  return row?.n ?? 0;
}

/* -------------------------------------------------------------- results */

export interface ResultRow {
  id: string;
  rank: number;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  authorName: string;
  rating: number;
  matches: number;
  wins: number;
}

/**
 * The final standings. Authors are revealed here and nowhere else — the whole
 * point of anonymous pairing is that nobody votes for a name.
 *
 * `resultsPublic` gates this for players; admins always see it, which is how
 * you sanity-check a contest before announcing it.
 */
export async function getResults(isAdmin: boolean): Promise<ResultRow[] | null> {
  const gates = await getGates();
  if (!gates.resultsPublic && !isAdmin) return null;

  const rows = await getDb()
    .select({
      id: pookalamSubmissions.id,
      title: pookalamSubmissions.title,
      imageUrl: pookalamSubmissions.imageUrl,
      sourceUrl: pookalamSubmissions.sourceUrl,
      authorName: users.name,
      rating: pookalamSubmissions.rating,
      matches: pookalamSubmissions.matches,
      wins: pookalamSubmissions.wins,
    })
    .from(pookalamSubmissions)
    .innerJoin(users, eq(users.id, pookalamSubmissions.userId))
    .where(eq(pookalamSubmissions.status, "approved"))
    .orderBy(desc(pookalamSubmissions.rating));

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/* ---------------------------------------------------------------- admin */

export interface ReviewRow extends ResultRow {
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  reviewNote: string | null;
}

export async function listForReview(limit = 50, offset = 0): Promise<ReviewRow[]> {
  const rows = await getDb()
    .select({
      id: pookalamSubmissions.id,
      title: pookalamSubmissions.title,
      imageUrl: pookalamSubmissions.imageUrl,
      sourceUrl: pookalamSubmissions.sourceUrl,
      authorName: users.name,
      rating: pookalamSubmissions.rating,
      matches: pookalamSubmissions.matches,
      wins: pookalamSubmissions.wins,
      status: pookalamSubmissions.status,
      notes: pookalamSubmissions.notes,
      reviewNote: pookalamSubmissions.reviewNote,
    })
    .from(pookalamSubmissions)
    .innerJoin(users, eq(users.id, pookalamSubmissions.userId))
    .orderBy(asc(pookalamSubmissions.status), desc(pookalamSubmissions.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
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
      reviewNote: reviewNote?.trim().slice(0, 300) || null,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pookalamSubmissions.id, submissionId));
}
