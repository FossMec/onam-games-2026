import { describe, expect, it } from "vite-plus/test";
import {
  GRID,
  applyTransform,
  canonicalBoardForTest,
  generate,
  transformFor,
  verify,
} from "./wend";
import type { WendView } from "./wend";

const SEED = "5c4b3a2918273645f0e1d2c3b4a59687";

const viewOf = (seed = SEED) => generate(seed).view as WendView;

/** Plays a perfect run for a seed, using the same transform the server will. */
function perfectRun(seed: string) {
  const t = transformFor(seed);
  return {
    found: canonicalBoardForTest().placements.map((p) => ({
      word: p.word,
      cells: p.cells.map((cell) => applyTransform(cell, t)),
    })),
  };
}

describe("canonical board", () => {
  it("places every word", () => {
    const board = canonicalBoardForTest();
    expect(board.placements.length).toBeGreaterThan(0);
    for (const p of board.placements) {
      expect(p.cells).toHaveLength(p.word.length);
    }
  });

  it("fills the whole grid with letters", () => {
    const board = canonicalBoardForTest();
    expect(board.grid).toHaveLength(GRID);
    for (const row of board.grid) {
      expect(row).toHaveLength(GRID);
      for (const letter of row) expect(letter).toMatch(/^[A-Z]$/);
    }
  });

  it("actually spells each word along its cells", () => {
    const board = canonicalBoardForTest();
    for (const p of board.placements) {
      const spelled = p.cells.map((cell) => board.grid[cell.r][cell.c]).join("");
      expect(spelled).toBe(p.word);
    }
  });

  it("is the same board every time — it is canonical for the whole event", () => {
    const a = canonicalBoardForTest();
    const b = canonicalBoardForTest();
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
  });
});

describe("transforms", () => {
  it("is a bijection for all eight presentations", () => {
    for (const rot of [0, 1, 2, 3] as const) {
      for (const flip of [false, true]) {
        const seen = new Set<string>();
        for (let r = 0; r < GRID; r += 1) {
          for (let c = 0; c < GRID; c += 1) {
            const to = applyTransform({ r, c }, { rot, flip });
            expect(to.r).toBeGreaterThanOrEqual(0);
            expect(to.r).toBeLessThan(GRID);
            seen.add(`${to.r},${to.c}`);
          }
        }
        // No two canonical cells may land on the same display cell.
        expect(seen.size).toBe(GRID * GRID);
      }
    }
  });

  it("preserves difficulty: every presentation holds the same letters", () => {
    const tally = (grid: string[][]) => grid.flat().sort().join("");
    const base = tally(viewOf("seed-a").grid);
    for (const seed of ["seed-b", "seed-c", "seed-d", "seed-e"]) {
      expect(tally(viewOf(seed).grid)).toBe(base);
    }
  });

  it("actually presents the board differently to different players", () => {
    const grids = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(viewOf(`s${i}`).grid)),
    );
    expect(grids.size).toBeGreaterThan(1);
  });
});

describe("verify", () => {
  const run = (submission: unknown, seed = SEED) =>
    verify({ seed, difficulty: "hard", submission, durationMs: 120_000 });

  it("accepts every word found in the player's own orientation", () => {
    expect(run(perfectRun(SEED)).valid).toBe(true);
  });

  it("accepts a run selected backwards", () => {
    const submission = perfectRun(SEED);
    submission.found[0].cells = [...submission.found[0].cells].reverse();
    expect(run(submission).valid).toBe(true);
  });

  it("rejects a partial solve", () => {
    const submission = perfectRun(SEED);
    submission.found.pop();
    expect(run(submission).valid).toBe(false);
  });

  it("rejects coordinates from a different player's orientation", () => {
    // The screenshot-sharing case: right words, wrong presentation.
    const other = ["a", "b", "c", "d", "e", "f", "g", "h"]
      .map((s) => `seed-${s}`)
      .find((s) => JSON.stringify(transformFor(s)) !== JSON.stringify(transformFor(SEED)));
    expect(other).toBeDefined();
    expect(run(perfectRun(other!), SEED).valid).toBe(false);
  });

  it("rejects invented cells for a real word", () => {
    const submission = perfectRun(SEED);
    submission.found[0].cells = submission.found[0].cells.map((cell) => ({
      r: (cell.r + 1) % GRID,
      c: cell.c,
    }));
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a word that is not on the list", () => {
    const submission = perfectRun(SEED);
    submission.found.push({ word: "NOTAWORD", cells: [{ r: 0, c: 0 }] });
    expect(run(submission).valid).toBe(false);
  });

  it("survives junk", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ found: "nope" }).valid).toBe(false);
    expect(run({ found: [{ word: 1, cells: [] }] }).valid).toBe(false);
  });
});
