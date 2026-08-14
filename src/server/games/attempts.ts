import { and, desc, eq, ne, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { logActivity, logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { dailyLeaderboard, devices, gameAttempts, games, globalScores } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { rollUpGlobalScores } from "~/server/leaderboard/settle";
import { getRedisOrNull } from "~/server/redis/client";
import type { GameAssets, GameDef, GameMetric } from "./registry";
import { requireGameDef } from "./registry";
import { newSeed } from "./rng";
import type { ViewerRole } from "./service";
import { getGameBySlug, resolveSchedule } from "./service";
import { updateStreak } from "./streak";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface StartInput {
  userId: string;
  deviceId: string;
  slug: string;
  ip: string;
  userAgent: string;
  country: string | null;
  city: string | null;
  role: ViewerRole;
}

export interface StartResult {
  attemptToken: string;
  gameId: string;
  /**
   * The generated instance's client-visible half. The matching `solution` is
   * discarded here and regenerated from the seed at verify time, so it never
   * crosses the wire.
   */
  view: unknown;
  startedAt: string;
  attemptNumber: number;
  attemptsRemaining: number;
  maxDurationMs: number;
  alreadyStarted: boolean;
}

/**
 * An attempt left open past the game's `maxDurationMs` is dead. It still burns
 * an attempt — otherwise parking a tab open would be a free reroll on a
 * seed you did not like.
 */
async function expireIfStale(
  attempt: typeof gameAttempts.$inferSelect,
  def: GameDef,
): Promise<boolean> {
  const age = Date.now() - attempt.startedAt.getTime();
  if (age <= def.maxDurationMs) return false;
  await getDb()
    .update(gameAttempts)
    .set({ status: "expired", durationMs: age })
    .where(eq(gameAttempts.id, attempt.id));
  return true;
}

export async function startAttempt(input: StartInput): Promise<StartResult> {
  const game = await getGameBySlug(input.slug, input.role);
  if (!game) throw new HttpError(404, "Game not found");
  /*
   * `closed` is deliberately playable. Every past day stays open forever, so
   * somebody who joins on day 5 can still go back and play days 1-4 — which is
   * most of the point of a week-long event with a growing audience.
   *
   * A late run counts towards the overall table at the completion floor and
   * never appears on that day's leaderboard; `finishAttempt` derives that from
   * the server clock, so nothing here has to be trusted. Only `upcoming` is
   * refused, because releasing a puzzle early is the one thing that cannot be
   * undone.
   */
  if (game.status === "upcoming") {
    throw new HttpError(403, "This game is not available yet");
  }
  const def = requireGameDef(game.gameType);

  const db = getDb();
  const prior = await db
    .select()
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, input.userId), eq(gameAttempts.gameId, game.id)))
    .orderBy(desc(gameAttempts.attemptNumber));

  // Resume an open attempt: same seed in, same instance out. The timer keeps
  // running from the original `startedAt`, so a refresh is never a reset.
  const open = prior.find((a) => a.status === "in_progress");
  if (open && !(await expireIfStale(open, def))) {
    const { view } = def.generate(open.seed, game.difficulty, game.assets as GameAssets);
    return {
      attemptToken: open.attemptToken,
      gameId: game.id,
      view,
      startedAt: open.startedAt.toISOString(),
      attemptNumber: open.attemptNumber,
      attemptsRemaining: def.maxAttempts - open.attemptNumber,
      maxDurationMs: def.maxDurationMs,
      alreadyStarted: true,
    };
  }

  const used = prior.length;
  if (used >= def.maxAttempts) {
    throw new HttpError(
      409,
      def.maxAttempts === 1 ? "You have already played this game" : "You are out of runs for today",
    );
  }

  const seed = newSeed();
  const { view } = def.generate(seed, game.difficulty, game.assets as GameAssets);
  const attemptNumber = (prior[0]?.attemptNumber ?? 0) + 1;
  const now = new Date();

  const [attempt] = await db
    .insert(gameAttempts)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      gameId: game.id,
      seed,
      attemptNumber,
      initialStateHash: sha256(JSON.stringify(view)),
      startedAt: now,
      status: "in_progress",
      ip: input.ip,
      userAgent: input.userAgent,
      country: input.country,
      city: input.city,
    })
    .returning({
      id: gameAttempts.id,
      attemptToken: gameAttempts.attemptToken,
      startedAt: gameAttempts.startedAt,
    });

  const redis = getRedisOrNull();
  if (redis) {
    await redis.set(
      `attempt:${attempt.attemptToken}`,
      JSON.stringify({ userId: input.userId, gameId: game.id, startedAt: now.getTime() }),
      { ex: 7200 },
    );
  }

  await logActivity({
    userId: input.userId,
    deviceId: input.deviceId,
    ip: input.ip,
    eventType: "game_start",
    meta: { slug: input.slug, attemptToken: attempt.attemptToken, attemptNumber },
  });

  return {
    attemptToken: attempt.attemptToken,
    gameId: game.id,
    view,
    startedAt: attempt.startedAt.toISOString(),
    attemptNumber,
    attemptsRemaining: def.maxAttempts - attemptNumber,
    maxDurationMs: def.maxDurationMs,
    alreadyStarted: false,
  };
}

