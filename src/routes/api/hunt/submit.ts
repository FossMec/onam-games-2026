import type { APIEvent } from "@solidjs/start/server";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentDevice, requireCurrentUser } from "~/server/auth/service";
import { HttpError } from "~/server/errors";
import { submitHuntAnswer } from "~/server/games/hunt/service";
import { getRequestMeta } from "~/server/request";

export async function POST({ request }: APIEvent) {
  try {
    const user = await requireCurrentUser();
    if (!user.onboardingCompleted) {
      return Response.json({ error: "Complete your profile first" }, { status: 403 });
    }
    assertCanPlay(user);

    const deviceId = await requireCurrentDevice();
    const meta = getRequestMeta();

    const body = (await request.json().catch(() => ({}))) as { answer?: string };
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!answer) {
      return Response.json({ error: "Please enter an answer." }, { status: 400 });
    }

    const result = await submitHuntAnswer(user.id, answer, {
      ip: meta.ip,
      deviceId,
      userAgent: meta.userAgent,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
