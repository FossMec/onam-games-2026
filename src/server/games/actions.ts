"use server";

import { getCurrentUser } from "~/server/auth/service";
import { getMyAttemptBySlug, getMyRecapBySlug, type TinderRecap } from "./attempts";
import type { ViewerRole } from "./service";
import { getGameBySlug, getGamesList, type GameCard } from "./service";
import { readOrDegrade } from "~/server/degrade";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (!user?.role) return "player";
  return user.role;
}

/**
 * The seven-day schedule.
 *
 * Degrades to an empty list, which the landing page and the leaderboard both
 * read as "the schedule is unavailable" rather than "there are no games" — the
 * distinction matters, because an empty list must never be dressed up as a
 * real festival week.
 */
export async function getGames(): Promise<GameCard[]> {
  return readOrDegrade<GameCard[]>("games.list", [], async () => {
    const user = await getCurrentUser();
    return getGamesList(viewerRole(user));
  });
}

export async function getGame(slug: string) {
  const user = await getCurrentUser();
  return getGameBySlug(slug, viewerRole(user));
}

export async function getMyAttempt(slug: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return getMyAttemptBySlug(slug, user.id, viewerRole(user));
}

/**
 * The answer key for a game the caller has already finished.
 *
 * Gated on their own submitted attempt, and derived from *that attempt's* seed
 * — so it can only ever reveal the deck they personally played, and only once
 * playing it is over. It is what makes a finished board worth coming back to:
 * every card, what it actually was, and why.
 *
 * Only Tinder has a reveal worth showing; the other games' finished boards are
 * the player's own moves, which they already have locally.
 */
export async function getMyRecap(slug: string): Promise<TinderRecap | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getMyRecapBySlug(slug, user.id);
}
