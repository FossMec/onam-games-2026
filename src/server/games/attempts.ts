import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import {
  dailyLeaderboard,
  devices,
  gameAttempts,
  games,
  huntQuestions,
  userHuntProgress,
} from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { revealDeck } from "./impl/tinder";
import type { GameAssets, GameDef, GameMetric } from "./registry";
import { requireGameDef } from "./registry";
import type { ViewerRole } from "./service";
import { getGameBySlug, resolveSchedule } from "./service";
import { updateStreak } from "./streak";
import { getSetting } from "~/server/settings/service";

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
  /** True for testers and admins, who play without a run limit. */
  unlimited: boolean;
  maxDurationMs: number;
  alreadyStarted: boolean;
}

/**
 * An attempt left open past the game's `maxDurationMs` is dead. It still burns
 * an attempt - otherwise parking a tab open would be a free reroll on a
 * seed you did not like.
 */
async function expireIfStale(
  attempt: Pick<typeof gameAttempts.$inferSelect, "id" | "startedAt">,
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
   * somebody who joins on day 5 can still go back and play days 1-4 - which is
   * most of the point of a week-long event with a growing audience.
   *
   * A late run counts towards the overall table at the completion floor and
   * never appears on that day's leaderboard; `finishAttempt` derives that from
   * the server clock, so nothing here has to be trusted.
   *
   * `upcoming` and `preview` are refused, because releasing a puzzle early is
   * the one thing that cannot be undone. Preview shows a player what the game
   * is; the seed still only exists once the clock says so, and this check is
   * what makes that true rather than the button being hidden - the endpoint is
   * callable directly.
   */
  if (game.status === "upcoming" || game.status === "preview") {
    throw new HttpError(403, "This game is not available yet");
  }
  const def = requireGameDef(game.gameType);

  const db = getDb();
  const prior = await db
    .select({
      id: gameAttempts.id,
      attemptToken: gameAttempts.attemptToken,
      attemptNumber: gameAttempts.attemptNumber,
      seed: gameAttempts.seed,
      startedAt: gameAttempts.startedAt,
      status: gameAttempts.status,
    })
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, input.userId), eq(gameAttempts.gameId, game.id)))
    .orderBy(desc(gameAttempts.attemptNumber));

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const isTester = (input.role === "tester" || input.role === "admin") && isTesterModeEnabled;
  const effectiveUnlimitedRole = isTester;

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
      attemptsRemaining: effectiveUnlimitedRole
        ? def.maxAttempts
        : Math.max(0, def.maxAttempts - open.attemptNumber),
      unlimited: effectiveUnlimitedRole,
      maxDurationMs: def.maxDurationMs,
      alreadyStarted: true,
    };
  }
  /*
   * Testers and admins play without a run limit when tester mode is on.
   * Closed games are accessible to testers when tester mode is on.
   */
  const isClosed = game.status === "closed";
  if (isClosed && !isTester) {
    throw new HttpError(403, "This daily game has ended");
  }
  const unlimited = isTester;
  const used = prior.length;
  if (!unlimited && used >= def.maxAttempts) {
    throw new HttpError(
      409,
      def.maxAttempts === 1 ? "You have already played this game" : "You are out of runs for today",
    );
  }

  const attemptNumber = (prior[0]?.attemptNumber ?? 0) + 1;

  if (game.gameType === "hunt") {
    // If starting a fresh attempt (e.g. testing or cleared attempt), reset any stale completed hunt progress
    const [existingProgress] = await db
      .select()
      .from(userHuntProgress)
      .where(eq(userHuntProgress.userId, input.userId))
      .limit(1);

    if (existingProgress && existingProgress.completedAt) {
      const allActive = await db
        .select()
        .from(huntQuestions)
        .where(eq(huntQuestions.active, true))
        .orderBy(huntQuestions.orderIndex);
      const firstQ = allActive.find((q) => q.difficulty === "first") || allActive[0];

      await db
        .update(userHuntProgress)
        .set({
          currentQuestionId: firstQ?.id ?? null,
          solvedQuestionIds: [],
          solvedCount: 0,
          completedAt: null,
          lastSubmittedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(userHuntProgress.id, existingProgress.id));
    }
  }

  // Generate per-attempt seeds for games where randomizing deals, piece scatter, or orientations
  // prevents answer sharing / layout copying between players, while maintaining identical puzzle difficulty.
  let seed: string;
  if (game.gameType === "tinder" || game.gameType === "jigsaw" || game.gameType === "wend") {
    seed = sha256(`foss-onam:${game.gameType}:${game.slug}:${input.userId}:${attemptNumber}`);
  } else {
    seed = sha256(`foss-onam:daily-game:${game.slug}:day-${game.day}`);
  }
  const { view } = def.generate(seed, game.difficulty, game.assets as GameAssets);
  const now = new Date();
  const releaseAtDate = game.releaseAt ? new Date(game.releaseAt) : null;
  const startedAt =
    def.metric === "fcfs" && releaseAtDate && releaseAtDate <= now ? releaseAtDate : now;

  const [attempt] = await db
    .insert(gameAttempts)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      gameId: game.id,
      seed,
      attemptNumber,
      initialStateHash: sha256(JSON.stringify(view)),
      startedAt,
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

  return {
    attemptToken: attempt.attemptToken,
    gameId: game.id,
    view,
    startedAt: attempt.startedAt.toISOString(),
    attemptNumber,
    attemptsRemaining: unlimited ? def.maxAttempts : def.maxAttempts - attemptNumber,
    unlimited,
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
  /** Ranked duration: the server-measured clock plus any in-game penalty. */
  durationMs: number;
  /** The clock alone, so the result card can show what the penalty cost. */
  rawDurationMs: number;
  /** Penalty added by the game's own rules, e.g. 3s per wrong Tinder swipe. */
  penaltyMs: number;
  /** Server-derived; null for non-score games. */
  score: number | null;
  metric: GameMetric;
  afterDeadline: boolean;
  attemptsRemaining: number;
  /** True for testers and admins, who play without a run limit. */
  unlimited: boolean;
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
  /** True for testers and admins, who play without a run limit. */
  unlimited: boolean;
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
export async function getMyAttemptBySlug(
  slug: string,
  userId: string,
  role: ViewerRole = "player",
): Promise<MyAttempt | null> {
  const db = getDb();
  const [game] = await db
    .select({ id: games.id, gameType: games.gameType })
    .from(games)
    .where(eq(games.slug, slug))
    .limit(1);
  if (!game) return null;

  const def = requireGameDef(game.gameType);
  const [summary] = await db
    .select({
      attemptsUsed: sql<number>`count(*)::int`,
      bestScore: sql<
        number | null
      >`max(${gameAttempts.score}) filter (where ${gameAttempts.serverValid} = true and ${gameAttempts.status} = 'submitted')`,
      bestDurationMs: sql<
        number | null
      >`min(${gameAttempts.durationMs}) filter (where ${gameAttempts.serverValid} = true and ${gameAttempts.status} = 'submitted')`,
    })
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, userId), eq(gameAttempts.gameId, game.id)));
  // Attempts are sequential: a new one is only started once the previous is
  // submitted or expired, so an `in_progress` row is always the latest. One
  // query for the newest attempt covers both the "resume me" and "my last run"
  // cases the page draws.
  const [latest] = await db
    .select({
      status: gameAttempts.status,
      durationMs: gameAttempts.durationMs,
      score: gameAttempts.score,
      serverValid: gameAttempts.serverValid,
      afterDeadline: gameAttempts.afterDeadline,
      startedAt: gameAttempts.startedAt,
      submittedAt: gameAttempts.submittedAt,
      attemptNumber: gameAttempts.attemptNumber,
    })
    .from(gameAttempts)
    .where(and(eq(gameAttempts.userId, userId), eq(gameAttempts.gameId, game.id)))
    .orderBy(desc(gameAttempts.attemptNumber))
    .limit(1);

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const unlimited = isTesterModeEnabled && role !== "player";
  const base = {
    metric: def.metric,
    maxAttempts: def.maxAttempts,
    attemptsUsed: summary?.attemptsUsed ?? 0,
    // Testers never run out unless tester mode is disabled, so the page must only draw them unlimited when true.
    attemptsRemaining: unlimited
      ? def.maxAttempts
      : Math.max(0, def.maxAttempts - (summary?.attemptsUsed ?? 0)),
    unlimited,
  };

  if (!latest) {
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

  return {
    ...base,
    status: latest.status,
    durationMs: latest.durationMs,
    score: latest.score,
    bestScore: summary?.bestScore ?? null,
    bestDurationMs: summary?.bestDurationMs ?? null,
    valid: latest.serverValid,
    afterDeadline: latest.afterDeadline,
    startedAt: latest.startedAt.toISOString(),
    submittedAt: latest.submittedAt?.toISOString() ?? null,
  };
}

