import { createHash } from "node:crypto";
import { logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import type { Game, HuntQuestion } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { revealDeck } from "./impl/tinder";
import type { GameAssets, GameDef, GameMetric } from "./registry";
import { requireGameDef } from "./registry";
import type { ViewerRole } from "./service";
import { getGameBySlug, resolveSchedule } from "./service";
import { updateStreak } from "./streak";
import { getSetting } from "~/server/settings/service";
import { invalidateShared } from "~/server/cache";

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
  view: unknown;
  startedAt: string;
  attemptNumber: number;
  attemptsRemaining: number;
  unlimited: boolean;
  maxDurationMs: number;
  alreadyStarted: boolean;
}

async function expireIfStale(
  attempt: { id: string; startedAt: Date },
  def: GameDef,
): Promise<boolean> {
  const age = Date.now() - attempt.startedAt.getTime();
  if (age <= def.maxDurationMs) return false;
  const db = getDb();
  await db`
    UPDATE game_attempts
    SET status = 'expired', duration_ms = ${age}
    WHERE id = ${attempt.id}
  `;
  return true;
}

export async function startAttempt(input: StartInput): Promise<StartResult> {
  const game = await getGameBySlug(input.slug, input.role);
  if (!game) throw new HttpError(404, "Game not found");
  if (game.status === "upcoming" || game.status === "preview") {
    throw new HttpError(403, "This game is not available yet");
  }
  const def = requireGameDef(game.gameType);

  const db = getDb();
  const prior = await db<
    {
      id: string;
      attempt_token: string;
      attempt_number: number;
      seed: string;
      started_at: Date;
      status: string;
    }[]
  >`
    SELECT id, attempt_token, attempt_number, seed, started_at, status
    FROM game_attempts
    WHERE user_id = ${input.userId} AND game_id = ${game.id}
    ORDER BY attempt_number DESC
  `;

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const isTester = (input.role === "tester" || input.role === "admin") && isTesterModeEnabled;
  const effectiveUnlimitedRole = isTester;

  const open = prior.find((a) => a.status === "in_progress");
  if (open && !(await expireIfStale({ id: open.id, startedAt: open.started_at }, def))) {
    const { view } = def.generate(open.seed, game.difficulty, game.assets as GameAssets);
    return {
      attemptToken: open.attempt_token,
      gameId: game.id,
      view,
      startedAt: open.started_at.toISOString(),
      attemptNumber: open.attempt_number,
      attemptsRemaining: effectiveUnlimitedRole
        ? def.maxAttempts
        : Math.max(0, def.maxAttempts - open.attempt_number),
      unlimited: effectiveUnlimitedRole,
      maxDurationMs: def.maxDurationMs,
      alreadyStarted: true,
    };
  }

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

  const attemptNumber = (prior[0]?.attempt_number ?? 0) + 1;

  if (game.gameType === "hunt") {
    const existingProgress = await db<{ id: string; completed_at: Date | null }[]>`
      SELECT id, completed_at FROM user_hunt_progress WHERE user_id = ${input.userId} LIMIT 1
    `;

    if (existingProgress[0] && existingProgress[0].completed_at) {
      const allActive = await db<HuntQuestion[]>`
        SELECT * FROM hunt_questions WHERE active = true ORDER BY order_index ASC
      `;
      const firstQ = allActive.find((q) => q.difficulty === "first") || allActive[0];

      await db`
        UPDATE user_hunt_progress
        SET
          current_question_id = ${firstQ?.id ?? null},
          solved_question_ids = '[]'::jsonb,
          solved_count = 0,
          completed_at = NULL,
          last_submitted_at = NULL,
          updated_at = NOW()
        WHERE id = ${existingProgress[0].id}
      `;
    }
  }

  let seed: string;
  if (
    game.gameType === "tinder" ||
    game.gameType === "jigsaw" ||
    game.gameType === "wend" ||
    game.gameType === "jump"
  ) {
    // Deterministic per-attempt RNG via sha256 — no Math.random. Same user+attempt → same level,
    // different attempt (Play Again) → new random level. Still reproducible for anti-cheat replay.
    seed = sha256(`foss-onam:${game.gameType}:${game.slug}:${input.userId}:${attemptNumber}`);
  } else {
    seed = sha256(`foss-onam:daily-game:${game.slug}:day-${game.day}`);
  }
  const { view } = def.generate(seed, game.difficulty, game.assets as GameAssets);
  const now = new Date();
  const releaseAtDate = game.releaseAt ? new Date(game.releaseAt) : null;
  const startedAt =
    def.metric === "fcfs" && releaseAtDate && releaseAtDate <= now ? releaseAtDate : now;

  const createdAttempts = await db<
    {
      id: string;
      attempt_token: string;
      started_at: Date;
    }[]
  >`
    INSERT INTO game_attempts (
      user_id,
      device_id,
      game_id,
      seed,
      attempt_number,
      initial_state_hash,
      started_at,
      status,
      ip,
      user_agent,
      country,
      city
    )
    VALUES (
      ${input.userId},
      ${input.deviceId},
      ${game.id},
      ${seed},
      ${attemptNumber},
      ${sha256(JSON.stringify(view))},
      ${startedAt},
      'in_progress',
      ${input.ip},
      ${input.userAgent},
      ${input.country},
      ${input.city}
    )
    RETURNING id, attempt_token, started_at
  `;

  const attempt = createdAttempts[0];

  return {
    attemptToken: attempt.attempt_token,
    gameId: game.id,
    view,
    startedAt: attempt.started_at.toISOString(),
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
  durationMs: number;
  rawDurationMs: number;
  penaltyMs: number;
  score: number | null;
  metric: GameMetric;
  afterDeadline: boolean;
  attemptsRemaining: number;
  unlimited: boolean;
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
  unlimited: boolean;
  valid: boolean;
  afterDeadline: boolean;
  startedAt: string | null;
  submittedAt: string | null;
}

export async function getMyAttemptBySlug(
  slug: string,
  userId: string,
  role: ViewerRole = "player",
): Promise<MyAttempt | null> {
  const db = getDb();
  const gamesRows = await db<{ id: string; game_type: string }[]>`
    SELECT id, game_type FROM games WHERE slug = ${slug} LIMIT 1
  `;
  const game = gamesRows[0];
  if (!game) return null;

  const def = requireGameDef(game.game_type);
  const summaryRows = await db<
    {
      attemptsUsed: number;
      bestScore: number | null;
      bestDurationMs: number | null;
    }[]
  >`
    SELECT
      COUNT(*)::int AS "attemptsUsed",
      MAX(score) FILTER (WHERE server_valid = true AND status = 'submitted') AS "bestScore",
      MIN(duration_ms) FILTER (WHERE server_valid = true AND status = 'submitted') AS "bestDurationMs"
    FROM game_attempts
    WHERE user_id = ${userId} AND game_id = ${game.id}
  `;
  const summary = summaryRows[0];

  const latestRows = await db<
    {
      status: "none" | "in_progress" | "submitted" | "expired" | "void";
      duration_ms: number | null;
      score: number | null;
      server_valid: boolean;
      after_deadline: boolean;
      started_at: Date;
      submitted_at: Date | null;
      attempt_number: number;
    }[]
  >`
    SELECT
      status,
      duration_ms,
      score,
      server_valid,
      after_deadline,
      started_at,
      submitted_at,
      attempt_number
    FROM game_attempts
    WHERE user_id = ${userId} AND game_id = ${game.id}
    ORDER BY attempt_number DESC
    LIMIT 1
  `;
  const latest = latestRows[0];

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const unlimited = isTesterModeEnabled && role !== "player";
  const base = {
    metric: def.metric,
    maxAttempts: def.maxAttempts,
    attemptsUsed: Number(summary?.attemptsUsed ?? 0),
    attemptsRemaining: unlimited
      ? def.maxAttempts
      : Math.max(0, def.maxAttempts - Number(summary?.attemptsUsed ?? 0)),
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
    durationMs: latest.duration_ms != null ? Number(latest.duration_ms) : null,
    score: latest.score != null ? Number(latest.score) : null,
    bestScore: summary?.bestScore != null ? Number(summary.bestScore) : null,
    bestDurationMs: summary?.bestDurationMs != null ? Number(summary.bestDurationMs) : null,
    valid: latest.server_valid,
    afterDeadline: latest.after_deadline,
    startedAt: latest.started_at ? latest.started_at.toISOString() : null,
    submittedAt: latest.submitted_at ? latest.submitted_at.toISOString() : null,
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

export async function getMyRecapBySlug(
  slug: string,
  userId: string,
  role: ViewerRole = "player",
): Promise<TinderRecap | null> {
  const game = await getGameBySlug(slug, role);
  if (!game || game.gameType !== "tinder") return null;

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const isTester = (role === "tester" || role === "admin") && isTesterModeEnabled;

  if (game.status !== "closed" && !isTester) return null;

  const db = getDb();
  const rows = await db<{ seed: string }[]>`
    SELECT seed FROM game_attempts
    WHERE user_id = ${userId} AND game_id = ${game.id} AND status = 'submitted'
    ORDER BY attempt_number DESC
    LIMIT 1
  `;
  const attempt = rows[0];
  if (!attempt) return null;

  return { kind: "tinder", cards: revealDeck(attempt.seed) };
}

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
  const betterCondition =
    params.metric === "score"
      ? db`daily_leaderboard.score IS NULL OR daily_leaderboard.score < EXCLUDED.score`
      : db`daily_leaderboard.duration_ms IS NULL OR daily_leaderboard.duration_ms > EXCLUDED.duration_ms`;

  const written = await db<{ id: string }[]>`
    INSERT INTO daily_leaderboard (
      game_id, user_id, attempt_id, metric, duration_ms, score, started_at, submitted_at, attempts_used, is_flagged
    )
    VALUES (
      ${params.gameId},
      ${params.userId},
      ${params.attemptId},
      ${params.metric},
      ${params.durationMs},
      ${params.score},
      ${params.startedAt},
      ${params.submittedAt},
      ${params.attemptsUsed},
      ${params.isFlagged}
    )
    ON CONFLICT (game_id, user_id) DO UPDATE
    SET
      attempt_id = EXCLUDED.attempt_id,
      duration_ms = EXCLUDED.duration_ms,
      score = EXCLUDED.score,
      submitted_at = EXCLUDED.submitted_at,
      started_at = EXCLUDED.started_at,
      attempts_used = EXCLUDED.attempts_used,
      is_flagged = EXCLUDED.is_flagged
    WHERE ${betterCondition}
    RETURNING id
  `;

  if (written.length > 0) {
    invalidateShared("leaderboard:");
    invalidateShared("userboard:");
    return true;
  }

  await db`
    UPDATE daily_leaderboard
    SET attempts_used = ${params.attemptsUsed}
    WHERE game_id = ${params.gameId} AND user_id = ${params.userId}
  `;
  invalidateShared("leaderboard:");
  invalidateShared("userboard:");
  return false;
}

export async function finishAttempt(input: FinishInput): Promise<FinishResult> {
  const db = getDb();
  const attemptRows = await db<
    {
      id: string;
      user_id: string;
      game_id: string;
      device_id: string;
      seed: string;
      attempt_number: number;
      started_at: Date;
      status: string;
      ip: string | null;
    }[]
  >`
    SELECT id, user_id, game_id, device_id, seed, attempt_number, started_at, status, ip
    FROM game_attempts
    WHERE attempt_token = ${input.attemptToken}
    LIMIT 1
  `;
  const attempt = attemptRows[0];
  if (!attempt) throw new HttpError(404, "Attempt not found");
  if (attempt.user_id !== input.userId) throw new HttpError(403, "Forbidden");
  if (attempt.status !== "in_progress") {
    throw new HttpError(409, "This attempt has already been submitted");
  }

  const gameRows = await db<Game[]>`
    SELECT
      id,
      slug,
      day,
      title,
      hint,
      game_type AS "gameType",
      difficulty,
      release_at AS "releaseAt",
      end_at AS "endAt",
      preview_at AS "previewAt",
      tester_early_hours AS "testerEarlyHours",
      status,
      assets_json AS "assetsJson",
      published,
      created_at AS "createdAt"
    FROM games
    WHERE id = ${attempt.game_id}
    LIMIT 1
  `;
  const game = gameRows[0];
  if (!game) throw new HttpError(404, "Game not found");
  const def = requireGameDef(game.gameType);

  const schedule = await resolveSchedule(game, input.role);
  const now = new Date();
  const rawDurationMs = now.getTime() - attempt.started_at.getTime();
  const afterDeadline = schedule.endAt ? now.getTime() > schedule.endAt.getTime() : false;

  const attemptsUsed = attempt.attempt_number;
  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const unlimited = isTesterModeEnabled && input.role !== "player";
  const attemptsRemaining = unlimited
    ? def.maxAttempts
    : Math.max(0, def.maxAttempts - attemptsUsed);

  if (rawDurationMs > def.maxDurationMs) {
    const expired = await db<{ id: string }[]>`
      UPDATE game_attempts
      SET status = 'expired', duration_ms = ${rawDurationMs}, submitted_at = ${now}
      WHERE id = ${attempt.id} AND status = 'in_progress'
      RETURNING id
    `;
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

  const result = await def.verify({
    seed: attempt.seed,
    difficulty: game.difficulty,
    submission: input.submittedState,
    durationMs: rawDurationMs,
    userId: input.userId,
    startedAt: attempt.started_at,
  });

  const penaltyMs = result.valid ? Math.max(0, result.durationPenaltyMs ?? 0) : 0;
  const durationMs = rawDurationMs + penaltyMs;
  const score = def.metric === "score" ? (result.score ?? 0) : null;
  const isAnomalous = result.valid && rawDurationMs < def.minPlausibleMs;

  const claimed = await db<{ id: string }[]>`
    UPDATE game_attempts
    SET
      submitted_at = ${now},
      duration_ms = ${durationMs},
      score = ${score},
      submitted_state_hash = ${sha256(JSON.stringify(input.submittedState ?? {}))},
      server_valid = ${result.valid},
      is_anomalous = ${isAnomalous},
      after_deadline = ${afterDeadline},
      status = 'submitted',
      moves_count = ${result.movesCount ?? null}
    WHERE id = ${attempt.id} AND status = 'in_progress'
    RETURNING id
  `;
  if (claimed.length === 0) {
    throw new HttpError(409, "This attempt has already been submitted");
  }

  // Non-blocking device counter update
  void db`
    UPDATE devices SET attempts_count = attempts_count + 1 WHERE id = ${attempt.device_id}
  `;

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
        startedAt: attempt.started_at,
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
