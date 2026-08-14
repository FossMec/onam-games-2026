"use server";

import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { getCurrentUser, requireAdmin, requireCurrentUser } from "~/server/auth/service";
import {
  type SubmissionInput,
  castVote,
  countMyVotes,
  getGates,
  getMySubmission,
  getResults,
  listForReview,
  nextPair,
  reviewSubmission,
  upsertSubmission,
} from "./service";

/**
 * Server actions for Code-a-Pookalam.
 *
 * Every mutation re-derives the caller from the session and re-reads the admin
 * gates; nothing here trusts an id or a flag from the page. Ban level gates
 * both entering and voting, on the same rule as playing a game — someone banned
 * for cheating does not get to keep influencing the outcome.
 */

export async function getPookalamState() {
  const user = await getCurrentUser();
  const gates = await getGates();
  return {
    gates,
    signedIn: !!user,
    mine: user ? await getMySubmission(user.id) : null,
    votesCast: user ? await countMyVotes(user.id) : 0,
  };
}

export async function submitPookalam(input: SubmissionInput) {
  const user = await requireCurrentUser();
  assertCanPlay(user);
  const limit = await checkRateLimit({
    key: `pookalam:submit:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
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
   * A vote is one tap, so a genuine voter fires these in bursts — the limit is
   * only here to stop a script walking every pair in a second. The real
   * one-vote-per-pair guarantee is the unique index, not this.
   */
  const limit = await checkRateLimit({
    key: `pookalam:vote:${user.id}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.success) return { ok: false, reason: "Too fast. Look at them properly." };
  return castVote(user.id, winnerId, loserId);
}

export async function getPookalamResults() {
  const user = await getCurrentUser();
  return getResults(user?.role === "admin");
}

/* ---------------------------------------------------------------- admin */

export async function adminListPookalams() {
  await requireAdmin();
  return listForReview();
}

export async function adminReviewPookalam(
  submissionId: string,
  status: "approved" | "rejected",
  reviewNote?: string,
) {
  const admin = await requireAdmin();
  await reviewSubmission(admin.id, submissionId, status, reviewNote);
  return listForReview();
}
