"use server";

import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { getCurrentUser, requireCurrentUser } from "~/server/auth/service";
import {
  MAX_STROKE,
  type StrokeResult,
  getCollabState,
  getTodayGrid,
  placeFlower,
  placeStroke,
} from "./collab";

/**
 * Server actions for the shared pookalam.
 *
 * Reading is open to anyone — the drawing is the point, and a signed-out
 * visitor should see what the room has made. Placing needs an account, which is
 * the only real gate here: without one there is no rate-limit key and no ban to
 * check, and a communal canvas anybody on the internet can write to is a
 * communal canvas that gets a slur drawn on it by lunchtime.
 */

export async function getCollabPookalam() {
  const user = await getCurrentUser();
  return getCollabState(!!user);
}

/** Just today's grid — what the poll asks for, so it stays cheap. */
export async function getCollabGrid() {
  return getTodayGrid();
}

export async function placeCollabFlower(index: number, flowerId: number) {
  const user = await requireCurrentUser();
  assertCanPlay(user);

  /*
   * Generous, because placing is one tap and people work in bursts — a run of
   * petals along an arc is a dozen taps in a few seconds and is exactly the
   * behaviour we want. This is here to stop a script filling 2500 cells, not to
   * pace a human.
   *
   * Note this is the *only* server-side limit. The daily allowance is counted
   * in the browser by design; see `collab.daily_flowers`.
   */
  const limit = await checkRateLimit({
    key: `collab:place:${user.id}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limit.unavailable) return { ok: false as const, reason: "Rate limiter unavailable." };
  if (!limit.success) {
    return { ok: false as const, reason: "Slow down — let the flowers settle." };
  }

  return placeFlower(index, flowerId);
}

/**
 * A whole drag in one call.
 *
 * Rate-limited per *stroke* rather than per flower, which is the only way a
 * drag can work at all — a line across the canvas is fifty cells, and fifty
 * requests would trip the limiter halfway and leave the line unfinished.
 */
export async function placeCollabStroke(
  cells: { index: number; flowerId: number }[],
): Promise<StrokeResult> {
  const user = await requireCurrentUser();
  assertCanPlay(user);

  /*
   * Every path returns the current grid, including the refusals.
   *
   * The client treats this reply as the truth and paints whatever comes back,
   * so a branch that omitted it would blank the canvas — and a rate-limited
   * player is exactly the person who should still see what everyone else has
   * been adding while they were told to wait.
   */
  const refuse = async (reason?: string): Promise<StrokeResult> => {
    const current = await getTodayGrid();
    return { written: [], placed: current.placed, cells: current.cells, reason };
  };

  if (!Array.isArray(cells) || cells.length === 0) return refuse();

  const limit = await checkRateLimit({
    key: `collab:stroke:${user.id}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (limit.unavailable) return refuse("Rate limiter unavailable.");
  if (!limit.success) return refuse("Slow down — let the flowers settle.");

  return placeStroke(cells.slice(0, MAX_STROKE));
}
