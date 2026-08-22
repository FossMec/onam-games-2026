import { describe, expect, it } from "vite-plus/test";
import { BOARD, GRID_SIZE, WORDS, applyTransform, generate, matchTrace, verify } from "./wend";
import type { Cell, WendView } from "./wend";

const SEED = "5c4b3a2918273645f0e1d2c3b4a59687";

const viewOf = (seed = SEED) => generate(seed).view as WendView;

const adjacent = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

/**
 * Solves a board from scratch: partition every open tile into paths spelling
 * the words. The tests use this rather than a stored answer key so they prove
 * the board is actually solvable, not merely that it matches something.
 */
function solve(grid: string[][]): { word: string; cells: Cell[] }[] | null {
  const used = new Set<string>();
  const open: Cell[] = [];
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) if (grid[r][c] !== "") open.push({ r, c });
  }
  const order = [...WORDS].sort((a, b) => b.length - a.length);
  const out: { word: string; cells: Cell[] }[] = [];

  const extend = (word: string, cells: Cell[], then: () => boolean): boolean => {
    if (cells.length === word.length) return then();
    const from = cells[cells.length - 1];
    for (const cell of open) {
      if (!adjacent(from, cell)) continue;
      const k = `${cell.r},${cell.c}`;
      if (used.has(k) || grid[cell.r][cell.c] !== word[cells.length]) continue;
      used.add(k);
      cells.push(cell);
      if (extend(word, cells, then)) return true;
      cells.pop();
      used.delete(k);
    }
    return false;
  };

  const place = (i: number): boolean => {
    if (i === order.length) return used.size === open.length;
    const word = order[i];
    for (const start of open) {
      const k = `${start.r},${start.c}`;
      if (used.has(k) || grid[start.r][start.c] !== word[0]) continue;
      used.add(k);
      const cells = [start];
      if (
        extend(word, cells, () => {
          out.push({ word, cells: [...cells] });
          if (place(i + 1)) return true;
          out.pop();
          return false;
        })
      ) {
        return true;
      }
      used.delete(k);
    }
    return false;
  };

  return place(0) ? out : null;
}

describe("the canonical board", () => {
  it("is a well-formed grid of letters and walls", () => {
    expect(BOARD).toHaveLength(GRID_SIZE);
    for (const row of BOARD) {
      expect(row).toHaveLength(GRID_SIZE);
      for (const cell of row) expect(cell).toMatch(/^[A-Z]?$/);
    }
  });

  it("has exactly as many open tiles as the words have letters", () => {
    // The defining constraint: every tile belongs to exactly one word, so a
    // mismatch here makes the puzzle unsolvable no matter how it is traced.
    const open = BOARD.flat().filter((cell) => cell !== "").length;
    const letters = WORDS.reduce((n, w) => n + w.length, 0);
    expect(open).toBe(letters);
  });

  it("is solvable", () => {
    expect(solve(BOARD.map((row) => [...row]))).not.toBeNull();
  });
});

describe("presentation", () => {
  it("is a bijection for all eight orientations", () => {
    for (const rot of [0, 1, 2, 3] as const) {
      for (const flip of [false, true]) {
        const seen = new Set<string>();
        for (let r = 0; r < GRID_SIZE; r += 1) {
          for (let c = 0; c < GRID_SIZE; c += 1) {
            const to = applyTransform({ r, c }, { rot, flip });
            expect(to.r).toBeGreaterThanOrEqual(0);
            expect(to.r).toBeLessThan(GRID_SIZE);
            seen.add(`${to.r},${to.c}`);
          }
        }
        expect(seen.size).toBe(GRID_SIZE * GRID_SIZE);
      }
    }
  });

  it("preserves difficulty: every player's board holds the same tiles", () => {
    const tally = (grid: string[][]) => grid.flat().sort().join("|");
    const base = tally(viewOf("seed-a").grid);
    for (const seed of ["seed-b", "seed-c", "seed-d", "seed-e"]) {
      expect(tally(viewOf(seed).grid)).toBe(base);
    }
  });

  it("keeps every board solvable, in every orientation", () => {
    // Rotation and reflection preserve orthogonal adjacency, so a legal path
    // stays legal. This is the property the fairness argument rests on.
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      expect(solve(viewOf(`orient-${seed}`).grid)).not.toBeNull();
    }
  });

  it("actually shows different players different boards", () => {
    const grids = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(viewOf(`s${i}`).grid)),
    );
    expect(grids.size).toBeGreaterThan(1);
  });

  it("never ships the answer to the browser", () => {
    expect(generate(SEED).solution).toBeNull();
  });
});

