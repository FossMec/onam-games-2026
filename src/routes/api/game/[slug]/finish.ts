import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentDevice, requireCurrentUser } from "~/server/auth/service";
import { HttpError } from "~/server/errors";
import { finishAttempt } from "~/server/games/attempts";
import { getGameDefBySlug } from "~/server/games/registry";
import { getRequestMeta } from "~/server/request";

/**
 * Note what is *absent*: no score, no duration, no move count. Those used to be
 * accepted from the client. All three are now derived server-side - the clock
 * from the attempt row, the score and moves from the registry's verifier.
 */
const finishSchema = z.object({
  attemptToken: z.uuid(),
  submittedState: z.unknown(),
  /**
   * Client-reported score hint — used only for the non-PB early-exit path.
   *
   * This is the ONE place a client-supplied number is accepted, and it is
   * accepted only as a pessimistic signal: if claimedScore ≤ currentBest,
   * the server skips the expensive simulation and records the attempt without
   * updating the leaderboard. The stored score in that case is the claimed
   * value (harmless — it cannot improve the player's standing).
   *
   * If the player omits it, or claims a score that would beat their best, the
   * server runs the full simulation as always and the claimed value is ignored.
   */
  claimedScore: z.number().int().nonnegative().optional(),
});

/** Fallback cap for an unknown slug; real limits come from the registry. */
const DEFAULT_MAX_BYTES = 64_000;

export async function POST({ params, request }: APIEvent) {
  try {
    const user = await requireCurrentUser();
    assertCanPlay(user);
    const deviceId = await requireCurrentDevice();
    const meta = getRequestMeta();

    const rate = await checkRateLimit({
      key: `game-finish:${meta.ip}:${user.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (rate.unavailable) {
      return Response.json({ error: "Rate limiter unavailable" }, { status: 503 });
    }
    if (!rate.success) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    // Bound the body before parsing it. Replay-verified games accept an input
    // trace, so this is the ceiling on how much work one request can buy.
    const maxBytes = getGameDefBySlug(params.slug ?? "")?.maxSubmissionBytes ?? DEFAULT_MAX_BYTES;
    const raw = await request.text();
    if (raw.length > maxBytes) {
      return Response.json({ error: "Submission too large" }, { status: 413 });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const body = finishSchema.safeParse(parsedBody);
    if (!body.success) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await finishAttempt({
      userId: user.id,
      deviceId,
      role: user.role,
      attemptToken: body.data.attemptToken,
      submittedState: body.data.submittedState,
      claimedScore: body.data.claimedScore,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[API FINISH ERROR]", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
