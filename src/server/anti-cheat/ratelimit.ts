export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  unavailable?: boolean;
}

const MEMORY_RATE_LIMIT = new Map<string, { count: number; windowStart: number }>();

export async function checkRateLimit(opts: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<RateLimitResult> {
  const limit = Math.max(1, opts.limit ?? 30);
  const windowMs = Math.max(1_000, opts.windowMs ?? 60_000);
  const now = Date.now();

  const entry = MEMORY_RATE_LIMIT.get(opts.key);
  if (!entry || now - entry.windowStart >= windowMs) {
    MEMORY_RATE_LIMIT.set(opts.key, { count: 1, windowStart: now });
    // Keep memory map bounded
    if (MEMORY_RATE_LIMIT.size > 2000) {
      for (const [k, v] of MEMORY_RATE_LIMIT.entries()) {
        if (now - v.windowStart >= windowMs) MEMORY_RATE_LIMIT.delete(k);
      }
    }
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  entry.count++;
  const count = entry.count;
  const remaining = Math.max(0, limit - count);
  const reset = entry.windowStart + windowMs;

  return {
    success: count <= limit,
    remaining,
    reset,
  };
}