export interface FinishInput {
  userId: string;
  deviceId: string;
  role: ViewerRole;
  attemptToken: string;
  submittedState: unknown;
}

export interface FinishResult {
  valid: boolean;
  durationMs: number;
  /** Server-derived; null for non-score games. */
  score: number | null;
  metric: GameMetric;
  afterDeadline: boolean;
  attemptsRemaining: number;
  /** True when this run improved the player's standing for the day. */
  isPersonalBest: boolean;
  reason?: string;
}

export interface MyAttempt {
  status: "none" | "in_progress" | "submitted" | "expired" | "void";
  metric: GameMetric;
  durationMs: number | null;
  score: number | null;
  bestScore: number | null;
  bestDurationMs: number | null;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  valid: boolean;
  afterDeadline: boolean;
  startedAt: string | null;
  submittedAt: string | null;
}

/**
 * The current user's standing on a game: what is open, what they have spent,
 * and their best result so far. Drives the whole game page, so it has to work
 * for both one-shot and retry games.
 */
export async function getMyAttemptBySlug(slug: string, userId: string): Promise<MyAttempt | null> {
  const db = getDb();
  const [game] = await db
    .select({ id: games.id, gameType: games.gameType })
    .from(games)
    .where(eq(games.slug, slug))
    .limit(1);
  if (!game) return null;

  const def = requireGameDef(game.gameType);
  const rows = await db
    .select()
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, userId), eq(gameAttempts.gameId, game.id)))
    .orderBy(desc(gameAttempts.attemptNumber));

  const base = {
    metric: def.metric,
    maxAttempts: def.maxAttempts,
    attemptsUsed: rows.length,
    attemptsRemaining: Math.max(0, def.maxAttempts - rows.length),
  };

  if (rows.length === 0) {
    return {
      ...base,
      status: "none",
      durationMs: null,
      score: null,
      bestScore: null,
      bestDurationMs: null,
      valid: false,
      afterDeadline: false,
      startedAt: null,
      submittedAt: null,
    };
  }

  const valid = rows.filter((r) => r.serverValid && r.status === "submitted");
  const bestScore = valid.length ? Math.max(...valid.map((r) => r.score ?? 0)) : null;
  const bestDurationMs = valid.length
    ? Math.min(...valid.map((r) => r.durationMs ?? Number.MAX_SAFE_INTEGER))
    : null;

  // Prefer an open attempt; otherwise report the most recent one.
  const current = rows.find((r) => r.status === "in_progress") ?? rows[0];
  return {
    ...base,
    status: current.status,
    durationMs: current.durationMs,
    score: current.score,
    bestScore,
    bestDurationMs: bestDurationMs === Number.MAX_SAFE_INTEGER ? null : bestDurationMs,
    valid: current.serverValid,
    afterDeadline: current.afterDeadline,
    startedAt: current.startedAt.toISOString(),
    submittedAt: current.submittedAt?.toISOString() ?? null,
  };
}

