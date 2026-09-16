"use server";

import { getCurrentUser } from "~/server/auth/service";
import type { ViewerRole } from "~/server/games/service";
import {
  getDailyLeaderboard,
  getMyStanding as getMyStandingService,
  type LeaderboardScope,
} from "./service";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (!user?.role) return "player";
  return user.role;
}

export async function getDaily(
  gameId: string,
  viewMode: "main" | "tester" = "main",
  page = 1,
  pageSize = 50,
  board: LeaderboardScope = "open",
) {
  const user = await getCurrentUser();
  return getDailyLeaderboard(
    gameId,
    viewerRole(user),
    user?.id ?? null,
    viewMode,
    page,
    pageSize,
    board,
  );
}

export interface MyStanding {
  rank: number;
  fieldSize: number;
}

/**
 * Just the caller's own position on a day's board.
 *
 * The share card needs a rank and a field size and nothing else. This asks the
 * leaderboard service directly for those two values in one query - no page
 * slice is fetched, and the ranking rules live in exactly one place.
 */
export async function getMyStanding(gameId: string): Promise<MyStanding | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = viewerRole(user);
  // A guest's standing lives on the open board; a real account's on the event
  // board. Picking by who they actually are keeps the share card honest.
  const board: LeaderboardScope = user.isGuest ? "open" : "event";
  // Testers and admins are kept off the main board, so their own standing only
  // exists on the tester view.
  return getMyStandingService(gameId, role, user.id, board);
}
