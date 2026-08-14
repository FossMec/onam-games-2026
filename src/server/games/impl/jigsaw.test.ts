import { describe, expect, it } from "vite-plus/test";
import { generate, verify, type JigsawView } from "./jigsaw";

const SEED = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const IMAGE = "/pookalam-placeholder.svg";

const viewOf = (seed = SEED, difficulty = "hard") =>
  generate(seed, difficulty, IMAGE).view as JigsawView;

/**
 * A finished board plus a plausible move log.
 *
 * `origin` shifts the whole assembly, which must make no difference: a finished
 * jigsaw sits wherever the player left it, so only relative positions count.
 */
function solvedRun(cols: number, rows: number, origin = { x: 0, y: 0 }, msPerMove = 400) {
  const count = cols * rows;
  return {
    layout: Array.from({ length: count }, (_, id) => ({
      id,
      gx: (id % cols) + origin.x,
      gy: Math.floor(id / cols) + origin.y,
    })),
    moveLog: Array.from({ length: count }, (_, i) => ({ p: i, t: (i + 1) * msPerMove })),
  };
}

describe("generate", () => {
  it("is deterministic for a seed", () => {
    expect(JSON.stringify(viewOf())).toEqual(JSON.stringify(viewOf()));
  });

  it("cuts different tabs for different players", () => {
    expect(JSON.stringify(viewOf().hEdges)).not.toEqual(JSON.stringify(viewOf("other").hEdges));
  });

  it("sizes the edge grids to the board", () => {
    const view = viewOf();
    expect(view.cols).toBe(5);
    expect(view.rows).toBe(5);
    // One horizontal seam between each pair of rows, one vertical per pair of cols.
    expect(view.hEdges).toHaveLength(view.rows - 1);
    expect(view.hEdges[0]).toHaveLength(view.cols);
    expect(view.vEdges).toHaveLength(view.rows);
    expect(view.vEdges[0]).toHaveLength(view.cols - 1);
  });

  it("scatters every piece exactly once", () => {
    const view = viewOf();
    const count = view.cols * view.rows;
    expect([...view.scatter].map((s) => s.id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: count }, (_, i) => i),
    );
  });

  it("keeps the scatter on the board", () => {
    const view = viewOf();
    for (const piece of view.scatter) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.y).toBeGreaterThanOrEqual(0);
      // A piece is one cell wide, so its origin must leave room for it.
      expect(piece.x).toBeLessThanOrEqual(view.cols * 1.6 - 1);
      expect(piece.y).toBeLessThanOrEqual(view.rows * 1.6 - 1);
    }
  });

  it("never starts a piece already in its solved spot", () => {
    // A piece that begins correct is a free join, and on a ranked day free
    // moves are not free.
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const view = viewOf(`scatter-${seed}`);
      for (const piece of view.scatter) {
        const home = { x: piece.id % view.cols, y: Math.floor(piece.id / view.cols) };
        expect(Math.abs(piece.x - home.x) > 0.75 || Math.abs(piece.y - home.y) > 0.75).toBe(true);
      }
    }
  });

  it("carries the swappable image straight through", () => {
    expect(viewOf().imageUrl).toBe(IMAGE);
    expect((generate(SEED, "hard", "/real.png").view as JigsawView).imageUrl).toBe("/real.png");
  });

  it("scales the grid with difficulty", () => {
    expect(viewOf(SEED, "normal").cols).toBe(4);
    expect(viewOf(SEED, "brutal").cols).toBe(6);
  });
});

describe("verify", () => {
  const run = (submission: unknown, durationMs = 60_000, difficulty = "hard") =>
    verify({ seed: SEED, difficulty, submission, durationMs });

  it("accepts an assembled board", () => {
    const result = run(solvedRun(5, 5));
    expect(result.valid).toBe(true);
    expect(result.movesCount).toBe(25);
  });

  it("accepts an assembly sitting anywhere on the board", () => {
    // The whole point of free placement: the finished picture does not have to
    // be parked at the origin.
    expect(run(solvedRun(5, 5, { x: 4, y: -2 })).valid).toBe(true);
    expect(run(solvedRun(5, 5, { x: -11, y: 7 })).valid).toBe(true);
  });

  it("rejects a board that is not actually assembled", () => {
    const submission = solvedRun(5, 5);
    // Two pieces swapped: every piece is present, none of it fits.
    [submission.layout[0].gx, submission.layout[1].gx] = [
      submission.layout[1].gx,
      submission.layout[0].gx,
    ];
    expect(run(submission).valid).toBe(false);
  });

  it("rejects an assembly with one piece nudged out of line", () => {
    const submission = solvedRun(5, 5);
    submission.layout[12].gy += 1;
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a layout sized for a different difficulty", () => {
    expect(run(solvedRun(4, 4)).valid).toBe(false);
  });

  it("rejects duplicate or missing pieces", () => {
    const dupe = solvedRun(5, 5);
    dupe.layout[1] = { ...dupe.layout[0] };
    expect(run(dupe).valid).toBe(false);

    const missing = solvedRun(5, 5);
    missing.layout.pop();
    expect(run(missing).valid).toBe(false);
  });

  it("rejects a finished board with no supporting move log", () => {
    expect(run({ ...solvedRun(5, 5), moveLog: [] }).valid).toBe(false);
  });

  it("rejects timestamps that run backwards", () => {
    const submission = solvedRun(5, 5);
    submission.moveLog[5] = { p: 5, t: 10 };
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a log that claims more time than the attempt lasted", () => {
    // The forged-duration case.
    expect(run(solvedRun(5, 5), 1_000).valid).toBe(false);
  });

  it("bounds replay work and survives junk", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ ...solvedRun(5, 5), moveLog: "nope" }).valid).toBe(false);
    expect(run({ layout: "nope", moveLog: [] }).valid).toBe(false);
    expect(run({ ...solvedRun(5, 5), layout: [{ id: 0.5, gx: 0, gy: 0 }] }).valid).toBe(false);

    const flood = {
      ...solvedRun(5, 5),
      moveLog: Array.from({ length: 25 * 61 }, () => ({ p: 0, t: 1 })),
    };
    expect(run(flood).valid).toBe(false);
  });
});
