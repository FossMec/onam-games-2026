import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { logActivity, logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { dailyLeaderboard, devices, gameAttempts, games, globalScores } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { getRedisOrNull } from "~/server/redis/client";
import { getSetting } from "~/server/settings/service";
import type { ViewerRole } from "./service";
import { getGameBySlug, resolveSchedule } from "./service";
import { startGame, validateSubmission } from "./engine";
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
  seed: string;
  initialState: unknown;
  startedAt: string;
  alreadyStarted: boolean;
}

export async function startAttempt(input: StartInput): Promise<StartResult> {
  const game = await getGameBySlug(input.slug, input.role);
  if (!game) throw new HttpError(404, "Game not found");
  if (game.status !== "live" && game.status !== "tester") {
    throw new HttpError(403, "This game is not available yet");
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, input.userId), eq(gameAttempts.gameId, game.id)))
    .limit(1);

  if (existing) {
    if (existing.status === "submitted") {
      throw new HttpError(409, "You have already played this game");
    }
    const { seed, initialState } = startGame(game.gameType, game.difficulty, existing.seed);
    return {
      attemptToken: existing.attemptToken,
      gameId: game.id,
      seed,
      initialState,
      startedAt: existing.startedAt.toISOString(),
      alreadyStarted: true,
    };
  }

  const { seed, initialState } = startGame(game.gameType, game.difficulty);
  const now = new Date();
  const [attempt] = await db
    .insert(gameAttempts)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      gameId: game.id,
      seed,
      initialStateHash: sha256(JSON.stringify(initialState)),
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
    meta: { slug: input.slug, attemptToken: attempt.attemptToken },
  });

  return {
    attemptToken: attempt.attemptToken,
    gameId: game.id,
    seed,
    initialState,
    startedAt: attempt.startedAt.toISOString(),
    alreadyStarted: false,
  };
}

export interface FinishInput {
  userId: string;
  deviceId: string;
  role: ViewerRole;
  attemptToken: string;
  submittedState: unknown;
  movesCount?: number;
}

export interface FinishResult {
  valid: boolean;
  durationMs: number;
  afterDeadline: boolean;
  reason?: string;
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
    throw new HttpError(409, "This game has already been submitted");
  }

  const [game] = await db.select().from(games).where(eq(games.id, attempt.gameId)).limit(1);
  if (!game) throw new HttpError(404, "Game not found");

  const schedule = await resolveSchedule(game, input.role);
  const now = new Date();
  const durationMs = now.getTime() - attempt.startedAt.getTime();
  const afterDeadline = schedule.endAt ? now.getTime() > schedule.endAt.getTime() : false;

  const { valid, reason } = await validateSubmission(
    game.gameType,
    attempt.seed,
    input.submittedState,
  );

  const minPlausible = await getSetting<number>("anti_cheat.min_plausible_ms", 3000);
  const isAnomalous = valid && durationMs < minPlausible;

  await db
    .update(gameAttempts)
    .set({
      submittedAt: now,
      durationMs,
      submittedStateHash: sha256(JSON.stringify(input.submittedState ?? {})),
      serverValid: valid,
      isAnomalous,
      afterDeadline,
      status: "submitted",
      movesCount: input.movesCount ?? null,
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
      details: { durationMs, minPlausible, gameId: game.id },
      actionTaken: "none",
    });
  }

  if (valid) {
    if (!afterDeadline) {
      await updateStreak(input.userId, game.day);

      await db
        .insert(dailyLeaderboard)
        .values({
          gameId: game.id,
          userId: input.userId,
          attemptId: attempt.id,
          durationMs,
          startedAt: attempt.startedAt,
          submittedAt: now,
          isFlagged: isAnomalous,
        })
        .onConflictDoNothing();

      await db
        .insert(globalScores)
        .values({ userId: input.userId, gamesCompleted: 1, weightedTotal: 0 })
        .onConflictDoUpdate({
          target: globalScores.userId,
          set: {
            gamesCompleted: sql`${globalScores.gamesCompleted} + 1`,
            updatedAt: new Date(),
          },
        });

      const redis = getRedisOrNull();
      if (redis) {
        const zset = input.role === "player" ? `lb:game:${game.id}` : `lb:game:${game.id}:testers`;
        await redis.zadd(zset, { score: durationMs, member: input.userId });
      }
    } else {
      await logActivity({
        userId: input.userId,
        deviceId: input.deviceId,
        ip: attempt.ip ?? undefined,
        eventType: "game_submit_late",
        meta: { durationMs, gameId: game.id },
      });
    }
  }

  await logActivity({
    userId: input.userId,
    deviceId: input.deviceId,
    ip: attempt.ip ?? undefined,
    eventType: "game_submit",
    meta: { durationMs, valid, afterDeadline, gameId: game.id },
  });

  return { valid, durationMs, afterDeadline, reason: valid ? undefined : reason };
}
