import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { appSettings } from "~/server/db/schema";

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
