"use server";

import { getCurrentUser } from "~/server/auth/service";
import type { ViewerRole } from "~/server/games/service";
import { getDailyLeaderboard, getGlobalLeaderboard } from "./service";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (user?.role === "tester" || user?.role === "admin") return user.role;
  return "player";
}

export async function getDaily(gameId: string) {
  const user = await getCurrentUser();
  return getDailyLeaderboard(gameId, viewerRole(user), user?.id ?? null);
}

export async function getGlobal() {
  const user = await getCurrentUser();
  return getGlobalLeaderboard(viewerRole(user), user?.id ?? null);
}
