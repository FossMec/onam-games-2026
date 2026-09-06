import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getDb } from "~/server/db/client";
import { HttpError } from "~/server/errors";
import { matchTrace } from "~/server/games/impl/wend";
import { getRequestMeta } from "~/server/request";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { readOrientationCookie } from "~/server/orientation/cookie";

const schema = z.object({
  attemptToken: z.string().uuid(),
  cells: z
    .array(z.object({ r: z.number().int().min(0).max(15), c: z.number().int().min(0).max(15) }))
    .min(3)
    .max(16),
});

export async function POST({ request }: APIEvent) {
  try {
    const meta = getRequestMeta();
    const rate = await checkRateLimit({
      key: `orientation-trace:${meta.ip}`,
      limit: 240,
      windowMs: 60_000,
    });
    if (rate.unavailable)
      return Response.json({ error: "Rate limiter unavailable" }, { status: 503 });
    if (!rate.success) return Response.json({ error: "Too many requests" }, { status: 429 });
    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

    const cookie = await readOrientationCookie();
    if (!cookie?.pid) throw new HttpError(401, "Not registered");

    const db = getDb();
    const rows = await db<{ participantId: string; seed: string; status: string }[]>`
      SELECT participant_id AS "participantId", seed, status FROM orientation_attempts
      WHERE attempt_token = ${body.data.attemptToken} LIMIT 1
    `;
    const attempt = rows[0];
    if (!attempt) throw new HttpError(404, "Attempt not found");
    if (attempt.participantId !== cookie.pid) throw new HttpError(403, "Forbidden");
    if (attempt.status !== "in_progress") throw new HttpError(409, "Attempt finished");

    return Response.json({ word: matchTrace(attempt.seed, body.data.cells) });
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
