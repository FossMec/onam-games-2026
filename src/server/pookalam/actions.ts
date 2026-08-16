"use server";

import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import {
  getCurrentUser,
  requireAdmin,
  requireCurrentUser,
  requireReviewer,
} from "~/server/auth/service";
import {
  type SubmissionInput,
  adjustRating,
  autoShortlist,
  castVote,
  countMyVotes,
  getConfig,
  getEntrantStandings,
  getGates,
  getMySubmission,
  getMyVotingProgress,
  getResults,
  getVoterStandings,
  listForAdmin,
  listForTesterReview,
  nextPair,
  reviewSubmission,
  setReviewVerdict,
  setShortlisted,
  upsertSubmission,
} from "./service";

/**
 * Server actions for Code-a-Pookalam.
 *
 * Every mutation re-derives the caller from the session and re-reads the phase
 * windows; nothing here trusts an id, a flag or a timestamp from the page. Ban
 * level gates entering and voting on the same rule as playing a game - someone
 * benched for cheating does not get to keep influencing the outcome.
 */

/** Phases as the browser needs them: booleans plus the instants for countdowns. */
function publicPhases(config: Awaited<ReturnType<typeof getConfig>>) {
  const phase = (state: (typeof config)["submissions"]) => ({
    open: state.open,
    reason: state.reason,
    opensAt: state.opensAt?.toISOString() ?? null,
    closesAt: state.closesAt?.toISOString() ?? null,
  });
  return {
    submissions: phase(config.submissions),
    voting: phase(config.voting),
    results: phase(config.results),
  };
}

export async function getPookalamState() {
  const user = await getCurrentUser();
  const config = await getConfig();
  return {
    phases: publicPhases(config),
    // Kept for the pages that only ask "is it open".
    gates: {
      submissionsOpen: config.submissions.open,
      votingOpen: config.voting.open,
      resultsPublic: config.results.open,
    },
    aspectTolerancePct: config.aspectTolerancePct,
    signedIn: !!user,
    isReviewer: user?.role === "tester" || user?.role === "admin",
    mine: user ? await getMySubmission(user.id) : null,
    votesCast: user ? await countMyVotes(user.id) : 0,
  };
}

