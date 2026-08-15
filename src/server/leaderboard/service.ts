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
  const filters = [
    eq(dailyLeaderboard.gameId, gameId),
    eq(dailyLeaderboard.isFlagged, false),
    eq(users.banLevel, 0),
    or(isNull(users.banUntil), lt(users.banUntil, now)),
    includeTesters ? undefined : ne(users.role, "tester"),
  ];
  const rankingOrder =
    metric === "score"
      ? sql`${dailyLeaderboard.score} desc, ${dailyLeaderboard.startedAt} asc`
      : metric === "fcfs"
        ? sql`${dailyLeaderboard.submittedAt} asc, ${dailyLeaderboard.startedAt} asc`
        : sql`${dailyLeaderboard.durationMs} asc, ${dailyLeaderboard.startedAt} asc`;

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
      rank: sql<number>`row_number() over (order by ${rankingOrder})`,
      fieldSize: sql<number>`count(*) over ()`,
    })
    .from(dailyLeaderboard)
    .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
    .where(and(...filters))
    .orderBy(
      // FCFS ranks by who submitted first; the others by their own metric.
      metric === "score"
        ? desc(dailyLeaderboard.score)
        : metric === "fcfs"
          ? asc(dailyLeaderboard.submittedAt)
          : asc(dailyLeaderboard.durationMs),
      asc(dailyLeaderboard.startedAt),
    )
    .limit(limit);

  const settled = !!game?.settledAt;
  const fieldSize = rows[0]?.fieldSize ?? 0;

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

  const entries = rows.map((row) => toEntry(row, row.rank));

  const myRow = viewerUserId ? rows.find((row) => row.userId === viewerUserId) : undefined;
  let myEntry = myRow ? toEntry(myRow, myRow.rank) : null;
  if (!myEntry && viewerUserId) {
    const [viewerRow] = await db
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
      .where(and(...filters, eq(dailyLeaderboard.userId, viewerUserId)))
      .limit(1);
    if (viewerRow) {
      const ahead =
        metric === "score"
          ? or(
              sql`${dailyLeaderboard.score} > ${viewerRow.score}`,
              and(
                sql`${dailyLeaderboard.score} = ${viewerRow.score}`,
                sql`${dailyLeaderboard.startedAt} < ${viewerRow.startedAt}`,
              ),
            )
          : metric === "fcfs"
            ? or(
                sql`${dailyLeaderboard.submittedAt} < ${viewerRow.submittedAt}`,
                and(
                  sql`${dailyLeaderboard.submittedAt} = ${viewerRow.submittedAt}`,
                  sql`${dailyLeaderboard.startedAt} < ${viewerRow.startedAt}`,
                ),
              )
            : or(
                sql`${dailyLeaderboard.durationMs} < ${viewerRow.durationMs}`,
                and(
                  sql`${dailyLeaderboard.durationMs} = ${viewerRow.durationMs}`,
                  sql`${dailyLeaderboard.startedAt} < ${viewerRow.startedAt}`,
                ),
              );
      const [rankRow] = await db
        .select({ rank: sql<number>`count(*)::int + 1` })
        .from(dailyLeaderboard)
        .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
        .where(and(...filters, ahead));
      myEntry = toEntry({ ...viewerRow, rank: rankRow?.rank ?? 1, fieldSize }, rankRow?.rank ?? 1);
    }
  }

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
  const [row] = await db
    .select({
      p99: sql<number>`percentile_cont(0.99) within group (order by ${dailyLeaderboard.durationMs})`,
    })
    .from(dailyLeaderboard)
    .where(
      and(
        eq(dailyLeaderboard.gameId, gameId),
        eq(dailyLeaderboard.isFlagged, false),
        sql`${dailyLeaderboard.durationMs} is not null`,
        sql`${dailyLeaderboard.durationMs} > 0`,
      ),
    );
  return Math.max(Math.round(row?.p99 ?? 1), 1);
}
