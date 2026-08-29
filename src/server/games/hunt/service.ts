import { getDb } from "~/server/db/client";
import type { HuntQuestion } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { logActivity } from "~/server/anti-cheat/log";
import { getSetting } from "~/server/settings/service";
import { getGameByType, type ViewerRole } from "~/server/games/service";
import { invalidateShared, sharedRead } from "~/server/cache";

const RATE_LIMIT_MS = 30_000;

function getActiveHuntQuestions(): Promise<HuntQuestion[]> {
  return sharedRead(
    "hunt:questions",
    async () => {
      const db = getDb();
      return db<HuntQuestion[]>`
        SELECT
          id,
          slug,
          title,
          hint_html AS "hintHtml",
          answer,
          difficulty,
          order_index AS "orderIndex",
          active,
          created_at AS "createdAt"
        FROM hunt_questions
        WHERE active = true
        ORDER BY order_index ASC
      `;
    },
    60_000,
  );
}

interface UserHuntProgressRow {
  id: string;
  user_id: string;
  current_question_id: string | null;
  solved_question_ids: string[];
  solved_count: number;
  last_submitted_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function asSolvedIds(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as string[];
      // Double-encoded case: string contains JSON array string
      if (typeof parsed === "string") {
        const inner = JSON.parse(parsed);
        if (Array.isArray(inner)) return inner as string[];
      }
    } catch {
      // Fall through to empty
    }
    // If string looks like '["a","b"]' but JSON.parse above failed, return empty
    return [];
  }
  return [];
}

async function loadUserHuntProgress(userId: string, allActive: HuntQuestion[]) {
  const db = getDb();
  const rows = await db<UserHuntProgressRow[]>`
    SELECT * FROM user_hunt_progress WHERE user_id = ${userId} LIMIT 1
  `;
  let progress = rows[0];
  if (progress) {
    // Fix double-encoded jsonb string case (see scripts/seed.mjs comment)
    progress = {
      ...progress,
      solved_question_ids: asSolvedIds(
        (progress as unknown as { solved_question_ids: unknown }).solved_question_ids,
      ) as unknown as string[],
    } as UserHuntProgressRow;
  }

  if (!progress) {
    const nextQ = pickNextQuestion(allActive, new Set());
    const created = await db<UserHuntProgressRow[]>`
      INSERT INTO user_hunt_progress (user_id, current_question_id, solved_question_ids, solved_count)
      VALUES (${userId}, ${nextQ?.id ?? null}, '[]'::jsonb, 0)
      RETURNING *
    `;
    progress = created[0];
  } else if (!progress.completed_at && !progress.current_question_id) {
    const solvedSet = new Set(progress.solved_question_ids ?? []);
    const nextQ = pickNextQuestion(allActive, solvedSet);
    if (!nextQ) {
      const updated = await db<UserHuntProgressRow[]>`
        UPDATE user_hunt_progress
        SET completed_at = NOW(), updated_at = NOW()
        WHERE id = ${progress.id}
        RETURNING *
      `;
      progress = updated[0];
    } else {
      const updated = await db<UserHuntProgressRow[]>`
        UPDATE user_hunt_progress
        SET current_question_id = ${nextQ.id}, updated_at = NOW()
        WHERE id = ${progress.id}
        RETURNING *
      `;
      progress = updated[0];
    }
  }
  return progress;
}

/** True only for a six-character code made from ASCII letters and digits. */
export function isTokenAnswer(answer: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(answer.trim());
}

export function normalizeAnswer(val: string): string {
  return val
    .trim()
    .toUpperCase()
    .replace(/^SSH\s+/i, "")
    .replace(/[^A-Z0-9@._-]/gi, "");
}

export function checkAnswerMatch(submitted: string, expected: string): boolean {
  const normSub = normalizeAnswer(submitted);
  const normExp = normalizeAnswer(expected);
  if (normSub === normExp) return true;

  // Extra flexible match for ssh string / tokens
  if (normExp.includes("@") && normSub.includes(normExp)) return true;
  return false;
}

