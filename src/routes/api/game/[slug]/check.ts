import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentUser } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { HttpError } from "~/server/errors";
import { checkPass, dealDeck, explainCards } from "~/server/games/impl/tinder";
import { getRequestMeta } from "~/server/request";

/**
 * Grades swipes mid-attempt - one card at a time as the deck is played, or a
 * whole pass at once.
 *
 * This exists so the browser never has to hold the answer key. It returns only
 * the ids the player got wrong, and the licence note for those - information
 * they earned by guessing, and which they are about to be shown as their
 * penalty screen. Nothing is revealed about cards they have not answered.
 *
 * It is deliberately stateless: the pass is graded as a pure function of the
 * attempt's seed. The authoritative check is still the full-transcript replay
 * in `finishAttempt`, so a client that lies to this endpoint gains nothing.
 */
const checkSchema = z.object({
  attemptToken: z.uuid(),
  /** The ids the client believes it was showing, in order. */
  expectedIds: z.array(z.string().max(64)).min(1).max(200),
  decisions: z
    .array(z.object({ id: z.string().max(64), open: z.boolean() }))
    .min(1)
    .max(200),
});

export async function POST({ request }: APIEvent) {
  try {
    const user = await requireCurrentUser();
    assertCanPlay(user);
    const meta = getRequestMeta();

    /*
     * One call per swipe, so this has to clear a whole deck inside a minute
     * and leave room for a second run. A 20-card deck plus recycled misses is
     * ~30 calls; 200 is comfortably above a human playing flat out and still
     * far below anything worth scripting - every call costs a real swipe and
     * only ever grades a card the player has already committed to.
     */
    const rate = await checkRateLimit({
      key: `game-check:${meta.ip}:${user.id}`,
      limit: 200,
      windowMs: 60_000,
    });
    if (rate.unavailable) {
      return Response.json({ error: "Rate limiter unavailable" }, { status: 503 });
    }
    if (!rate.success) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = checkSchema.safeParse(await request.json());
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
      WHERE ga.attempt_token = ${body.data.attemptToken} AND g.game_type = 'tinder'
      LIMIT 1
    `;
    const attempt = attempts[0];

    if (!attempt) throw new HttpError(404, "Attempt not found");
    if (attempt.userId !== user.id) throw new HttpError(403, "Forbidden");
    if (attempt.status !== "in_progress") {
      throw new HttpError(409, "This attempt is already finished");
    }

    // Pass 1 must be the dealt deck; later passes are a subset, which the
    // final replay re-derives anyway. For stale attempts after card list changes,
    // allow any id that exists in overall pool to avoid spurious Unknown card
    // on every swipe (e.g., canva). The authoritative check is still checkPass
    // which uses answerKey from same seed.
    const dealt = dealDeck(attempt.seed).map((card) => card.id);
    const dealtSet = new Set(dealt);
    const unknownIds = body.data.expectedIds.filter((id) => !dealtSet.has(id));
    if (unknownIds.length > 0) {
      // Log for diagnostics but don't block if id exists in overall pool (stale deck)
      const poolIds = new Set(
        (await import("~/server/games/data/tinder-cards")).TINDER_CARDS.map((c) => c.id),
      );
      const trulyUnknown = unknownIds.filter((id) => !poolIds.has(id));
      if (trulyUnknown.length > 0) {
        console.warn(
          `[tinder check] truly unknown ids ${trulyUnknown.join(",")} seed=${attempt.seed.slice(0, 8)} dealt=${dealt.join(",")}`,
        );
        return Response.json({ error: `Unknown card: ${trulyUnknown[0]}` }, { status: 400 });
      }
      console.warn(
        `[tinder check] stale deck ids ${unknownIds.join(",")} seed=${attempt.seed.slice(0, 8)} allowed`,
      );
    }

    const result = checkPass(attempt.seed, body.data.expectedIds, body.data.decisions);
    if (!result.ok) {
      return Response.json({ error: result.reason }, { status: 400 });
    }
    // `wrong` carries the licence note for the misses only. The player is about
    // to be shown it as their penalty screen, and it says nothing about any
    // card they have not already answered.
    return Response.json({
      wrongIds: result.wrongIds,
      wrong: explainCards(attempt.seed, result.wrongIds),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
