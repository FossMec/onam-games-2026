import { getDb } from "~/server/db/client";
import { invalidateShared, sharedRead } from "~/server/cache";

const BLOCKED_IPS_CACHE_KEY = "blocked_ips:set";

async function loadBlockedIpSet(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db<{ ip: string }[]>`
    SELECT ip FROM blocked_ips
    WHERE expires_at >= NOW() OR expires_at IS NULL
  `;
  return new Set(rows.map((r) => r.ip));
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip) return false;
  try {
    const blockedSet = await sharedRead(BLOCKED_IPS_CACHE_KEY, loadBlockedIpSet, 30_000);
    return blockedSet.has(ip);
  } catch (err) {
    console.error("[anti-cheat] Failed checking isIpBlocked (failing open):", err);
    return false;
  }
}

export async function blockIp(opts: {
  ip: string;
  reason?: string;
  scope?: "auth" | "game" | "all";
  expiresAt?: Date | null;
  createdBy?: string;
}): Promise<void> {
  const ip = opts.ip.trim();
  if (!ip) throw new Error("Invalid IP");
  const db = getDb();
  const reason = opts.reason ?? null;
  const scope = opts.scope ?? "all";
  const expiresAt = opts.expiresAt ?? null;
  const createdBy = opts.createdBy ?? null;

  await db`
    INSERT INTO blocked_ips (ip, reason, scope, expires_at, created_by)
    VALUES (${ip}, ${reason}, ${scope}, ${expiresAt}, ${createdBy})
    ON CONFLICT (ip) DO UPDATE
    SET
      reason = ${reason},
      scope = ${scope},
      expires_at = ${expiresAt},
      created_by = ${createdBy},
      created_at = NOW()
  `;
  invalidateShared(BLOCKED_IPS_CACHE_KEY);
}

export async function unblockIp(ip: string): Promise<void> {
  const db = getDb();
  await db`DELETE FROM blocked_ips WHERE ip = ${ip}`;
  invalidateShared(BLOCKED_IPS_CACHE_KEY);
}

export async function listBlockedIps(
  limit = 200,
  offset = 0,
): Promise<
  { ip: string; reason: string | null; scope: string; expiresAt: Date | null; createdAt: Date }[]
> {
  const db = getDb();
  return db<
    { ip: string; reason: string | null; scope: string; expiresAt: Date | null; createdAt: Date }[]
  >`
    SELECT
      ip,
      reason,
      scope,
      expires_at AS "expiresAt",
      created_at AS "createdAt"
    FROM blocked_ips
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}
