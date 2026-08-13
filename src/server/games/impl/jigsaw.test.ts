import { describe, expect, it } from "vite-plus/test";
import { generate, verify, type JigsawView } from "./jigsaw";

const SEED = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const IMAGE = "/pookalam-placeholder.svg";

const viewOf = (seed = SEED, difficulty = "hard") =>
  generate(seed, difficulty, IMAGE).view as JigsawView;

/** A solved board plus a plausible move log that produces it. */
function solvedRun(count: number, msPerMove = 400) {
  return {
    placement: Array.from({ length: count }, (_, i) => i),
    moveLog: Array.from({ length: count }, (_, i) => ({ p: i, s: i, t: (i + 1) * msPerMove })),
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

  it("shuffles the tray without losing or duplicating a piece", () => {
    const view = viewOf();
    const count = view.cols * view.rows;
    expect([...view.trayOrder].sort((a, b) => a - b)).toEqual(
      Array.from({ length: count }, (_, i) => i),
    );
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

  it("accepts a solved board with a consistent log", () => {
    const result = run(solvedRun(25));
    expect(result.valid).toBe(true);
    expect(result.movesCount).toBe(25);
  });

  it("rejects a board that is not actually solved", () => {
    const submission = solvedRun(25);
    [submission.placement[0], submission.placement[1]] = [
      submission.placement[1],
      submission.placement[0],
    ];
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a placement sized for a different difficulty", () => {
    // A 4x4 run submitted against the 5x5 game.
    expect(run(solvedRun(16)).valid).toBe(false);
  });

  it("rejects a solved board with no supporting move log", () => {
    expect(run({ placement: Array.from({ length: 25 }, (_, i) => i), moveLog: [] }).valid).toBe(
      false,
    );
  });

  it("rejects a log whose replay disagrees with the final board", () => {
    const submission = solvedRun(25);
    // Claim the last piece went somewhere else on the way.
    submission.moveLog[24] = { p: 24, s: 3, t: 10_000 };
    expect(run(submission).valid).toBe(false);
  });

  it("rejects timestamps that run backwards", () => {
    const submission = solvedRun(25);
    submission.moveLog[5] = { p: 5, s: 5, t: 10 };
    expect(run(submission).valid).toBe(false);
  });

  it("rejects a log that claims moves after the server's own clock", () => {
    // The forged-duration case: a log longer than the attempt actually lasted.
    expect(run(solvedRun(25), 1_000).valid).toBe(false);
  });

  it("accepts a piece being moved more than once before settling", () => {
    const count = 25;
    const moveLog = [
      { p: 0, s: 7, t: 100 },
      { p: 0, s: 0, t: 200 },
      ...Array.from({ length: count - 1 }, (_, i) => ({ p: i + 1, s: i + 1, t: 300 + i * 100 })),
    ];
    const result = run({ placement: Array.from({ length: count }, (_, i) => i), moveLog });
    expect(result.valid).toBe(true);
  });

  it("bounds replay work and survives junk", () => {
    expect(run(null).valid).toBe(false);
    expect(run({}).valid).toBe(false);
    expect(run({ placement: Array.from({ length: 25 }, (_, i) => i), moveLog: "nope" }).valid).toBe(
      false,
    );
    const flood = {
      placement: Array.from({ length: 25 }, (_, i) => i),
      moveLog: Array.from({ length: 25 * 61 }, () => ({ p: 0, s: 0, t: 1 })),
    };
    expect(run(flood).valid).toBe(false);
  });
});