/**
 * Writes the player's best-of-day row.
 *
 * The conflict clause is what makes retries safe: a worse run simply loses the
 * `setWhere` test and leaves the existing row alone, so twelve Maveli runs can
 * only ever move the board in one direction.
 */
async function upsertDailyBest(params: {
  gameId: string;
  userId: string;
  attemptId: string;
  metric: GameMetric;
  durationMs: number;
  score: number | null;
  startedAt: Date;
  submittedAt: Date;
  attemptsUsed: number;
  isFlagged: boolean;
}): Promise<boolean> {
  const db = getDb();
  const values = {
    gameId: params.gameId,
    userId: params.userId,
    attemptId: params.attemptId,
    metric: params.metric,
    durationMs: params.durationMs,
    score: params.score,
    attemptsUsed: params.attemptsUsed,
    startedAt: params.startedAt,
    submittedAt: params.submittedAt,
    isFlagged: params.isFlagged,
  };

  const better =
    params.metric === "score"
      ? sql`${dailyLeaderboard.score} is null or ${dailyLeaderboard.score} < excluded.score`
      : sql`${dailyLeaderboard.durationMs} is null or ${dailyLeaderboard.durationMs} > excluded.duration_ms`;

  const written = await db
    .insert(dailyLeaderboard)
    .values(values)
    .onConflictDoUpdate({
      target: [dailyLeaderboard.gameId, dailyLeaderboard.userId],
      set: {
        attemptId: sql`excluded.attempt_id`,
        durationMs: sql`excluded.duration_ms`,
        score: sql`excluded.score`,
        submittedAt: sql`excluded.submitted_at`,
        startedAt: sql`excluded.started_at`,
        attemptsUsed: sql`excluded.attempts_used`,
        isFlagged: sql`excluded.is_flagged`,
      },
      setWhere: better,
    })
    .returning({ id: dailyLeaderboard.id });

  if (written.length > 0) return true;

  // Not an improvement — still keep the run counter honest.
  await db
    .update(dailyLeaderboard)
    .set({ attemptsUsed: params.attemptsUsed })
    .where(
      and(eq(dailyLeaderboard.gameId, params.gameId), eq(dailyLeaderboard.userId, params.userId)),
    );
  return false;
}

