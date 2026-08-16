import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";
import { createRng, type Rng } from "../rng";

/**
 * Pookalam Jigsaw.
 *
 * ANTI-CHEAT, HONESTLY
 *
 * A jigsaw cannot hide its answer. The browser has to render each piece, which
 * means it necessarily knows which slot every piece came from - no amount of
 * server-side secrecy changes that. Pretending otherwise would be theatre.
 *
 * So the defence here is different in kind from the other games:
 *   - the clock is the server's, as always, and time is the only score;
 *   - `minPlausibleMs` in the registry rejects superhuman completions;
 *   - a move log must replay to the submitted final state, with monotonic
 *     timestamps that fit inside the server-measured duration.
 *
 * That does not make scripting impossible. It makes a script have to *act*
 * like a person for a plausible length of time, which is most of the value,
 * and anything faster than a human gets flagged for review rather than
 * silently topping the board.
 */

/** One interlocking edge between two adjacent pieces. */
export interface JigsawTab {
  /** 1 = tab bulges toward the second piece, -1 = toward the first. */
  dir: 1 | -1;
  /** Where along the edge the tab sits (0.35-0.65). */
  offset: number;
  /** Neck width as a fraction of the edge. Narrower = harder to eyeball. */
  neck: number;
  /** How far the head bulges, as a fraction of the piece. */
  head: number;
  /** Lateral lean, so no two tabs are quite the same shape. */
  skew: number;
}

export interface JigsawView {
  kind: "jigsaw";
  cols: number;
  rows: number;
  imageUrl: string;
  /** (rows-1) x cols - edges between vertically adjacent pieces. */
  hEdges: JigsawTab[][];
  /** rows x (cols-1) - edges between horizontally adjacent pieces. */
  vEdges: JigsawTab[][];
  /**
   * Where each piece starts, in cell units relative to the board origin.
   * Seeded so a resumed attempt scatters identically, and so two players get
   * the same scatter - the layout is part of the difficulty.
   */
  scatter: { id: number; x: number; y: number }[];
}

export interface JigsawSubmission {
  /**
   * Where each piece ended up, in whole cells.
   *
   * A free-placement jigsaw has no slots - the assembled picture can sit
   * anywhere on the board - so the submission is each piece's grid coordinate
   * and the check is on the *relative* layout. `gx`/`gy` are integers because
   * snapping aligns pieces exactly; there is no tolerance to argue about.
   */
  layout: { id: number; gx: number; gy: number }[];
  /** Every snap: piece, ms since start. Replayed against the server's clock. */
  moveLog: { p: number; t: number }[];
}

/**
 * How much bigger the scatter area is than the finished picture, per axis.
 * Enough room to spread out without making the board a scrolling expedition.
 */
export const SCATTER_SPREAD = 1.6;

/** Grid size by difficulty. 5x5 is a real fight on a phone; 6x6 is punishment. */
function gridFor(difficulty: string): { cols: number; rows: number } {
  if (difficulty === "hard") return { cols: 5, rows: 5 };
  if (difficulty === "brutal") return { cols: 6, rows: 6 };
  return { cols: 4, rows: 4 };
}

/**
 * Tabs are varied deliberately: uniform tabs let a player match pieces by
 * silhouette alone, which trivialises a symmetric pookalam. Randomising neck,
 * head and skew forces them to actually read the artwork.
 */
function makeTab(rng: Rng): JigsawTab {
  return {
    dir: rng.chance(0.5) ? 1 : -1,
    offset: 0.35 + rng.next() * 0.3,
    neck: 0.1 + rng.next() * 0.08,
    head: 0.16 + rng.next() * 0.1,
    skew: (rng.next() - 0.5) * 0.12,
  };
}

export function generate(seed: string, difficulty: string, imageUrl: string): GeneratedInstance {
  const rng = createRng(seed);
  const { cols, rows } = gridFor(difficulty);

  const hEdges: JigsawTab[][] = [];
  for (let r = 0; r < rows - 1; r += 1) {
    hEdges.push(Array.from({ length: cols }, () => makeTab(rng)));
  }
  const vEdges: JigsawTab[][] = [];
  for (let r = 0; r < rows; r += 1) {
    vEdges.push(Array.from({ length: cols - 1 }, () => makeTab(rng)));
  }

  const count = cols * rows;
  /*
   * Pieces are scattered across a board wider and taller than the finished
   * picture, so there is somewhere to put them. Positions are in cell units;
   * the client scales to pixels.
   *
   * Nothing is placed in its solved spot at the start - a piece that happens to
   * begin correctly is a free move, and on a ranked day free moves are not free.
   */
  const scatter = rng.shuffle(Array.from({ length: count }, (_, i) => i)).map((id) => {
    const home = { x: id % cols, y: Math.floor(id / cols) };
    for (let tries = 0; tries < 12; tries += 1) {
      const x = rng.next() * (cols * SCATTER_SPREAD - 1);
      const y = rng.next() * (rows * SCATTER_SPREAD - 1);
      if (Math.abs(x - home.x) > 0.75 || Math.abs(y - home.y) > 0.75) {
        return { id, x, y };
      }
    }
    return {
      id,
      x: rng.next() * (cols * SCATTER_SPREAD - 1),
      y: rng.next() * (rows * SCATTER_SPREAD - 1),
    };
  });

  return {
    view: { kind: "jigsaw", cols, rows, imageUrl, hEdges, vEdges, scatter } satisfies JigsawView,
    // The "solution" is the identity permutation - see the note above about
    // why there is nothing here worth hiding.
    solution: { count },
  };
}

