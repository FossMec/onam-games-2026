import { and, eq, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { collabPookalam } from "~/server/db/schema";
import { getSettings } from "~/server/settings/service";
import {
  CELL_COUNT,
  cellAddress,
  emptyGrid,
  isValidFlower,
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
}

/**
 * Today's date in IST as `YYYY-MM-DD`.
 */
export function istDayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

async function getConfig(): Promise<{ open: boolean; dailyFlowers: number }> {
  const values = await getSettings(["collab.open", "collab.daily_flowers"]);
  const limit = Number(values.get("collab.daily_flowers"));
  return {
    open: values.get("collab.open") !== false,
    dailyFlowers: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30,
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
    canPlace: config.open && signedIn,
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
        // Bare cell, OR eraser, OR canvas is >= 80% filled (<= 20% empty)
        sql`(${flowerId} = 0 or (get_byte(${collabPookalam.cells}, ${byteIndex}) & ${mask}) = 0 or ${collabPookalam.placed} >= 2000)`,
      ),
    )
    .returning({ placed: collabPookalam.placed });

  return updated.length === 0 ? null : updated[0].placed;
}

export async function placeFlower(index: number, flowerId: number): Promise<PlaceResult> {
  if (!isValidIndex(index)) return { ok: false, reason: "That square is not on the grid." };
  if (!isValidFlower(flowerId)) return { ok: false, reason: "Unknown flower." };

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

  for (const cell of cells.slice(0, MAX_STROKE)) {
    if (!isValidIndex(cell.index) || !isValidFlower(cell.flowerId)) continue;
    // A drag re-reports the same cell as the pointer wobbles inside it.
    if (seen.has(cell.index)) continue;
    seen.add(cell.index);

    const next = await writeCell(cell.index, cell.flowerId);
    if (next !== null) {
      written.push(cell.index);
      placed = next;
    }
  }

  // Always read back: the reply is the authoritative grid, which has to include
  // whatever anybody else placed while this stroke was being drawn.
  const [row] = await getDb()
    .select({ cells: collabPookalam.cells, placed: collabPookalam.placed })
    .from(collabPookalam)
    .where(eq(collabPookalam.dayKey, COMMUNITY_GRID_KEY))
    .limit(1);

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
