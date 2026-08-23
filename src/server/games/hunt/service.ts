import { getDb } from "~/server/db/client";
import type { HuntQuestion } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { logActivity } from "~/server/anti-cheat/log";
import { getSetting } from "~/server/settings/service";
import { getGameBySlug, type ViewerRole } from "~/server/games/service";
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

async function loadUserHuntProgress(userId: string, allActive: HuntQuestion[]) {
  const db = getDb();
  const rows = await db<UserHuntProgressRow[]>`
    SELECT * FROM user_hunt_progress WHERE user_id = ${userId} LIMIT 1
  `;
  let progress = rows[0];

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

/** True for 6-char alphanumeric token (e.g. 3X91A4). No dashes/specials. */
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

function checkAnswerMatch(submitted: string, expected: string): boolean {
  const normSub = normalizeAnswer(submitted);
  const normExp = normalizeAnswer(expected);
  if (normSub === normExp) return true;

  // Extra flexible match for ssh string / tokens
  if (normExp.includes("@") && normSub.includes(normExp)) return true;
  return false;
}

/**
 * Picks the next question according to difficulty hierarchy:
 * 1. Unsolved "first" questions (fixed introductory challenge)
 * 2. Random unsolved "easy" questions until exhausted
 * 3. Random unsolved "medium" questions until exhausted
 * 4. Random unsolved "hard" questions until exhausted
 */
function pickNextQuestion(
  allQuestions: HuntQuestion[],
  solvedIds: Set<string>,
): HuntQuestion | null {
  const unsolved = allQuestions.filter((q) => !solvedIds.has(q.id));
  if (unsolved.length === 0) return null;

  // 1. First priority
  const firsts = unsolved.filter((q) => q.difficulty === "first");
  if (firsts.length > 0) {
    return firsts[0];
  }

  // 2. Easy priority (pick random)
  const easies = unsolved.filter((q) => q.difficulty === "easy");
  if (easies.length > 0) {
    return easies[Math.floor(Math.random() * easies.length)];
  }

  // 3. Medium priority (pick random)
  const mediums = unsolved.filter((q) => q.difficulty === "medium");
  if (mediums.length > 0) {
    return mediums[Math.floor(Math.random() * mediums.length)];
  }

  // 4. Hard priority (pick random)
  const hards = unsolved.filter((q) => q.difficulty === "hard");
  if (hards.length > 0) {
    return hards[Math.floor(Math.random() * hards.length)];
  }

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
    getGameBySlug("treasure-hunt", role),
  ]);

  const isTesterMode = (role === "tester" || role === "admin") && isTesterModeEnabled;
  const isGameActive =
    huntGame?.status === "live" ||
    huntGame?.status === "closed" ||
    (isTesterMode && huntGame?.status === "tester");

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

  const isBalloonQuestion = (q: HuntQuestion) => isGameActive && q.slug === "hunt-c2d5a7f9";

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
  const progress = progressRows[0];

  if (!progress) {
    throw new HttpError(400, "Hunt progress not initialized");
  }

  const now = Date.now();
  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const isTesterMode = (role === "tester" || role === "admin") && isTesterModeEnabled;

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
    const solvedSetEarly = new Set(progress.solved_question_ids ?? []);
    const hasUnsolved = allActive.some((q) => !solvedSetEarly.has(q.id));
    if (!hasUnsolved) {
      return {
        valid: false,
        reason: "You have already completed all available treasures in the hunt!",
        cooldownRemainingSec: 0,
        state: await getUserHuntState(userId, role),
      };
    }
    if (!isTesterMode) {
      return {
        valid: false,
        reason: "You have already completed all available treasures in the hunt!",
        cooldownRemainingSec: 0,
        state: await getUserHuntState(userId, role),
      };
    }
  }

  let currentQ: HuntQuestion | undefined;
  if (isTesterMode) {
    const solvedSet = new Set(progress.solved_question_ids ?? []);
    const unsolved = allActive.filter((q) => !solvedSet.has(q.id));
    currentQ = unsolved.find((q) => checkAnswerMatch(rawAnswer, q.answer));
    if (!currentQ) {
      currentQ = allActive.find((q) => q.id === progress.current_question_id);
      if (currentQ && !checkAnswerMatch(rawAnswer, currentQ.answer)) {
        currentQ = undefined;
      }
    }
    if (!currentQ) {
      const fallbackQ = allActive.find((q) => q.id === progress.current_question_id) ?? unsolved[0];
      if (!fallbackQ) throw new HttpError(404, "Active question not found");
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
          questionId: fallbackQ.id,
          questionSlug: fallbackQ.slug,
          submitted: rawAnswer.slice(0, 100),
          testerMode: true,
        },
      });

      return {
        valid: false,
        reason: "That is not the right token. Look closely at the hint!",
        cooldownRemainingSec: Math.ceil(RATE_LIMIT_MS / 1000),
        state: await getUserHuntState(userId, role),
      };
    }
  } else {
    currentQ = allActive.find((q) => q.id === progress.current_question_id);
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
  }

  if (!currentQ) throw new HttpError(404, "Active question not found");
  const solvedSet = new Set(progress.solved_question_ids ?? []);
  solvedSet.add(currentQ!.id);
  const updatedSolvedList = Array.from(solvedSet);

  const nextQ = pickNextQuestion(allActive, solvedSet);
  const isComplete = !nextQ;

  await db`
    UPDATE user_hunt_progress
    SET
      solved_question_ids = ${JSON.stringify(updatedSolvedList)}::jsonb,
      solved_count = ${updatedSolvedList.length},
      current_question_id = ${nextQ?.id ?? null},
      last_submitted_at = NULL,
      completed_at = ${isComplete ? new Date() : null},
      updated_at = NOW()
    WHERE id = ${progress.id}
  `;
  invalidateShared(`hunt:progress:${userId}`);

  try {
    const huntGameRows = await db<{ id: string }[]>`
      SELECT id FROM games WHERE game_type = 'hunt' LIMIT 1
    `;
    const huntGame = huntGameRows[0];

    if (huntGame) {
      const attemptRows = await db<{ id: string; started_at: Date }[]>`
        SELECT id, started_at FROM game_attempts
        WHERE user_id = ${userId}
        ORDER BY started_at DESC
        LIMIT 1
      `;
      const attempt = attemptRows[0];

      if (attempt) {
        await db`
          INSERT INTO daily_leaderboard (
            game_id, user_id, attempt_id, metric, score, duration_ms, attempts_used, started_at, submitted_at
          )
          VALUES (
            ${huntGame.id},
            ${userId},
            ${attempt.id},
            'score',
            ${updatedSolvedList.length},
            NULL,
            1,
            ${attempt.started_at},
            NOW()
          )
          ON CONFLICT (game_id, user_id) DO UPDATE
          SET
            score = GREATEST(daily_leaderboard.score, ${updatedSolvedList.length}),
            submitted_at = NOW()
        `;
      }
    }
  } catch {
    /* ignore leaderboard sync errors */
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
    cooldownRemainingSec: 0,
    state: nextState,
  };
}
