import { getDb } from "~/server/db/client";
import { getSettings } from "~/server/settings/service";
import { sharedRead, invalidateShared } from "~/server/cache";
import {
  CELL_COUNT,
  OVERWRITE_THRESHOLD,
  cellAddress,
  countFilled,
  emptyGrid,
  isValidBrush,
  isValidIndex,
  readCell,
  toBase64,
  writeCell as writeCellBuffer,
} from "~/lib/pookalam-grid";
import { IST_OFFSET_MS } from "./window";

/**
 * The shared pookalam: one continuous communal canvas that lives and grows
 * throughout the festival.
 */
const COMMUNITY_GRID_KEY = "community";

export interface CollabDay {
  dayKey: string;
  /** Base64 of the packed 1250-byte grid. */
  cells: string;
  placed: number;
}

export interface CollabState {
  open: boolean;
  today: CollabDay;

  /** Browser-enforced allowance, from settings. */
  dailyFlowers: number;
  canPlace: boolean;

  /** When true, canvas is view-only and shows the celebration banner. */
  disableDrawing: boolean;
  /** When true, floating balloons are suppressed site-wide. */
  disableBalloons: boolean;
  /** When true, wish bubbles and the composer are hidden. */
  disableComments: boolean;
}

/**
 * Today's date in IST as `YYYY-MM-DD`.
 */
export function istDayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

async function computeCollabConfig(): Promise<{
  open: boolean;
  dailyFlowers: number;
  disableDrawing: boolean;
  disableBalloons: boolean;
  disableComments: boolean;
}> {
  const values = await getSettings([
    "collab.open",
    "collab.daily_flowers",
    "collab.disable_drawing",
    "collab.disable_balloons",
    "collab.disable_comments",
  ]);
  const limit = Number(values.get("collab.daily_flowers"));
  return {
    open: values.get("collab.open") !== false,
    dailyFlowers: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30,
    disableDrawing: values.get("collab.disable_drawing") === true,
    disableBalloons: values.get("collab.disable_balloons") === true,
    disableComments: values.get("collab.disable_comments") === true,
  };
}

function getConfig() {
  return sharedRead("collab:config", computeCollabConfig, 30_000);
}

interface CollabGridRow {
  day_key: string;
  cells: Uint8Array;
  placed: number;
}

/**
 * Ensures the one event-wide canvas exists.
 */
async function loadCommunityGrid(): Promise<CollabGridRow> {
  const db = getDb();
  const existing = await db<CollabGridRow[]>`
    SELECT day_key, cells, placed
    FROM collab_pookalam
    WHERE day_key = ${COMMUNITY_GRID_KEY}
    LIMIT 1
  `;
  if (existing[0]) return existing[0];

  const empty = emptyGrid();
  await db`
    INSERT INTO collab_pookalam (day_key, cells, placed)
    VALUES (${COMMUNITY_GRID_KEY}, ${empty}, 0)
    ON CONFLICT DO NOTHING
  `;

  const created = await db<CollabGridRow[]>`
    SELECT day_key, cells, placed
    FROM collab_pookalam
    WHERE day_key = ${COMMUNITY_GRID_KEY}
    LIMIT 1
  `;
  return created[0];
}

function ensureCommunityGrid() {
  return sharedRead("collab:grid", loadCommunityGrid, 30_000);
}

let diffsTableInitPromise: Promise<void> | null = null;

export async function ensureDiffsTable(): Promise<void> {
  if (diffsTableInitPromise) return diffsTableInitPromise;
  const db = getDb();
  diffsTableInitPromise = (async () => {
    try {
      await db`
        CREATE TABLE IF NOT EXISTS collab_pookalam_diffs (
          id BIGSERIAL PRIMARY KEY,
          cell_index SMALLINT NOT NULL,
          flower_id SMALLINT NOT NULL,
          placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS collab_pookalam_diffs_placed_at_idx ON collab_pookalam_diffs(placed_at);
      `;
    } catch {
      /* ignore if already created */
    }
  })();
  return diffsTableInitPromise;
}

function encode(row: CollabGridRow): CollabDay {
  return { dayKey: row.day_key, cells: toBase64(row.cells), placed: row.placed };
}

export async function getCollabState(signedIn: boolean): Promise<CollabState> {
  const config = await getConfig();
  const today = await ensureCommunityGrid();

  return {
    open: config.open,
    today: encode(today),
    dailyFlowers: config.dailyFlowers,
    canPlace: config.open && signedIn && !config.disableDrawing,
    disableDrawing: config.disableDrawing,
    disableBalloons: config.disableBalloons,
    disableComments: config.disableComments,
  };
}

export type PlaceResult =
  | { ok: true; index: number; flowerId: number; placed: number }
  | { ok: false; reason: string; taken?: boolean };

/**
 * Puts one flower on today's grid, if that square is still bare.
 */
