import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import {
  dailyLeaderboard,
  gameAttempts,
  games,
  huntQuestions,
  userHuntProgress,
  type HuntQuestion,
} from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { logActivity } from "~/server/anti-cheat/log";
import { getSetting } from "~/server/settings/service";
import { getGameBySlug, type ViewerRole } from "~/server/games/service";
import { sharedRead } from "~/server/cache";

const RATE_LIMIT_MS = 30_000;

function getActiveHuntQuestions(): Promise<HuntQuestion[]> {
  return sharedRead(
    "hunt:questions",
    () =>
      getDb()
        .select()
        .from(huntQuestions)
        .where(eq(huntQuestions.active, true))
        .orderBy(huntQuestions.orderIndex),
    60_000,
  );
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
    // Opaque flag for special client behavior (e.g. treasure balloon) — avoids leaking slug/hint
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
  const db = getDb();

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

  let [progress] = await db
    .select()
    .from(userHuntProgress)
    .where(eq(userHuntProgress.userId, userId))
    .limit(1);

  const now = Date.now();

  if (!progress) {
    const nextQ = pickNextQuestion(allActive, new Set());
    const [created] = await db
      .insert(userHuntProgress)
      .values({
        userId,
        currentQuestionId: nextQ?.id ?? null,
        solvedQuestionIds: [],
        solvedCount: 0,
      })
      .returning();
    progress = created;
  } else if (!progress.completedAt && !progress.currentQuestionId) {
    const solvedSet = new Set(progress.solvedQuestionIds ?? []);
    const nextQ = pickNextQuestion(allActive, solvedSet);
    if (!nextQ) {
      const [updated] = await db
        .update(userHuntProgress)
        .set({ completedAt: new Date(), updatedAt: new Date() })
        .where(eq(userHuntProgress.id, progress.id))
        .returning();
      progress = updated;
    } else {
      const [updated] = await db
        .update(userHuntProgress)
        .set({ currentQuestionId: nextQ.id, updatedAt: new Date() })
        .where(eq(userHuntProgress.id, progress.id))
        .returning();
      progress = updated;
    }
  }

  let cooldownRemainingSec = 0;
  if (progress.lastSubmittedAt) {
    const elapsed = now - new Date(progress.lastSubmittedAt).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      cooldownRemainingSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
    }
  }

  const currentQ = progress.currentQuestionId
    ? allActive.find((q) => q.id === progress.currentQuestionId)
    : null;

  // Internal: detect balloon question without exposing slug/answer to client
  // Only active when the treasure hunt game itself is open/live!
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
    solvedQuestionIds: progress.solvedQuestionIds ?? [],
    solvedCount: (progress.solvedQuestionIds ?? []).length,
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
    completed: !!progress.completedAt,
    completedAt: progress.completedAt?.toISOString() ?? null,
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

  let [progress] = await db
    .select()
    .from(userHuntProgress)
    .where(eq(userHuntProgress.userId, userId))
    .limit(1);

  if (!progress) {
    throw new HttpError(400, "Hunt progress not initialized");
  }

  const now = Date.now();

  const isTesterModeEnabled = await getSetting<boolean>("access.tester_mode", true);
  const isTesterMode = (role === "tester" || role === "admin") && isTesterModeEnabled;

  // 30-second rate limit
  if (progress.lastSubmittedAt) {
    const elapsed = now - new Date(progress.lastSubmittedAt).getTime();
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

  if (progress.completedAt || !progress.currentQuestionId) {
    // In tester mode, completedAt may be null but all treasures could already be solved
    const solvedSetEarly = new Set(progress.solvedQuestionIds ?? []);
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
    const solvedSet = new Set(progress.solvedQuestionIds ?? []);
    const unsolved = allActive.filter((q) => !solvedSet.has(q.id));
    currentQ = unsolved.find((q) => checkAnswerMatch(rawAnswer, q.answer));
    // Fallback to currentQuestionId if answer matches that specifically (allows precise tester debug)
    if (!currentQ) {
      currentQ = allActive.find((q) => q.id === progress.currentQuestionId);
      if (currentQ && !checkAnswerMatch(rawAnswer, currentQ.answer)) {
        currentQ = undefined;
      }
    }
    if (!currentQ) {
      // No unsolved matches — treat as wrong answer for the current question for logging
      const fallbackQ = allActive.find((q) => q.id === progress.currentQuestionId) ?? unsolved[0];
      if (!fallbackQ) throw new HttpError(404, "Active question not found");
      await db
        .update(userHuntProgress)
        .set({ lastSubmittedAt: new Date(), updatedAt: new Date() })
        .where(eq(userHuntProgress.id, progress.id));

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
    currentQ = allActive.find((q) => q.id === progress.currentQuestionId);
    if (!currentQ) {
      throw new HttpError(404, "Active question not found");
    }
    if (!checkAnswerMatch(rawAnswer, currentQ.answer)) {
      // Cooldown is applied ONLY on failed attempts
      await db
        .update(userHuntProgress)
        .set({ lastSubmittedAt: new Date(), updatedAt: new Date() })
        .where(eq(userHuntProgress.id, progress.id));

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

  // Correct answer! Reset any past cooldown and proceed immediately
  if (!currentQ) throw new HttpError(404, "Active question not found");
  const solvedSet = new Set(progress.solvedQuestionIds ?? []);
  solvedSet.add(currentQ!.id);
  const updatedSolvedList = Array.from(solvedSet);

  const nextQ = pickNextQuestion(allActive, solvedSet);
  const isComplete = !nextQ;

  await db
    .update(userHuntProgress)
    .set({
      solvedQuestionIds: updatedSolvedList,
      solvedCount: updatedSolvedList.length,
      currentQuestionId: nextQ?.id ?? null,
      lastSubmittedAt: null,
      completedAt: isComplete ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(userHuntProgress.id, progress.id));

  // Live update the Treasure Hunt ranking on dailyLeaderboard by number of treasures found
  try {
    const [huntGame] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.gameType, "hunt"))
      .limit(1);

    if (huntGame) {
      const [attempt] = await db
        .select({ id: gameAttempts.id, startedAt: gameAttempts.startedAt })
        .from(gameAttempts)
        .where(eq(gameAttempts.userId, userId))
        .orderBy(desc(gameAttempts.startedAt))
        .limit(1);

      if (attempt) {
        await db
          .insert(dailyLeaderboard)
          .values({
            gameId: huntGame.id,
            userId,
            attemptId: attempt.id,
            metric: "score",
            score: updatedSolvedList.length,
            durationMs: null,
            attemptsUsed: 1,
            startedAt: attempt.startedAt,
            submittedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [dailyLeaderboard.gameId, dailyLeaderboard.userId],
            set: {
              score: sql`greatest(${dailyLeaderboard.score}, ${updatedSolvedList.length})`,
              submittedAt: new Date(),
            },
          });
      }
    }
  } catch {
    /* ignore leaderboard sync errors to avoid blocking answer submission */
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
