import { and, asc, eq, lt, ne, or, sql } from "drizzle-orm";
import { getDb, type Db } from "~/server/db/client";
import { dailyLeaderboard, games, users } from "~/server/db/schema";
import type { GameMetric } from "~/server/games/registry";
import { getGameDefByType } from "~/server/games/registry";
import type { ViewerRole } from "~/server/games/service";
import { getSetting } from "~/server/settings/service";
import { sharedRead } from "~/server/cache";

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
  gameType?: string;
  durationMs: number | null;
  score: number | null;
  /** The ranking value for `fcfs` boards - "finished at" wall-clock time. */
  submittedAt: string;
  attemptsUsed: number;
  isTester: boolean;
  isMe: boolean;
}

export interface DailyBoard {
  metric: GameMetric;
  gameType: string;
  /** UI label for the ranking column, e.g. "Time", "Height", or "Treasures". */
  metricLabel: string;
  fieldSize: number;
  entries: DailyEntry[];
  myEntry: DailyEntry | null;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function metricLabel(metric: GameMetric, gameType?: string): string {
  if (gameType === "hunt") return "Treasures";
  switch (metric) {
    case "score":
      return "Height";
    case "fcfs":
      return "Finished at";
    default:
      return "Time";
  }
}

async function getGameType(gameId: string, db: Db): Promise<string | undefined> {
  return sharedRead(`game:type:${gameId}`, async () => {
    const [game] = await db
      .select({ gameType: games.gameType })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    return game?.gameType;
  });
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
  const gameType = (await getGameType(gameId, db)) ?? "time";
  const metric: GameMetric = getGameDefByType(gameType)?.metric ?? "time";
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const hideTestersFromPlayerBoard = await getSetting<boolean>(
    "access.tester_real_leaderboard",
    true,
  );

  let rows: any[] = [];
  let fieldSize = 0;

  if (safePage === 1) {
    const cached = await sharedRead(
      `leaderboard:${gameId}:${viewMode}:${viewerRole}:${safePageSize}`,
      async () => {
        const ranked = rankedBoard(
          db,
          gameId,
          viewerRole,
          viewMode,
          metric,
          hideTestersFromPlayerBoard,
        );
        const inSlice = and(sql`${ranked.rank} > 0`, sql`${ranked.rank} <= ${safePageSize}`);
        const resultRows = await db
          .with(ranked)
          .select()
          .from(ranked)
          .where(inSlice)
          .orderBy(asc(ranked.rank));
        return {
          rows: resultRows,
          fieldSize: resultRows[0]?.fieldSize ?? 0,
        };
      },
      15_000,
    );
    rows = [...cached.rows];
    fieldSize = cached.fieldSize;

    if (viewerUserId && !rows.some((r) => r.userId === viewerUserId)) {
      const ranked = rankedBoard(
        db,
        gameId,
        viewerRole,
        viewMode,
        metric,
        hideTestersFromPlayerBoard,
      );
      const myRow = await db
        .with(ranked)
        .select()
        .from(ranked)
        .where(eq(ranked.userId, viewerUserId))
        .limit(1);
      if (myRow[0]) {
        rows.push(myRow[0]);
      }
    }
  } else {
    const ranked = rankedBoard(
      db,
      gameId,
      viewerRole,
      viewMode,
      metric,
      hideTestersFromPlayerBoard,
    );
    const inSlice = and(
      sql`${ranked.rank} > ${offset}`,
      sql`${ranked.rank} <= ${offset + safePageSize}`,
    );
    rows = await db
      .with(ranked)
      .select()
      .from(ranked)
      .where(viewerUserId ? or(inSlice, eq(ranked.userId, viewerUserId)) : inSlice)
      .orderBy(asc(ranked.rank));
    fieldSize = rows[0]?.fieldSize ?? 0;
  }

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
    gameType,
    durationMs: row.durationMs,
    score: row.score,
    submittedAt: row.submittedAt
      ? new Date(row.submittedAt).toISOString()
      : new Date().toISOString(),
    attemptsUsed: row.attemptsUsed,
    isTester: row.role === "tester",
    isMe: row.userId === viewerUserId,
  });

  const entries = rows
    .filter((row) => row.rank > offset && row.rank <= offset + safePageSize)
    .map((row) => toEntry(row, row.rank));

  const myRow = viewerUserId ? rows.find((r) => r.userId === viewerUserId) : null;
  const myEntry = myRow ? toEntry(myRow, myRow.rank) : null;

  return {
    metric,
    gameType,
    metricLabel: metricLabel(metric, gameType),
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
 * asked for - the caller then filters out the slice (or the viewer) it wants.
 */
function rankedBoard(
  db: Db,
  gameId: string,
  viewerRole: ViewerRole,
  viewMode: "main" | "tester",
  metric: GameMetric,
  hideTestersFromPlayerBoard = true,
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
        /*
         * The aliases are load-bearing, not decoration.
         *
         * These two are raw SQL inside a CTE, and the outer query filters and
         * orders by `ranked.rank`. Without an explicit alias drizzle cannot
         * name the column from outside, so touching `ranked.rank` throws while
         * the query is still being *built* - before a single byte reaches the
         * database. That failure mode is nastier than it sounds: it surfaced as
         * an unhandled rejection that killed the process mid-stream, so the
         * response was never terminated and every page hung until the platform
         * timed it out, with no query in the database logs to explain why.
         */
        rank: sql<number>`row_number() over (order by ${rankingOrder(metric)})`.as("rank"),
        fieldSize: sql<number>`count(*) over ()`.as("field_size"),
      })
      .from(dailyLeaderboard)
      .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
      .where(and(...boardConditions(gameId, viewerRole, viewMode, hideTestersFromPlayerBoard))),
  );
}

function boardConditions(
  gameId: string,
  viewerRole: ViewerRole,
  viewMode: "main" | "tester",
  hideTestersFromPlayerBoard = true,
) {
  const roleFilter =
    viewMode === "tester"
      ? or(eq(users.role, "tester"), eq(users.role, "admin"))
      : hideTestersFromPlayerBoard
        ? and(ne(users.role, "tester"), ne(users.role, "admin"))
        : undefined;

  const conditions = [
    eq(dailyLeaderboard.gameId, gameId),
    eq(dailyLeaderboard.isFlagged, false),
    lt(users.banLevel, 4),
  ];
  if (roleFilter) {
    conditions.push(roleFilter);
  }
  return conditions;
}

function rankingOrder(metric: GameMetric) {
  return metric === "score"
    ? sql`${dailyLeaderboard.score} desc, coalesce(${dailyLeaderboard.submittedAt}, ${dailyLeaderboard.startedAt}) asc`
    : metric === "fcfs"
      ? sql`${dailyLeaderboard.submittedAt} asc, ${dailyLeaderboard.startedAt} asc`
      : sql`${dailyLeaderboard.durationMs} asc, ${dailyLeaderboard.startedAt} asc`;
}

/**
 * Just the caller's own position on a day's board - the share card needs a
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
  const hideTestersFromPlayerBoard = await getSetting<boolean>(
    "access.tester_real_leaderboard",
    true,
  );
  const viewMode = viewerRole === "player" ? "main" : "tester";
  const ranked = rankedBoard(db, gameId, viewerRole, viewMode, metric, hideTestersFromPlayerBoard);
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
