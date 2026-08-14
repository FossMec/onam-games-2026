import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";
import { createRng } from "../rng";

/**
 * Wend — an 8x8 word grid of FOSS and Onam words.
 *
 * VARIANT POLICY
 *
 * There is exactly ONE canonical board for the whole event, shown to each
 * player under a seed-chosen isomorphism. Generating a different board per
 * player was rejected deliberately: different boards mean different
 * difficulty, and you cannot rank people fairly across puzzles that are not
 * equally hard.
 *
 * Every transform below is difficulty-preserving by construction:
 *   - 8 dihedral presentations (4 rotations x optional mirror)
 *   - the word list is re-ordered per player
 * so the search is visually different while the puzzle is provably identical.
 *
 * The accepted tradeoff: a shared screenshot still leaks the solution's
 * structure to anyone willing to mentally re-orient it. That is inherent to
 * any simultaneous single-puzzle release. The transforms raise the cost of
 * copying without ever changing what a player is asked to solve.
 */

export const GRID = 8;

/**
 * Words must fit the grid; every entry is <= 8 characters.
 *
 * DENSITY MATTERS. These total 44 letters in 64 cells (~69%). An earlier list
 * of 12 words came to 68 letters — more than the grid holds — and no amount of
 * retrying could place it, because it required four letters of overlap. If you
 * add a word, check the total stays under about 50 or placement stops
 * converging.
 */
const WORDS = ["POOKALAM", "KERNEL", "MAVELI", "VALLAM", "LINUX", "SADYA", "FORK", "ONAM"] as const;

/** Fixed forever: this seed defines THE canonical board. Never change it mid-event. */
const CANONICAL_SEED = "wend-canonical-v1";

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

export interface Cell {
  r: number;
  c: number;
}

interface Placement {
  word: string;
  cells: Cell[];
}

interface CanonicalBoard {
  grid: string[][];
  placements: Placement[];
}

/**
 * Lays every word into the grid, backtracking when a word will not fit.
 * Deterministic given the seed, so the canonical board is stable across
 * processes and deploys.
 */
function buildCanonical(salt: number): CanonicalBoard | null {
  const rng = createRng(`${CANONICAL_SEED}:${salt}`);
  const grid: (string | null)[][] = Array.from({ length: GRID }, () =>
    Array.from<string | null>({ length: GRID }).fill(null),
  );
  const placements: Placement[] = [];

  const fits = (word: string, r: number, c: number, dr: number, dc: number): Cell[] | null => {
    const cells: Cell[] = [];
    for (let i = 0; i < word.length; i += 1) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID) return null;
      const existing = grid[rr][cc];
      // Overlaps are allowed only where the letters agree.
      if (existing !== null && existing !== word[i]) return null;
      cells.push({ r: rr, c: cc });
    }
    return cells;
  };

  // Longest first: long words have the fewest legal positions, so placing
  // them last is how a word search generator fails to converge.
  const ordered = [...WORDS].sort((a, b) => b.length - a.length);

  for (const word of ordered) {
    const candidates: { cells: Cell[] }[] = [];
    for (const [dr, dc] of rng.shuffle(DIRECTIONS)) {
      for (let r = 0; r < GRID; r += 1) {
        for (let c = 0; c < GRID; c += 1) {
          const cells = fits(word, r, c, dr, dc);
          if (cells) candidates.push({ cells });
        }
      }
    }
    // Greedy placement paints itself into a corner often enough that this
    // is the normal case, not an error — the caller retries with a new salt.
    if (candidates.length === 0) return null;
    const chosen = rng.pick(candidates);
    chosen.cells.forEach((cell, i) => {
      grid[cell.r][cell.c] = word[i];
    });
    placements.push({ word, cells: chosen.cells });
  }

  // Filler. Biased toward letters already in play so the noise does not look
  // obviously different from the answers.
  const pool = placements.flatMap((p) => p.word.split(""));
  const filled = grid.map((row) => row.map((cell) => cell ?? rng.pick(pool)));

  return { grid: filled, placements };
}

