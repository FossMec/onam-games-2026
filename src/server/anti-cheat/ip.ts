import { and, eq, gte, isNull, or } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { blockedIps } from "~/server/db/schema";

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip) return false;
  const db = getDb();
  const [row] = await db
    .select({ id: blockedIps.ip })
    .from(blockedIps)
    .where(
      and(
        eq(blockedIps.ip, ip),
        or(gte(blockedIps.expiresAt, new Date()), isNull(blockedIps.expiresAt)),
      ),
    )
    .limit(1);
  return !!row;
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
}

export async function unblockIp(ip: string): Promise<void> {
  const db = getDb();
  await db.delete(blockedIps).where(eq(blockedIps.ip, ip));
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
