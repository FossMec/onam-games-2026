import { asc, desc, eq, lt, sql } from "drizzle-orm";
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

/** How many days back the page draws underneath today. */
const HISTORY_DAYS = 6;

export interface CollabDay {
  dayKey: string;
  /** Base64 of the packed 1250-byte grid. */
  cells: string;
  placed: number;
}

export interface CollabState {
  open: boolean;
  today: CollabDay;
  /** Previous days, oldest first — painted underneath today. */
  history: CollabDay[];
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
 * Ensures today's canvas row exists, carrying over existing flowers from previous days
 * so the pookalam lives forever and continuously evolves.
 */
async function ensureToday(dayKey: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(collabPookalam)
    .where(eq(collabPookalam.dayKey, dayKey))
    .limit(1);
  if (existing.length > 0) return existing[0];

  // Carry forward existing flowers from previous day
  const [latest] = await db
    .select()
    .from(collabPookalam)
    .where(lt(collabPookalam.dayKey, dayKey))
    .orderBy(desc(collabPookalam.dayKey))
    .limit(1);

  const cells = latest?.cells ? new Uint8Array(latest.cells) : emptyGrid();
  const placed = latest?.placed ?? 0;

  await db.insert(collabPookalam).values({ dayKey, cells, placed }).onConflictDoNothing();

  const [row] = await db
    .select()
    .from(collabPookalam)
    .where(eq(collabPookalam.dayKey, dayKey))
    .limit(1);
  return row;
}

function encode(row: { dayKey: string; cells: Uint8Array; placed: number }): CollabDay {
  return { dayKey: row.dayKey, cells: toBase64(row.cells), placed: row.placed };
}

export async function getCollabState(signedIn: boolean): Promise<CollabState> {
  const dayKey = istDayKey();
  const config = await getConfig();
  const [today, history] = await Promise.all([
    ensureToday(dayKey),
    getDb()
      .select()
      .from(collabPookalam)
      .where(lt(collabPookalam.dayKey, dayKey))
      .orderBy(asc(collabPookalam.dayKey))
      .limit(HISTORY_DAYS),
  ]);

  return {
    open: config.open,
    today: encode(today),
    history: history.map(encode),
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
async function writeCell(dayKey: string, index: number, flowerId: number): Promise<number | null> {
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
    .where(eq(collabPookalam.dayKey, dayKey))
    .returning({ placed: collabPookalam.placed });

  return updated.length === 0 ? null : updated[0].placed;
}

export async function placeFlower(index: number, flowerId: number): Promise<PlaceResult> {
  if (!isValidIndex(index)) return { ok: false, reason: "That square is not on the grid." };
  if (!isValidFlower(flowerId)) return { ok: false, reason: "Unknown flower." };

  const config = await getConfig();
  if (!config.open) return { ok: false, reason: "The shared pookalam is closed right now." };

  const dayKey = istDayKey();
  await ensureToday(dayKey);

  const placed = await writeCell(dayKey, index, flowerId);
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

  const dayKey = istDayKey();
  await ensureToday(dayKey);

  const written: number[] = [];
  let placed = 0;
  const seen = new Set<number>();

  for (const cell of cells.slice(0, MAX_STROKE)) {
    if (!isValidIndex(cell.index) || !isValidFlower(cell.flowerId)) continue;
    // A drag re-reports the same cell as the pointer wobbles inside it.
    if (seen.has(cell.index)) continue;
    seen.add(cell.index);

    const next = await writeCell(dayKey, cell.index, cell.flowerId);
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
    .where(eq(collabPookalam.dayKey, dayKey))
    .limit(1);

  return {
    written,
    placed: row?.placed ?? placed,
    cells: toBase64(row?.cells ?? emptyGrid()),
  };
}

/** Today's grid alone, for the cheap poll that keeps the canvas fresh. */
export async function getTodayGrid(): Promise<CollabDay> {
  const dayKey = istDayKey();
  return encode(await ensureToday(dayKey));
}

/** Cells filled today, as a fraction — for the "how full is it" meter. */
export function fillFraction(placed: number): number {
  return Math.min(1, Math.max(0, placed / CELL_COUNT));
}
