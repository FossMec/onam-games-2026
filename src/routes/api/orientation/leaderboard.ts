import type { APIEvent } from "@solidjs/start/server";
import {
  getOrientationLeaderboard,
  getOrientationSettings,
  ORIENTATION_BATCHES,
} from "~/server/orientation/service";

export async function GET({ request }: APIEvent) {
  const url = new URL(request.url);
  const batchParam = url.searchParams.get("batch");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50) || 50));
  let batch = batchParam?.trim() ?? "";
  if (!(ORIENTATION_BATCHES as readonly string[]).includes(batch)) {
    const { currentBatch } = await getOrientationSettings();
    batch = currentBatch;
  }
  const board = await getOrientationLeaderboard(batch, page, pageSize);
  return Response.json(board);
}
