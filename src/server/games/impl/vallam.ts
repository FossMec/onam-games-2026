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

export const BOARD = 7;
/** The vallam always sits on this row and escapes to the right. */
export const EXIT_ROW = 3;

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

/**
 * Backward-scramble board generator:
 * Places vertical blocker boats crossing the exit lane, then scrambles
 * backwards via legal moves, guaranteeing deep 7x7 sliding puzzles with high par.
 */
export function randomBoard(rng: Rng): Boat[] | null {
  const vallamLen = 2;
  // Start with Vallam at the exit (solved position)
  let boats: Boat[] = [
    {
      id: 0,
      r: EXIT_ROW,
      c: BOARD - vallamLen,
      len: vallamLen,
      horizontal: true,
    },
  ];
  const occupied = new Set<string>();
  for (const cell of cellsOf(boats[0])) occupied.add(`${cell.r},${cell.c}`);

  // Guarantee 2 to 3 vertical blocker boats crossing the exit row
  const exitBlockCols = [2, 3, 4].filter((col) => !occupied.has(`${EXIT_ROW},${col}`));
  for (const col of exitBlockCols) {
    if (rng.chance(0.85)) {
      const len = rng.chance(0.6) ? 2 : 3;
      const r = rng.int(Math.max(0, EXIT_ROW - len + 1), Math.min(BOARD - len, EXIT_ROW));
      const candidate: Boat = {
        id: boats.length,
        r,
        c: col,
        len,
        horizontal: false,
      };
      const cells = cellsOf(candidate);
      if (!cells.some((cell) => occupied.has(`${cell.r},${cell.c}`))) {
        for (const cell of cells) occupied.add(`${cell.r},${cell.c}`);
        boats.push(candidate);
      }
    }
  }

  // Place additional random horizontal and vertical blockers
  const target = rng.int(11, 14);
  let guard = 0;
  while (boats.length < target && guard < 400) {
    guard += 1;
    const horizontal = rng.chance(0.55);
    const len = rng.chance(0.6) ? 2 : 3;
    const r = rng.int(0, BOARD - (horizontal ? 1 : len));
    const c = rng.int(0, BOARD - (horizontal ? len : 1));
    const candidate: Boat = { id: boats.length, r, c, len, horizontal };

    if (horizontal && r === EXIT_ROW) continue;

    const cells = cellsOf(candidate);
    if (cells.some((cell) => occupied.has(`${cell.r},${cell.c}`))) continue;
    for (const cell of cells) occupied.add(`${cell.r},${cell.c}`);
    boats.push(candidate);
  }

  // Deep random walk to scramble the board backwards
  for (let step = 0; step < 250; step += 1) {
    const grid = buildGrid(boats);
    const boatIdx = rng.int(0, boats.length - 1);
    const boat = boats[boatIdx];
    const deltas: number[] = [];
    for (const d of [-3, -2, -1, 1, 2, 3]) {
      if (d !== 0 && canMove(grid, boat, d)) deltas.push(d);
    }
    if (deltas.length > 0) {
      const chosenD = deltas[rng.int(0, deltas.length - 1)];
      boats = applyMove(boats, { b: boat.id, d: chosenD });
    }
  }

  // Push Vallam away from exit to c:0 or c:1
  if (boats[0].c > 1) {
    for (let c = boats[0].c; c > 0; c -= 1) {
      const grid = buildGrid(boats);
      if (canMove(grid, boats[0], -1)) {
        boats = applyMove(boats, { b: 0, d: -1 });
      }
    }
  }

  return boats.length >= 8 && boats[0].c <= 1 ? boats : null;
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

/** Single hard curated challenge - significantly harder than previous levels, solvable and verified via BFS */
export const CUSTOM_LEVELS: {
  id: string;
  name: string;
  difficulty: "normal" | "hard" | "master";
  par: number;
  boats: Omit<Boat, "id">[];
}[] = [
  {
    id: "vembanad-hard-7x7",
    name: "Vembanad Hard Lock",
    difficulty: "hard",
    par: 15,
    boats: [
      { r: 3, c: 0, len: 2, horizontal: true },
      { r: 3, c: 2, len: 2, horizontal: false },
      { r: 1, c: 2, len: 2, horizontal: false },
      { r: 4, c: 0, len: 2, horizontal: false },
      { r: 5, c: 4, len: 2, horizontal: false },
      { r: 4, c: 4, len: 3, horizontal: true },
      { r: 1, c: 3, len: 2, horizontal: false },
      { r: 0, c: 0, len: 2, horizontal: false },
      { r: 0, c: 4, len: 3, horizontal: false },
      { r: 5, c: 5, len: 2, horizontal: false },
      { r: 5, c: 1, len: 2, horizontal: true },
      { r: 4, c: 3, len: 2, horizontal: false },
      { r: 0, c: 2, len: 2, horizontal: true },
    ],
  },
];

function generateUncached(seed: string, difficulty: string): GeneratedInstance {
  const rng = createRng(`${seed}:vallam:level-pick`);

  const matchingLevels = CUSTOM_LEVELS.filter(
    (lvl) =>
      difficulty === "all" ||
      lvl.difficulty === difficulty ||
      (difficulty === "hard" && lvl.difficulty === "master"),
  );

  const levelPool = matchingLevels.length > 0 ? matchingLevels : CUSTOM_LEVELS;
  const pickedLevel = levelPool[rng.int(0, levelPool.length - 1)];

  const boats: Boat[] = pickedLevel.boats.map((b, idx) => ({
    ...b,
    id: idx,
  }));
  const par = pickedLevel.par;

  return {
    view: {
      kind: "vallam",
      size: BOARD,
      exitRow: EXIT_ROW,
      boats,
      par,
    } satisfies VallamView,
    solution: { par },
  };
}

export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as VallamSubmission | null;
  if (!submission || !Array.isArray(submission.moves)) {
    return { valid: false, reason: "Nothing submitted." };
  }
  if (submission.moves.length > 2_000) {
    return {
      valid: false,
      reason: "That is a lot of moves. Too many, in fact.",
    };
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
