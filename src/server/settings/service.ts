import { getRequestEvent } from "solid-js/web";
import { getDb } from "~/server/db/client";
import { appSettings } from "~/server/db/schema";

/**
 * Every setting, once per request.
 *
 * The whole table is sixteen rows and about two hundred bytes of values, so
 * fetching all of it costs the same round trip as fetching one key - and a
 * single page render reads settings from several places that know nothing about
 * each other. The home page alone was two separate `app_settings` selects (the
 * closed-beta flag, then the four schedule keys) on top of the games query.
 *
 * The snapshot is memoised on the request, not on the module: settings are
 * edited live from the admin panel, and a process-wide cache would keep serving
 * yesterday's schedule from a warm Vercel instance. Within one request the
 * value is fixed anyway - a render that saw two different values for the same
 * flag would be worse than a stale one.
 *
 * Outside a request (scripts, tests) there is nothing to hang it on, so it
 * falls back to a plain query.
 */
/**
 * Undoes a double-encoded jsonb value.
 *
 * A value written as `JSON.stringify(x)` into a jsonb column gets encoded a
 * second time by the driver, so `"19:00"` lands in the database as a JSON
 * string whose *contents* are `"19:00"` - quotes and all. `scripts/seed.mjs`
 * did exactly that for every key it wrote.
 *
 * The failure mode is what makes this worth a defence rather than just a fix:
 * nothing throws. `parseTimeSetting` simply fails its regex, returns null,
 * `computeRelease` returns null, and every game on every day sits at
 * `upcoming` forever with no error anywhere. A schedule that silently refuses
 * to start is the worst possible bug for a one-week event.
 *
 * Unwrapping here fixes every reader at once - schedule, pookalam windows and
 * anything added later - instead of hardening one parser at a time. A value
 * that legitimately begins and ends with a quote character is not something
 * any setting has, so this cannot corrupt a good row.
 */
function unwrapDoubleEncoded(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

async function loadSettings(): Promise<Map<string, unknown>> {
  const rows = await getDb()
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings);
  return new Map(rows.map((row) => [row.key, unwrapDoubleEncoded(row.value)]));
}

export function snapshotSettings(): Promise<Map<string, unknown>> {
  const event = getRequestEvent();
  if (!event) return loadSettings();
  event.locals.settingsPromise ??= loadSettings();
  return event.locals.settingsPromise;
}

/**
 * Several settings at once. Missing keys are simply absent from the map;
 * callers keep their own fallbacks.
 */
export async function getSettings(keys: string[]): Promise<Map<string, unknown>> {
  if (keys.length === 0) return new Map();
  try {
    const all = await snapshotSettings();
    return new Map(keys.filter((key) => all.has(key)).map((key) => [key, all.get(key)]));
  } catch {
    return new Map();
  }
}

/**
 * The raw read: `fallback` covers a *missing* key, and an unreachable database
 * throws.
 *
 * Most callers want `getSetting`, which flattens both cases into the fallback.
 * The two are worth telling apart exactly once - the closed-beta door, where
 * "the flag was never written" and "we cannot reach the flag" must be answered
 * in opposite directions. See `getAccessState`.
 */
export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await snapshotSettings();
  return all.has(key) ? (all.get(key) as T) : fallback;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    return await readSetting(key, fallback);
  } catch {
    return fallback;
  }
}

export async function setSetting(
  key: string,
  value: unknown,
  opts?: { group?: string; description?: string; updatedBy?: string },
): Promise<void> {
  await getDb()
    .insert(appSettings)
    .values({
      key,
      value: value as never,
      group: opts?.group ?? "general",
      description: opts?.description,
      updatedBy: opts?.updatedBy,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: value as never,
        group: opts?.group ?? "general",
        description: opts?.description,
        updatedBy: opts?.updatedBy,
        updatedAt: new Date(),
      },
    });
  /*
   * The admin panel writes a setting and then re-reads the list to show it.
   * Drop the request's snapshot so that read sees what was just written rather
   * than the row it replaced.
   */
  const event = getRequestEvent();
  if (event) event.locals.settingsPromise = undefined;
}
