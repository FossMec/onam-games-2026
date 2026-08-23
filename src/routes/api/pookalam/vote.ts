import type { APIEvent } from "@solidjs/start/server";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentUser } from "~/server/auth/service";
import { batchVote, castVote } from "~/server/pookalam/service";

/**
 * Lightweight vote endpoint — bypasses SolidStart `_server` RPC serde.
 * Single POST = ~4 DB ops (select+insert+2 updates). With `skipNextPair` we
 * removed the extra `nextPairs` (5 more DB ops) that was causing 30ms CPU.
 * Use batch array when possible: 3 votes in 1 round-trip.
 */
export async function POST(event: APIEvent) {
  try {
    const user = await requireCurrentUser();
    assertCanPlay(user);

    const body = (await event.request.json()) as
      | { winnerId: string; loserId: string }
      | { votes: Array<{ winnerId: string; loserId: string }> };

    const votes: Array<{ winnerId: string; loserId: string }> =
      "votes" in body && Array.isArray((body as any).votes)
        ? (body as any).votes
        : "winnerId" in body
          ? [{ winnerId: (body as any).winnerId, loserId: (body as any).loserId }]
          : [];

    if (votes.length === 0) return Response.json({ ok: false, reason: "No vote" }, { status: 400 });
    if (votes.length > 20) return Response.json({ ok: false, reason: "Too many" }, { status: 400 });

    const limit = await checkRateLimit({
      key: `pookalam:vote:${user.id}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (limit.unavailable)
      return Response.json({ ok: false, reason: "Rate limiter unavailable" }, { status: 503 });
    if (votes.length > limit.remaining + 1) {
      return Response.json(
        { ok: false, reason: "Too fast. Look at them properly." },
        { status: 429 },
      );
    }

    if (votes.length === 1) {
      const r = await castVote(user.id, votes[0].winnerId, votes[0].loserId, {
        skipNextPair: true,
      });
      return Response.json(r);
    }
    const r = await batchVote(user.id, votes);
    return Response.json(r);
  } catch (err: any) {
    const msg = err?.message || "Could not vote.";
    const status = msg.includes("Voting is not open") ? 403 : 500;
    return Response.json({ ok: false, reason: msg }, { status });
  }
}
