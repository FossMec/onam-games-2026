import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getDb } from "~/server/db/client";
import { HttpError } from "~/server/errors";
import { checkPass, dealDeck, explainCards } from "~/server/games/impl/tinder";
import { getRequestMeta } from "~/server/request";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { readOrientationCookie } from "~/server/orientation/cookie";

const schema = z.object({
  attemptToken: z.string().uuid(),
  expectedIds: z.array(z.string().max(64)).min(1).max(200),
  decisions: z
    .array(z.object({ id: z.string().max(64), open: z.boolean() }))
    .min(1)
    .max(200),
});

/**
 * Orientation-mode equivalent of `/api/game/[slug]/check` for FOSSwipe.
 *
 * The shared `TinderGame` component grades every swipe mid-attempt. The main
 * endpoint requires a Google session (`requireCurrentUser`), but orientation
 * play is cookie-based (`og_orientation` -> orientation_participants) with no
 * login. Without this endpoint every wrong swipe in `/orientation` fails with
 * 401 "Not signed in" and the pass can never settle.
 */
export async function POST({ request }: APIEvent) {
  try {
    const meta = getRequestMeta();
    const rate = await checkRateLimit({
      key: `orientation-check:${meta.ip}`,
      limit: 200,
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
      SELECT oa.participant_id AS "participantId", oa.seed, oa.status
      FROM orientation_attempts oa
      INNER JOIN games g ON g.id = oa.game_id
      WHERE oa.attempt_token = ${body.data.attemptToken} AND g.game_type = 'tinder'
      LIMIT 1
    `;
    const attempt = rows[0];
    if (!attempt) throw new HttpError(404, "Attempt not found");
    if (attempt.participantId !== cookie.pid) throw new HttpError(403, "Forbidden");
    if (attempt.status !== "in_progress") throw new HttpError(409, "Attempt finished");

    const dealt = dealDeck(attempt.seed).map((card) => card.id);
    const dealtSet = new Set(dealt);
    const unknownIds = body.data.expectedIds.filter((id) => !dealtSet.has(id));
    if (unknownIds.length > 0) {
      const poolIds = new Set(
        (await import("~/server/games/data/tinder-cards")).TINDER_CARDS.map((c) => c.id),
      );
      const trulyUnknown = unknownIds.filter((id) => !poolIds.has(id));
      if (trulyUnknown.length > 0) {
        return Response.json({ error: `Unknown card: ${trulyUnknown[0]}` }, { status: 400 });
      }
    }

    const result = checkPass(attempt.seed, body.data.expectedIds, body.data.decisions);
    if (!result.ok) {
      return Response.json({ error: result.reason }, { status: 400 });
    }
    return Response.json({
      wrongIds: result.wrongIds,
      wrong: explainCards(attempt.seed, result.wrongIds),
    });
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
