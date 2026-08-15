"use server";

import { getCurrentUser } from "~/server/auth/service";
import type { ViewerRole } from "~/server/games/service";
import { getDailyLeaderboard } from "./service";

function viewerRole(user: { role?: "player" | "tester" | "admin" } | null): ViewerRole {
  if (user?.role === "tester" || user?.role === "admin") return user.role;
  return "player";
}

export async function getDaily(
  gameId: string,
  viewMode: "main" | "tester" = "main",
  page = 1,
  pageSize = 50,
) {
  const user = await getCurrentUser();
  return getDailyLeaderboard(gameId, viewerRole(user), user?.id ?? null, viewMode, page, pageSize);
}

export interface MyStanding {
  rank: number;
  fieldSize: number;
  points: number;
}

/**
 * Just the caller's own position on a day's board.
 *
 * The share card needs a rank and a field size and nothing else, so it asks
 * for the board with `limit = 1`: `myEntry` is computed for the viewer whether
 * or not they are in the returned slice, and `fieldSize` comes from a
 * `count(*) over ()` evaluated before the limit. One query's worth of work
 * instead of fifty rows over the wire, with no second copy of the ranking
 * rules to keep in step.
 */
export async function getMyStanding(gameId: string): Promise<MyStanding | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = viewerRole(user);
  // Testers and admins are kept off the main board, so their own standing only
  // exists on the tester view — ask for the board they are actually ranked on.
  const viewMode = role === "player" ? "main" : "tester";
  const board = await getDailyLeaderboard(gameId, role, user.id, viewMode, 1);
  if (!board.myEntry) return null;
  return {
    rank: board.myEntry.rank,
    fieldSize: board.fieldSize,
    points: board.myEntry.points,
  };
}