export async function finishAttempt(input: FinishInput): Promise<FinishResult> {
  const db = getDb();
  const [attempt] = await db
    .select()
    .from(gameAttempts)
    .where(eq(gameAttempts.attemptToken, input.attemptToken))
    .limit(1);
  if (!attempt) throw new HttpError(404, "Attempt not found");
  if (attempt.userId !== input.userId) throw new HttpError(403, "Forbidden");
  if (attempt.status !== "in_progress") {
    throw new HttpError(409, "This attempt has already been submitted");
  }

  const [game] = await db.select().from(games).where(eq(games.id, attempt.gameId)).limit(1);
  if (!game) throw new HttpError(404, "Game not found");
  const def = requireGameDef(game.gameType);

  const schedule = await resolveSchedule(game, input.role);
  const now = new Date();
  // The clock is the DB's, not the client's. Nothing posted can change it.
  const durationMs = now.getTime() - attempt.startedAt.getTime();
  const afterDeadline = schedule.endAt ? now.getTime() > schedule.endAt.getTime() : false;

  const priorCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, input.userId), eq(gameAttempts.gameId, game.id)));
  const attemptsUsed = priorCount[0]?.count ?? attempt.attemptNumber;

  if (durationMs > def.maxDurationMs) {
    await db
      .update(gameAttempts)
      .set({ status: "expired", durationMs, submittedAt: now })
      .where(eq(gameAttempts.id, attempt.id));
    return {
      valid: false,
      durationMs,
      score: null,
      metric: def.metric,
      afterDeadline,
      attemptsRemaining: Math.max(0, def.maxAttempts - attemptsUsed),
      isPersonalBest: false,
      reason: "This attempt was open too long and expired.",
    };
  }

  // The registry regenerates the answer from the seed and grades the
  // submission. For score games the number it returns is the only score that
  // reaches the DB — anything the client claimed is dropped on the floor.
  const result = await def.verify({
    seed: attempt.seed,
    difficulty: game.difficulty,
    submission: input.submittedState,
    durationMs,
  });

  const score = def.metric === "score" ? (result.score ?? 0) : null;
  const isAnomalous = result.valid && durationMs < def.minPlausibleMs;

  await db
    .update(gameAttempts)
    .set({
      submittedAt: now,
      durationMs,
      score,
      submittedStateHash: sha256(JSON.stringify(input.submittedState ?? {})),
      serverValid: result.valid,
      isAnomalous,
      afterDeadline,
      status: "submitted",
      movesCount: result.movesCount ?? null,
    })
    .where(eq(gameAttempts.id, attempt.id));

  await db
    .update(devices)
    .set({ attemptsCount: sql`${devices.attemptsCount} + 1` })
    .where(eq(devices.id, attempt.deviceId));

  if (isAnomalous) {
    await logSuspicious({
      userId: input.userId,
      deviceId: input.deviceId,
      ip: attempt.ip ?? undefined,
      eventType: "speed_anomaly",
      severity: "warn",
      details: { durationMs, minPlausibleMs: def.minPlausibleMs, gameId: game.id },
      actionTaken: "flag",
    });
  }

  let isPersonalBest = false;
  if (result.valid && !afterDeadline) {
    await updateStreak(input.userId, game.day);

    isPersonalBest = await upsertDailyBest({
      gameId: game.id,
      userId: input.userId,
      attemptId: attempt.id,
      metric: def.metric,
      durationMs,
      score,
      startedAt: attempt.startedAt,
      submittedAt: now,
      attemptsUsed,
      isFlagged: isAnomalous,
    });

    // `gamesCompleted` counts distinct games, so only the first valid run of a
    // retry game increments it. Points themselves are written at settlement.
    if (isPersonalBest && attemptsUsed === 1) {
      await db
        .insert(globalScores)
        .values({ userId: input.userId, gamesCompleted: 1 })
        .onConflictDoUpdate({
          target: globalScores.userId,
          set: {
            gamesCompleted: sql`${globalScores.gamesCompleted} + 1`,
            updatedAt: new Date(),
          },
        });
    }

    const redis = getRedisOrNull();
    if (redis) {
      const zset = input.role === "player" ? `lb:game:${game.id}` : `lb:game:${game.id}:testers`;
      // Redis sorts ascending, so score games store a negated score to keep
      // "first element is best" true for every metric.
      await redis.zadd(zset, {
        score: def.metric === "score" ? -(score ?? 0) : durationMs,
        member: input.userId,
      });
    }
  } else if (result.valid) {
    await logActivity({
      userId: input.userId,
      deviceId: input.deviceId,
      ip: attempt.ip ?? undefined,
      eventType: "game_submit_late",
      meta: { durationMs, gameId: game.id },
    });

    /*
     * Catch-up play: no daily row, but the overall table owes them the
     * completion floor. `rollUpGlobalScores` is a full recompute, so it is only
     * worth running when this submission actually changed anything — that is,
     * on the *first* valid late completion of this game by this player.
     * Retrying Maveli Jump eleven more times after the day closed must not
     * trigger eleven recomputes.
     */
    const [earlier] = await db
      .select({ id: gameAttempts.id })
      .from(gameAttempts)
      .where(
        and(
          eq(gameAttempts.userId, input.userId),
          eq(gameAttempts.gameId, game.id),
          eq(gameAttempts.serverValid, true),
          eq(gameAttempts.afterDeadline, true),
          ne(gameAttempts.id, attempt.id),
        ),
      )
      .limit(1);
    if (!earlier) await rollUpGlobalScores();
  }

  await logActivity({
    userId: input.userId,
    deviceId: input.deviceId,
    ip: attempt.ip ?? undefined,
    eventType: "game_submit",
    meta: { durationMs, score, valid: result.valid, afterDeadline, gameId: game.id },
  });

  return {
    valid: result.valid,
    durationMs,
    score,
    metric: def.metric,
    afterDeadline,
    attemptsRemaining: Math.max(0, def.maxAttempts - attemptsUsed),
    isPersonalBest,
    reason: result.valid ? undefined : result.reason,
  };
}
