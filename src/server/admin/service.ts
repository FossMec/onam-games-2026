import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  activityLogs,
  appSettings,
  collabMessages,
  dailyLeaderboard,
  devices,
  gameAttempts,
  games,
  getDb,
  pookalamSubmissions,
  suspiciousLogs,
  testers,
  userDevices,
  users,
} from "~/server/db/client";
import { invalidateShared } from "~/server/cache";
import { requireAdmin } from "~/server/auth/service";
import type { BanLevel } from "~/server/auth/bans";
import { setBanLevel } from "~/server/auth/bans";
import { ensureDefaultSettings } from "~/server/settings/defaults";
import { ensureMessageTables } from "~/server/pookalam/comments";

export async function adminListUsers(limit = 100, offset = 0) {
  await requireAdmin();
  return getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      college: users.college,
      branch: users.branch,
      batch: users.batch,
      banLevel: users.banLevel,
      banUntil: users.banUntil,
      banReason: users.banReason,
      trustScore: users.trustScore,
      streakCount: users.streakCount,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function adminSetUserRole(userId: string, role: "player" | "tester" | "admin") {
  await requireAdmin();
  await getDb().update(users).set({ role }).where(eq(users.id, userId));
}

/**
 * Sets a player's ban level (0-4). Level 4 is only ever reachable from here -
 * automated anti-cheat can propose it, but a human confirms it, because the
 * shared-NAT and shared-device signals this event runs on produce real false
 * positives.
 */
export async function adminSetUserBanLevel(userId: string, level: BanLevel, reason?: string) {
  await requireAdmin();
  await setBanLevel(userId, level, level === 0 ? null : (reason ?? "set by admin"));
}

export async function adminListTesters(limit = 100, offset = 0) {
  await requireAdmin();
  return getDb()
    .select({
      id: testers.id,
      email: testers.email,
      earlyHours: testers.earlyHours,
      active: testers.active,
      activatedAt: testers.activatedAt,
      createdAt: testers.createdAt,
    })
    .from(testers)
    .orderBy(desc(testers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function adminAddTester(email: string, earlyHours = 24) {
  await requireAdmin();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Invalid email");
  await getDb()
    .insert(testers)
    .values({ email: normalized, earlyHours })
    .onConflictDoUpdate({
      target: testers.email,
      set: { active: true, earlyHours, activatedAt: new Date() },
    });
}

export async function adminSetTesterActive(id: string, active: boolean) {
  await requireAdmin();
  await getDb().update(testers).set({ active }).where(eq(testers.id, id));
}

export async function adminListSuspicious(limit = 100, offset = 0) {
  await requireAdmin();
  return getDb()
    .select({
      id: suspiciousLogs.id,
      eventType: suspiciousLogs.eventType,
      severity: suspiciousLogs.severity,
      actionTaken: suspiciousLogs.actionTaken,
      details: suspiciousLogs.detailsJson,
      ip: suspiciousLogs.ip,
      userEmail: users.email,
      deviceHash: devices.deviceHash,
      createdAt: suspiciousLogs.createdAt,
    })
    .from(suspiciousLogs)
    .leftJoin(users, eq(users.id, suspiciousLogs.userId))
    .leftJoin(devices, eq(devices.id, suspiciousLogs.deviceId))
    .orderBy(desc(suspiciousLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function adminListActivity(limit = 100, offset = 0) {
  await requireAdmin();
  return getDb()
    .select({
      id: activityLogs.id,
      eventType: activityLogs.eventType,
      meta: activityLogs.metaJson,
      ip: activityLogs.ip,
      userEmail: users.email,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(users, eq(users.id, activityLogs.userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function adminListSettings() {
  await requireAdmin();
  await ensureDefaultSettings();
  return getDb().select().from(appSettings).orderBy(appSettings.group);
}

export async function adminUpdateSetting(
  key: string,
  value: unknown,
  group?: string,
  description?: string,
) {
  await requireAdmin();
  const { setSetting } = await import("~/server/settings/service");
  const [row] = await getDb()
    .select({ group: appSettings.group, description: appSettings.description })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  await setSetting(key, value, {
    group: group ?? row?.group ?? "general",
    description: description ?? row?.description ?? undefined,
  });
}

export async function adminDeviceCount(userId: string): Promise<number> {
  await requireAdmin();
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(userDevices)
    .where(eq(userDevices.userId, userId));
  return row?.count ?? 0;
}

export async function adminListGames() {
  await requireAdmin();
  return getDb().select().from(games).orderBy(asc(games.day));
}

export async function adminCreateGame(input: {
  slug: string;
  day: number;
  title: string;
  hint?: string;
  gameType: string;
  difficulty?: string;
  releaseAt?: string | null;
  endAt?: string | null;
  /** Null = derive it from `schedule.preview_hours`, which is the normal case. */
  previewAt?: string | null;
  testerEarlyHours?: number;
  published?: boolean;
}) {
  await requireAdmin();
  await getDb()
    .insert(games)
    .values({
      slug: input.slug.trim().toLowerCase(),
      day: input.day,
      title: input.title,
      hint: input.hint ?? null,
      gameType: input.gameType,
      difficulty: input.difficulty ?? "normal",
      releaseAt: input.releaseAt ? new Date(input.releaseAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
      previewAt: input.previewAt ? new Date(input.previewAt) : null,
      testerEarlyHours: input.testerEarlyHours ?? 24,
      published: input.published ?? false,
    });
  invalidateShared("games:");
}

export async function adminUpdateGame(
  id: string,
  patch: Partial<{
    slug: string;
    day: number;
    title: string;
    hint: string | null;
    gameType: string;
    difficulty: string;
    releaseAt: string | null;
    endAt: string | null;
    previewAt: string | null;
    testerEarlyHours: number;
    published: boolean;
  }>,
) {
  await requireAdmin();
  await getDb()
    .update(games)
    .set({
      ...patch,
      releaseAt: patch.releaseAt
        ? new Date(patch.releaseAt)
        : patch.releaseAt === null
          ? null
          : undefined,
      endAt: patch.endAt ? new Date(patch.endAt) : patch.endAt === null ? null : undefined,
      previewAt: patch.previewAt
        ? new Date(patch.previewAt)
        : patch.previewAt === null
          ? null
          : undefined,
    })
    .where(eq(games.id, id));
  invalidateShared("games:");
}

export async function adminDeleteGame(id: string) {
  await requireAdmin();
  await getDb().delete(games).where(eq(games.id, id));
  invalidateShared("games:");
}

export async function adminGetMetrics() {
  await requireAdmin();
  const db = getDb();
  const [
    [userCount],
    [testerCount],
    [gameCount],
    [suspiciousCount],
    [attemptCount],
    [pookalamCount],
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(testers)
      .where(eq(testers.active, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(games),
    db.select({ count: sql<number>`count(*)::int` }).from(suspiciousLogs),
    db.select({ count: sql<number>`count(*)::int` }).from(gameAttempts),
    db.select({ count: sql<number>`count(*)::int` }).from(pookalamSubmissions),
  ]);

  return {
    totalUsers: userCount?.count ?? 0,
    activeTesters: testerCount?.count ?? 0,
    totalGames: gameCount?.count ?? 0,
    suspiciousEvents: suspiciousCount?.count ?? 0,
    totalAttempts: attemptCount?.count ?? 0,
    pookalamSubmissions: pookalamCount?.count ?? 0,
  };
}

export async function adminListAttempts(limit = 100, offset = 0) {
  await requireAdmin();
  const db = getDb();
  return db
    .select({
      id: gameAttempts.id,
      gameId: gameAttempts.gameId,
      gameTitle: games.title,
      gameSlug: games.slug,
      gameDay: games.day,
      userId: gameAttempts.userId,
      userName: users.name,
      userEmail: users.email,
      attemptNumber: gameAttempts.attemptNumber,
      status: gameAttempts.status,
      durationMs: gameAttempts.durationMs,
      score: gameAttempts.score,
      movesCount: gameAttempts.movesCount,
      serverValid: gameAttempts.serverValid,
      isAnomalous: gameAttempts.isAnomalous,
      afterDeadline: gameAttempts.afterDeadline,
      ip: gameAttempts.ip,
      deviceHash: devices.deviceHash,
      startedAt: gameAttempts.startedAt,
      submittedAt: gameAttempts.submittedAt,
      createdAt: gameAttempts.createdAt,
    })
    .from(gameAttempts)
    .innerJoin(games, eq(games.id, gameAttempts.gameId))
    .innerJoin(users, eq(users.id, gameAttempts.userId))
    .leftJoin(devices, eq(devices.id, gameAttempts.deviceId))
    .orderBy(desc(gameAttempts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function adminVoidAttempt(attemptId: string) {
  await requireAdmin();
  const db = getDb();
  const [attempt] = await db
    .select()
    .from(gameAttempts)
    .where(eq(gameAttempts.id, attemptId))
    .limit(1);
  if (!attempt) throw new Error("Attempt not found");

  // Mark attempt void
  await db
    .update(gameAttempts)
    .set({ status: "void", serverValid: false })
    .where(eq(gameAttempts.id, attemptId));

  // If this attempt is linked in dailyLeaderboard, remove or recalculate it
  const [boardEntry] = await db
    .select()
    .from(dailyLeaderboard)
    .where(
      and(
        eq(dailyLeaderboard.gameId, attempt.gameId),
        eq(dailyLeaderboard.userId, attempt.userId),
        eq(dailyLeaderboard.attemptId, attemptId),
      ),
    )
    .limit(1);

  if (boardEntry) {
    // Check if there are other valid submitted attempts by this user for this game
    const [nextBest] = await db
      .select()
      .from(gameAttempts)
      .where(
        and(
          eq(gameAttempts.gameId, attempt.gameId),
          eq(gameAttempts.userId, attempt.userId),
          eq(gameAttempts.status, "submitted"),
          eq(gameAttempts.serverValid, true),
        ),
      )
      .orderBy(asc(gameAttempts.durationMs))
      .limit(1);

    if (nextBest) {
      await db
        .update(dailyLeaderboard)
        .set({
          attemptId: nextBest.id,
          durationMs: nextBest.durationMs,
          score: nextBest.score,
          startedAt: nextBest.startedAt,
          submittedAt: nextBest.submittedAt ?? nextBest.startedAt,
        })
        .where(eq(dailyLeaderboard.id, boardEntry.id));
    } else {
      // No other valid attempt, remove from daily leaderboard
      await db.delete(dailyLeaderboard).where(eq(dailyLeaderboard.id, boardEntry.id));
    }
  }
}

export async function adminRemoveLeaderboardEntry(leaderboardId: string) {
  await requireAdmin();
  const db = getDb();
  await db.delete(dailyLeaderboard).where(eq(dailyLeaderboard.id, leaderboardId));
}

/** Delete attempts so selected testers can replay from a clean state. */
export async function adminResetTesterAttempts(input: {
  allTesters?: boolean;
  testerEmails?: string[];
  gameIds?: string[];
}) {
  await requireAdmin();
  const emails = (input.testerEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!input.allTesters && emails.length === 0) {
    throw new Error("Select at least one tester or choose all testers");
  }

  const db = getDb();
  const testerUsers = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(testers, eq(testers.email, users.email))
    .where(
      and(eq(users.role, "tester"), input.allTesters ? undefined : inArray(users.email, emails)),
    );
  const userIds = testerUsers.map((user) => user.id);
  if (userIds.length === 0) return 0;

  const conditions = [inArray(gameAttempts.userId, userIds)];
  if (input.gameIds?.length) conditions.push(inArray(gameAttempts.gameId, input.gameIds));
  const where = and(...conditions);
  const matching = await db.select({ id: gameAttempts.id }).from(gameAttempts).where(where);
  if (matching.length === 0) return 0;

  const attemptIds = matching.map((attempt) => attempt.id);
  await db.delete(dailyLeaderboard).where(inArray(dailyLeaderboard.attemptId, attemptIds));
  await db.delete(gameAttempts).where(inArray(gameAttempts.id, attemptIds));
  return matching.length;
}

/** Delete tester attempts and leaderboard rows for one or more games. */
export async function adminResetGameAttempts(gameIds: string[]) {
  await requireAdmin();
  if (gameIds.length === 0) throw new Error("Select at least one game");
  const db = getDb();
  const matching = await db
    .select({ id: gameAttempts.id })
    .from(gameAttempts)
    .innerJoin(users, eq(users.id, gameAttempts.userId))
    .where(
      and(
        inArray(gameAttempts.gameId, gameIds),
        or(eq(users.role, "tester"), eq(users.role, "admin")),
      ),
    );
  if (matching.length === 0) return 0;
  const attemptIds = matching.map((attempt) => attempt.id);
  await db.delete(dailyLeaderboard).where(inArray(dailyLeaderboard.attemptId, attemptIds));
  await db.delete(gameAttempts).where(inArray(gameAttempts.id, attemptIds));
  return matching.length;
}

/** Delete attempts for one privileged user, optionally limited to one game. */
export async function adminResetUserAttempts(userId: string, gameId?: string) {
  await requireAdmin();
  const db = getDb();
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || (user.role !== "tester" && user.role !== "admin")) {
    throw new Error("Only tester or admin data can be reset here");
  }
  const conditions = [eq(gameAttempts.userId, userId)];
  if (gameId) conditions.push(eq(gameAttempts.gameId, gameId));
  const matching = await db
    .select({ id: gameAttempts.id })
    .from(gameAttempts)
    .where(and(...conditions));
  if (matching.length === 0) return 0;
  const attemptIds = matching.map((attempt) => attempt.id);
  await db.delete(dailyLeaderboard).where(inArray(dailyLeaderboard.attemptId, attemptIds));
  await db.delete(gameAttempts).where(inArray(gameAttempts.id, attemptIds));
  return matching.length;
}

/**
 * List all community Onam wishes for admin moderation.
 * Returns messages newest-first across all day keys with pagination.
 */
export async function adminListCollabMessages(limit = 30, offset = 0) {
  await requireAdmin();
  await ensureMessageTables();
  const db = getDb();

  return db
    .select({
      id: collabMessages.id,
      dayKey: collabMessages.dayKey,
      userId: collabMessages.userId,
      userName: collabMessages.userName,
      userAvatar: collabMessages.userAvatar,
      message: collabMessages.message,
      likesCount: collabMessages.likesCount,
      createdAt: collabMessages.createdAt,
    })
    .from(collabMessages)
    .orderBy(desc(collabMessages.createdAt))
    .limit(limit)
    .offset(offset);
}
