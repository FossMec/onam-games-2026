import type { APIEvent } from "@solidjs/start/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentUser } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { gameAttempts, games } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { checkPass, dealDeck } from "~/server/games/impl/tinder";
import { getRequestMeta } from "~/server/request";

/**
 * Grades one pass of a deck mid-attempt.
 *
 * This exists so the browser never has to hold the answer key. It returns only
 * the ids the player got wrong — information they earned by guessing, and
 * would learn anyway when the card came back around. Nothing is revealed about
 * cards they have not answered.
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

    // Generous: a full run is several passes, but this bounds a script.
    const rate = await checkRateLimit({
      key: `game-check:${meta.ip}:${user.id}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rate.success) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = checkSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getDb();
    const [attempt] = await db
      .select({ userId: gameAttempts.userId, seed: gameAttempts.seed, status: gameAttempts.status })
      .from(gameAttempts)
      .innerJoin(games, eq(games.id, gameAttempts.gameId))
      .where(
        and(eq(gameAttempts.attemptToken, body.data.attemptToken), eq(games.gameType, "tinder")),
      )
      .limit(1);

    if (!attempt) throw new HttpError(404, "Attempt not found");
    if (attempt.userId !== user.id) throw new HttpError(403, "Forbidden");
    if (attempt.status !== "in_progress") {
      throw new HttpError(409, "This attempt is already finished");
    }

    // Pass 1 must be the dealt deck; later passes are a subset, which the
    // final replay re-derives anyway.
    const dealt = dealDeck(attempt.seed).map((card) => card.id);
    const dealtSet = new Set(dealt);
    if (body.data.expectedIds.some((id) => !dealtSet.has(id))) {
      return Response.json({ error: "Unknown card" }, { status: 400 });
    }

    const result = checkPass(attempt.seed, body.data.expectedIds, body.data.decisions);
    if (!result.ok) {
      return Response.json({ error: result.reason }, { status: 400 });
    }
    return Response.json({ wrongIds: result.wrongIds });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
