"use server";

import { blockIp, listBlockedIps, unblockIp } from "~/server/anti-cheat/ip";
import {
  adminAddTester,
  adminListActivity,
  adminListSettings,
  adminListSuspicious,
  adminListTesters,
  adminListUsers,
  adminSetTesterActive,
  adminSetUserBlock,
  adminSetUserRole,
  adminUpdateSetting,
} from "~/server/admin/service";

export async function getAdminDashboard() {
  return {
    users: await adminListUsers(),
    testers: await adminListTesters(),
    suspicious: await adminListSuspicious(),
    activity: await adminListActivity(),
    settings: await adminListSettings(),
    blockedIps: await listBlockedIps(),
  };
}

export async function listUsers() {
  return adminListUsers();
}

export async function setUserRole(userId: string, role: "player" | "tester" | "admin") {
  await adminSetUserRole(userId, role);
}

export async function setUserBlock(userId: string, blocked: boolean, reason?: string) {
  await adminSetUserBlock(userId, blocked, reason);
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
