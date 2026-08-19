import type { APIEvent } from "@solidjs/start/server";
import { requireAdmin } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { collabPookalamDiffs } from "~/server/db/client";
import { ensureDiffsTable } from "~/server/pookalam/collab";
import { asc } from "drizzle-orm";

/** Maximum diffs to return in one export (prevents absurd payloads). */
const MAX_DIFFS = 500_000;

/**
 * Returns the full ordered diff log for the community pookalam animation export.
 * Admin-only. The client replays the diffs on a hidden canvas and encodes a WebM.
 *
 * Query params:
 *   duration — target video duration in seconds (15–30, default 20)
 */
export async function GET(event: APIEvent) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(event.request.url);
  const rawDur = Number(url.searchParams.get("duration") ?? "20");
  const duration = Math.min(30, Math.max(15, Number.isFinite(rawDur) ? rawDur : 20));

  try {
    await ensureDiffsTable();
    const db = getDb();
    const diffs = await db
      .select({
        cellIndex: collabPookalamDiffs.cellIndex,
        flowerId: collabPookalamDiffs.flowerId,
        placedAt: collabPookalamDiffs.placedAt,
      })
      .from(collabPookalamDiffs)
      .orderBy(asc(collabPookalamDiffs.placedAt))
      .limit(MAX_DIFFS);

    return Response.json({
      duration,
      total: diffs.length,
      diffs: diffs.map((d) => ({
        i: Number(d.cellIndex),
        f: Number(d.flowerId),
        t: d.placedAt.toISOString(),
      })),
    });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Failed to load diffs" }, { status: 500 });
  }
}
