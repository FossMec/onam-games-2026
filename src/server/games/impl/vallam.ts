import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";
import { createRng, type Rng } from "../rng";

/**
 * Escape the Vallam - a sliding-block puzzle. Get the chundan vallam out of
 * the right edge; every other boat is in the way and only moves along its own
 * axis.
 *
 * GENERATION
 *
 * Boards are generated *backwards from a solved state* and then verified by a
 * BFS solver, so every board is guaranteed solvable and its true minimum move
 * count is known. Forward random generation produces unsolvable boards
 * constantly, and shipping one to 500 players at once would be unrecoverable.
 *
 * VERIFICATION
 *
 * The server replays the submitted move list on its own copy of the board.
 * Every move must be legal - right boat, right axis, unobstructed - and the
 * final position must have the vallam at the exit. The client's claims about
 * what happened are never trusted; only the replay counts.
 */

export const BOARD = 6;
/** The vallam always sits on this row and escapes to the right. */
export const EXIT_ROW = 2;

export interface Boat {
  id: number;
  /** Top-left cell. */
  r: number;
  c: number;
  len: number;
  /** Horizontal boats move along a row; vertical along a column. */
  horizontal: boolean;
}

export interface VallamView {
  kind: "vallam";
  size: number;
  exitRow: number;
  boats: Boat[];
  /** Shortest known solution, shown as a par score. Not a secret. */
  par: number;
}

export interface VallamMove {
  /** Boat id. */
  b: number;
  /** Signed steps: negative = left/up, positive = right/down. */
  d: number;
}

export interface VallamSubmission {
  moves: VallamMove[];
}

/** Cells a boat occupies. */
function cellsOf(boat: Boat): { r: number; c: number }[] {
  return Array.from({ length: boat.len }, (_, i) => ({
    r: boat.r + (boat.horizontal ? 0 : i),
    c: boat.c + (boat.horizontal ? i : 0),
  }));
}

function buildGrid(boats: Boat[]): Int8Array {
  const grid = new Int8Array(BOARD * BOARD).fill(-1);
  for (const boat of boats) {
    for (const cell of cellsOf(boat)) grid[cell.r * BOARD + cell.c] = boat.id;
  }
  return grid;
}

/**
 * Can `boat` shift by `delta` steps without leaving the board or hitting
 * anything? Walks one step at a time, checking only the cell the boat newly
 * occupies - the cell it vacates is its own and never blocks it.
 */
function canMove(grid: Int8Array, boat: Boat, delta: number): boolean {
  const step = Math.sign(delta);
  let { r, c } = boat;
  for (let i = 0; i < Math.abs(delta); i += 1) {
    // Leading edge: the far end when moving forward, one before when back.
    const lead = boat.horizontal
      ? { r, c: step > 0 ? c + boat.len : c - 1 }
      : { r: step > 0 ? r + boat.len : r - 1, c };
    if (lead.r < 0 || lead.r >= BOARD || lead.c < 0 || lead.c >= BOARD) return false;
    const occupant = grid[lead.r * BOARD + lead.c];
    if (occupant !== -1 && occupant !== boat.id) return false;
    if (boat.horizontal) c += step;
    else r += step;
  }
  return true;
}

function applyMove(boats: Boat[], move: VallamMove): Boat[] {
  return boats.map((boat) =>
    boat.id === move.b
      ? {
          ...boat,
          r: boat.horizontal ? boat.r : boat.r + move.d,
          c: boat.horizontal ? boat.c + move.d : boat.c,
        }
      : boat,
  );
}

const isSolved = (boats: Boat[]): boolean => {
  const vallam = boats[0];
  return vallam.c + vallam.len === BOARD;
};

/**
 * Breadth-first shortest solution length, or null if unsolvable within `cap`
 * explored states.
 *
 * Written on flat typed arrays rather than the `Boat[]` objects used
 * elsewhere. A boat only ever moves along one axis, so a whole position is
 * just each boat's primary coordinate - one byte each. The object version of
 * this allocated a fresh array of boat objects per explored state and took
 * ~1s per generated board, which is not a thing you can do inside a request.
 *
 * The cap is deliberately modest: a board needing more search than this is one
 * nobody would enjoy, so "too hard to search" is treated as "redraw".
 */
