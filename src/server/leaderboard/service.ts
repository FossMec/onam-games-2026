import { and, asc, eq, lt, ne, or, sql } from "drizzle-orm";
import { getDb, type Db } from "~/server/db/client";
import { dailyLeaderboard, games, users } from "~/server/db/schema";
import type { GameMetric } from "~/server/games/registry";
import { getGameDefByType } from "~/server/games/registry";
import type { ViewerRole } from "~/server/games/service";

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
  isTester: boolean;
  isMe: boolean;
}

export interface DailyBoard {
  metric: GameMetric;
  /** UI label for the ranking column, e.g. "Time" or "Height". */
  metricLabel: string;
  fieldSize: number;
  entries: DailyEntry[];
  myEntry: DailyEntry | null;
  page: number;
  pageSize: number;
  totalPages: number;
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
  viewMode: "main" | "tester" = "main",
  page = 1,
  pageSize = 50,
): Promise<DailyBoard> {
  const db = getDb();
  const [game] = await db
    .select({ gameType: games.gameType })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  const metric: GameMetric = game ? (getGameDefByType(game.gameType)?.metric ?? "time") : "time";
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const ranked = rankedBoard(db, gameId, viewerRole, viewMode, metric);
  const inSlice = and(
    sql`${ranked.rank} > ${offset}`,
    sql`${ranked.rank} <= ${offset + safePageSize}`,
  );
  const rows = await db
    .with(ranked)
    .select()
    .from(ranked)
    .where(viewerUserId ? or(inSlice, eq(ranked.userId, viewerUserId)) : inSlice)
    .orderBy(asc(ranked.rank));

  const fieldSize = rows[0]?.fieldSize ?? 0;
  const totalPages = Math.max(1, Math.ceil(fieldSize / safePageSize));

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
    isTester: row.role === "tester",
    isMe: row.userId === viewerUserId,
  });

  const entries = rows
    .filter((row) => row.rank > offset && row.rank <= offset + safePageSize)
    .map((row) => toEntry(row, row.rank));

  const myRow = viewerUserId ? rows.find((row) => row.userId === viewerUserId) : undefined;
  const myEntry = myRow ? toEntry(myRow, myRow.rank) : null;

  return {
    metric,
    metricLabel: metricLabel(metric),
    fieldSize,
    entries,
    myEntry,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

/**
 * The window-function core both board reads share. Every row of the filtered
 * field gets its true global rank and the full field size before any
 * LIMIT/OFFSET, so a viewer's own position is known no matter which page they
 * asked for — the caller then filters out the slice (or the viewer) it wants.
 */
function rankedBoard(
  db: Db,
  gameId: string,
  viewerRole: ViewerRole,
  viewMode: "main" | "tester",
  metric: GameMetric,
) {
  return db.$with("ranked").as(
    db
      .select({
        userId: dailyLeaderboard.userId,
        durationMs: dailyLeaderboard.durationMs,
        score: dailyLeaderboard.score,
        attemptsUsed: dailyLeaderboard.attemptsUsed,
        startedAt: dailyLeaderboard.startedAt,
        submittedAt: dailyLeaderboard.submittedAt,
        name: users.name,
        avatarUrl: users.avatarUrl,
        college: users.college,
        branch: users.branch,
        batch: users.batch,
        streakCount: users.streakCount,
        role: users.role,
        rank: sql<number>`row_number() over (order by ${rankingOrder(metric)})`,
        fieldSize: sql<number>`count(*) over ()`,
      })
      .from(dailyLeaderboard)
      .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
      .where(and(...boardConditions(gameId, viewerRole, viewMode))),
  );
}

function boardConditions(gameId: string, viewerRole: ViewerRole, viewMode: "main" | "tester") {
  return [
    eq(dailyLeaderboard.gameId, gameId),
    eq(dailyLeaderboard.isFlagged, false),
    /*
     * Only a hard ban takes a run off the board.
     *
     * This used to demand `banLevel = 0`, which quietly deleted anyone holding
     * a level-1 *warning* from every board — and a warning is explicitly the
     * level that "costs an honest player nothing" (`auth/bans.ts`), handed out
     * for things as innocent as sharing a hostel's NAT IP. The player was told
     * their run counted, the run was verified, and then it was nowhere, with no
     * message explaining why.
     *
     * Levels 2 and 3 stay visible too. They are a timed bench on *playing*, and
     * the ban notice itself promises "the leaderboard is still yours to watch";
     * hiding an already-earned score for three hours and then restoring it
     * reads as a bug from every direction. Level 4 is the only level that means
     * "out of the games", and the rest of the codebase already uses `>= 4` as
     * the line — this was the one place that disagreed.
     */
    lt(users.banLevel, 4),
    viewerRole === "player" || viewMode === "main"
      ? and(ne(users.role, "tester"), ne(users.role, "admin"))
      : or(eq(users.role, "tester"), eq(users.role, "admin")),
  ];
}

function rankingOrder(metric: GameMetric) {
  return metric === "score"
    ? sql`${dailyLeaderboard.score} desc, ${dailyLeaderboard.startedAt} asc`
    : metric === "fcfs"
      ? sql`${dailyLeaderboard.submittedAt} asc, ${dailyLeaderboard.startedAt} asc`
      : sql`${dailyLeaderboard.durationMs} asc, ${dailyLeaderboard.startedAt} asc`;
}

/**
 * Just the caller's own position on a day's board — the share card needs a
 * rank and a field size and nothing else. The window functions compute both
 * over the whole field in one query, so there is no page slice to over-fetch
 * and no second copy of the ranking rules to keep in step.
 */
export async function getMyStanding(
  gameId: string,
  viewerRole: ViewerRole,
  viewerUserId: string,
): Promise<{ rank: number; fieldSize: number } | null> {
  const db = getDb();
  const [game] = await db
    .select({ gameType: games.gameType })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  const metric: GameMetric = game ? (getGameDefByType(game.gameType)?.metric ?? "time") : "time";
  const viewMode = viewerRole === "player" ? "main" : "tester";
  const ranked = rankedBoard(db, gameId, viewerRole, viewMode, metric);
  const [row] = await db
    .with(ranked)
    .select()
    .from(ranked)
    .where(eq(ranked.userId, viewerUserId))
    .limit(1);
  if (!row) return null;
  return {
    rank: row.rank,
    fieldSize: row.fieldSize,
  };
}

// Global leaderboard removed in favor of daily leaderboards.
