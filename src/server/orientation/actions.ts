"use server";

import {
  getOrientationGameCard,
  getOrientationLeaderboard as getBoardService,
  getOrientationMyAttempt,
  getOrientationParticipant,
  getOrientationSettings,
  registerOrientationParticipant,
  clearOrientationBatch as clearBatchService,
  ORIENTATION_BATCHES,
} from "./service";

export async function getOrientationConfig() {
  const [settings, gameCard, participant, myAttempt] = await Promise.all([
    getOrientationSettings(),
    getOrientationGameCard(),
    getOrientationParticipant(),
    getOrientationMyAttempt(),
  ]);
  return { settings, gameCard, participant, myAttempt };
}

export async function getOrientationMe() {
  return getOrientationParticipant();
}

export async function registerOrientation(name: string, batch: string) {
  return registerOrientationParticipant(name, batch);
}

export async function getOrientationLeaderboardAction(batch: string, page = 1, pageSize = 50) {
  const safeBatch = ORIENTATION_BATCHES.includes(batch as any)
    ? batch
    : (await getOrientationSettings()).currentBatch;
  return getBoardService(safeBatch, page, pageSize);
}

export async function clearOrientationBatchAction(batch: string) {
  const { requireAdmin } = await import("~/server/auth/service");
  await requireAdmin();
  return clearBatchService(batch);
}

export async function getOrientationBatches() {
  return ORIENTATION_BATCHES;
}

export async function updateOrientationGameAction(gameType: string) {
  const { requireAdmin } = await import("~/server/auth/service");
  await requireAdmin();
  const { setSetting } = await import("~/server/settings/service");
  await setSetting("orientation.game_type", gameType.trim(), {
    group: "orientation",
    description: "Game type for orientation play",
  });
}

export async function updateOrientationBatchAction(batch: string) {
  const { requireAdmin } = await import("~/server/auth/service");
  await requireAdmin();
  const { setSetting } = await import("~/server/settings/service");
  await setSetting("orientation.current_batch", batch.trim(), {
    group: "orientation",
    description: "Current active batch",
  });
}

export async function updateOrientationEnabledAction(enabled: boolean) {
  const { requireAdmin } = await import("~/server/auth/service");
  await requireAdmin();
  const { setSetting } = await import("~/server/settings/service");
  await setSetting("orientation.enabled", Boolean(enabled), {
    group: "orientation",
    description: "Master switch for orientation play",
  });
}
