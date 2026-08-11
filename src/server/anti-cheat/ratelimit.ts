import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "~/server/redis/client";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Sliding-window rate limit keyed per identifier (ip, user, etc.).
 * Returns success=false when the limit is exceeded. Falls back to "allowed"
 * when Redis is not configured (local dev) so requests never fail on setup.
 */
export async function checkRateLimit(opts: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<RateLimitResult> {
  try {
    const limit = opts.limit ?? 30;
    const windowMs = opts.windowMs ?? 60_000;
    const ratelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "rl",
      analytics: false,
    });
    const result = await ratelimit.limit(opts.key);
    return { success: result.success, remaining: result.remaining, reset: result.reset };
  } catch {
    return { success: true, remaining: Number.MAX_SAFE_INTEGER, reset: 0 };
  }
}
