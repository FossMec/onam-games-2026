import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { dailyLeaderboard, games, globalScores, users } from "~/server/db/schema";
import { higherIsBetter, requireGameDef } from "~/server/games/registry";
import { resolveSchedule } from "~/server/games/service";

/**
 * Points settlement — the one place where games become comparable.
 *
 * The problem: four games rank by fastest time, Maveli Jump ranks by highest
 * score, and the treasure hunt ranks by who submitted first. There is no honest
 * exchange rate between "12.4 seconds" and "4,300 metres".
 *
 * The fix: never compare raw units. Convert each day's result to the player's
 * *rank within that day's field*, and award points from the rank alone. "You
 * beat 92% of the field today" means the same thing in every game, whatever it
 * measured. It is also immune to outliers — one player who leaves a tab open
 * for three hours cannot distort the scale the way a p99-anchored ratio does.
 */

/** Points for finishing at all, on top of the rank curve. Playing always beats skipping. */
const COMPLETION_FLOOR = 50;
const MAX_RANK_POINTS = 1000;

/**
 * Exponent on the rank fraction.
 *
 * A linear curve makes 1st vs 2nd out of 300 worth ~3 points, so nobody fights
 * for the podium. Raising the fraction to a power > 1 steepens the top of the
 * curve — the gap between 1st and 5th is worth chasing — while still letting
 * mid-table players earn a meaningful share.
 */
const RANK_CURVE_EXPONENT = 1.5;

/** Consecutive-day bonuses. Pure retention lever; kept separate so it is explainable. */
const STREAK_BONUS: Record<number, number> = { 3: 50, 4: 100, 5: 175, 6: 300 };

export function pointsForRank(rank: number, fieldSize: number): number {
  if (fieldSize <= 0) return 0;
  // A field of one is a full-marks field; there is nobody to lose to.
  if (fieldSize === 1) return MAX_RANK_POINTS + COMPLETION_FLOOR;
  const fraction = (fieldSize - rank) / (fieldSize - 1);
  return Math.round(MAX_RANK_POINTS * fraction ** RANK_CURVE_EXPONENT) + COMPLETION_FLOOR;
}

export function streakBonusFor(streak: number): number {
  let bonus = 0;
  for (const [days, value] of Object.entries(STREAK_BONUS)) {
    if (streak >= Number(days)) bonus = value;
  }
  return bonus;
}

interface Standing {
  id: string;
  userId: string;
  rank: number;
}

/**
 * Orders a game's field by its own metric and assigns competition ranks
 * (ties share a rank, then the next rank skips — 1, 2, 2, 4).
 *
 * Exported for tests: this and `pointsForRank` decide who wins the week, so
 * they are the two functions in the codebase most worth pinning down.
 */
export function rankField(
  rows: { id: string; userId: string; durationMs: number | null; score: number | null }[],
  metric: "time" | "score" | "fcfs",
): Standing[] {
  const key = (r: (typeof rows)[number]): number =>
    metric === "score" ? (r.score ?? 0) : (r.durationMs ?? Number.MAX_SAFE_INTEGER);

  const sorted = rows
    .slice()
    .sort((a, b) => (higherIsBetter(metric) ? key(b) - key(a) : key(a) - key(b)));

  const standings: Standing[] = [];
  let lastValue: number | null = null;
  let lastRank = 0;
  sorted.forEach((row, index) => {
    const value = key(row);
    const rank = lastValue !== null && value === lastValue ? lastRank : index + 1;
    lastValue = value;
    lastRank = rank;
    standings.push({ id: row.id, userId: row.userId, rank });
  });
  return standings;
}

/**
 * Settles one game's points. Idempotent via `games.settled_at`, so it is safe
 * to call from a request path.
 *
 * Flagged rows are excluded from the *field* as well as from scoring — a
 * cheater should not inflate the field size and hand everyone below them a
 * better rank fraction.
 */
export async function settleGame(gameId: string): Promise<{ settled: boolean; players: number }> {
  const db = getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return { settled: false, players: 0 };
  if (game.settledAt) return { settled: false, players: 0 };

  // Only settle after the game has actually closed for everyone.
  const schedule = await resolveSchedule(game, "player");
  if (!schedule.endAt || Date.now() < schedule.endAt.getTime()) {
    return { settled: false, players: 0 };
  }

  const def = requireGameDef(game.gameType);
  const rows = await db
    .select({
      id: dailyLeaderboard.id,
      userId: dailyLeaderboard.userId,
      durationMs: dailyLeaderboard.durationMs,
      score: dailyLeaderboard.score,
    })
    .from(dailyLeaderboard)
    .innerJoin(users, eq(users.id, dailyLeaderboard.userId))
    .where(
      and(
        eq(dailyLeaderboard.gameId, gameId),
        eq(dailyLeaderboard.isFlagged, false),
        // Testers play early against a different field; they never rank.
        eq(users.role, "player"),
      ),
    );

  const standings = rankField(rows, def.metric);
  const fieldSize = standings.length;

  for (const standing of standings) {
    await db
      .update(dailyLeaderboard)
      .set({ rank: standing.rank, points: pointsForRank(standing.rank, fieldSize) })
      .where(eq(dailyLeaderboard.id, standing.id));
  }

  await db.update(games).set({ settledAt: new Date() }).where(eq(games.id, gameId));
  await rollUpGlobalScores();

  return { settled: true, players: fieldSize };
}

/**
 * Recomputes `global_scores` from settled daily rows.
 *
 * Deliberately a full recompute rather than an incremental add: it runs once a
 * day over ~500 rows, and it means a corrected flag or a voided attempt can
 * never leave a stale total behind.
 */
export async function rollUpGlobalScores(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      userId: dailyLeaderboard.userId,
      points: dailyLeaderboard.points,
    })
    .from(dailyLeaderboard)
    .where(and(isNotNull(dailyLeaderboard.points), eq(dailyLeaderboard.isFlagged, false)));

  const totals = new Map<string, { points: number; games: number }>();
  for (const row of rows) {
    const entry = totals.get(row.userId) ?? { points: 0, games: 0 };
    entry.points += row.points ?? 0;
    entry.games += 1;
    totals.set(row.userId, entry);
  }
  if (totals.size === 0) return;

  const streaks = await db.select({ id: users.id, bestStreak: users.bestStreak }).from(users);
  const streakByUser = new Map(streaks.map((s) => [s.id, s.bestStreak]));

  for (const [userId, entry] of totals) {
    const bonus = streakBonusFor(streakByUser.get(userId) ?? 0);
    await db
      .insert(globalScores)
      .values({
        userId,
        gamesCompleted: entry.games,
        totalPoints: entry.points + bonus,
        streakBonus: bonus,
      })
      .onConflictDoUpdate({
        target: globalScores.userId,
        set: {
          gamesCompleted: entry.games,
          totalPoints: entry.points + bonus,
          streakBonus: bonus,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Settles any game whose window has closed but whose points are still unwritten.
 *
 * Called lazily from leaderboard reads instead of a cron: with a 24h window and
 * a handful of games there is at most one game to settle at any time, and the
 * `settled_at` guard makes a concurrent double-call harmless.
 */
export async function settlePendingGames(): Promise<void> {
  const db = getDb();
  const pending = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.published, true), sql`${games.settledAt} is null`));

  for (const game of pending) {
    try {
      await settleGame(game.id);
    } catch {
      // A single bad game must not take the leaderboard down.
    }
  }
}
