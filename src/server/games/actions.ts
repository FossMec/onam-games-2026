"use server";

import { getCurrentUser } from "~/server/auth/service";
import { getMyAttemptBySlug, getMyRecapBySlug, type TinderRecap } from "./attempts";
import type { ViewerRole } from "./service";
import { getGameBySlug, getGamesList } from "./service";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (user?.role === "tester" || user?.role === "admin") return user.role;
  return "player";
}

export async function getGames() {
  const user = await getCurrentUser();
  return getGamesList(viewerRole(user));
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
