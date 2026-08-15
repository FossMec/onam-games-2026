import { lt, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { rateLimitWindows } from "~/server/db/schema";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  unavailable?: boolean;
}

/**
 * Fixed-window rate limit stored in Postgres. Each key has one row that is
 * atomically reset and incremented when its window changes.
 */
export async function checkRateLimit(opts: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<RateLimitResult> {
  const limit = Math.max(1, opts.limit ?? 30);
  const windowMs = Math.max(1_000, opts.windowMs ?? 60_000);
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);
  const db = getDb();

  try {
    const [row] = await db
      .insert(rateLimitWindows)
      .values({ key: opts.key, windowStart, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitWindows.key,
        set: {
          windowStart,
          expiresAt,
          count: sql`case when ${rateLimitWindows.windowStart} = ${windowStart} then ${rateLimitWindows.count} + 1 else 1 end`,
        },
      })
      .returning({ count: rateLimitWindows.count, expiresAt: rateLimitWindows.expiresAt });

    if (Math.random() < 0.01) {
      void db.delete(rateLimitWindows).where(lt(rateLimitWindows.expiresAt, new Date()));
    }

    const count = row?.count ?? limit;
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      reset: row?.expiresAt.getTime() ?? expiresAt.getTime(),
    };
  } catch {
    return { success: false, remaining: 0, reset: Date.now() + 1_000, unavailable: true };
  }
}
