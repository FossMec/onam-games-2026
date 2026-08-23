import type { APIEvent } from "@solidjs/start/server";
import { requireAdmin } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { ensureDiffsTable } from "~/server/pookalam/collab";

/** Maximum diffs to return in one export (prevents absurd payloads). */
const MAX_DIFFS = 500_000;

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
    const diffs = await db<
      {
        cell_index: number;
        flower_id: number;
        placed_at: Date;
      }[]
    >`
      SELECT cell_index, flower_id, placed_at
      FROM collab_pookalam_diffs
      ORDER BY placed_at ASC
      LIMIT ${MAX_DIFFS}
    `;

    return Response.json({
      duration,
      total: diffs.length,
      diffs: diffs.map((d) => ({
        i: Number(d.cell_index),
        f: Number(d.flower_id),
        t: new Date(d.placed_at).toISOString(),
      })),
    });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Failed to load diffs" }, { status: 500 });
  }
}
