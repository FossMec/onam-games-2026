import { getRequestEvent } from "solid-js/web";
import { getDb } from "~/server/db/client";
import { invalidateShared, sharedRead } from "~/server/cache";

const SETTINGS_KEY = "settings:all";

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
  const db = getDb();
  const rows = await db<{ key: string; value: unknown }[]>`
    SELECT key, value FROM app_settings
  `;
  return new Map(rows.map((row) => [row.key, unwrapDoubleEncoded(row.value)]));
}

export function snapshotSettings(): Promise<Map<string, unknown>> {
  const event = getRequestEvent();
  if (event) {
    event.locals.settingsPromise ??= sharedRead(SETTINGS_KEY, loadSettings);
    return event.locals.settingsPromise;
  }
  return sharedRead(SETTINGS_KEY, loadSettings);
}

export async function getSettings(keys: string[]): Promise<Map<string, unknown>> {
  if (keys.length === 0) return new Map();
  try {
    const all = await snapshotSettings();
    return new Map(keys.filter((key) => all.has(key)).map((key) => [key, all.get(key)]));
  } catch {
    return new Map();
  }
}

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
  const db = getDb();
  const group = opts?.group ?? "general";
  const description = opts?.description ?? null;
  const updatedBy = opts?.updatedBy ?? null;

  await db`
    INSERT INTO app_settings (key, value, "group", description, updated_by)
    VALUES (${key}, ${db.json(value as any)}, ${group}, ${description}, ${updatedBy})
    ON CONFLICT (key) DO UPDATE
    SET
      value = EXCLUDED.value,
      "group" = EXCLUDED."group",
      description = EXCLUDED.description,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `;

  const event = getRequestEvent();
  if (event) event.locals.settingsPromise = undefined;

  invalidateShared(SETTINGS_KEY);
  invalidateShared("games:");
  invalidateShared("pookalam:config");
}