describe("verify", () => {
  const run = (submission: unknown, seed = SEED) =>
    verify({ seed, difficulty: "hard", submission, durationMs: 120_000 });

  const solved = (seed = SEED) => ({ found: solve(viewOf(seed).grid)! });

  it("accepts a real solution", () => {
    expect(run(solved()).valid).toBe(true);
  });

  it("accepts the words in any order", () => {
    const submission = solved();
    submission.found.reverse();
    expect(run(submission).valid).toBe(true);
  });

  it("rejects a partial solve", () => {
    const submission = solved();
    submission.found.pop();
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a path that jumps instead of bending", () => {
    const submission = solved();
    const entry = submission.found.find((f) => f.word.length > 3)!;
    // Move one tile of the path off the chain while keeping the letter right
    // would be caught by the letter check, so break adjacency directly.
    entry.cells = [entry.cells[0], ...entry.cells.slice(2)];
    expect(run(submission).valid).toBe(false);
  });

  it("rejects diagonal movement", () => {
    // Diagonals are the single biggest way to get this game wrong, and this is
    // the test that would have caught the original word-search implementation.
    const grid = viewOf().grid;
    let diagonal: Cell[] | null = null;
    for (let r = 0; r < GRID_SIZE - 1 && !diagonal; r += 1) {
      for (let c = 0; c < GRID_SIZE - 1 && !diagonal; c += 1) {
        if (grid[r][c] !== "" && grid[r + 1][c + 1] !== "") {
          diagonal = [
            { r, c },
            { r: r + 1, c: c + 1 },
          ];
        }
      }
    }
    expect(diagonal).not.toBeNull();
    const word = grid[diagonal![0].r][diagonal![0].c] + grid[diagonal![1].r][diagonal![1].c];
    expect(run({ found: [{ word, cells: diagonal }] }).valid).toBe(false);
  });

  it("rejects a solution that leaves a tile uncovered", () => {
    const submission = solved();
    const entry = submission.found.find((f) => f.word === "GIT")!;
    entry.cells = entry.cells.slice(0, 2);
    expect(run(submission).valid).toBe(false);
  });

  it("rejects two words sharing a tile", () => {
    const submission = solved();
    submission.found[1].cells = [
      ...submission.found[0].cells.slice(0, 1),
      ...submission.found[1].cells.slice(1),
    ];
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a solution traced on another player's board", () => {
    const other = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
      .map((s) => `seed-${s}`)
      .find((s) => JSON.stringify(viewOf(s).grid) !== JSON.stringify(viewOf(SEED).grid));
    expect(other).toBeDefined();
    expect(run(solved(other!), SEED).valid).toBe(false);
  });

  it("rejects a word that is not on the list", () => {
    const submission = solved();
    submission.found[0] = { word: "NOTAWORD", cells: submission.found[0].cells };
    expect(run(submission).valid).toBe(false);
  });

  it("rejects the same word claimed twice", () => {
    const submission = solved();
    submission.found[1] = { ...submission.found[0] };
    expect(run(submission).valid).toBe(false);
  });

  it("survives junk", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ found: "nope" }).valid).toBe(false);
    expect(run({ found: [{ word: 1, cells: [] }] }).valid).toBe(false);
    expect(run({ found: WORDS.map((word) => ({ word, cells: [{ r: 99, c: 99 }] })) }).valid).toBe(
      false,
    );
  });
});

describe("matchTrace", () => {
  const cellsFor = (word: string, seed = SEED) =>
    solve(viewOf(seed).grid)!.find((f) => f.word === word)!.cells;

  it("confirms a path that spells a hidden word", () => {
    expect(matchTrace(SEED, cellsFor("GIT"))).toBe("GIT");
  });

  it("rejects a path that spells nothing", () => {
    const grid = viewOf().grid;
    // Two adjacent open tiles plus a third, deliberately not a word.
    const junk = cellsFor("POOKALAM").slice(0, 3).reverse();
    expect(grid).toBeDefined();
    expect(matchTrace(SEED, junk)).toBeNull();
  });

  it("rejects a diagonal or broken path outright", () => {
    expect(
      matchTrace(SEED, [
        { r: 0, c: 0 },
        { r: 1, c: 1 },
        { r: 2, c: 2 },
      ]),
    ).toBeNull();
  });

  it("rejects out-of-bounds cells", () => {
    expect(
      matchTrace(SEED, [
        { r: -1, c: 0 },
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ]),
    ).toBeNull();
    expect(
      matchTrace(SEED, [
        { r: 99, c: 99 },
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ]),
    ).toBeNull();
  });

  it("does not leak a word for a path on another player's board", () => {
    const other = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
      .map((s) => `seed-${s}`)
      .find((s) => JSON.stringify(viewOf(s).grid) !== JSON.stringify(viewOf(SEED).grid))!;
    expect(matchTrace(SEED, cellsFor("POOKALAM", other))).toBeNull();
  });
});
