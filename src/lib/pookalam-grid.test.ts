import { describe, expect, it } from "vite-plus/test";
import {
  CELL_COUNT,
  EMPTY_CELL,
  GRID_SIZE,
  MAX_FLOWER_ID,
  PACKED_BYTES,
  cellAddress,
  cellToXY,
  countFilled,
  emptyGrid,
  fromBase64,
  isValidFlower,
  isValidIndex,
  readCell,
  toBase64,
  writeCell,
  xyToCell,
} from "./pookalam-grid";

describe("grid dimensions", () => {
  it("packs 2500 cells into 1250 bytes", () => {
    expect(CELL_COUNT).toBe(2500);
    expect(PACKED_BYTES).toBe(1250);
    expect(emptyGrid()).toHaveLength(1250);
  });

  it("starts entirely empty", () => {
    expect(countFilled(emptyGrid())).toBe(0);
  });
});

describe("cellAddress", () => {
  it("puts even cells in the high nibble and odd in the low", () => {
    expect(cellAddress(0)).toEqual({ byteIndex: 0, shift: 4, mask: 0xf0 });
    expect(cellAddress(1)).toEqual({ byteIndex: 0, shift: 0, mask: 0x0f });
    expect(cellAddress(2)).toEqual({ byteIndex: 1, shift: 4, mask: 0xf0 });
  });

  it("reaches the last cell inside the buffer", () => {
    const last = cellAddress(CELL_COUNT - 1);
    expect(last.byteIndex).toBe(PACKED_BYTES - 1);
  });
});

describe("readCell / writeCell", () => {
  it("round-trips every flower id in both nibbles", () => {
    const grid = emptyGrid();
    for (let id = 1; id <= MAX_FLOWER_ID; id++) {
      writeCell(grid, 0, id);
      writeCell(grid, 1, id);
      expect(readCell(grid, 0)).toBe(id);
      expect(readCell(grid, 1)).toBe(id);
    }
  });

  it("does not disturb the neighbouring nibble", () => {
    const grid = emptyGrid();
    writeCell(grid, 0, 7);
    writeCell(grid, 1, 3);
    expect(readCell(grid, 0)).toBe(7);
    expect(readCell(grid, 1)).toBe(3);

    // Overwriting one must leave the other exactly as it was.
    writeCell(grid, 0, 12);
    expect(readCell(grid, 0)).toBe(12);
    expect(readCell(grid, 1)).toBe(3);
  });

  it("keeps the byte in range when the high nibble is set", () => {
    const grid = emptyGrid();
    writeCell(grid, 0, 15);
    writeCell(grid, 1, 15);
    expect(grid[0]).toBe(0xff);
  });

  it("ignores out-of-range indices instead of corrupting the buffer", () => {
    const grid = emptyGrid();
    writeCell(grid, -1, 5);
    writeCell(grid, CELL_COUNT, 5);
    expect(countFilled(grid)).toBe(0);
    expect(readCell(grid, -1)).toBe(EMPTY_CELL);
    expect(readCell(grid, CELL_COUNT)).toBe(EMPTY_CELL);
  });

  it("clears a cell when written with 0", () => {
    const grid = emptyGrid();
    writeCell(grid, 42, 9);
    expect(countFilled(grid)).toBe(1);
    writeCell(grid, 42, EMPTY_CELL);
    expect(countFilled(grid)).toBe(0);
  });
});

describe("validation", () => {
  it("accepts only whole cell indices inside the grid", () => {
    expect(isValidIndex(0)).toBe(true);
    expect(isValidIndex(CELL_COUNT - 1)).toBe(true);
    expect(isValidIndex(CELL_COUNT)).toBe(false);
    expect(isValidIndex(-1)).toBe(false);
    expect(isValidIndex(1.5)).toBe(false);
    expect(isValidIndex(Number.NaN)).toBe(false);
  });

  it("rejects 0 as a flower — it is the empty marker", () => {
    expect(isValidFlower(0)).toBe(false);
    expect(isValidFlower(1)).toBe(true);
    expect(isValidFlower(MAX_FLOWER_ID)).toBe(true);
    expect(isValidFlower(MAX_FLOWER_ID + 1)).toBe(false);
    expect(isValidFlower(2.5)).toBe(false);
  });
});

describe("coordinates", () => {
  it("maps corners the way the canvas draws them", () => {
    expect(cellToXY(0)).toEqual({ x: 0, y: 0 });
    expect(cellToXY(GRID_SIZE - 1)).toEqual({ x: GRID_SIZE - 1, y: 0 });
    expect(cellToXY(GRID_SIZE)).toEqual({ x: 0, y: 1 });
    expect(cellToXY(CELL_COUNT - 1)).toEqual({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 });
  });

  it("round-trips through xyToCell", () => {
    for (const index of [0, 1, 49, 50, 1275, CELL_COUNT - 1]) {
      const { x, y } = cellToXY(index);
      expect(xyToCell(x, y)).toBe(index);
    }
  });
});

describe("base64 transport", () => {
  it("round-trips a populated grid exactly", () => {
    const grid = emptyGrid();
    for (let i = 0; i < CELL_COUNT; i += 7) {
      writeCell(grid, i, (i % MAX_FLOWER_ID) + 1);
    }
    const restored = fromBase64(toBase64(grid));
    expect(restored).toEqual(grid);
    expect(countFilled(restored)).toBe(countFilled(grid));
  });

  it("pads a short payload with empty cells rather than throwing", () => {
    const restored = fromBase64(toBase64(new Uint8Array(4)));
    expect(restored).toHaveLength(PACKED_BYTES);
    expect(countFilled(restored)).toBe(0);
  });

  it("stays well under a sane payload size", () => {
    // 1250 bytes of nibbles -> ~1668 base64 chars. The point of the format.
    expect(toBase64(emptyGrid()).length).toBeLessThan(1800);
  });
});
