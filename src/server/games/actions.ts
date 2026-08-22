"use server";

import { getCurrentUser } from "~/server/auth/service";
import { getMyAttemptBySlug, getMyRecapBySlug, type TinderRecap } from "./attempts";
import type { ViewerRole } from "./service";
import { getGameBySlug, getGamesList, type GameCard } from "./service";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (!user?.role) return "player";
  return user.role;
}

/**
 * The seven-day schedule.
 * real festival week.
 */
export async function getGames(): Promise<GameCard[]> {
  try {
    const user = await getCurrentUser();
    return await getGamesList(viewerRole(user));
  } catch {
    return [];
  }
}

export async function getGame(slug: string): Promise<GameCard | null> {
  try {
    const user = await getCurrentUser();
    return await getGameBySlug(slug, viewerRole(user));
  } catch {
    return null;
  }
}

export async function getMyAttempt(slug: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return await getMyAttemptBySlug(slug, user.id, viewerRole(user));
  } catch {
    return null;
  }
}

/**
 * The answer key for a game the caller has already finished.
 *
 * Gated on their own submitted attempt, and derived from *that attempt's* seed
 * - so it can only ever reveal the deck they personally played, and only once
 * playing it is over. It is what makes a finished board worth coming back to:
 * every card, what it actually was, and why.
 *
 * Only Tinder has a reveal worth showing; the other games' finished boards are
 * the player's own moves, which they already have locally.
 */
export async function getMyRecap(slug: string): Promise<TinderRecap | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getMyRecapBySlug(slug, user.id, viewerRole(user));
}
