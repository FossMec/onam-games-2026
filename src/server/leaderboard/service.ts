import { getDb, type Db } from "~/server/db/client";
import type { GameMetric } from "~/server/games/registry";
import { getGameDefByType } from "~/server/games/registry";
import type { ViewerRole } from "~/server/games/service";
import { getSetting } from "~/server/settings/service";
import { sharedRead } from "~/server/cache";
import { isOpenToAll } from "~/server/open-to-all";

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
    const rows = await db<{ game_type: string }[]>`
      SELECT game_type FROM games WHERE id = ${gameId} LIMIT 1
    `;
    return rows[0]?.game_type;
  });
}

function getRankingOrderSql(metric: GameMetric, gameType?: string): string {
  if (gameType === "hunt") {
    return "score DESC, COALESCE(submitted_at, started_at) ASC, duration_ms ASC";
  }
  if (metric === "score") {
    return "score DESC, COALESCE(submitted_at, started_at) ASC";
  }
  if (metric === "fcfs") {
    return "submitted_at ASC, started_at ASC";
  }
  return "duration_ms ASC, started_at ASC";
}

interface RankedLeaderboardRow {
  userId: string;
  durationMs: number | null;
  score: number | null;
  attemptsUsed: number;
  startedAt: Date;
  submittedAt: Date;
  name: string;
  avatarUrl: string | null;
  college: string | null;
  branch: string | null;
  batch: string | null;
  streakCount: number;
  role: string;
  rank: number | string;
  fieldSize: number | string;
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

  const orderSql = getRankingOrderSql(metric, gameType);
  const roleClause =
    viewMode === "tester"
      ? db`AND (u.role = 'tester' OR u.role = 'admin')`
      : hideTestersFromPlayerBoard
        ? db`AND (u.role != 'tester' AND u.role != 'admin')`
        : db``;
  /*
   * Open-to-all mode: the public board is a fresh scoreboard for the people who
   * walked in today. A database inherited from the scheduled event still holds
   * last year's finishers, and they are not playing - so the main board is
   * narrowed to `is_guest` accounts. The tester view is untouched: it is an
   * internal tool, not the public standings.
   */
  const guestClause = viewMode === "main" && isOpenToAll() ? db`AND u.is_guest = true` : db``;

  // Cached public page read (60s TTL)
  const cached = await sharedRead(
    `leaderboard:${gameId}:${viewMode}:${safePage}:${safePageSize}`,
    async () => {
      const resultRows = await db<RankedLeaderboardRow[]>`
        WITH ranked AS (
          SELECT
            dl.user_id AS "userId",
            dl.duration_ms AS "durationMs",
            dl.score AS "score",
            dl.attempts_used AS "attemptsUsed",
            dl.started_at AS "startedAt",
            dl.submitted_at AS "submittedAt",
            u.name AS "name",
            u.avatar_url AS "avatarUrl",
            u.college AS "college",
            u.branch AS "branch",
            u.batch AS "batch",
            u.streak_count AS "streakCount",
            u.role AS "role",
            ROW_NUMBER() OVER (ORDER BY ${db.unsafe(orderSql)}) AS "rank",
            COUNT(*) OVER () AS "fieldSize"
          FROM daily_leaderboard dl
          INNER JOIN users u ON u.id = dl.user_id
          WHERE dl.game_id = ${gameId}
            AND dl.is_flagged = false
            AND u.ban_level < 4
            ${roleClause}
            ${guestClause}
        )
        SELECT * FROM ranked
        WHERE "rank" > ${offset} AND "rank" <= ${offset + safePageSize}
        ORDER BY "rank" ASC
      `;
      const fieldSize = Number(resultRows[0]?.fieldSize ?? 0);
      return {
        rows: resultRows,
        fieldSize,
      };
    },
    60_000,
  );

  const rows = [...cached.rows];
  const fieldSize = cached.fieldSize;

