import { eq, inArray } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { appSettings } from "~/server/db/schema";

/**
 * Several settings in one round trip.
 *
 * `getSetting` is a query per key, which is fine for a one-off flag and wasteful
 * for a group that is always read together — the schedule alone was four
 * separate selects on every request that resolved a game's status. Missing keys
 * are simply absent from the map; callers keep their own fallbacks.
 */
export async function getSettings(keys: string[]): Promise<Map<string, unknown>> {
  if (keys.length === 0) return new Map();
  try {
    const rows = await getDb()
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(inArray(appSettings.key, keys));
    return new Map(rows.map((row) => [row.key, row.value]));
  } catch {
    return new Map();
  }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const [row] = await getDb()
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row ? (row.value as T) : fallback;
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
}