async function writeCell(index: number, flowerId: number): Promise<number | null> {
  const { byteIndex, shift, mask } = cellAddress(index);
  const shifted = flowerId << shift;
  const clearMask = 0xff - mask;
  const db = getDb();

  const updated = await db<{ placed: number }[]>`
    UPDATE collab_pookalam
    SET
      cells = set_byte(cells, ${byteIndex}, (get_byte(cells, ${byteIndex}) & ${clearMask}) | ${shifted}),
      placed = CASE
        WHEN ${flowerId} = 0 AND (get_byte(cells, ${byteIndex}) & ${mask}) != 0 THEN GREATEST(0, placed - 1)
        WHEN ${flowerId} != 0 AND (get_byte(cells, ${byteIndex}) & ${mask}) = 0 THEN placed + 1
        ELSE placed
      END,
      updated_at = NOW()
    WHERE
      day_key = ${COMMUNITY_GRID_KEY} AND
      (${flowerId} = 0 OR (get_byte(cells, ${byteIndex}) & ${mask}) = 0 OR placed >= ${OVERWRITE_THRESHOLD})
    RETURNING placed
  `;

  return updated.length === 0 ? null : updated[0].placed;
}

export async function placeFlower(index: number, flowerId: number): Promise<PlaceResult> {
  if (!isValidIndex(index)) return { ok: false, reason: "That square is not on the grid." };
  if (!isValidBrush(flowerId)) return { ok: false, reason: "Unknown flower." };

  const config = await getConfig();
  if (!config.open) return { ok: false, reason: "The shared pookalam is closed right now." };

  await ensureCommunityGrid();

  const placed = await writeCell(index, flowerId);
  if (placed === null) return { ok: false, reason: "Someone got there first.", taken: true };
  invalidateShared("collab:grid");
  return { ok: true, index, flowerId, placed };
}

/** A drag is one request. Anything longer than this is a script, not a finger. */
export const MAX_STROKE = 400;

export interface StrokeResult {
  written: number[];
  placed: number;
  cells: string;
  reason?: string;
}

/**
 * One drag, one round trip.
 */
export async function placeStroke(
  cells: { index: number; flowerId: number }[],
): Promise<StrokeResult> {
  const config = await getConfig();
  if (!config.open) {
    const current = await getTodayGrid();
    return {
      written: [],
      placed: current.placed,
      cells: current.cells,
      reason: "The shared pookalam is closed.",
    };
  }

  const current = await ensureCommunityGrid();
  const grid = new Uint8Array(current.cells);
  const isUnlocked = current.placed >= OVERWRITE_THRESHOLD;

  const written: number[] = [];
  const seen = new Set<number>();
  const diffRows: { cellIndex: number; flowerId: number }[] = [];

  for (const cell of cells.slice(0, MAX_STROKE)) {
    if (!isValidIndex(cell.index) || !isValidBrush(cell.flowerId)) continue;
    if (seen.has(cell.index)) continue;
    seen.add(cell.index);

    const existing = readCell(grid, cell.index);
    if (existing === 0 || cell.flowerId === 0 || isUnlocked) {
      writeCellBuffer(grid, cell.index, cell.flowerId);
      written.push(cell.index);
      diffRows.push({ cellIndex: cell.index, flowerId: cell.flowerId });
    }
  }

  let finalPlaced = current.placed;
  if (written.length > 0) {
    finalPlaced = countFilled(grid);
    const db = getDb();
    await db`
      UPDATE collab_pookalam
      SET cells = ${grid}, placed = ${finalPlaced}, updated_at = NOW()
      WHERE day_key = ${COMMUNITY_GRID_KEY}
    `;

    invalidateShared("collab:grid");

    /*
     * Must be awaited before returning: on Cloudflare Workers the isolate is
     * frozen the moment the response is sent, so any background promise here
     * would never run and the animation replay would silently lose strokes.
     * One batched statement keeps the added latency to a single round trip.
     */
    if (diffRows.length > 0) {
      try {
        await ensureDiffsTable();
        await db`
          INSERT INTO collab_pookalam_diffs ${db(diffRows.map((d) => ({ cell_index: d.cellIndex, flower_id: d.flowerId })))}
        `;
      } catch (err: any) {
        console.error("[collab] diff insert failed:", err?.message ?? err);
      }
    }
  }

  return {
    written,
    placed: finalPlaced,
    cells: toBase64(grid),
  };
}

/** Today's grid alone, for the cheap poll that keeps the canvas fresh. */
export async function getTodayGrid(): Promise<CollabDay> {
  return encode(await ensureCommunityGrid());
}

/** Cells filled today, as a fraction — for the "how full is it" meter. */
export function fillFraction(placed: number): number {
  return Math.min(1, Math.max(0, placed / CELL_COUNT));
}
