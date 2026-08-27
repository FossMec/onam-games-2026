"use server";

import { getCurrentDeviceId, getCurrentUser, requireAdmin } from "~/server/auth/service";
import {
  type SaveFeedbackPayload,
  getAllFeedbackList,
  getFeedbackForUser,
  getFeedbackSummaryStats,
  saveFeedback,
} from "./service";

export async function submitFeedbackAction(payload: SaveFeedbackPayload) {
  const user = await getCurrentUser();
  const deviceId = await getCurrentDeviceId();

  const userBatch = payload.batch || user?.batch || null;
  const userCollege = payload.college || user?.college || null;

  return await saveFeedback(user?.id ?? null, deviceId, {
    ...payload,
    batch: userBatch,
    college: userCollege,
  });
}

export async function getMyFeedbackAction() {
  const user = await getCurrentUser();
  const deviceId = await getCurrentDeviceId();
  return await getFeedbackForUser(user?.id ?? null, deviceId);
}

export async function getFeedbackListAction(params?: {
  batch?: string;
  limit?: number;
  offset?: number;
}) {
  await requireAdmin();
  return await getAllFeedbackList(params);
}

export async function getFeedbackSummaryAction() {
  await requireAdmin();
  return await getFeedbackSummaryStats();
}
