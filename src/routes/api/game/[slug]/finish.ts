import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { requireCurrentDevice, requireCurrentUser } from "~/server/auth/service";
import { HttpError } from "~/server/errors";
import { finishAttempt } from "~/server/games/attempts";
import { getRequestMeta } from "~/server/request";

const finishSchema = z.object({
  attemptToken: z.string().uuid(),
  submittedState: z.unknown(),
  movesCount: z.number().int().nonnegative().optional(),
});

export async function POST({ request }: APIEvent) {
  try {
    const user = await requireCurrentUser();
    const deviceId = await requireCurrentDevice();
    const meta = getRequestMeta();

    const rate = await checkRateLimit({
      key: `game-finish:${meta.ip}:${user.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.success) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = finishSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await finishAttempt({
      userId: user.id,
      deviceId,
      role: user.role,
      attemptToken: body.data.attemptToken,
      submittedState: body.data.submittedState,
      movesCount: body.data.movesCount,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
