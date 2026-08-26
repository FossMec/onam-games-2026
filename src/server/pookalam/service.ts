import { logActivity } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { getSettings } from "~/server/settings/service";
import { invalidateShared, requestMemo, sharedRead } from "~/server/cache";
import { applyResult, pairKey } from "./elo";
import { decodeSubmissionImage, deleteStoredImage, storeSubmissionImage } from "./image";
import { candidatePairs, type PoolEntry, samplePair } from "./pairing";
import { eligiblePairCount, scoreVoters, voteTarget } from "./voters";
import { type PhaseState, parseIstDateTime, resolvePhase } from "./window";

/**
 * Code-a-Pookalam: the whole seven-day arc.
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
  return sharedRead("pookalam:config", computeConfig, 30_000);
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
  title?: string;
  sourceUrl: string;
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

export function getMySubmission(userId: string): Promise<MySubmission | null> {
  return requestMemo(`pookalam:mine:${userId}`, async () => {
    const db = getDb();
    const rows = await db<MySubmission[]>`
      SELECT
        id,
        title,
        source_url AS "sourceUrl",
        image_url AS "imageUrl",
        notes,
        status,
        shortlisted,
        review_note AS "reviewNote"
      FROM pookalam_submissions
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
}

export async function upsertSubmission(userId: string, input: SubmissionInput): Promise<void> {
  const config = await getConfig();
  if (!config.submissions.open) throw new Error("Submissions are closed.");

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

  if (!input.imageDataUrl && !existing) {
    throw new Error("Upload a square render of your pookalam.");
  }

  const title = submitted || undefined;

  let stored: { url: string; path: string; width: number; height: number } | null = null;
  if (input.imageDataUrl) {
    stored = await storeSubmissionImage(
      decodeSubmissionImage(input.imageDataUrl, config.aspectTolerancePct),
    );
  }

  const defaultTitle = title ?? "Untitled pookalam";
  const defaultImageUrl = stored?.url ?? existing?.imageUrl ?? "";
  const defaultImagePath = stored?.path ?? existing?.imagePath ?? null;
  const defaultImageWidth = stored?.width ?? null;
  const defaultImageHeight = stored?.height ?? null;

  await db`
    INSERT INTO pookalam_submissions (
      user_id, title, source_url, image_url, image_path, image_width, image_height, notes
    )
    VALUES (
      ${userId}, ${defaultTitle}, ${sourceUrl}, ${defaultImageUrl},
      ${defaultImagePath}, ${defaultImageWidth}, ${defaultImageHeight}, ${notes}
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      source_url = EXCLUDED.source_url,
      notes = EXCLUDED.notes,
      title = COALESCE(${title ?? null}, pookalam_submissions.title),
      image_url = COALESCE(${stored?.url ?? null}, pookalam_submissions.image_url),
      image_path = COALESCE(${stored?.path ?? null}, pookalam_submissions.image_path),
      image_width = COALESCE(${stored?.width ?? null}, pookalam_submissions.image_width),
      image_height = COALESCE(${stored?.height ?? null}, pookalam_submissions.image_height),
      status = 'pending',
      shortlisted = false,
      review_note = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = NOW()
  `;

  if (stored && existing?.imagePath && existing.imagePath !== stored.path) {
    await deleteStoredImage(existing.imagePath);
  }
}

async function getExistingImage(
  userId: string,
): Promise<{ imagePath: string | null; imageUrl: string } | null> {
  const db = getDb();
  const rows = await db<{ imagePath: string | null; imageUrl: string }[]>`
    SELECT image_path AS "imagePath", image_url AS "imageUrl"
    FROM pookalam_submissions
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/* -------------------------------------------------------------- pairing */

export interface PairEntry {
  id: string;
  title: string;
  imageUrl: string;
}

export interface VotingPair {
  left: PairEntry;
  right: PairEntry;
  pairKey: string;
  progress: { votes: number; target: number; remaining: number };
}

