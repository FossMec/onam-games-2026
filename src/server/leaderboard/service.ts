import { and, asc, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { dailyLeaderboard, games, users } from "~/server/db/schema";
import type { GameMetric } from "~/server/games/registry";
import { getGameDefByType } from "~/server/games/registry";
import type { ViewerRole } from "~/server/games/service";
import { pointsForRank } from "./settle";

export interface DailyEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  college: string | null;
  branch: string | null;
  batch: string | null;
  streakCount: number;
  /** Which of `durationMs` / `score` is the ranking value for this board. */
  metric: GameMetric;
  durationMs: number | null;
  score: number | null;
  /** The ranking value for `fcfs` boards — "finished at" wall-clock time. */
  submittedAt: string;
  attemptsUsed: number;
  /** Settled points, or the provisional value while the day is still open. */
  points: number;
  isProvisional: boolean;
  isTester: boolean;
  isMe: boolean;
}

export interface DailyBoard {
  metric: GameMetric;
  /** UI label for the ranking column, e.g. "Time" or "Height". */
  metricLabel: string;
  fieldSize: number;
  settled: boolean;
  entries: DailyEntry[];
  myEntry: DailyEntry | null;
}

export function metricLabel(metric: GameMetric): string {
  switch (metric) {
    case "score":
      return "Height";
    case "fcfs":
      return "Finished at";
    default:
      return "Time";
  }
}

/**
 * A day's board, ranked in the game's own units.
 */
export async function getDailyLeaderboard(
  gameId: string,
  viewerRole: ViewerRole,
  viewerUserId: string | null,
  limit = 50,
): Promise<DailyBoard> {
  const db = getDb();
  const [game] = await db
    .select({ gameType: games.gameType, settledAt: games.settledAt })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  const metric: GameMetric = game ? (getGameDefByType(game.gameType)?.metric ?? "time") : "time";
  const includeTesters = viewerRole !== "player";
  const now = new Date();

  const rows = await db
    .select({
      userId: dailyLeaderboard.userId,
      durationMs: dailyLeaderboard.durationMs,
      score: dailyLeaderboard.score,
      attemptsUsed: dailyLeaderboard.attemptsUsed,
      points: dailyLeaderboard.points,
      startedAt: dailyLeaderboard.startedAt,
      submittedAt: dailyLeaderboard.submittedAt,
      name: users.name,
      avatarUrl: users.avatarUrl,
      college: users.college,
      branch: users.branch,
      batch: users.batch,
      streakCount: users.streakCount,
      role: users.role,
    })
    .from(dailyLeaderboard)
    .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
    .where(
      and(
        eq(dailyLeaderboard.gameId, gameId),
        eq(dailyLeaderboard.isFlagged, false),
        eq(users.banLevel, 0),
        or(isNull(users.banUntil), lt(users.banUntil, now)),
        includeTesters ? undefined : ne(users.role, "tester"),
      ),
    )
    .orderBy(
      // FCFS ranks by who submitted first; the others by their own metric.
      metric === "score"
        ? desc(dailyLeaderboard.score)
        : metric === "fcfs"
          ? asc(dailyLeaderboard.submittedAt)
          : asc(dailyLeaderboard.durationMs),
      asc(dailyLeaderboard.startedAt),
    );

  const settled = !!game?.settledAt;
  const fieldSize = rows.length;

  const toEntry = (row: (typeof rows)[number], rank: number): DailyEntry => ({
    rank,
    userId: row.userId,
    name: row.name,
    avatarUrl: row.avatarUrl,
    college: row.college,
    branch: row.branch,
    batch: row.batch,
    streakCount: row.streakCount,
    metric,
    durationMs: row.durationMs,
    score: row.score,
    submittedAt: row.submittedAt.toISOString(),
    attemptsUsed: row.attemptsUsed,
    // While the day is open, points are shown as a live projection so a player
    // can see what their rank is worth — but only the settled value is stored,
    // so nobody's banked total ever moves after the fact.
    points: row.points ?? pointsForRank(rank, fieldSize),
    isProvisional: row.points === null,
    isTester: row.role === "tester",
    isMe: row.userId === viewerUserId,
  });

  const entries = rows.slice(0, limit).map((row, index) => toEntry(row, index + 1));

  const myIndex = viewerUserId ? rows.findIndex((r) => r.userId === viewerUserId) : -1;
  const myEntry = myIndex >= 0 ? toEntry(rows[myIndex], myIndex + 1) : null;

  return {
    metric,
    metricLabel: metricLabel(metric),
    fieldSize,
    settled,
    entries,
    myEntry,
  };
}

// Global leaderboard removed in favor of daily leaderboards.

/**
 * Per-day points breakdown for one player — the "why is my total that number"
 * view. Six chips under the global board beats an unexplained integer.
 */
export async function getMyPointsBreakdown(
  userId: string,
): Promise<{ day: number; title: string; rank: number | null; points: number | null }[]> {
  const db = getDb();
  const rows = await db
    .select({
      day: games.day,
      title: games.title,
      rank: dailyLeaderboard.rank,
      points: dailyLeaderboard.points,
    })
    .from(dailyLeaderboard)
    .innerJoin(games, eq(games.id, dailyLeaderboard.gameId))
    .where(and(eq(dailyLeaderboard.userId, userId), eq(dailyLeaderboard.isFlagged, false)))
    .orderBy(asc(games.day));
  return rows;
}

/** Kept for anti-cheat callers that still want a slow-tail anchor. */
export async function getGameP99(gameId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ durationMs: dailyLeaderboard.durationMs })
    .from(dailyLeaderboard)
    .where(
      and(
        eq(dailyLeaderboard.gameId, gameId),
        eq(dailyLeaderboard.isFlagged, false),
        sql`${dailyLeaderboard.durationMs} is not null`,
      ),
    );
  const durations = rows
    .map((r) => r.durationMs ?? 0)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  if (durations.length === 0) return 1;
  if (durations.length <= 5) return Math.max(durations[durations.length - 1], 1);
  return Math.max(durations[Math.floor(0.99 * (durations.length - 1))], 1);
}
