import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";
import { createRng, type Rng } from "../rng";

/**
 * Pookalam Jigsaw.
 *
 * ANTI-CHEAT, HONESTLY
 *
 * A jigsaw cannot hide its answer. The browser has to render each piece, which
 * means it necessarily knows which slot every piece came from — no amount of
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
  /** (rows-1) x cols — edges between vertically adjacent pieces. */
  hEdges: JigsawTab[][];
  /** rows x (cols-1) — edges between horizontally adjacent pieces. */
  vEdges: JigsawTab[][];
  /** Shuffled tray order, so pieces do not arrive pre-sorted. */
  trayOrder: number[];
}

export interface JigsawSubmission {
  /** placement[slot] = piece id. Solved when placement[i] === i for all i. */
  placement: number[];
  /** Every drop: piece, slot, ms since start. Replayed to confirm consistency. */
  moveLog: { p: number; s: number; t: number }[];
}

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
  const trayOrder = rng.shuffle(Array.from({ length: count }, (_, i) => i));

  return {
    view: { kind: "jigsaw", cols, rows, imageUrl, hEdges, vEdges, trayOrder } satisfies JigsawView,
    // The "solution" is the identity permutation — see the note above about
    // why there is nothing here worth hiding.
    solution: { count },
  };
}

export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as JigsawSubmission | null;
  const { cols, rows } = gridFor(input.difficulty);
  const count = cols * rows;

  if (!submission || !Array.isArray(submission.placement)) {
    return { valid: false, reason: "Nothing submitted." };
  }
  if (submission.placement.length !== count) {
    return { valid: false, reason: "That is not this puzzle." };
  }

  // Every slot filled by exactly the piece cut from it.
  for (let slot = 0; slot < count; slot += 1) {
    if (submission.placement[slot] !== slot) {
      return { valid: false, reason: "Not solved yet. Keep going." };
    }
  }

  const log = submission.moveLog;
  if (!Array.isArray(log) || log.length < count) {
    return { valid: false, reason: "Move log missing or too short." };
  }
  // Bound the replay so a huge log cannot buy CPU time.
  if (log.length > count * 60) {
    return { valid: false, reason: "Move log is implausibly long." };
  }

  // Replay the log and confirm it actually produces the submitted board.
  const board = Array.from<number | null>({ length: count }).fill(null);
  let lastT = -1;
  const slack = 5_000;

  for (const move of log) {
    if (
      typeof move?.p !== "number" ||
      typeof move?.s !== "number" ||
      typeof move?.t !== "number" ||
      move.p < 0 ||
      move.p >= count ||
      move.s < 0 ||
      move.s >= count
    ) {
      return { valid: false, reason: "Malformed move log." };
    }
    // Timestamps must run forward and fit inside the server's own clock.
    if (move.t < lastT || move.t > input.durationMs + slack) {
      return { valid: false, reason: "Move log does not match the clock." };
    }
    lastT = move.t;

    // A piece can only be in one slot; moving it vacates the old one.
    const previous = board.indexOf(move.p);
    if (previous !== -1) board[previous] = null;
    board[move.s] = move.p;
  }

  for (let slot = 0; slot < count; slot += 1) {
    if (board[slot] !== submission.placement[slot]) {
      return { valid: false, reason: "Move log does not match the final board." };
    }
  }

  return { valid: true, movesCount: log.length };
}
