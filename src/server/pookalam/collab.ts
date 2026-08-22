import { and, eq, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { collabPookalam, collabPookalamDiffs } from "~/server/db/client";
import { getSettings } from "~/server/settings/service";
import {
  CELL_COUNT,
  OVERWRITE_THRESHOLD,
  cellAddress,
  emptyGrid,
  isValidBrush,
  isValidIndex,
  toBase64,
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

async function getConfig(): Promise<{
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

/**
 * Ensures the one event-wide canvas exists. Older deployments created one row
 * per day; the migration collapses those rows, and this key prevents that model
 * from returning in application code.
 */
async function ensureCommunityGrid() {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(collabPookalam)
    .where(eq(collabPookalam.dayKey, COMMUNITY_GRID_KEY))
    .limit(1);
  if (existing) return existing;

  const [row] = await db
    .insert(collabPookalam)
    .values({ dayKey: COMMUNITY_GRID_KEY, cells: emptyGrid(), placed: 0 })
    .onConflictDoNothing()
    .returning();

  if (row) return row;
  const [created] = await db
    .select()
    .from(collabPookalam)
    .where(eq(collabPookalam.dayKey, COMMUNITY_GRID_KEY))
    .limit(1);
  return created;
}

let diffsTableInitPromise: Promise<void> | null = null;

export async function ensureDiffsTable(): Promise<void> {
  if (diffsTableInitPromise) return diffsTableInitPromise;
  const db = getDb();
  diffsTableInitPromise = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS collab_pookalam_diffs (
          id BIGSERIAL PRIMARY KEY,
          cell_index SMALLINT NOT NULL,
          flower_id SMALLINT NOT NULL,
          placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS collab_pookalam_diffs_placed_at_idx ON collab_pookalam_diffs(placed_at);
      `);
    } catch {
      /* ignore if already created */
    }
  })();
  return diffsTableInitPromise;
}

function encode(row: { dayKey: string; cells: Uint8Array; placed: number }): CollabDay {
  return { dayKey: row.dayKey, cells: toBase64(row.cells), placed: row.placed };
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
 *
 * The check and the write are the same statement. Reading the cell, deciding it
 * is empty and then writing it would be a race that two people tapping the same
 * square at once would win *both* of — the second silently overwriting the
 * first. Here the `WHERE` tests the nibble and the `SET` fills it atomically,
 * so exactly one of them updates a row and the other is told it was taken.
 *
 * The OR is safe precisely because the guard proved the nibble was zero.
 */
async function writeCell(index: number, flowerId: number): Promise<number | null> {
  const { byteIndex, shift, mask } = cellAddress(index);
  const shifted = flowerId << shift;
  const clearMask = 0xff - mask;

  const updated = await getDb()
    .update(collabPookalam)
    .set({
      cells: sql`set_byte(${collabPookalam.cells}, ${byteIndex}, (get_byte(${collabPookalam.cells}, ${byteIndex}) & ${clearMask}) | ${shifted})`,
      placed: sql`case
        when ${flowerId} = 0 and (get_byte(${collabPookalam.cells}, ${byteIndex}) & ${mask}) != 0 then greatest(0, ${collabPookalam.placed} - 1)
        when ${flowerId} != 0 and (get_byte(${collabPookalam.cells}, ${byteIndex}) & ${mask}) = 0 then ${collabPookalam.placed} + 1
        else ${collabPookalam.placed}
      end`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(collabPookalam.dayKey, COMMUNITY_GRID_KEY),
        // Bare cell, eraser (allowed anytime), or canvas is >= 80% filled
        sql`(${flowerId} = 0 or (get_byte(${collabPookalam.cells}, ${byteIndex}) & ${mask}) = 0 or ${collabPookalam.placed} >= ${OVERWRITE_THRESHOLD})`,
      ),
    )
    .returning({ placed: collabPookalam.placed });

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
  return { ok: true, index, flowerId, placed };
}

/** A drag is one request. Anything longer than this is a script, not a finger. */
export const MAX_STROKE = 400;

export interface StrokeResult {
  /** Cells that actually landed. */
  written: number[];
  placed: number;
  /**
   * The whole grid as it now stands, base64.
   *
   * The reply carries the truth rather than a diff to apply against a local
   * guess. It is 1668 characters, which is nothing, and it collapses three
   * problems into none: rejected cells revert without the client tracking
   * which, other people's flowers arrive for free, and a client whose optimistic
   * copy has drifted for any reason is silently corrected on the next stroke.
   */
  cells: string;
  reason?: string;
}

/**
 * One drag, one round trip.
 *
 * Drawing a line across the canvas is dozens of cells, and firing a request per
 * cell would hit the rate limiter mid-stroke and leave half a line on screen.
 * They still go in one at a time here — each needs its own atomic guard — but
 * the client pays for a single call and gets back exactly which ones took.
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

  await ensureCommunityGrid();

  const written: number[] = [];
  let placed = 0;
  const seen = new Set<number>();
  /** Cells that landed, collected for the diff log. */
  const diffRows: { cellIndex: number; flowerId: number }[] = [];

  for (const cell of cells.slice(0, MAX_STROKE)) {
    if (!isValidIndex(cell.index) || !isValidBrush(cell.flowerId)) continue;
    // A drag re-reports the same cell as the pointer wobbles inside it.
    if (seen.has(cell.index)) continue;
    seen.add(cell.index);

    const next = await writeCell(cell.index, cell.flowerId);
    if (next !== null) {
      written.push(cell.index);
      placed = next;
      diffRows.push({ cellIndex: cell.index, flowerId: cell.flowerId });
    }
  }

  // Always read back: the reply is the authoritative grid, which has to include
  // whatever anybody else placed while this stroke was being drawn.
  const [row] = await getDb()
    .select({ cells: collabPookalam.cells, placed: collabPookalam.placed })
    .from(collabPookalam)
    .where(eq(collabPookalam.dayKey, COMMUNITY_GRID_KEY))
    .limit(1);

  // Batch-insert diff rows for animation replay. Fire-and-forget after the
  // grid read-back; a failure here must not break the stroke response.
  if (diffRows.length > 0) {
    void ensureDiffsTable()
      .then(() => getDb().insert(collabPookalamDiffs).values(diffRows))
      .catch((err) => {
        console.warn("[collab] diff insert failed:", err?.message ?? err);
      });
  }

  return {
    written,
    placed: row?.placed ?? placed,
    cells: toBase64(row?.cells ?? emptyGrid()),
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