/**
 * Picks the next question in exact sequential order (1 -> 2 -> 3 -> ... -> 10).
 * All players follow the exact same path based on order_index.
 */
export function pickNextQuestion(
  allQuestions: HuntQuestion[],
  solvedIds: Set<string>,
): HuntQuestion | null {
  const unsolved = allQuestions.filter((q) => !solvedIds.has(q.id));
  if (unsolved.length === 0) return null;
  return unsolved[0];
}

export type HuntInputType = "token" | "answer";

export interface HuntPublicState {
  isGameActive: boolean;
  currentQuestion: {
    id: string;
    title: string;
    hintHtml: string;
    difficulty: string;
    orderIndex: number;
    inputType: HuntInputType;
    isBalloon?: boolean;
  } | null;
  solvedQuestionIds: string[];
  solvedCount: number;
  totalQuestionsCount: number;
  allQuestions: {
    id: string;
    title: string;
    difficulty: string;
    orderIndex: number;
    inputType: HuntInputType;
    hintHtml?: string;
    isBalloon?: boolean;
  }[];
  completed: boolean;
  completedAt: string | null;
  cooldownRemainingSec: number;
  isTesterMode?: boolean;
}

export async function getUserHuntState(
  userId: string,
  role: ViewerRole = "player",
): Promise<HuntPublicState> {
  const [allActive, isTesterModeEnabled, huntGame] = await Promise.all([
    getActiveHuntQuestions(),
    getSetting<boolean>("access.tester_mode", true),
    getGameByType("hunt", role),
  ]);

  const isTesterMode = (role === "tester" || role === "admin") && isTesterModeEnabled;
  const isGameActive =
    huntGame?.status === "live" ||
    huntGame?.status === "closed" ||
    huntGame?.status === "tester" ||
    isTesterMode;

  const progress = await sharedRead(
    `hunt:progress:${userId}`,
    () => loadUserHuntProgress(userId, allActive),
    2_000,
  );

  const now = Date.now();
  let cooldownRemainingSec = 0;
  if (progress.last_submitted_at) {
    const elapsed = now - new Date(progress.last_submitted_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      cooldownRemainingSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
    }
  }

  const currentQ = progress.current_question_id
    ? allActive.find((q) => q.id === progress.current_question_id)
    : null;

  const isBalloonQuestion = (q: HuntQuestion) => q.slug === "hunt-c2d5a7f9";

  return {
    isGameActive,
    currentQuestion: currentQ
      ? {
          id: currentQ.id,
          title: currentQ.title,
          hintHtml: currentQ.hintHtml,
          difficulty: currentQ.difficulty,
          orderIndex: currentQ.orderIndex,
          inputType: (isTokenAnswer(currentQ.answer) ? "token" : "answer") as HuntInputType,
          ...(isBalloonQuestion(currentQ) ? { isBalloon: true as const } : {}),
        }
      : null,
    solvedQuestionIds: progress.solved_question_ids ?? [],
    solvedCount: (progress.solved_question_ids ?? []).length,
    totalQuestionsCount: allActive.length,
    allQuestions: allActive.map((q) => ({
      id: q.id,
      title: q.title,
      difficulty: q.difficulty,
      orderIndex: q.orderIndex,
      inputType: (isTokenAnswer(q.answer) ? "token" : "answer") as HuntInputType,
      ...(isTesterMode
        ? {
            hintHtml: q.hintHtml,
            ...(isBalloonQuestion(q) ? { isBalloon: true as const } : {}),
          }
        : {}),
    })),
    completed: !!progress.completed_at,
    completedAt: progress.completed_at ? new Date(progress.completed_at).toISOString() : null,
    cooldownRemainingSec,
    ...(isTesterMode ? { isTesterMode: true as const } : {}),
  };
}

