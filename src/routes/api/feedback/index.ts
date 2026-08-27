import type { APIEvent } from "@solidjs/start/server";
import { getCurrentDeviceId, getCurrentUser } from "~/server/auth/service";
import {
  getFeedbackForUser,
  saveFeedback,
  type SaveFeedbackPayload,
} from "~/server/feedback/service";

export async function GET(_event: APIEvent) {
  try {
    const user = await getCurrentUser();
    const deviceId = await getCurrentDeviceId();
    const feedback = await getFeedbackForUser(user?.id ?? null, deviceId);
    return Response.json({
      ok: true,
      feedback,
      user: user ? { batch: user.batch, college: user.college } : null,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || "Failed to fetch feedback" },
      { status: 500 },
    );
  }
}

export async function POST(event: APIEvent) {
  try {
    const user = await getCurrentUser();
    const deviceId = await getCurrentDeviceId();
    const body = (await event.request.json()) as SaveFeedbackPayload;

    const res = await saveFeedback(user?.id ?? null, deviceId, {
      ...body,
      batch: body.batch || user?.batch || null,
      college: body.college || user?.college || null,
    });

    return Response.json({ ok: true, id: res.id });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || "Failed to save feedback" },
      { status: 500 },
    );
  }
}
