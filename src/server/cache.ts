import { getRequestEvent } from "solid-js/web";

/**
 * The read path, in two layers.
 *
 * Outbound Supabase traffic was running at roughly one query per inbound
 * request, and almost none of it was per-visitor: the settings table, the
 * seven-day schedule and the pookalam window are byte-identical for everybody
 * and change a couple of times a day. Paying a network round trip for them on
 * every page view is the whole problem.
 *
 *   requestMemo   one render          - stops a page asking twice
 *   sharedRead    one instance, TTL   - stops every *visitor* asking again
 *
 * Both are a plain `Map` and a timestamp, deliberately: this has to behave the
 * same in a long-lived Node process on Render and in a Cloudflare isolate that
 * may be recycled between any two requests. Nothing here assumes the process
 * survives, and nothing here is correct only because it does - a cold isolate
 * simply takes the miss.
 *
 * `sharedRead` is for data that does not depend on who is asking. Putting a
 * per-user read in it would serve one visitor's row to the next, so the
 * signature asks for a key and the caller is responsible for it being global.
 * Per-user reads use `requestMemo`, which cannot leak across requests because
 * it hangs off the request itself.
 */

interface Entry {
  /** Resolved value, once the first read lands. */
  value?: unknown;
  /** When `value` stops being servable. */
  expiresAt: number;
  /**
   * The read in flight. Kept so a hundred concurrent misses cost one query
   * rather than a hundred - the thundering herd is exactly what a launch-night
   * traffic spike looks like.
   *
   * Only ever populated where `CAN_SHARE_INFLIGHT` is true. See below.
   */
  inflight?: Promise<unknown>;
}

const store = new Map<string, Entry>();

/**
 * How long a global read may be stale. Thirty seconds is chosen against the
 * thing that actually goes wrong: a game releases on a schedule, and the worst
 * case is a player seeing "opens in a moment" for half a minute after it
 * opened. Admin writes call `invalidateShared`, so the only reader that waits
 * out the TTL is one nobody explicitly changed.
 */
export const SHARED_TTL_MS = 30_000;

/**
 * A read shared by every visitor, cached per instance.
 *
 * `key` must fully determine the value. Anything that varies by viewer belongs
 * in the key or, better, outside this function.
 */
export function sharedRead<T>(
  key: string,
  read: () => Promise<T>,
  ttlMs = SHARED_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);

  if (hit && hit.value !== undefined && hit.expiresAt > now) {
    return Promise.resolve(hit.value as T);
  }

  // Deduplicate concurrent inflight reads within the current request
  return requestMemo(`shared:${key}`, async () => {
    // Check store again in case a previous step in this request populated it
    const current = store.get(key);
    if (current && current.value !== undefined && current.expiresAt > Date.now()) {
      return current.value as T;
    }

    try {
      const value = await read();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } catch (error) {
      store.delete(key);
      throw error;
    }
  });
}

/**
 * Drops cached reads after a write.
 *
 * With no argument, everything. With a prefix, every key beginning with it -
 * so `invalidateShared("games:")` clears all three viewer-role variants of the
 * schedule without the caller having to enumerate them.
 */
export function invalidateShared(prefix?: string): void {
  if (prefix === undefined) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * A read memoised for the length of one request.
 *
 * Safe for per-user data: the cache is the request. Outside a request - in
 * scripts and tests - there is nothing to hang it on, so the read just runs.
 */
export function requestMemo<T>(key: string, read: () => Promise<T>): Promise<T> {
  const event = getRequestEvent();
  if (!event) return read();
  const locals = event.locals as Record<string, unknown>;
  const bag = (locals.__memo ??= new Map<string, Promise<unknown>>()) as Map<
    string,
    Promise<unknown>
  >;
  let hit = bag.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = read();
    bag.set(key, hit);
  }
  return hit;
}