async function loadPool(): Promise<PoolEntry[]> {
  return sharedRead(
    "pookalam:pool",
    async () => {
      const db = getDb();
      return db<PoolEntry[]>`
        SELECT
          id,
          title,
          image_url AS "imageUrl",
          rating,
          matches
        FROM pookalam_submissions
        WHERE status = 'approved' AND shortlisted = true
        ORDER BY matches ASC, id ASC
      `;
    },
    60_000,
  );
}

export async function nextPairs(voterId: string, count = 25): Promise<VotingPair[]> {
  const db = getDb();
  const [pool, judgedRows, pairCountRows, config, mineRows] = await Promise.all([
    loadPool(),
    db<{ pairKey: string }[]>`
      SELECT pair_key AS "pairKey" FROM pookalam_votes WHERE voter_id = ${voterId}
    `,
    sharedRead(
      "pookalam:pair_counts",
      async () => {
        const d = getDb();
        return d<{ pairKey: string; n: number }[]>`
          SELECT pair_key AS "pairKey", count(*)::int AS n
          FROM pookalam_votes
          GROUP BY pair_key
        `;
      },
      30_000,
    ),
    getConfig(),
    db<{ id: string }[]>`
      SELECT id FROM pookalam_submissions WHERE user_id = ${voterId} LIMIT 1
    `,
  ]);

  const mine = mineRows[0];
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

export type VoteResult = { ok: true; nextPair?: VotingPair | null } | { ok: false; reason: string };

export async function castVote(
  voterId: string,
  winnerId: string,
  loserId: string,
  opts: { skipNextPair?: boolean } = {},
): Promise<VoteResult> {
  const config = await getConfig();
  if (!config.voting.open) return { ok: false, reason: "Voting is not open." };
  if (winnerId === loserId) return { ok: false, reason: "Those are the same entry." };

  const db = getDb();
  const rows = await db<
    {
      id: string;
      userId: string;
      rating: number;
      matches: number;
      status: string;
      shortlisted: boolean;
    }[]
  >`
    SELECT
      id,
      user_id AS "userId",
      rating,
      matches,
      status,
      shortlisted
    FROM pookalam_submissions
    WHERE id = ${winnerId} OR id = ${loserId}
  `;

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
  const inserted = await db<{ id: string }[]>`
    INSERT INTO pookalam_votes (voter_id, winner_id, loser_id, pair_key)
    VALUES (${voterId}, ${winnerId}, ${loserId}, ${key})
    ON CONFLICT (voter_id, pair_key) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    return { ok: false, reason: "You have already judged this pair." };
  }

  const next = applyResult(winner.rating, winner.matches, loser.rating, loser.matches);
  // Single DB round-trip for both Elo updates (was 2 separate UPDATEs → 30ms CPU)
  // Explicit ::double precision avoids "column is double precision but expression is text" when CASE infers text
  await db`
    UPDATE pookalam_submissions
    SET
      rating = CASE
        WHEN id = ${winnerId} THEN ${next.winner}::double precision
        WHEN id = ${loserId} THEN ${next.loser}::double precision
      END,
      matches = matches + 1,
      wins = wins + CASE WHEN id = ${winnerId} THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id IN (${winnerId}, ${loserId})
  `;

  if (opts.skipNextPair) {
    return { ok: true };
  }
  const upcoming = await nextPair(voterId);
  return { ok: true, nextPair: upcoming };
}

export async function batchVote(
  voterId: string,
  votes: Array<{ winnerId: string; loserId: string }>,
): Promise<{ ok: number; errors: string[] }> {
  const batch = votes.slice(0, 50);
  if (batch.length === 0) return { ok: 0, errors: [] };
  const config = await getConfig();
  if (!config.voting.open) return { ok: 0, errors: batch.map(() => "Voting is not open.") };
  const db = getDb();
  const allIds = [...new Set(batch.flatMap((v) => [v.winnerId, v.loserId]))];
  const rows = await db<
    {
      id: string;
      userId: string;
      rating: number;
      matches: number;
      status: string;
      shortlisted: boolean;
    }[]
  >`
    SELECT id, user_id AS "userId", rating, matches, status, shortlisted
    FROM pookalam_submissions WHERE id = ANY(${allIds})
  `;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const valid: typeof batch = [];
  const errors: string[] = [];
  for (const v of batch) {
    if (v.winnerId === v.loserId) {
      errors.push("Those are the same entry.");
      continue;
    }
    const w = byId.get(v.winnerId);
    const l = byId.get(v.loserId);
    if (!w || !l) {
      errors.push("That entry no longer exists.");
      continue;
    }
    if (!w.shortlisted || !l.shortlisted || w.status !== "approved" || l.status !== "approved") {
      errors.push("One of those entries is not in the running.");
      continue;
    }
    if (w.userId === voterId || l.userId === voterId) {
      errors.push("You cannot vote on your own pookalam. Nice try.");
      continue;
    }
    valid.push(v);
  }
  if (valid.length === 0) return { ok: 0, errors };

  // Bulk insert — one round-trip (was N)
  const pairKeys = valid.map((v) => pairKey(v.winnerId, v.loserId));
  const inserted = await db<{ pair_key: string }[]>`
    INSERT INTO pookalam_votes (voter_id, winner_id, loser_id, pair_key)
    VALUES ${db(valid.map((v, i) => [voterId, v.winnerId, v.loserId, pairKeys[i]] as const))}
    ON CONFLICT (voter_id, pair_key) DO NOTHING
    RETURNING pair_key
  `;
  const insertedSet = new Set(inserted.map((r) => r.pair_key));
  // Count duplicates as errors
  for (const v of valid) {
    const k = pairKey(v.winnerId, v.loserId);
    if (!insertedSet.has(k)) errors.push("You have already judged this pair.");
  }
  if (insertedSet.size === 0) return { ok: 0, errors };

  // Compute Elo sequentially in memory to keep ratings consistent within batch
  const ratingById = new Map<string, number>();
  const matchesById = new Map<string, number>();
  for (const r of rows) {
    ratingById.set(r.id, Number(r.rating));
    matchesById.set(r.id, Number(r.matches));
  }
  const winsById = new Map<string, number>();
  const countsById = new Map<string, number>();
  for (const v of valid) {
    const k = pairKey(v.winnerId, v.loserId);
    if (!insertedSet.has(k)) continue;
    const wRating = ratingById.get(v.winnerId)!;
    const lRating = ratingById.get(v.loserId)!;
    const wMatches = matchesById.get(v.winnerId)!;
    const lMatches = matchesById.get(v.loserId)!;
    const next = applyResult(wRating, wMatches, lRating, lMatches);
    ratingById.set(v.winnerId, next.winner);
    ratingById.set(v.loserId, next.loser);
    matchesById.set(v.winnerId, wMatches + 1);
    matchesById.set(v.loserId, lMatches + 1);
    winsById.set(v.winnerId, (winsById.get(v.winnerId) ?? 0) + 1);
    countsById.set(v.winnerId, (countsById.get(v.winnerId) ?? 0) + 1);
    countsById.set(v.loserId, (countsById.get(v.loserId) ?? 0) + 1);
  }
  const ids = [...countsById.keys()];
  if (ids.length > 0) {
    // Single bulk UPDATE — one more round-trip (was N)
    const ratingCases = ids
      .map((id) => db`WHEN id = ${id} THEN ${ratingById.get(id)!}::double precision`)
      .reduce((a, b) => db`${a} ${b}`);
    const winCases = ids
      .map((id) => db`WHEN id = ${id} THEN ${winsById.get(id) ?? 0}`)
      .reduce((a, b) => db`${a} ${b}`);
    await db`
      UPDATE pookalam_submissions SET
        rating = CASE ${ratingCases} END,
        matches = matches + CASE ${ids.map((id) => db`WHEN id = ${id} THEN ${countsById.get(id)!}`).reduce((a, b) => db`${a} ${b}`)} END,
        wins = wins + CASE ${winCases} ELSE 0 END,
        updated_at = NOW()
      WHERE id = ANY(${ids})
    `;
  }
  return { ok: insertedSet.size, errors };
}

export async function countMyVotes(voterId: string): Promise<number> {
  const db = getDb();
  const rows = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pookalam_votes WHERE voter_id = ${voterId}
  `;
  return rows[0]?.n ?? 0;
}

export async function getMyVotingProgress(
  voterId: string,
): Promise<{ votes: number; target: number; poolSize: number; totalPairs: number }> {
  const db = getDb();
  const [pool, votes, config, mineRows] = await Promise.all([
    db<{ id: string; userId: string }[]>`
      SELECT id, user_id AS "userId"
      FROM pookalam_submissions
      WHERE status = 'approved' AND shortlisted = true
    `,
    countMyVotes(voterId),
    getConfig(),
    db<{ id: string }[]>`
      SELECT id FROM pookalam_submissions
      WHERE user_id = ${voterId} AND shortlisted = true
      LIMIT 1
    `,
  ]);
  const mine = mineRows[0];
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
  nextUpdateInMs: number;
}

async function readCached<T>(
  key: "entries" | "voters",
  delayMs: number,
  compute: () => Promise<T[]>,
): Promise<Standings<T>> {
  const db = getDb();
  const cachedRows = await db<{ payload: unknown; computedAt: Date }[]>`
    SELECT payload, computed_at AS "computedAt"
    FROM pookalam_standings
    WHERE key = ${key}
    LIMIT 1
  `;
  const cached = cachedRows[0];

  const age = cached
    ? Date.now() - new Date(cached.computedAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (cached && age < delayMs && cached.payload) {
    let parsed = cached.payload;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        rows: parsed as T[],
        computedAt: new Date(cached.computedAt).toISOString(),
        nextUpdateInMs: delayMs - age,
      };
    }
  }

  const rows = await compute();
  const computedAt = new Date();
  await db`
    INSERT INTO pookalam_standings (key, payload, computed_at)
    VALUES (${key}, ${db.json(rows as any)}, ${computedAt})
    ON CONFLICT (key) DO UPDATE
    SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at
  `;
  return { rows, computedAt: computedAt.toISOString(), nextUpdateInMs: delayMs };
}