export async function submitPookalam(input: SubmissionInput) {
  const user = await requireCurrentUser();
  assertCanPlay(user);
  /*
   * Tighter than the old limit because a submission now carries up to a
   * megabyte of image and does real work: decode, verify, upload. Ten of those
   * a minute from one account is already generous for someone iterating on a
   * render.
   */
  const limit = await checkRateLimit({
    key: `pookalam:submit:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (limit.unavailable) throw new Error("Rate limiter unavailable");
  if (!limit.success) throw new Error("Slow down a moment.");
  await upsertSubmission(user.id, input);
  return getMySubmission(user.id);
}

export async function getNextPair() {
  const user = await requireCurrentUser();
  assertCanPlay(user);
  const gates = await getGates();
  if (!gates.votingOpen) return null;
  return nextPair(user.id);
}

export async function votePookalam(winnerId: string, loserId: string) {
  const user = await requireCurrentUser();
  assertCanPlay(user);
  /*
   * A vote is one tap, so a genuine voter fires these in bursts - the limit is
   * only here to stop a script walking every pair in a second. The real
   * one-vote-per-pair guarantee is the unique index, not this.
   */
  const limit = await checkRateLimit({
    key: `pookalam:vote:${user.id}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (limit.unavailable) return { ok: false, reason: "Rate limiter unavailable." };
  if (!limit.success) return { ok: false, reason: "Too fast. Look at them properly." };
  return castVote(user.id, winnerId, loserId);
}

export async function getMyProgress() {
  const user = await getCurrentUser();
  if (!user) return null;
  return getMyVotingProgress(user.id);
}

/* ----------------------------------------------------------- day 7 boards */

/**
 * Day 7's boards.
 *
 * WHILE VOTING IS OPEN THIS SENDS NO ARTWORK.
 *
 * Ranks, Elo and names all go out live - what does not is `imageUrl`, and that
 * one omission is the whole safeguard. The bandwagon to avoid is a voter
 * recognising one of the two pictures in front of them as the current leader,
 * which needs a rank-to-image mapping; without the artwork there is nothing to
 * match against, so the pair stays as blind as it ever was.
 *
 * Enforced by not fetching it rather than by not rendering it. A server action
 * is an HTTP endpoint, and "the page doesn't show it" is not privacy - anyone
 * can call this directly and read the JSON.
 *
 * Artwork joins the ranking only once results are public, at which point there
 * is no vote left to influence.
 */
export async function getArenaBoards() {
  const config = await getConfig();
  if (!config.voting.open && !config.results.open) {
    return null;
  }
  const [entrants, voters] = await Promise.all([getEntrantStandings(), getVoterStandings()]);
  return {
    votingOpen: config.voting.open,
    resultsPublic: config.results.open,
    entrants,
    voters,
    results: config.results.open ? await getResults(false) : null,
  };
}

export async function getPookalamResults() {
  const user = await getCurrentUser();
  return getResults(user?.role === "admin");
}

/** Results plus the final voters' board, for the closing page. */
export async function getFinalResults() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const results = await getResults(isAdmin);
  if (!results) return null;
  return { results, voters: await getVoterStandings() };
}

/* -------------------------------------------------- tester shortlisting */

/**
 * Whether the caller may see the shortlisting gallery, and at what level.
 *
 * Lets `/admin` render one Pookalam tab for both roles rather than bouncing
 * testers off the whole page: an admin gets the queue with author names and the
 * approve/shortlist controls, a tester gets the anonymous gallery and a verdict
 * button. Returns a shape instead of throwing because the page asks this to
 * decide what to draw, not to guard a mutation - the mutations guard themselves.
 */
export async function getReviewAccess() {
  const user = await getCurrentUser();
  return {
    isReviewer: user?.role === "tester" || user?.role === "admin",
    isAdmin: user?.role === "admin",
  };
}

export async function reviewerListPookalams() {
  const user = await requireReviewer();
  return listForTesterReview(user.id);
}

export async function reviewerSetVerdict(
  submissionId: string,
  verdict: "like" | "dislike",
  comment?: string,
) {
  const user = await requireReviewer();
  const limit = await checkRateLimit({
    key: `pookalam:review:${user.id}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limit.unavailable) throw new Error("Rate limiter unavailable");
  if (!limit.success) throw new Error("Slow down a moment.");
  await setReviewVerdict(user.id, submissionId, verdict, comment);
  return listForTesterReview(user.id);
}

/**
 * The current user's entry, for the shortlist notice.
 *
 * Returns the fields a shortlisted entrant needs to see the announcement and
 * the admin's note - nothing else. Reuses `getMySubmission`, so the note rides
 * along on the same query rather than costing an extra round trip. Null when
 * the caller has no entry or is signed out.
 */
export async function getMyPookalamNotice() {
  const user = await getCurrentUser();
  if (!user) return null;
  const mine = await getMySubmission(user.id);
  if (!mine) return null;
  return {
    title: mine.title,
    imageUrl: mine.imageUrl,
    status: mine.status,
    shortlisted: mine.shortlisted,
    reviewNote: mine.reviewNote,
  };
}

/* ---------------------------------------------------------------- admin */

export async function adminListPookalams(page = 0) {
  await requireAdmin();
  return listForAdmin(100, Math.max(0, page) * 100);
}

export async function adminReviewPookalam(
  submissionId: string,
  status: "approved" | "rejected",
  reviewNote?: string,
) {
  const admin = await requireAdmin();
  await reviewSubmission(admin.id, submissionId, status, reviewNote);
  return listForAdmin();
}

export async function adminSetShortlisted(submissionId: string, shortlisted: boolean) {
  const admin = await requireAdmin();
  await setShortlisted(admin.id, submissionId, shortlisted);
  return listForAdmin();
}

/**
 * Corrects one entry's score. Reason is mandatory and goes to `activity_logs`.
 *
 * Deliberately not rate-limited into uselessness but still limited: this is the
 * single most abusable action in the app, and a compromised admin session
 * walking every entry down 400 points at a time should hit a wall.
 */
export async function adminAdjustRating(submissionId: string, delta: number, reason: string) {
  const admin = await requireAdmin();
  const limit = await checkRateLimit({
    key: `pookalam:adjust:${admin.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (limit.unavailable) throw new Error("Rate limiter unavailable");
  if (!limit.success) throw new Error("Too many adjustments at once. Slow down.");
  await adjustRating(admin.id, submissionId, delta, reason);
  return listForAdmin();
}

/** Seeds the shortlist from tester verdicts. The admin edits it afterwards. */
export async function adminAutoShortlist(count?: number) {
  const admin = await requireAdmin();
  const config = await getConfig();
  const picked = await autoShortlist(admin.id, count ?? config.shortlistSize);
  return { picked, rows: await listForAdmin() };
}