export interface HuntSubmitResult {
  valid: boolean;
  reason?: string;
  cooldownRemainingSec: number;
  solvedQuestionId?: string;
  isComplete?: boolean;
  score?: number;
  durationMs?: number;
  submittedAt?: string;
  state: HuntPublicState;
}

export async function submitHuntAnswer(
  userId: string,
  rawAnswer: string,
  meta: { ip?: string; deviceId?: string; userAgent?: string } = {},
  role: ViewerRole = "player",
): Promise<HuntSubmitResult> {
  const db = getDb();
  const allActive = await getActiveHuntQuestions();

  const progressRows = await db<UserHuntProgressRow[]>`
    SELECT * FROM user_hunt_progress WHERE user_id = ${userId} LIMIT 1
  `;
  let progress = progressRows[0] as UserHuntProgressRow & { solved_question_ids: unknown };
  if (progress) {
    (progress as unknown as { solved_question_ids: string[] }).solved_question_ids = asSolvedIds(
      (progress as unknown as { solved_question_ids: unknown }).solved_question_ids,
    );
  }

  if (!progress) {
    throw new HttpError(400, "Hunt progress not initialized");
  }

  const now = Date.now();

  // 30-second rate limit
  if (progress.last_submitted_at) {
    const elapsed = now - new Date(progress.last_submitted_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return {
        valid: false,
        reason: `Rate limit hit. Please wait ${waitSec}s before submitting again.`,
        cooldownRemainingSec: waitSec,
        state: await getUserHuntState(userId, role),
      };
    }
  }

  if (progress.completed_at || !progress.current_question_id) {
    return {
      valid: false,
      reason: "You have already completed all available treasures in the hunt!",
      cooldownRemainingSec: 0,
      state: await getUserHuntState(userId, role),
    };
  }

  const currentQ = allActive.find((q) => q.id === progress.current_question_id);
  if (!currentQ) {
    throw new HttpError(404, "Active question not found");
  }
  if (!checkAnswerMatch(rawAnswer, currentQ.answer)) {
    await db`
      UPDATE user_hunt_progress
      SET last_submitted_at = NOW(), updated_at = NOW()
      WHERE id = ${progress.id}
    `;
    invalidateShared(`hunt:progress:${userId}`);

    await logActivity({
      userId,
      deviceId: meta.deviceId,
      ip: meta.ip,
      eventType: "hunt_answer_wrong",
      meta: {
        questionId: currentQ.id,
        questionSlug: currentQ.slug,
        submitted: rawAnswer.slice(0, 100),
      },
    });

    return {
      valid: false,
      reason: "That is not the right token. Look closely at the hint!",
      cooldownRemainingSec: Math.ceil(RATE_LIMIT_MS / 1000),
      state: await getUserHuntState(userId, role),
    };
  }

  const solvedSet = new Set(asSolvedIds(progress.solved_question_ids ?? []));
  solvedSet.add(currentQ.id);
  const updatedSolvedList = Array.from(solvedSet);

  const nextQ = pickNextQuestion(allActive, solvedSet);
  const isComplete = !nextQ || updatedSolvedList.length >= allActive.length;
  const finalScore = Math.min(allActive.length, updatedSolvedList.length);
  let completionDurationMs: number | undefined;
  let completionSubmittedAt: Date | undefined;

  await db`
    UPDATE user_hunt_progress
    SET
      solved_question_ids = ${db.json(updatedSolvedList)},
      solved_count = ${finalScore},
      current_question_id = ${nextQ?.id ?? null},
      last_submitted_at = NULL,
      completed_at = ${isComplete ? new Date() : null},
      updated_at = NOW()
    WHERE id = ${progress.id}
  `;
  invalidateShared(`hunt:progress:${userId}`);

  // Update daily_leaderboard and game_attempts on EVERY correct clue solved so live progress
  // (e.g. 1/10, 4/10, 10/10) is reflected on the leaderboard immediately for all players.
  try {
    const huntGameRows = await db<{ id: string; end_at: Date | null; release_at: Date | null }[]>`
      SELECT id, end_at, release_at FROM games WHERE game_type = 'hunt' LIMIT 1
    `;
    const huntGame = huntGameRows[0];

    if (huntGame) {
      const attemptRows = await db<
        { id: string; started_at: Date; attempt_number: number; status: string }[]
      >`
        SELECT id, started_at, attempt_number, status FROM game_attempts
        WHERE user_id = ${userId} AND game_id = ${huntGame.id}
        ORDER BY started_at DESC
        LIMIT 1
      `;
      let attempt = attemptRows[0];
      const submittedAt = new Date();
      const releaseTime = huntGame.release_at
        ? new Date(huntGame.release_at)
        : (attempt?.started_at ?? submittedAt);
      const durationMs = Math.max(0, submittedAt.getTime() - releaseTime.getTime());
      const afterDeadline = !!huntGame.end_at && submittedAt > new Date(huntGame.end_at);
      completionDurationMs = durationMs;
      completionSubmittedAt = submittedAt;

      if (!attempt) {
        const seed = `foss-onam:daily-game:treasure-hunt:day-6:${userId}`;
        const newAttempt = await db<{ id: string; started_at: Date; attempt_number: number }[]>`
          INSERT INTO game_attempts (
            user_id, device_id, game_id, seed, attempt_number, attempt_token, started_at, status
          )
          VALUES (
            ${userId},
            ${meta.deviceId ?? "hunt-direct"},
            ${huntGame.id},
            ${seed},
            1,
            ${`hunt-${userId}-${Date.now()}`},
            ${releaseTime},
            ${isComplete ? "submitted" : "in_progress"}
          )
          RETURNING id, started_at, attempt_number
        `;
        attempt = { ...newAttempt[0], status: isComplete ? "submitted" : "in_progress" };
      } else {
        await db`
          UPDATE game_attempts
          SET submitted_at = ${submittedAt},
              duration_ms = ${durationMs},
              score = ${finalScore},
              server_valid = true,
              after_deadline = ${afterDeadline},
              status = ${isComplete ? "submitted" : "in_progress"}
          WHERE id = ${attempt.id}
        `;
      }

      if (!afterDeadline && attempt) {
        await db`
          INSERT INTO daily_leaderboard (
            game_id, user_id, attempt_id, metric, score, duration_ms, attempts_used, started_at, submitted_at
          )
          VALUES (
            ${huntGame.id},
            ${userId},
            ${attempt.id},
            'score',
            ${finalScore},
            ${durationMs},
            ${attempt.attempt_number},
            ${releaseTime},
            ${submittedAt}
          )
          ON CONFLICT (game_id, user_id) DO UPDATE
          SET score = ${finalScore},
              duration_ms = EXCLUDED.duration_ms,
              attempt_id = EXCLUDED.attempt_id,
              started_at = EXCLUDED.started_at,
              submitted_at = EXCLUDED.submitted_at,
              attempts_used = EXCLUDED.attempts_used
        `;
      }
      invalidateShared("leaderboard:");
      invalidateShared("userboard:");
    }
  } catch {
    /* Hunt progress is already recorded; leaderboard sync is best effort. */
  }

  await logActivity({
    userId,
    deviceId: meta.deviceId,
    ip: meta.ip,
    eventType: isComplete ? "hunt_completed" : "hunt_answer_correct",
    meta: {
      questionId: currentQ!.id,
      questionSlug: currentQ!.slug,
      totalSolved: updatedSolvedList.length,
      isComplete,
    },
  });

  const nextState = await getUserHuntState(userId, role);

  return {
    valid: true,
    solvedQuestionId: currentQ!.id,
    isComplete,
    ...(isComplete
      ? {
          score: updatedSolvedList.length,
          ...(completionDurationMs !== undefined ? { durationMs: completionDurationMs } : {}),
          ...(completionSubmittedAt ? { submittedAt: completionSubmittedAt.toISOString() } : {}),
        }
      : {}),
    cooldownRemainingSec: 0,
    state: nextState,
  };
}