export function solve(boats: Boat[], cap = 30_000): number | null {
  const n = boats.length;
  const horiz = boats.map((b) => b.horizontal);
  const lens = boats.map((b) => b.len);
  // The coordinate that never changes for each boat.
  const fixed = boats.map((b) => (b.horizontal ? b.r : b.c));
  const start = Int8Array.from(boats.map((b) => (b.horizontal ? b.c : b.r)));

  const grid = new Int8Array(BOARD * BOARD);
  const paint = (pos: Int8Array): void => {
    grid.fill(-1);
    for (let i = 0; i < n; i += 1) {
      for (let k = 0; k < lens[i]; k += 1) {
        grid[horiz[i] ? fixed[i] * BOARD + pos[i] + k : (pos[i] + k) * BOARD + fixed[i]] = i;
      }
    }
  };

  const solved = (pos: Int8Array): boolean => pos[0] + lens[0] === BOARD;
  const key = (pos: Int8Array): string => String.fromCharCode(...pos);

  if (solved(start)) return 0;

  const seen = new Set([key(start)]);
  let frontier: Int8Array[] = [start];
  let depth = 0;

  while (frontier.length > 0 && seen.size < cap) {
    depth += 1;
    const next: Int8Array[] = [];
    for (const pos of frontier) {
      paint(pos);
      for (let i = 0; i < n; i += 1) {
        for (const dir of [-1, 1]) {
          for (let steps = 1; steps < BOARD; steps += 1) {
            const to = pos[i] + dir * steps;
            // Leading cell for this step.
            const lead = dir > 0 ? to + lens[i] - 1 : to;
            if (lead < 0 || lead >= BOARD) break;
            const cell = horiz[i] ? fixed[i] * BOARD + lead : lead * BOARD + fixed[i];
            const occupant = grid[cell];
            if (occupant !== -1 && occupant !== i) break;

            const moved = Int8Array.from(pos);
            moved[i] = to;
            if (solved(moved)) return depth;
            const k = key(moved);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push(moved);
          }
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Places boats at random without overlapping. Vallam is always id 0. */
function randomBoard(rng: Rng): Boat[] | null {
  const boats: Boat[] = [{ id: 0, r: EXIT_ROW, c: rng.int(0, 1), len: 3, horizontal: true }];
  const occupied = new Set<string>();
  for (const cell of cellsOf(boats[0])) occupied.add(`${cell.r},${cell.c}`);

  const target = rng.int(10, 13);
  let guard = 0;
  while (boats.length < target && guard < 400) {
    guard += 1;
    const horizontal = rng.chance(0.5);
    const len = rng.chance(0.72) ? 2 : 3;
    const r = rng.int(0, BOARD - (horizontal ? 1 : len));
    const c = rng.int(0, BOARD - (horizontal ? len : 1));
    const candidate: Boat = { id: boats.length, r, c, len, horizontal };

    // A horizontal boat on the exit row would make the puzzle unsolvable or
    // trivial depending on side; keep that row for the vallam alone.
    if (horizontal && r === EXIT_ROW) continue;

    const cells = cellsOf(candidate);
    if (cells.some((cell) => occupied.has(`${cell.r},${cell.c}`))) continue;
    for (const cell of cells) occupied.add(`${cell.r},${cell.c}`);
    boats.push(candidate);
  }
  return boats.length >= 8 ? boats : null;
}

/**
 * Generates a solvable board that is actually worth solving.
 *
 * Rejection sampling against the BFS solver: keep drawing boards until one
 * needs at least `minPar` moves. A board you can clear in three moves is not a
 * puzzle, and on a ranked day that difference decides the leaderboard.
 */
/**
 * Generation runs a BFS solver, so it is far too expensive to repeat. Both
 * `/start` and `verify` need the same board, and a player who refreshes hits
 * it again - memoise per seed so it is computed once per process.
 */
const boardCache = new Map<string, GeneratedInstance>();
const CACHE_LIMIT = 500;

export function generate(seed: string, difficulty: string): GeneratedInstance {
  const cacheKey = `${seed}:${difficulty}`;
  const cached = boardCache.get(cacheKey);
  if (cached) return cached;

  const result = generateUncached(seed, difficulty);
  // Crude bound: this is a per-process cache on a short-lived function, and
  // an unbounded map here would be a slow leak on a long-running instance.
  if (boardCache.size >= CACHE_LIMIT) boardCache.clear();
  boardCache.set(cacheKey, result);
  return result;
}

function generateUncached(seed: string, difficulty: string): GeneratedInstance {
  /*
   * Tuned against the measured distribution. A single random 9-11 boat board
   * usually solves in 5-10 moves, so a high threshold means every generation
   * exhausts its attempts and falls back - the slowest path, taken every time.
   * Thresholds of 14 and then 11 both did exactly that.
   *
   * These accept within a few draws. Par is a floor on interest, not the
   * score: the day is ranked on time, so a 6-move board still separates
   * players by how fast they see it.
   */
  const minPar = difficulty === "hard" ? 8 : 6;
  let fallback: { boats: Boat[]; par: number } | null = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const rng = createRng(`${seed}:vallam:${attempt}`);
    const boats = randomBoard(rng);
    if (!boats) continue;
    const par = solve(boats);
    if (par === null || par === 0) continue;
    if (par >= minPar) {
      return {
        view: { kind: "vallam", size: BOARD, exitRow: EXIT_ROW, boats, par } satisfies VallamView,
        solution: { par },
      };
    }
    // Keep the hardest solvable board seen, so we always have something.
    if (!fallback || par > fallback.par) fallback = { boats, par };
  }

  if (!fallback) throw new Error("Vallam: could not generate a solvable board");
  return {
    view: {
      kind: "vallam",
      size: BOARD,
      exitRow: EXIT_ROW,
      boats: fallback.boats,
      par: fallback.par,
    } satisfies VallamView,
    solution: { par: fallback.par },
  };
}

export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as VallamSubmission | null;
  if (!submission || !Array.isArray(submission.moves)) {
    return { valid: false, reason: "Nothing submitted." };
  }
  if (submission.moves.length > 2_000) {
    return { valid: false, reason: "That is a lot of moves. Too many, in fact." };
  }

  // Regenerate the player's own board from their seed.
  const view = generate(input.seed, input.difficulty).view as VallamView;
  let boats = view.boats;

  for (const move of submission.moves) {
    if (typeof move?.b !== "number" || typeof move?.d !== "number" || move.d === 0) {
      return { valid: false, reason: "Malformed move." };
    }
    const boat = boats.find((b) => b.id === move.b);
    if (!boat) return { valid: false, reason: "No such boat." };
    if (!canMove(buildGrid(boats), boat, move.d)) {
      return { valid: false, reason: "That boat cannot move there. DWAAAA..." };
    }
    boats = applyMove(boats, move);
  }

  if (!isSolved(boats)) {
    return { valid: false, reason: "Your vallam is still stuck." };
  }
  return { valid: true, movesCount: submission.moves.length };
}
