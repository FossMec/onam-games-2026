import type { APIEvent } from "@solidjs/start/server";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentDevice, requireCurrentUser } from "~/server/auth/service";
import { HttpError } from "~/server/errors";
import { startAttempt } from "~/server/games/attempts";
import { getRequestMeta } from "~/server/request";

export async function POST({ params }: APIEvent) {
  try {
    const user = await requireCurrentUser();
    if (!user.onboardingCompleted) {
      return Response.json({ error: "Complete your profile first" }, { status: 403 });
    }
    // Soft bans bite here rather than at sign-in, so a benched player keeps
    // the leaderboard and the schedule.
    assertCanPlay(user);
    const deviceId = await requireCurrentDevice();
    const meta = getRequestMeta();

    const rate = await checkRateLimit({
      key: `game-start:${meta.ip}:${user.id}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.success) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const result = await startAttempt({
      userId: user.id,
      deviceId,
      slug: params.slug ?? "",
      ip: meta.ip,
      userAgent: meta.userAgent,
      country: meta.country,
      city: meta.city,
      role: user.role,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
