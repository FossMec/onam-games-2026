import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentUser } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { HttpError } from "~/server/errors";
import { matchTrace } from "~/server/games/impl/wend";
import { getRequestMeta } from "~/server/request";

/**
 * Checks whether a traced path in Wend spells one of the hidden words.
 */
const traceSchema = z.object({
  attemptToken: z.uuid(),
  cells: z
    .array(z.object({ r: z.number().int().min(0).max(15), c: z.number().int().min(0).max(15) }))
    .min(3)
    .max(16),
});

export async function POST({ request }: APIEvent) {
  try {
    const user = await requireCurrentUser();
    assertCanPlay(user);
    const meta = getRequestMeta();

    const rate = await checkRateLimit({
      key: `game-trace:${meta.ip}:${user.id}`,
      limit: 240,
      windowMs: 60_000,
    });
    if (rate.unavailable) {
      return Response.json({ error: "Rate limiter unavailable" }, { status: 503 });
    }
    if (!rate.success) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = traceSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getDb();
    const attempts = await db<{ userId: string; seed: string; status: string }[]>`
      SELECT
        ga.user_id AS "userId",
        ga.seed,
        ga.status
      FROM game_attempts ga
      INNER JOIN games g ON g.id = ga.game_id
      WHERE ga.attempt_token = ${body.data.attemptToken} AND g.game_type = 'wend'
      LIMIT 1
    `;
    const attempt = attempts[0];

    if (!attempt) throw new HttpError(404, "Attempt not found");
    if (attempt.userId !== user.id) throw new HttpError(403, "Forbidden");
    if (attempt.status !== "in_progress") {
      throw new HttpError(409, "This attempt is already finished");
    }

    return Response.json({ word: matchTrace(attempt.seed, body.data.cells) });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