export interface TinderRecap {
  kind: "tinder";
  cards: {
    id: string;
    name: string;
    category: string;
    open: boolean;
    why: string;
    fact: string;
  }[];
}

/**
 * The answer key for a Tinder deck the player has already submitted.
 *
 * Three things keep this from being a leak. It reads the caller's own attempt
 * row; it refuses unless that attempt is `submitted`; and it regenerates from
 * that attempt's seed, which is unique per player per run. So the most it can
 * ever hand over is the deck you just finished - and every card in it is one
 * you have already answered correctly, or the run would not have ended.
 */
export async function getMyRecapBySlug(
  slug: string,
  userId: string,
  role: ViewerRole = "player",
): Promise<TinderRecap | null> {
  const game = await getGameBySlug(slug, role);
  if (!game || game.gameType !== "tinder") return null;

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const isTester = (role === "tester" || role === "admin") && isTesterModeEnabled;

  // Answers remain locked until the day's challenge closes (or tester mode for testers)
  if (game.status !== "closed" && !isTester) return null;

  const db = getDb();

  const [attempt] = await db
    .select({ seed: gameAttempts.seed })
    .from(gameAttempts)
    .where(
      and(
        eq(gameAttempts.userId, userId),
        eq(gameAttempts.gameId, game.id),
        eq(gameAttempts.status, "submitted"),
      ),
    )
    .orderBy(desc(gameAttempts.attemptNumber))
    .limit(1);
  if (!attempt) return null;

  return { kind: "tinder", cards: revealDeck(attempt.seed) };
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

  // Not an improvement - still keep the run counter honest.
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
  const rawDurationMs = now.getTime() - attempt.startedAt.getTime();
  const afterDeadline = schedule.endAt ? now.getTime() > schedule.endAt.getTime() : false;

  // Attempts are numbered 1..N at creation and never deleted, so the current
  // row's number already is the count of runs used - no recount needed.
  const attemptsUsed = attempt.attemptNumber;
  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const unlimited = isTesterModeEnabled && input.role !== "player";
  const attemptsRemaining = unlimited
    ? def.maxAttempts
    : Math.max(0, def.maxAttempts - attemptsUsed);

  // The expiry test uses the bare clock: a time penalty is a ranking cost, not
  // a reason to void a run somebody actually finished inside the window.
  if (rawDurationMs > def.maxDurationMs) {
    const expired = await db
      .update(gameAttempts)
      .set({ status: "expired", durationMs: rawDurationMs, submittedAt: now })
      .where(and(eq(gameAttempts.id, attempt.id), eq(gameAttempts.status, "in_progress")))
      .returning({ id: gameAttempts.id });
    if (expired.length === 0) {
      throw new HttpError(409, "This attempt has already been submitted");
    }
    return {
      valid: false,
      durationMs: rawDurationMs,
      rawDurationMs,
      penaltyMs: 0,
      score: null,
      metric: def.metric,
      afterDeadline,
      attemptsRemaining,
      unlimited,
      isPersonalBest: false,
      reason: "This attempt was open too long and expired.",
    };
  }

  // The registry regenerates the answer from the seed and grades the
  // submission. For score games the number it returns is the only score that
  // reaches the DB - anything the client claimed is dropped on the floor.
  const result = await def.verify({
    seed: attempt.seed,
    difficulty: game.difficulty,
    submission: input.submittedState,
    durationMs: rawDurationMs,
    userId: input.userId,
    startedAt: attempt.startedAt,
  });

  /*
   * The ranked duration. A game may charge its own time penalty - Tinder adds
   * three seconds per wrong swipe - and that penalty is derived from the replay
   * above, so it is as server-authoritative as the clock it is added to. This
   * combined figure is what gets stored and ranked; `rawDurationMs` survives
   * only to show the player what the mistakes cost them.
   */
  const penaltyMs = result.valid ? Math.max(0, result.durationPenaltyMs ?? 0) : 0;
  const durationMs = rawDurationMs + penaltyMs;

  const score = def.metric === "score" ? (result.score ?? 0) : null;
  // Anomaly detection reads the real clock. A penalty inflating a duration past
  // the floor would launder exactly the impossibly-fast run it exists to catch.
  const isAnomalous = result.valid && rawDurationMs < def.minPlausibleMs;

  const claimed = await db
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
    .where(and(eq(gameAttempts.id, attempt.id), eq(gameAttempts.status, "in_progress")))
    .returning({ id: gameAttempts.id });
  if (claimed.length === 0) {
    throw new HttpError(409, "This attempt has already been submitted");
  }

  // Fire non-critical device counter update in background
  void db
    .update(devices)
    .set({ attemptsCount: sql`${devices.attemptsCount} + 1` })
    .where(eq(devices.id, attempt.deviceId));

  if (isAnomalous) {
    void logSuspicious({
      userId: input.userId,
      deviceId: input.deviceId,
      ip: attempt.ip ?? undefined,
      eventType: "speed_anomaly",
      severity: "warn",
      details: { durationMs: rawDurationMs, minPlausibleMs: def.minPlausibleMs, gameId: game.id },
      actionTaken: "flag",
    });
  }

  let isPersonalBest = false;
  if (result.valid && !afterDeadline) {
    const [_, isPb] = await Promise.all([
      updateStreak(input.userId, game.day, schedule.eventStartDate),
      upsertDailyBest({
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
      }),
    ]);
    isPersonalBest = isPb;
  }

  return {
    valid: result.valid,
    durationMs,
    rawDurationMs,
    penaltyMs,
    score,
    metric: def.metric,
    afterDeadline,
    attemptsRemaining,
    unlimited,
    isPersonalBest,
    reason: result.valid ? undefined : result.reason,
  };
}
