import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { huntQuestions, userHuntProgress, type HuntQuestion } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { logActivity } from "~/server/anti-cheat/log";

const RATE_LIMIT_MS = 60_000;

export function normalizeAnswer(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/^ssh\s+/i, "")
    .replace(/[^a-z0-9@._-]/gi, "");
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

export interface HuntPublicState {
  currentQuestion: {
    id: string;
    slug: string;
    title: string;
    hintHtml: string;
    difficulty: string;
    orderIndex: number;
  } | null;
  solvedQuestionIds: string[];
  solvedCount: number;
  totalQuestionsCount: number;
  allQuestions: {
    id: string;
    slug: string;
    title: string;
    difficulty: string;
    orderIndex: number;
  }[];
  completed: boolean;
  completedAt: string | null;
  cooldownRemainingSec: number;
}

export async function getUserHuntState(userId: string): Promise<HuntPublicState> {
  const db = getDb();

  const allActive = await db
    .select()
    .from(huntQuestions)
    .where(eq(huntQuestions.active, true))
    .orderBy(huntQuestions.orderIndex);

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

  return {
    currentQuestion: currentQ
      ? {
          id: currentQ.id,
          slug: currentQ.slug,
          title: currentQ.title,
          hintHtml: currentQ.hintHtml,
          difficulty: currentQ.difficulty,
          orderIndex: currentQ.orderIndex,
        }
      : null,
    solvedQuestionIds: progress.solvedQuestionIds ?? [],
    solvedCount: (progress.solvedQuestionIds ?? []).length,
    totalQuestionsCount: allActive.length,
    allQuestions: allActive.map((q) => ({
      id: q.id,
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      orderIndex: q.orderIndex,
    })),
    completed: !!progress.completedAt,
    completedAt: progress.completedAt?.toISOString() ?? null,
    cooldownRemainingSec,
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
): Promise<HuntSubmitResult> {
  const db = getDb();

  const allActive = await db
    .select()
    .from(huntQuestions)
    .where(eq(huntQuestions.active, true))
    .orderBy(huntQuestions.orderIndex);

  let [progress] = await db
    .select()
    .from(userHuntProgress)
    .where(eq(userHuntProgress.userId, userId))
    .limit(1);

  if (!progress) {
    throw new HttpError(400, "Hunt progress not initialized");
  }

  const now = Date.now();

  // 60-second rate limit
  if (progress.lastSubmittedAt) {
    const elapsed = now - new Date(progress.lastSubmittedAt).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return {
        valid: false,
        reason: `Rate limit hit. Please wait ${waitSec}s before submitting again.`,
        cooldownRemainingSec: waitSec,
        state: await getUserHuntState(userId),
      };
    }
  }

  if (progress.completedAt || !progress.currentQuestionId) {
    return {
      valid: false,
      reason: "You have already completed all available treasures in the hunt!",
      cooldownRemainingSec: 0,
      state: await getUserHuntState(userId),
    };
  }

  const currentQ = allActive.find((q) => q.id === progress.currentQuestionId);
  if (!currentQ) {
    throw new HttpError(404, "Active question not found");
  }

  // Update lastSubmittedAt immediately for rate limiting
  await db
    .update(userHuntProgress)
    .set({ lastSubmittedAt: new Date(), updatedAt: new Date() })
    .where(eq(userHuntProgress.id, progress.id));

  const isCorrect = checkAnswerMatch(rawAnswer, currentQ.answer);

  if (!isCorrect) {
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
      state: await getUserHuntState(userId),
    };
  }

  // Correct answer!
  const solvedSet = new Set(progress.solvedQuestionIds ?? []);
  solvedSet.add(currentQ.id);
  const updatedSolvedList = Array.from(solvedSet);

  const nextQ = pickNextQuestion(allActive, solvedSet);
  const isComplete = !nextQ;

  await db
    .update(userHuntProgress)
    .set({
      solvedQuestionIds: updatedSolvedList,
      solvedCount: updatedSolvedList.length,
      currentQuestionId: nextQ?.id ?? null,
      completedAt: isComplete ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(userHuntProgress.id, progress.id));

  await logActivity({
    userId,
    deviceId: meta.deviceId,
    ip: meta.ip,
    eventType: isComplete ? "hunt_completed" : "hunt_answer_correct",
    meta: {
      questionId: currentQ.id,
      questionSlug: currentQ.slug,
      totalSolved: updatedSolvedList.length,
      isComplete,
    },
  });

  const nextState = await getUserHuntState(userId);

  return {
    valid: true,
    solvedQuestionId: currentQ.id,
    isComplete,
    cooldownRemainingSec: Math.ceil(RATE_LIMIT_MS / 1000),
    state: nextState,
  };
}
