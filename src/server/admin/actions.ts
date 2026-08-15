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

export async function getAdminDashboard() {
  return {
    metrics: await adminGetMetrics(),
    users: await adminListUsers(),
    games: await adminListGames(),
    attempts: await adminListAttempts(),
    testers: await adminListTesters(),
    suspicious: await adminListSuspicious(),
    activity: await adminListActivity(),
    settings: await adminListSettings(),
    blockedIps: await listBlockedIps(),
  };
}

export async function getAdminMetricsAction() {
  return adminGetMetrics();
}

export async function listAttemptsAction(limit = 100) {
  return adminListAttempts(limit);
}

export async function voidAttemptAction(attemptId: string) {
  await adminVoidAttempt(attemptId);
}

export async function removeLeaderboardEntryAction(leaderboardId: string) {
  await adminRemoveLeaderboardEntry(leaderboardId);
}

export async function listUsers() {
  return adminListUsers();
}

export async function setUserRole(userId: string, role: "player" | "tester" | "admin") {
  await adminSetUserRole(userId, role);
}

export async function setUserBanLevel(userId: string, level: 0 | 1 | 2 | 3 | 4, reason?: string) {
  await adminSetUserBanLevel(userId, level, reason);
}

export async function listTesters() {
  return adminListTesters();
}

export async function addTester(email: string, earlyHours = 24) {
  await adminAddTester(email, earlyHours);
}

export async function setTesterActive(id: string, active: boolean) {
  await adminSetTesterActive(id, active);
}

export async function listSuspicious() {
  return adminListSuspicious();
}

export async function listActivity() {
  return adminListActivity();
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

export async function listBlockedIpsAction() {
  return listBlockedIps();
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
