import type { APIEvent } from "@solidjs/start/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentUser } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { gameAttempts, games } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { matchTrace } from "~/server/games/impl/wend";
import { getRequestMeta } from "~/server/request";

/**
 * Checks whether a traced path in Wend spells one of the hidden words.
 *
 * This exists because the words are the puzzle. The board tells a player how
 * many words there are and how long each one is, and nothing else — so the
 * browser genuinely cannot know whether a path is a word, and has to ask.
 *
 * Shipping the list, or hashes of it, was considered and rejected: an
 * eight-letter uppercase word falls to a wordlist in seconds, so any
 * client-side check hands over the answers to anyone who wants them.
 *
 * The response reveals only the word the player just traced, which they can
 * read off their own screen. It says nothing about the words they have not
 * found. And it is not authoritative — the whole board is re-validated at
 * finish, so lying to this endpoint gains nothing.
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

    /*
     * A player traces a handful of wrong guesses per word, so this is called
     * far more often than /check. The limit is set for a determined human
     * rather than a patient one — anything above this is a script walking the
     * grid, and a script gains nothing anyway since the board is re-validated
     * at finish.
     */
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
    const [attempt] = await db
      .select({ userId: gameAttempts.userId, seed: gameAttempts.seed, status: gameAttempts.status })
      .from(gameAttempts)
      .innerJoin(games, eq(games.id, gameAttempts.gameId))
      .where(and(eq(gameAttempts.attemptToken, body.data.attemptToken), eq(games.gameType, "wend")))
      .limit(1);

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
