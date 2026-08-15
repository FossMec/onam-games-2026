import { describe, expect, it } from "vite-plus/test";
import { edgeSegment, edgesForPiece, pieceOutline, type JigsawTab } from "./jigsaw-shape";

/**
 * The one property that matters: a shared edge is the same curve in absolute
 * space from either side. Everything else about a jigsaw can be approximately
 * right; this cannot, because a tab that does not fit its socket is visible.
 */

const CELL = 100;

const tab = (over: Partial<JigsawTab> = {}): JigsawTab => ({
  dir: 1,
  offset: 0.42,
  neck: 0.13,
  head: 0.2,
  skew: 0.05,
  ...over,
});

/** Pulls every coordinate pair out of a path, as absolute numbers. */
function coords(path: string, dx = 0, dy = 0): number[] {
  const nums = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  return nums.map((n, i) => Math.round((n + (i % 2 === 0 ? dx : dy)) * 1000) / 1000);
}

/**
 * The tab itself: the seven points of the curve, as [x, y] pairs.
 *
 * The final `L` is dropped. It is the straight run-out to the piece's *own*
 * corner, and the two pieces sharing an edge legitimately run out to opposite
 * corners — only the curve between the two shoulders has to agree.
 */
function tabPoints(path: string, dx = 0, dy = 0): [number, number][] {
  const nums = coords(path, dx, dy);
  const pairs: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]]);
  return pairs.slice(0, -1);
}

describe("shared edges", () => {
  /*
   * A horizontal edge, drawn by the piece above (as its bottom, walked
   * right-to-left) and by the piece below (as its top, walked left-to-right).
   * The lower piece sits one cell down, so its coordinates shift by +CELL in y.
   */
  it("puts a horizontal tab in the same place from both sides", () => {
    const t = tab();
    const fromAbove = tabPoints(edgeSegment([0, CELL], [CELL, CELL], t, false));
    const fromBelow = tabPoints(edgeSegment([0, 0], [CELL, 0], t, true), 0, CELL);

    // Walked in opposite directions, so one is the exact reverse of the other.
    expect(fromAbove.slice().reverse()).toEqual(fromBelow);
  });

  it("puts a vertical tab in the same place from both sides", () => {
    const t = tab({ offset: 0.63, skew: -0.08, dir: -1 });
    const fromLeft = tabPoints(edgeSegment([CELL, 0], [CELL, CELL], t, true));
    const fromRight = tabPoints(edgeSegment([0, 0], [0, CELL], t, false), CELL, 0);

    expect(fromLeft).toEqual(fromRight.slice().reverse());
  });

  /*
   * The regression this file was written for. An off-centre tab used to be
   * mirrored about the middle of the edge when drawn from the far side, so the
   * knob and the hole sat in different places and the pieces visibly did not
   * marry up. At offset 0.35 that is 30% of the edge length apart.
   */
  it("does not mirror an off-centre tab", () => {
    const t = tab({ offset: 0.35, neck: 0.1, head: 0.2, skew: 0 });
    const above = coords(edgeSegment([0, CELL], [CELL, CELL], t, false));
    const below = coords(edgeSegment([0, 0], [CELL, 0], t, true), 0, CELL);

    // The tab's tip: the point furthest from the edge line.
    const tipOf = (nums: number[]) => {
      let best = 0;
      let bestX = 0;
      for (let i = 0; i < nums.length; i += 2) {
        const away = Math.abs(nums[i + 1] - CELL);
        if (away > best) {
          best = away;
          bestX = nums[i];
        }
      }
      return bestX;
    };

    expect(tipOf(above)).toBeCloseTo(tipOf(below), 3);
    // And it really is off centre, or this test proves nothing.
    expect(Math.abs(tipOf(above) - CELL / 2)).toBeGreaterThan(5);
  });

  it("agrees on every edge of a full grid", () => {
    const cols = 4;
    const rows = 4;
    let n = 0;
    const next = (): JigsawTab => {
      n += 1;
      return tab({
        dir: n % 2 === 0 ? 1 : -1,
        offset: 0.35 + ((n * 7) % 30) / 100,
        skew: (((n * 13) % 24) - 12) / 200,
      });
    };
    const hEdges = Array.from({ length: rows - 1 }, () =>
      Array.from({ length: cols }, () => next()),
    );
    const vEdges = Array.from({ length: rows }, () =>
      Array.from({ length: cols - 1 }, () => next()),
    );

    for (let r = 0; r < rows - 1; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const above = edgesForPiece(r * cols + c, cols, rows, hEdges, vEdges);
        const below = edgesForPiece((r + 1) * cols + c, cols, rows, hEdges, vEdges);
        // Both pieces must be looking at the very same spec object.
        expect(above.bottom).toBe(below.top);
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols - 1; c += 1) {
        const left = edgesForPiece(r * cols + c, cols, rows, hEdges, vEdges);
        const right = edgesForPiece(r * cols + c + 1, cols, rows, hEdges, vEdges);
        expect(left.right).toBe(right.left);
      }
    }
  });
});

describe("pieceOutline", () => {
  it("closes, and stays inside the padding the board allows for tabs", () => {
    const path = pieceOutline(CELL, {
      top: tab(),
      right: tab({ dir: -1 }),
      bottom: tab(),
      left: tab({ dir: -1 }),
    });
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);

    // The board overdraws each piece by 0.35 of a cell; nothing may exceed it.
    for (const n of coords(path)) {
      expect(n).toBeGreaterThanOrEqual(-CELL * 0.35);
      expect(n).toBeLessThanOrEqual(CELL * 1.35);
    }
  });

  it("draws a flat side where there is no neighbour", () => {
    const edge = pieceOutline(CELL, { top: null, right: null, bottom: null, left: null });
    // Four straight lines and nothing else.
    expect(edge).not.toContain("C");
  });
});
