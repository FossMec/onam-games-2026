import { query } from "@solidjs/router";
import { getCurrentUser } from "~/server/auth/service";
import { getMyAttemptBySlug } from "./attempts";
import type { ViewerRole } from "./service";
import { getGameBySlug, getGamesList } from "./service";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (user?.role === "tester" || user?.role === "admin") return user.role;
  return "player";
}

export const getGames = query(async () => {
  "use server";
  const user = await getCurrentUser();
  return getGamesList(viewerRole(user));
}, "games:list");

export async function getGame(slug: string) {
  const user = await getCurrentUser();
  return getGameBySlug(slug, viewerRole(user));
}

export async function getMyAttempt(slug: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return getMyAttemptBySlug(slug, user.id);
}