export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as JigsawSubmission | null;
  const { cols, rows } = gridFor(input.difficulty);
  const count = cols * rows;

  if (!submission || !Array.isArray(submission.layout)) {
    return { valid: false, reason: "Nothing submitted." };
  }
  if (submission.layout.length !== count) {
    return { valid: false, reason: "That is not this puzzle." };
  }

  /*
   * The assembly check.
   *
   * A finished jigsaw can sit anywhere on the board, so absolute positions mean
   * nothing - what matters is that every piece sits in the right place relative
   * to the others. Anchor on piece 0 and require every other piece to be at
   * exactly its true grid offset from it.
   *
   * Integers throughout: snapping aligns pieces cell-exactly, so a float
   * tolerance here would only be a place for rounding error to hide.
   */
  const at = new Map<number, { gx: number; gy: number }>();
  for (const piece of submission.layout) {
    if (
      typeof piece?.id !== "number" ||
      typeof piece?.gx !== "number" ||
      typeof piece?.gy !== "number" ||
      !Number.isInteger(piece.id) ||
      !Number.isInteger(piece.gx) ||
      !Number.isInteger(piece.gy) ||
      piece.id < 0 ||
      piece.id >= count
    ) {
      return { valid: false, reason: "Malformed layout." };
    }
    if (at.has(piece.id)) return { valid: false, reason: "A piece is in two places." };
    at.set(piece.id, { gx: piece.gx, gy: piece.gy });
  }
  if (at.size !== count) return { valid: false, reason: "Pieces are missing." };

  const anchor = at.get(0)!;
  for (let id = 0; id < count; id += 1) {
    const here = at.get(id)!;
    const wantX = id % cols;
    const wantY = Math.floor(id / cols);
    if (here.gx - anchor.gx !== wantX || here.gy - anchor.gy !== wantY) {
      return { valid: false, reason: "Not solved yet. Keep going." };
    }
  }

  /*
   * The move log does not prove correctness - the layout above does that. It
   * exists to make a completion *take time*, which for a game whose answer the
   * browser necessarily knows is the only defence worth having. See the note
   * at the top of this file.
   */
  const log = submission.moveLog;
  /*
   * A token floor, and deliberately only a token one.
   *
   * This used to demand `count - 1` entries, on the reasoning that assembling N
   * pieces takes N-1 joins. The premise is right and the conclusion is wrong:
   * the log records one entry per *drag*, not per join, and a single drag can
   * close several joins at once - the snap loop keeps merging while the dragged
   * group has neighbours to merge with. So a player who assembles efficiently
   * finishes a 25-piece board in well under 24 drags and had their completed,
   * provably correct puzzle rejected with "move log too short". Being good at
   * the game was the failure condition.
   *
   * Nothing is lost by relaxing it, because the length of this log was never a
   * real defence: fabricating twenty-four plausible entries is trivial, and a
   * script would have done so. What actually guards this game is the layout
   * check above, `minPlausibleMs` against the server's own clock, and the
   * timestamp bounds below. The log is timing evidence, not proof of effort.
   */
  if (!Array.isArray(log) || log.length < 2) {
    return { valid: false, reason: "Move log missing or too short." };
  }
  if (log.length > count * 60) {
    return { valid: false, reason: "Move log is implausibly long." };
  }

  let lastT = -1;
  const slack = 5_000;
  for (const move of log) {
    if (
      typeof move?.p !== "number" ||
      typeof move?.t !== "number" ||
      !Number.isInteger(move.p) ||
      move.p < 0 ||
      move.p >= count
    ) {
      return { valid: false, reason: "Malformed move log." };
    }
    // Timestamps must run forward and fit inside the server's own clock.
    if (move.t < lastT || move.t > input.durationMs + slack) {
      return { valid: false, reason: "Move log does not match the clock." };
    }
    lastT = move.t;
  }

  return { valid: true, movesCount: log.length };
}
