"use server";

import { blockIp, listBlockedIps, unblockIp } from "~/server/anti-cheat/ip";
import {
  adminAddTester,
  adminCreateGame,
  adminDeleteGame,
  adminDeleteTester,
  adminGetHuntOverview,
  adminGetMetrics,
  adminListActivity,
  adminListAttempts,
  adminListCollabMessages,
  adminListGames,
  adminListSettings,
  adminListSuspicious,
  adminListTesters,
  adminListUsers,
  adminRemoveLeaderboardEntry,
  adminResetTesterAttempts,
  adminResetGameAttempts,
  adminResetUserAttempts,
  adminSetTesterActive,
  adminSetUserBanLevel,
  adminSetUserRole,
  adminUpdateGame,
  adminUpdateSetting,
  adminVoidAttempt,
} from "~/server/admin/service";
import { requireAdmin } from "~/server/auth/service";
import { deleteCollabMessage } from "~/server/pookalam/comments";

export async function getAdminDashboard() {
  await requireAdmin();
  const [metrics, games] = await Promise.all([adminGetMetrics(), adminListGames()]);

  return {
    metrics,
    games,
  };
}

export async function getAdminMetricsAction() {
  return adminGetMetrics();
}

export async function listAttemptsAction(page = 0) {
  return adminListAttempts(100, Math.max(0, page) * 100);
}

export async function voidAttemptAction(attemptId: string) {
  await adminVoidAttempt(attemptId);
}

export async function removeLeaderboardEntryAction(leaderboardId: string) {
  await adminRemoveLeaderboardEntry(leaderboardId);
}

export async function resetTesterAttemptsAction(
  input: Parameters<typeof adminResetTesterAttempts>[0],
) {
  return adminResetTesterAttempts(input);
}

export async function resetGameAttemptsAction(gameIds: string[]) {
  return adminResetGameAttempts(gameIds);
}

export async function resetUserAttemptsAction(userId: string, gameId?: string) {
  return adminResetUserAttempts(userId, gameId);
}

import { getDailyLeaderboard } from "~/server/leaderboard/service";
import { getDb } from "~/server/db/client";

export async function listUsers(page?: number, limit?: number) {
  if (limit !== undefined && limit > 0) {
    const p = page ?? 0;
    return adminListUsers(limit, Math.max(0, p) * limit);
  }
  return adminListUsers();
}

export async function getGameWinnerAction(gameId: string) {
  await requireAdmin();
  const board = await getDailyLeaderboard(gameId, "admin", null, "main", 1, 1);
  if (!board.entries || board.entries.length === 0) return null;
  const winner = board.entries[0];

  const db = getDb();
  const userRows = await db<
    {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      instagramHandle: string | null;
      whatsappNumber: string | null;
      occupation: string | null;
      college: string | null;
      collegeOther: string | null;
      branch: string | null;
      branchOther: string | null;
      batch: string | null;
      div: string | null;
      trustScore: number;
    }[]
  >`
    SELECT
      id,
      email,
      name,
      avatar_url AS "avatarUrl",
      instagram_handle AS "instagramHandle",
      whatsapp_number AS "whatsappNumber",
      occupation,
      college,
      college_other AS "collegeOther",
      branch,
      branch_other AS "branchOther",
      batch,
      div,
      trust_score AS "trustScore"
    FROM users
    WHERE id = ${winner.userId}
    LIMIT 1
  `;
  const profile = userRows[0] ?? null;

  return {
    winner,
    profile,
    metric: board.metric,
    gameType: board.gameType,
    fieldSize: board.fieldSize,
  };
}

export async function setUserRole(userId: string, role: "player" | "tester" | "admin") {
  await adminSetUserRole(userId, role);
}

export async function setUserBanLevel(userId: string, level: 0 | 1 | 2 | 3 | 4, reason?: string) {
  await adminSetUserBanLevel(userId, level, reason);
}

export async function listTesters(page = 0) {
  return adminListTesters(100, Math.max(0, page) * 100);
}

export async function addTester(email: string, earlyHours = 24) {
  await adminAddTester(email, earlyHours);
}

export async function setTesterActive(id: string, active: boolean) {
  await adminSetTesterActive(id, active);
}

export async function deleteTesterAction(id: string) {
  await adminDeleteTester(id);
}

export async function listSuspicious(page = 0) {
  return adminListSuspicious(100, Math.max(0, page) * 100);
}

export async function listActivity(page = 0) {
  return adminListActivity(100, Math.max(0, page) * 100);
}

export async function listSettings() {
  return adminListSettings();
}

export async function updateSetting(
  key: string,
  value: unknown,
  group?: string,
  description?: string,
) {
  await adminUpdateSetting(key, value, group, description);
}

export async function listBlockedIpsAction(page = 0) {
  return listBlockedIps(100, Math.max(0, page) * 100);
}

export async function blockIpAction(opts: {
  ip: string;
  reason?: string;
  scope?: "auth" | "game" | "all";
  expiresAt?: string | null;
}) {
  await blockIp({
    ip: opts.ip,
    reason: opts.reason,
    scope: opts.scope,
    expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
  });
}

export async function unblockIpAction(ip: string) {
  await unblockIp(ip);
}

export async function listGames() {
  return adminListGames();
}

export async function createGame(input: {
  slug: string;
  day: number;
  title: string;
  hint?: string;
  gameType: string;
  difficulty?: string;
  releaseAt?: string | null;
  endAt?: string | null;
  previewAt?: string | null;
  testerEarlyHours?: number;
  published?: boolean;
}) {
  await adminCreateGame(input);
}

export async function updateGame(id: string, patch: Parameters<typeof adminUpdateGame>[1]) {
  await adminUpdateGame(id, patch);
}

export async function deleteGame(id: string) {
  await adminDeleteGame(id);
}

export async function listCollabMessagesAction(page = 0) {
  return adminListCollabMessages(30, Math.max(0, page) * 30);
}

export async function adminDeleteCollabMessageAction(messageId: string) {
  await requireAdmin();
  return deleteCollabMessage(messageId);
}

export async function getAdminHuntOverviewAction() {
  return adminGetHuntOverview();
}