/**
 * Built once per process — the board is constant for the whole event.
 *
 * Retries with successive salts because greedy placement frequently strands
 * the last short word. The first salt that fully places is deterministic, so
 * every process and deploy lands on the same board.
 */
let cached: CanonicalBoard | null = null;
function canonical(): CanonicalBoard {
  if (cached) return cached;
  for (let salt = 0; salt < 500; salt += 1) {
    const board = buildCanonical(salt);
    if (board) {
      cached = board;
      return board;
    }
  }
  throw new Error("Wend: no canonical board after 500 attempts — shorten the word list");
}

export interface WendTransform {
  /** Quarter-turns clockwise. */
  rot: 0 | 1 | 2 | 3;
  /** Mirror horizontally before rotating. */
  flip: boolean;
}

/** The player's presentation, derived from their seed. 8 possibilities. */
export function transformFor(seed: string): WendTransform {
  const rng = createRng(`${seed}:wend`);
  return { rot: rng.int(0, 3) as 0 | 1 | 2 | 3, flip: rng.chance(0.5) };
}

/** Maps a canonical cell to where it appears on the player's board. */
export function applyTransform(cell: Cell, t: WendTransform): Cell {
  let { r, c } = cell;
  const n = GRID - 1;
  if (t.flip) c = n - c;
  for (let i = 0; i < t.rot; i += 1) {
    const nr = c;
    const nc = n - r;
    r = nr;
    c = nc;
  }
  return { r, c };
}

export interface WendView {
  kind: "wend";
  size: number;
  /** The transformed letter grid. */
  grid: string[][];
  /** Words to find, shuffled per player. */
  words: string[];
}

export interface WendSubmission {
  /** One entry per word the player claims to have found. */
  found: { word: string; cells: Cell[] }[];
}

export function generate(seed: string): GeneratedInstance {
  const board = canonical();
  const t = transformFor(seed);
  const rng = createRng(`${seed}:wend-words`);

  const grid: string[][] = Array.from({ length: GRID }, () =>
    Array.from<string>({ length: GRID }).fill(""),
  );
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      const to = applyTransform({ r, c }, t);
      grid[to.r][to.c] = board.grid[r][c];
    }
  }

  return {
    view: {
      kind: "wend",
      size: GRID,
      grid,
      words: rng.shuffle(board.placements.map((p) => p.word)),
    } satisfies WendView,
    solution: board.placements.map((p) => ({
      word: p.word,
      cells: p.cells.map((cell) => applyTransform(cell, t)),
    })),
  };
}

const sameCells = (a: Cell[], b: Cell[]): boolean =>
  a.length === b.length && a.every((cell, i) => cell.r === b[i].r && cell.c === b[i].c);

export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as WendSubmission | null;
  if (!submission || !Array.isArray(submission.found)) {
    return { valid: false, reason: "Nothing submitted." };
  }
  if (submission.found.length > WORDS.length * 4) {
    return { valid: false, reason: "Too many claims." };
  }

  const t = transformFor(input.seed);
  const expected = new Map(
    canonical().placements.map((p) => [p.word, p.cells.map((cell) => applyTransform(cell, t))]),
  );

  const seen = new Set<string>();
  for (const claim of submission.found) {
    if (typeof claim?.word !== "string" || !Array.isArray(claim.cells)) {
      return { valid: false, reason: "Malformed submission." };
    }
    const target = expected.get(claim.word);
    if (!target) return { valid: false, reason: "That is not one of the words." };

    // Accept the run typed in either direction — dragging right-to-left over
    // a left-to-right word is the same find, and punishing that is just mean.
    const forward = sameCells(claim.cells, target);
    const backward = sameCells(claim.cells, [...target].reverse());
    if (!forward && !backward) {
      return { valid: false, reason: `"${claim.word}" is not there. ENTHUVA!` };
    }
    seen.add(claim.word);
  }

  if (seen.size !== WORDS.length) {
    return { valid: false, reason: "Some words are still hiding." };
  }
  return { valid: true, movesCount: submission.found.length };
}

/** Exposed for tests and for a future admin preview. */
export function canonicalBoardForTest(): CanonicalBoard {
  return canonical();
}
