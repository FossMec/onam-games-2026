import { describe, expect, it } from "vite-plus/test";
import { BOARD, EXIT_ROW, generate, solve, verify } from "./vallam";
import type { Boat, VallamMove, VallamView } from "./vallam";

const SEED = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";

const viewOf = (seed = SEED, difficulty = "hard") => generate(seed, difficulty).view as VallamView;

/** Every cell each boat sits on. */
function cells(boats: Boat[]): string[] {
  return boats.flatMap((b) =>
    Array.from({ length: b.len }, (_, i) =>
      b.horizontal ? `${b.r},${b.c + i}` : `${b.r + i},${b.c}`,
    ),
  );
}

/**
 * Brute-force replay of a solution found by BFS. The solver only returns a
 * length, so tests that need actual moves search for them directly — small
 * boards make this cheap and it keeps the solver honest.
 */
function findSolution(boats: Boat[], maxDepth: number): VallamMove[] | null {
  const key = (bs: Boat[]) => bs.map((b) => `${b.r},${b.c}`).join("|");
  const occupied = (bs: Boat[]) => new Set(cells(bs));
  const solved = (bs: Boat[]) => bs[0].c + bs[0].len === BOARD;

  const seen = new Set([key(boats)]);
  let frontier: { boats: Boat[]; path: VallamMove[] }[] = [{ boats, path: [] }];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const taken = occupied(node.boats);
      for (const boat of node.boats) {
        for (const dir of [-1, 1]) {
          for (let steps = 1; steps < BOARD; steps += 1) {
            const d = dir * steps;
            const moved: Boat = {
              ...boat,
              r: boat.horizontal ? boat.r : boat.r + d,
              c: boat.horizontal ? boat.c + d : boat.c,
            };
            if (moved.r < 0 || moved.c < 0) break;
            if (moved.r + (moved.horizontal ? 1 : moved.len) > BOARD) break;
            if (moved.c + (moved.horizontal ? moved.len : 1) > BOARD) break;
            const own = new Set(cells([boat]));
            const hits = cells([moved]).some((cell) => taken.has(cell) && !own.has(cell));
            if (hits) break;

            const bs = node.boats.map((b) => (b.id === boat.id ? moved : b));
            const path = [...node.path, { b: boat.id, d }];
            if (solved(bs)) return path;
            const k = key(bs);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push({ boats: bs, path });
          }
        }
      }
    }
    frontier = next;
  }
  return null;
}

describe("generate", () => {
  it("is deterministic for a seed", () => {
    expect(JSON.stringify(viewOf())).toBe(JSON.stringify(viewOf()));
  });

  it("gives different players different boards", () => {
    const boards = new Set(
      Array.from({ length: 4 }, (_, i) => JSON.stringify(viewOf(`board-${i}`).boats)),
    );
    expect(boards.size).toBeGreaterThan(1);
  }, 15000);

  it("never overlaps boats and never leaves the board", () => {
    for (let i = 0; i < 8; i += 1) {
      const boats = viewOf(`overlap-${i}`).boats;
      const all = cells(boats);
      expect(new Set(all).size).toBe(all.length);
      for (const boat of boats) {
        expect(boat.r).toBeGreaterThanOrEqual(0);
        expect(boat.c).toBeGreaterThanOrEqual(0);
        expect(boat.r + (boat.horizontal ? 1 : boat.len)).toBeLessThanOrEqual(BOARD);
        expect(boat.c + (boat.horizontal ? boat.len : 1)).toBeLessThanOrEqual(BOARD);
      }
    }
  });

  it("puts the vallam on the exit row, horizontal, as boat 0", () => {
    for (let i = 0; i < 8; i += 1) {
      const vallam = viewOf(`vallam-${i}`).boats[0];
      expect(vallam.id).toBe(0);
      expect(vallam.r).toBe(EXIT_ROW);
      expect(vallam.horizontal).toBe(true);
    }
  });

  it("keeps the exit row clear of other horizontal boats", () => {
    // A second horizontal boat on the exit row can wedge the lane permanently.
    for (let i = 0; i < 8; i += 1) {
      const boats = viewOf(`lane-${i}`).boats;
      for (const boat of boats.slice(1)) {
        expect(boat.horizontal && boat.r === EXIT_ROW).toBe(false);
      }
    }
  });

  it("only ships boards that are actually solvable, and not trivially", () => {
    for (let i = 0; i < 8; i += 1) {
      const view = viewOf(`solvable-${i}`);
      expect(view.par).toBeGreaterThanOrEqual(3);
      expect(solve(view.boats)).toBe(view.par);
    }
  });
});

