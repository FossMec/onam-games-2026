import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { HttpError } from "~/server/errors";
import { finishOrientationAttempt } from "~/server/orientation/service";
import { getGameDefByType } from "~/server/games/registry";
import { getOrientationSettings } from "~/server/orientation/service";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { getRequestMeta } from "~/server/request";

const schema = z.object({
  attemptToken: z.string().uuid(),
  submittedState: z.unknown(),
  claimedScore: z.number().int().nonnegative().optional(),
});

const DEFAULT_MAX_BYTES = 64_000;

export async function POST({ request }: APIEvent) {
  try {
    const meta = getRequestMeta();
    const rate = await checkRateLimit({
      key: `orientation-finish:${meta.ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (rate.unavailable)
      return Response.json({ error: "Rate limiter unavailable" }, { status: 503 });
    if (!rate.success) return Response.json({ error: "Too many requests" }, { status: 429 });

    const { gameType } = await getOrientationSettings();
    const maxBytes = getGameDefByType(gameType)?.maxSubmissionBytes ?? DEFAULT_MAX_BYTES;
    const raw = await request.text();
    if (raw.length > maxBytes)
      return Response.json({ error: "Submission too large" }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const body = schema.safeParse(parsed);
    if (!body.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

    const result = await finishOrientationAttempt({
      attemptToken: body.data.attemptToken,
      submittedState: body.data.submittedState,
      claimedScore: body.data.claimedScore,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error("[orientation finish]", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
