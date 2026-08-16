/**
 * The collaborative pookalam's storage format.
 *
 * A 50×50 grid where every cell holds one flower or nothing. There are ten
 * flowers in the catalogue and room for fifteen, so a cell is a **nibble** —
 * four bits — and the whole canvas is 1250 bytes. That is small enough to send
 * a fresh copy on every poll without thinking about it, and small enough that
 * keeping one per day for the entire festival costs under nine kilobytes.
 *
 * WHY NOT A ROW PER PLACEMENT
 *
 * The obvious shape is a `placements` table: 2500 rows a day, each with a user,
 * a cell and a flower. It buys an audit trail nobody asked for and costs a
 * query that grows with participation, on the one screen everybody opens at
 * once. The grid is the state; who placed what is not part of the picture.
 *
 * WHY NOT A FLATTENED IMAGE PER DAY
 *
 * Rendering yesterday to WebP server-side would need an image encoder this
 * project does not have, and would throw away the data to save space that was
 * never the problem — 1250 bytes is smaller than any WebP of it. Keeping each
 * day's nibbles means the client can redraw the whole week at any resolution,
 * and the layering below stays a rendering decision rather than a baked one.
 *
 * The nibble order is high-first: cell 0 is the top four bits of byte 0. It has
 * to match `placeFlower`'s SQL, which does the same arithmetic in Postgres.
 */

export const GRID_SIZE = 50;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const PACKED_BYTES = CELL_COUNT / 2;

/** 0 means empty, so the catalogue can hold fifteen flowers at most. */
export const EMPTY_CELL = 0;
export const MAX_FLOWER_ID = 15;

export interface CellAddress {
  byteIndex: number;
  /** Bits to shift a flower id left by to land in this cell's nibble. */
  shift: number;
  /** The nibble's bits, already shifted — `0xf0` or `0x0f`. */
  mask: number;
}

export function isValidIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT;
}

export function isValidFlower(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id <= MAX_FLOWER_ID;
}

/**
 * Where a cell lives in the packed buffer.
 *
 * Exported because the placement query needs exactly this arithmetic in SQL,
 * and two copies of it that could drift is how a canvas silently corrupts.
 */
export function cellAddress(index: number): CellAddress {
  const shift = index % 2 === 0 ? 4 : 0;
  return { byteIndex: index >> 1, shift, mask: 0x0f << shift };
}

export function emptyGrid(): Uint8Array {
  return new Uint8Array(PACKED_BYTES);
}

export function readCell(packed: Uint8Array, index: number): number {
  if (!isValidIndex(index)) return EMPTY_CELL;
  const { byteIndex, shift } = cellAddress(index);
  return ((packed[byteIndex] ?? 0) >> shift) & 0x0f;
}

/** Writes in place and returns the same buffer, for chaining in tests. */
export function writeCell(packed: Uint8Array, index: number, flowerId: number): Uint8Array {
  if (!isValidIndex(index)) return packed;
  const { byteIndex, shift, mask } = cellAddress(index);
  const current = packed[byteIndex] ?? 0;
  packed[byteIndex] = (current & ~mask & 0xff) | ((flowerId & 0x0f) << shift);
  return packed;
}

export function countFilled(packed: Uint8Array): number {
  let filled = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (readCell(packed, i) !== EMPTY_CELL) filled++;
  }
  return filled;
}

/** Row/column of a cell, for anything that needs to think in coordinates. */
export function cellToXY(index: number): { x: number; y: number } {
  return { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) };
}

export function xyToCell(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

/*
 * Base64 on the wire.
 *
 * A server function's payload is JSON, and a Uint8Array serialises to an object
 * keyed "0", "1", "2"… — 1250 entries of it, tens of kilobytes to move 1250
 * bytes. Base64 costs a third on top of the raw size and nothing else.
 */
export function toBase64(packed: Uint8Array): string {
  let binary = "";
  for (const byte of packed) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const out = new Uint8Array(PACKED_BYTES);
  // Anything short is padded with empty rather than rejected: a truncated grid
  // should cost the missing flowers, not the whole canvas.
  const length = Math.min(binary.length, PACKED_BYTES);
  for (let i = 0; i < length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
