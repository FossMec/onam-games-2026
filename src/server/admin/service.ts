import { asc, desc, eq, sql } from "drizzle-orm";
import {
  activityLogs,
  appSettings,
  devices,
  games,
  getDb,
  suspiciousLogs,
  testers,
  userDevices,
  users,
} from "~/server/db/client";
import { requireAdmin } from "~/server/auth/service";
import { ensureDefaultSettings } from "~/server/settings/defaults";

export async function adminListUsers(limit = 200) {
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
      isBlocked: users.isBlocked,
      trustScore: users.trustScore,
      streakCount: users.streakCount,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function adminSetUserRole(userId: string, role: "player" | "tester" | "admin") {
  await requireAdmin();
  await getDb().update(users).set({ role }).where(eq(users.id, userId));
}

export async function adminSetUserBlock(userId: string, blocked: boolean, reason?: string) {
  await requireAdmin();
  await getDb()
    .update(users)
    .set({ isBlocked: blocked, blockReason: blocked ? (reason ?? "blocked by admin") : null })
    .where(eq(users.id, userId));
}

export async function adminListTesters() {
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
    .limit(500);
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

export async function adminListSuspicious(limit = 100) {
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
    .limit(limit);
}

export async function adminListActivity(limit = 100) {
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
    .limit(limit);
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
      testerEarlyHours: input.testerEarlyHours ?? 24,
      published: input.published ?? false,
    });
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
    })
    .where(eq(games.id, id));
}

export async function adminDeleteGame(id: string) {
  await requireAdmin();
  await getDb().delete(games).where(eq(games.id, id));
}