export async function getVoterStandings(limit = 50): Promise<Standings<VoterStanding>> {
  const config = await getConfig();
  return readCached<VoterStanding>("voters", config.leaderboardDelayMs, async () => {
    const db = getDb();
    const [pool, votes] = await Promise.all([
      db<{ id: string; userId: string; rating: number }[]>`
        SELECT id, user_id AS "userId", rating
        FROM pookalam_submissions
        WHERE status = 'approved' AND shortlisted = true
      `,
      db<{ voterId: string; winnerId: string; loserId: string }[]>`
        SELECT voter_id AS "voterId", winner_id AS "winnerId", loser_id AS "loserId"
        FROM pookalam_votes
      `,
    ]);

    const ratings = new Map(pool.map((entry) => [entry.id, entry.rating]));
    const entrants = new Set(pool.map((entry) => entry.userId));
    const scored = scoreVoters(votes, {
      ratings,
      voteTarget: (voterId) =>
        voteTarget(pool.length, entrants.has(voterId), config.voterTargetPct),
    }).slice(0, limit);
    if (scored.length === 0) return [];

    const voterIds = scored.map((row) => row.voterId);
    const profiles = await db<{ id: string; name: string; avatarUrl: string | null }[]>`
      SELECT id, name, avatar_url AS "avatarUrl"
      FROM users
      WHERE id = ANY(${voterIds})
    `;
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

export async function getEntrantStandings(): Promise<Standings<Entrant>> {
  const config = await getConfig();
  return readCached<Entrant>("entries", config.leaderboardDelayMs, async () => {
    const db = getDb();
    const rows = await db<
      {
        name: string;
        avatarUrl: string | null;
        title: string;
        rating: number;
        matches: number;
        wins: number;
      }[]
    >`
      SELECT
        u.name,
        u.avatar_url AS "avatarUrl",
        s.title,
        (s.rating + s.adjustment) AS rating,
        s.matches,
        s.wins
      FROM pookalam_submissions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.status = 'approved' AND s.shortlisted = true
      ORDER BY (s.rating + s.adjustment) DESC
    `;

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      rating: Math.round(row.rating),
    }));
  });
}

