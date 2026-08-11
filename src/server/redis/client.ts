import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

/** Returns the Upstash Redis client, or null when not configured (dev). */
export function getRedisOrNull(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (redis === undefined) {
    redis = new Redis({ url, token });
  }
  return redis;
}

/** Returns the Upstash Redis client, throwing when not configured. */
export function getRedis(): Redis {
  const client = getRedisOrNull();
  if (!client) {
    throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set");
  }
  return client;
}
