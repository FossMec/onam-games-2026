import { and, asc, eq, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { dailyLeaderboard, users } from "~/server/db/schema";
import { getRedisOrNull } from "~/server/redis/client";
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
  durationMs: number;
  startedAt: string;
  isTester: boolean;
  isMe: boolean;
}

export interface GlobalEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  college: string | null;
  streakCount: number;
  gamesCompleted: number;
  weightedTotal: number;
  isTester: boolean;
  isMe: boolean;
}

interface RawDailyRow {
  userId: string;
  durationMs: number;
  startedAt: Date;
  name: string;
  avatarUrl: string | null;
  college: string | null;
  branch: string | null;
  batch: string | null;
  streakCount: number;
  role: string;
}

function dailyFilters(gameId: string, includeTesters: boolean) {
  return and(
    eq(dailyLeaderboard.gameId, gameId),
    eq(dailyLeaderboard.isFlagged, false),
    includeTesters ? undefined : ne(users.role, "tester"),
  );
}

export async function getDailyLeaderboard(
  gameId: string,
  viewerRole: ViewerRole,
  viewerUserId: string | null,
  limit = 50,
): Promise<{ entries: DailyEntry[]; myEntry: DailyEntry | null }> {
  const db = getDb();
  const includeTesters = viewerRole !== "player";
  const filters = dailyFilters(gameId, includeTesters);

  const rows = (await db
    .select({
      userId: dailyLeaderboard.userId,
      durationMs: dailyLeaderboard.durationMs,
      startedAt: dailyLeaderboard.startedAt,
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
    .where(filters)
    .orderBy(asc(dailyLeaderboard.durationMs), asc(dailyLeaderboard.startedAt))
    .limit(limit)) as RawDailyRow[];

  const entries = rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    name: row.name,
    avatarUrl: row.avatarUrl,
    college: row.college,
    branch: row.branch,
    batch: row.batch,
    streakCount: row.streakCount,
    durationMs: row.durationMs,
    startedAt: row.startedAt.toISOString(),
    isTester: row.role === "tester",
    isMe: row.userId === viewerUserId,
  }));

  let myEntry: DailyEntry | null = null;
  if (viewerUserId) {
    const [mine] = (await db
      .select({
        userId: dailyLeaderboard.userId,
        durationMs: dailyLeaderboard.durationMs,
        startedAt: dailyLeaderboard.startedAt,
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
      .where(and(filters, eq(dailyLeaderboard.userId, viewerUserId)))
      .limit(1)) as RawDailyRow[];

    if (mine) {
      const [betterCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(dailyLeaderboard)
        .where(
          and(
            filters,
            or(
              lt(dailyLeaderboard.durationMs, mine.durationMs),
              and(
                eq(dailyLeaderboard.durationMs, mine.durationMs),
                lt(dailyLeaderboard.startedAt, mine.startedAt),
              ),
            ),
          ),
        );
      myEntry = {
        rank: (betterCount?.count ?? 0) + 1,
        userId: mine.userId,
        name: mine.name,
        avatarUrl: mine.avatarUrl,
        college: mine.college,
        branch: mine.branch,
        batch: mine.batch,
        streakCount: mine.streakCount,
        durationMs: mine.durationMs,
        startedAt: mine.startedAt.toISOString(),
        isTester: mine.role === "tester",
        isMe: true,
      };
    }
  }

  return { entries, myEntry };
}

/** p99 (99th percentile) of a game's on-time durations, cached in Redis. */
export async function getGameP99(gameId: string): Promise<number> {
  const redis = getRedisOrNull();
  const cacheKey = `stats:p99:${gameId}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return Number(cached);
    } catch {
      // fall through to compute
    }
  }
  const db = getDb();
  const rows = await db
    .select({ durationMs: dailyLeaderboard.durationMs })
    .from(dailyLeaderboard)
    .where(and(eq(dailyLeaderboard.gameId, gameId), eq(dailyLeaderboard.isFlagged, false)));
  const durations = rows.map((r) => r.durationMs).sort((a, b) => a - b);
  let p99 = durations[durations.length - 1] ?? 1;
  if (durations.length > 5) {
    const idx = Math.floor(0.99 * (durations.length - 1));
    p99 = durations[idx];
  }
  p99 = Math.max(p99, 1);
  if (redis) {
    try {
      await redis.set(cacheKey, String(p99), { ex: 300 });
    } catch {
      // ignore
    }
  }
  return p99;
}

interface Aggregate {
  userId: string;
  gamesCompleted: number;
  weightedTotal: number;
  isTester: boolean;
}

export async function getGlobalLeaderboard(
  viewerRole: ViewerRole,
  viewerUserId: string | null,
  limit = 100,
): Promise<{ entries: GlobalEntry[]; myEntry: GlobalEntry | null }> {
  const db = getDb();
  const rows = await db
    .select({
      userId: dailyLeaderboard.userId,
      gameId: dailyLeaderboard.gameId,
      durationMs: dailyLeaderboard.durationMs,
      role: users.role,
    })
    .from(dailyLeaderboard)
    .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
    .where(eq(dailyLeaderboard.isFlagged, false));

  const byGame = new Map<string, number[]>();
  for (const row of rows) {
    const list = byGame.get(row.gameId) ?? [];
    list.push(row.durationMs);
    byGame.set(row.gameId, list);
  }
  const p99Cache = new Map<string, number>();
  const p99Of = (gameId: string): number => {
    const cached = p99Cache.get(gameId);
    if (cached) return cached;
    const durations = (byGame.get(gameId) ?? []).sort((a, b) => a - b);
    let p99 = durations[durations.length - 1] ?? 1;
    if (durations.length > 5) {
      p99 = durations[Math.floor(0.99 * (durations.length - 1))];
    }
    p99 = Math.max(p99, 1);
    p99Cache.set(gameId, p99);
    return p99;
  };

  const byUser = new Map<string, Aggregate>();
  for (const row of rows) {
    const agg = byUser.get(row.userId) ?? {
      userId: row.userId,
      gamesCompleted: 0,
      weightedTotal: 0,
      isTester: row.role === "tester",
    };
    agg.gamesCompleted += 1;
    const p99 = p99Of(row.gameId);
    const percentile = Math.max(0, Math.min(1, 1 - row.durationMs / p99));
    agg.weightedTotal += percentile;
    byUser.set(row.userId, agg);
  }

  let aggregates = Array.from(byUser.values());
  if (viewerRole === "player") {
    aggregates = aggregates.filter((a) => !a.isTester);
  }
  aggregates.sort(
    (a, b) => b.gamesCompleted - a.gamesCompleted || b.weightedTotal - a.weightedTotal,
  );
  aggregates = aggregates.slice(0, limit);

  const userIds = aggregates.map((a) => a.userId);
  const userRows = userIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          college: users.college,
          streakCount: users.streakCount,
        })
        .from(users)
        .where(sql`${users.id} = any(${userIds})`)
    : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const entries: GlobalEntry[] = aggregates.map((agg, index) => {
    const info = userMap.get(agg.userId);
    return {
      rank: index + 1,
      userId: agg.userId,
      name: info?.name ?? "Player",
      avatarUrl: info?.avatarUrl ?? null,
      college: info?.college ?? null,
      streakCount: info?.streakCount ?? 0,
      gamesCompleted: agg.gamesCompleted,
      weightedTotal: agg.weightedTotal,
      isTester: agg.isTester,
      isMe: agg.userId === viewerUserId,
    };
  });

  const myEntry = entries.find((e) => e.userId === viewerUserId) ?? null;
  return { entries, myEntry };
}