export async function invalidateStandings(): Promise<void> {
  invalidateShared("pookalam:pool");
  const db = getDb();
  await db`DELETE FROM pookalam_standings`;
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

export async function getResults(isAdmin: boolean): Promise<ResultRow[] | null> {
  const config = await getConfig();
  if (!config.results.open && !isAdmin) return null;

  const db = getDb();
  const rows = await db<
    {
      id: string;
      title: string;
      imageUrl: string;
      sourceUrl: string;
      authorName: string;
      notes: string | null;
      rating: number;
      matches: number;
      wins: number;
    }[]
  >`
    SELECT
      s.id,
      s.title,
      s.image_url AS "imageUrl",
      s.source_url AS "sourceUrl",
      u.name AS "authorName",
      s.notes,
      (s.rating + s.adjustment) AS rating,
      s.matches,
      s.wins
    FROM pookalam_submissions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.status = 'approved' AND s.shortlisted = true
    ORDER BY (s.rating + s.adjustment) DESC
  `;

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
  comments: { reviewerName: string; verdict: "like" | "dislike"; comment: string | null }[];
  myVerdict: "like" | "dislike" | null;
  myComment: string | null;
}

export async function listForTesterReview(reviewerId: string): Promise<ReviewEntry[]> {
  const db = getDb();
  const [entries, reviews] = await Promise.all([
    db<
      {
        id: string;
        title: string;
        imageUrl: string;
        sourceUrl: string;
        notes: string | null;
        status: "pending" | "approved" | "rejected";
        shortlisted: boolean;
      }[]
    >`
      SELECT
        id,
        title,
        image_url AS "imageUrl",
        source_url AS "sourceUrl",
        notes,
        status,
        shortlisted
      FROM pookalam_submissions
      WHERE status != 'rejected'
      ORDER BY created_at DESC
    `,
    db<
      {
        submissionId: string;
        reviewerId: string;
        reviewerName: string;
        verdict: "like" | "dislike";
        comment: string | null;
      }[]
    >`
      SELECT
        r.submission_id AS "submissionId",
        r.reviewer_id AS "reviewerId",
        u.name AS "reviewerName",
        r.verdict,
        r.comment
      FROM pookalam_reviews r
      INNER JOIN users u ON u.id = r.reviewer_id
      ORDER BY r.updated_at DESC
    `,
  ]);

  const byEntry = new Map<string, (typeof reviews)[number][]>();
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

export async function setReviewVerdict(
  reviewerId: string,
  submissionId: string,
  verdict: "like" | "dislike",
  comment?: string,
): Promise<void> {
  const trimmed = comment?.trim().slice(0, 500) || null;
  const db = getDb();
  await db`
    INSERT INTO pookalam_reviews (submission_id, reviewer_id, verdict, comment)
    VALUES (${submissionId}, ${reviewerId}, ${verdict}, ${trimmed})
    ON CONFLICT (submission_id, reviewer_id) DO UPDATE
    SET verdict = EXCLUDED.verdict, comment = EXCLUDED.comment, updated_at = NOW()
  `;
}

/* ---------------------------------------------------------------- admin */

export interface AdminRow extends ReviewEntry {
  authorName: string;
  authorEmail: string;
  rating: number;
  adjustment: number;
  adjustmentNote: string | null;
  effectiveRating: number;
  matches: number;
  wins: number;
  reviewNote: string | null;
}

export async function listForAdmin(limit = 100, offset = 0): Promise<AdminRow[]> {
  const db = getDb();
  const [rows, reviews] = await Promise.all([
    db<
      {
        id: string;
        title: string;
        imageUrl: string;
        sourceUrl: string;
        notes: string | null;
        status: "pending" | "approved" | "rejected";
        shortlisted: boolean;
        reviewNote: string | null;
        authorName: string;
        authorEmail: string;
        rating: number;
        adjustment: number;
        adjustmentNote: string | null;
        matches: number;
        wins: number;
      }[]
    >`
      SELECT
        s.id,
        s.title,
        s.image_url AS "imageUrl",
        s.source_url AS "sourceUrl",
        s.notes,
        s.status,
        s.shortlisted,
        s.review_note AS "reviewNote",
        u.name AS "authorName",
        u.email AS "authorEmail",
        s.rating,
        s.adjustment,
        s.adjustment_note AS "adjustmentNote",
        s.matches,
        s.wins
      FROM pookalam_submissions s
      INNER JOIN users u ON u.id = s.user_id
      ORDER BY s.status ASC, s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db<
      {
        submissionId: string;
        reviewerName: string;
        verdict: "like" | "dislike";
        comment: string | null;
      }[]
    >`
      SELECT
        r.submission_id AS "submissionId",
        u.name AS "reviewerName",
        r.verdict,
        r.comment
      FROM pookalam_reviews r
      INNER JOIN users u ON u.id = r.reviewer_id
    `,
  ]);

  const byEntry = new Map<string, (typeof reviews)[number][]>();
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
  const db = getDb();
  const isRejected = status === "rejected";
  const note = reviewNote?.trim().slice(0, 300) || null;

  await db`
    UPDATE pookalam_submissions
    SET
      status = ${status},
      shortlisted = CASE WHEN ${isRejected} THEN false ELSE shortlisted END,
      review_note = ${note},
      reviewed_by = ${adminId},
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${submissionId}
  `;
  await invalidateStandings();
}

const MAX_ADJUSTMENT_STEP = 400;

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
  const updated = await db<
    {
      title: string;
      rating: number;
      adjustment: number;
    }[]
  >`
    UPDATE pookalam_submissions
    SET
      adjustment = adjustment + ${delta},
      adjustment_note = ${note.slice(0, 300)},
      updated_at = NOW()
    WHERE id = ${submissionId}
    RETURNING title, rating, adjustment
  `;
  const row = updated[0];
  if (!row) throw new Error("That entry no longer exists.");

  await logActivity({
    userId: adminId,
    eventType: "pookalam_rating_adjusted",
    meta: {
      submissionId,
      title: row.title,
      delta,
      rawRating: row.rating,
      adjustmentAfter: row.adjustment,
      effectiveAfter: row.rating + row.adjustment,
      reason: note,
    },
  });
  await invalidateStandings();
}

export async function setShortlisted(
  adminId: string,
  submissionId: string,
  shortlisted: boolean,
): Promise<void> {
  const db = getDb();
  await db`
    UPDATE pookalam_submissions
    SET
      shortlisted = ${shortlisted},
      status = CASE WHEN ${shortlisted} THEN 'approved' ELSE status END,
      reviewed_by = CASE WHEN ${shortlisted} THEN ${adminId} ELSE reviewed_by END,
      reviewed_at = CASE WHEN ${shortlisted} THEN NOW() ELSE reviewed_at END,
      updated_at = NOW()
    WHERE id = ${submissionId}
  `;
  await invalidateStandings();
}

export async function autoShortlist(adminId: string, count: number): Promise<number> {
  const db = getDb();
  const limitCount = Math.max(1, Math.min(64, count));

  const scores = await db<{ id: string; net: number; likes: number }[]>`
    SELECT
      s.id,
      COALESCE(SUM(CASE WHEN r.verdict = 'like' THEN 1 WHEN r.verdict = 'dislike' THEN -1 ELSE 0 END), 0)::int AS net,
      COALESCE(SUM(CASE WHEN r.verdict = 'like' THEN 1 ELSE 0 END), 0)::int AS likes
    FROM pookalam_submissions s
    LEFT JOIN pookalam_reviews r ON r.submission_id = s.id
    WHERE s.status = 'approved'
    GROUP BY s.id, s.created_at
    ORDER BY net DESC, likes DESC, s.created_at DESC
    LIMIT ${limitCount}
  `;

  const ids = scores.map((row) => row.id);
  await db`
    UPDATE pookalam_submissions
    SET shortlisted = false, updated_at = NOW()
    WHERE shortlisted = true
  `;
  if (ids.length > 0) {
    await db`
      UPDATE pookalam_submissions
      SET
        shortlisted = true,
        reviewed_by = ${adminId},
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = ANY(${ids})
    `;
  }
  await invalidateStandings();
  return ids.length;
}