describe("solve", () => {
  it("reports 0 for an already-escaped vallam", () => {
    const boats: Boat[] = [{ id: 0, r: EXIT_ROW, c: BOARD - 2, len: 2, horizontal: true }];
    expect(solve(boats)).toBe(0);
  });

  it("counts a single slide as one move", () => {
    const boats: Boat[] = [{ id: 0, r: EXIT_ROW, c: 0, len: 2, horizontal: true }];
    expect(solve(boats)).toBe(1);
  });

  it("returns null when the lane is permanently walled off", () => {
    // A full-height vertical stack in the last column that nothing can shift.
    const boats: Boat[] = [
      { id: 0, r: EXIT_ROW, c: 0, len: 2, horizontal: true },
      { id: 1, r: 0, c: BOARD - 1, len: 3, horizontal: false },
      { id: 2, r: 3, c: BOARD - 1, len: 3, horizontal: false },
    ];
    expect(solve(boats)).toBeNull();
  });
});

describe("verify", () => {
  const run = (submission: unknown, seed = SEED) =>
    verify({ seed, difficulty: "hard", submission, durationMs: 60_000 });

  it("accepts a genuine solution", () => {
    const view = viewOf();
    const moves = findSolution(view.boats, view.par);
    expect(moves).not.toBeNull();
    expect(run({ moves }).valid).toBe(true);
  });

  it("accepts a wasteful but legal solution", () => {
    const view = viewOf();
    const moves = findSolution(view.boats, view.par)!;
    // Shuffle a boat back and forth first. Move count does not rank this game,
    // so a longer route has to still count as a win.
    const wanderer = view.boats.find((b) => !b.horizontal && b.r > 0)!;
    expect(
      run({ moves: [{ b: wanderer.id, d: -1 }, { b: wanderer.id, d: 1 }, ...moves] }).valid,
    ).toBe(true);
  });

  it("rejects a solution replayed against a different player's board", () => {
    const other = Array.from({ length: 12 }, (_, i) => `rival-${i}`).find((seed) => {
      const view = viewOf(seed);
      return JSON.stringify(view.boats) !== JSON.stringify(viewOf().boats);
    })!;
    const view = viewOf(other);
    const moves = findSolution(view.boats, view.par)!;
    expect(run({ moves }, SEED).valid).toBe(false);
  });

  it("rejects sliding a boat through another boat", () => {
    const vallam = viewOf().boats[0];
    // Straight to the exit in one move. It stays on the board, so this is
    // rejected for hitting something rather than for leaving the grid — and
    // par >= 3 guarantees something is in the way.
    const toExit = BOARD - vallam.len - vallam.c;
    expect(run({ moves: [{ b: 0, d: toExit }] }).valid).toBe(false);
  });

  it("rejects sliding a boat off the board", () => {
    const vertical = viewOf().boats.find((b) => !b.horizontal)!;
    expect(run({ moves: [{ b: vertical.id, d: BOARD }] }).valid).toBe(false);
  });

  it("rejects a board left unsolved", () => {
    expect(run({ moves: [] }).valid).toBe(false);
  });

  it("rejects a boat that does not exist", () => {
    expect(run({ moves: [{ b: 999, d: 1 }] }).valid).toBe(false);
  });

  it("rejects an absurd move list before replaying it", () => {
    const moves = Array.from({ length: 2_001 }, () => ({ b: 0, d: 1 }));
    expect(run({ moves }).valid).toBe(false);
  });

  it("survives junk", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ moves: "nope" }).valid).toBe(false);
    expect(run({ moves: [{ b: "0", d: 1 }] }).valid).toBe(false);
    expect(run({ moves: [{ b: 0, d: 0 }] }).valid).toBe(false);
  });
});