  let myRow: RankedLeaderboardRow | null = null;
  if (viewerUserId) {
    const existing = rows.find((r) => r.userId === viewerUserId);
    if (existing) {
      myRow = existing;
    } else {
      myRow = await sharedRead(
        `userboard:${gameId}:${viewMode}:${viewerUserId}`,
        async () => {
          const res = await db<RankedLeaderboardRow[]>`
            WITH ranked AS (
              SELECT
                dl.user_id AS "userId",
                dl.duration_ms AS "durationMs",
                dl.score AS "score",
                dl.attempts_used AS "attemptsUsed",
                dl.started_at AS "startedAt",
                dl.submitted_at AS "submittedAt",
                u.name AS "name",
                u.avatar_url AS "avatarUrl",
                u.college AS "college",
                u.branch AS "branch",
                u.batch AS "batch",
                u.streak_count AS "streakCount",
                u.role AS "role",
                ROW_NUMBER() OVER (ORDER BY ${db.unsafe(orderSql)}) AS "rank",
                COUNT(*) OVER () AS "fieldSize"
              FROM daily_leaderboard dl
              INNER JOIN users u ON u.id = dl.user_id
              WHERE dl.game_id = ${gameId}
                AND dl.is_flagged = false
                AND u.ban_level < 4
                ${roleClause}
                ${guestClause}
            )
            SELECT * FROM ranked
            WHERE "userId" = ${viewerUserId}
            LIMIT 1
          `;
          return res[0] ?? null;
        },
        30_000,
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(fieldSize / safePageSize));
  const toEntry = (row: RankedLeaderboardRow, rank: number): DailyEntry => ({
    rank,
    userId: row.userId,
    name: row.name,
    avatarUrl: row.avatarUrl,
    college: row.college,
    branch: row.branch,
    batch: row.batch,
    streakCount: Number(row.streakCount ?? 0),
    metric,
    gameType,
    durationMs: row.durationMs != null ? Number(row.durationMs) : null,
    score: row.score != null ? Number(row.score) : null,
    submittedAt: row.submittedAt
      ? new Date(row.submittedAt).toISOString()
      : new Date().toISOString(),
    attemptsUsed: Number(row.attemptsUsed ?? 1),
    isTester: row.role === "tester",
    isMe: row.userId === viewerUserId,
  });

  const entries = rows.map((row) => toEntry(row, Number(row.rank)));
  const myEntry = myRow ? toEntry(myRow, Number(myRow.rank)) : null;

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
 * Just the caller's own position on a day's board - the share card needs a
 * rank and a field size and nothing else.
 */
export async function getMyStanding(
  gameId: string,
  viewerRole: ViewerRole,
  viewerUserId: string,
): Promise<{ rank: number; fieldSize: number } | null> {
  const db = getDb();
  const gameType = (await getGameType(gameId, db)) ?? "time";
  const metric: GameMetric = getGameDefByType(gameType)?.metric ?? "time";
  const hideTestersFromPlayerBoard = await getSetting<boolean>(
    "access.tester_real_leaderboard",
    true,
  );
  const viewMode = viewerRole === "player" ? "main" : "tester";
  const orderSql = getRankingOrderSql(metric);
  const roleClause =
    viewMode === "tester"
      ? db`AND (u.role = 'tester' OR u.role = 'admin')`
      : hideTestersFromPlayerBoard
        ? db`AND (u.role != 'tester' AND u.role != 'admin')`
        : db``;
  // Same open-to-all narrowing as `getDailyLeaderboard`, so a share card cannot
  // quote a rank from a board the player is not actually on.
  const guestClause = viewMode === "main" && isOpenToAll() ? db`AND u.is_guest = true` : db``;

  const rows = await db<{ rank: number | string; fieldSize: number | string }[]>`
    WITH ranked AS (
      SELECT
        dl.user_id AS "userId",
        ROW_NUMBER() OVER (ORDER BY ${db.unsafe(orderSql)}) AS "rank",
        COUNT(*) OVER () AS "fieldSize"
      FROM daily_leaderboard dl
      INNER JOIN users u ON u.id = dl.user_id
      WHERE dl.game_id = ${gameId}
        AND dl.is_flagged = false
        AND u.ban_level < 4
        ${roleClause}
        ${guestClause}
    )
    SELECT "rank", "fieldSize" FROM ranked
    WHERE "userId" = ${viewerUserId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return {
    rank: Number(rows[0].rank),
    fieldSize: Number(rows[0].fieldSize),
  };
}
