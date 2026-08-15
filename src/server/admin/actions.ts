"use server";

import { blockIp, listBlockedIps, unblockIp } from "~/server/anti-cheat/ip";
import {
  adminAddTester,
  adminCreateGame,
  adminDeleteGame,
  adminGetMetrics,
  adminListActivity,
  adminListAttempts,
  adminListGames,
  adminListSettings,
  adminListSuspicious,
  adminListTesters,
  adminListUsers,
  adminRemoveLeaderboardEntry,
  adminSetTesterActive,
  adminSetUserBanLevel,
  adminSetUserRole,
  adminUpdateGame,
  adminUpdateSetting,
  adminVoidAttempt,
} from "~/server/admin/service";
import { requireAdmin } from "~/server/auth/service";

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

export async function listUsers(page = 0) {
  return adminListUsers(100, Math.max(0, page) * 100);
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
