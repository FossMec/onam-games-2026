import { eq, gte, isNull, or } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { blockedIps } from "~/server/db/schema";
import { invalidateShared, sharedRead } from "~/server/cache";

const BLOCKED_IPS_CACHE_KEY = "blocked_ips:set";

async function loadBlockedIpSet(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ ip: blockedIps.ip })
    .from(blockedIps)
    .where(or(gte(blockedIps.expiresAt, new Date()), isNull(blockedIps.expiresAt)));
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
  await db
    .insert(blockedIps)
    .values({
      ip,
      reason: opts.reason,
      scope: opts.scope ?? "all",
      expiresAt: opts.expiresAt ?? null,
      createdBy: opts.createdBy,
    })
    .onConflictDoUpdate({
      target: blockedIps.ip,
      set: {
        reason: opts.reason,
        scope: opts.scope ?? "all",
        expiresAt: opts.expiresAt ?? null,
        createdBy: opts.createdBy,
        createdAt: new Date(),
      },
    });
  invalidateShared(BLOCKED_IPS_CACHE_KEY);
}

export async function unblockIp(ip: string): Promise<void> {
  const db = getDb();
  await db.delete(blockedIps).where(eq(blockedIps.ip, ip));
  invalidateShared(BLOCKED_IPS_CACHE_KEY);
}

export async function listBlockedIps(
  limit = 200,
  offset = 0,
): Promise<
  { ip: string; reason: string | null; scope: string; expiresAt: Date | null; createdAt: Date }[]
> {
  const db = getDb();
  return db
    .select({
      ip: blockedIps.ip,
      reason: blockedIps.reason,
      scope: blockedIps.scope,
      expiresAt: blockedIps.expiresAt,
      createdAt: blockedIps.createdAt,
    })
    .from(blockedIps)
    .orderBy(blockedIps.createdAt)
    .limit(limit)
    .offset(offset);
}
