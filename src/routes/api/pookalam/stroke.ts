import type { APIEvent } from "@solidjs/start/server";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { assertCanPlay } from "~/server/auth/bans";
import { requireCurrentUser } from "~/server/auth/service";
import { MAX_STROKE, getTodayGrid, placeStroke } from "~/server/pookalam/collab";

export async function POST(event: APIEvent) {
  try {
    const user = await requireCurrentUser();
    assertCanPlay(user);

    const body = (await event.request.json()) as { cells: { index: number; flowerId: number }[] };
    const cells = body?.cells;

    const refuse = async (reason?: string) => {
      const current = await getTodayGrid();
      return Response.json({ written: [], placed: current.placed, cells: current.cells, reason });
    };

    if (!Array.isArray(cells) || cells.length === 0) return refuse();

    const limit = await checkRateLimit({
      key: `collab:stroke:${user.id}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (limit.unavailable) return refuse("Rate limiter unavailable.");
    if (!limit.success) return refuse("Slow down — let the flowers settle.");

    const result = await placeStroke(cells.slice(0, MAX_STROKE));
    return Response.json(result);
  } catch (err: any) {
    return Response.json(
      { written: [], placed: 0, cells: "", reason: err?.message || "Could not place flowers." },
      { status: 200 },
    );
  }
}
