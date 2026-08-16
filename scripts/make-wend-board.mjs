/**
 * Builds the canonical Wend board and prints it as a frozen TypeScript literal
 * to paste into `src/server/games/impl/wend.ts`.
 *
 *   node scripts/make-wend-board.mjs [seed]
 *
 * WHY THIS IS OFFLINE
 *
 * Finding a board is a backtracking search, and *proving the board has only one
 * solution* is a second, bigger search. That is fine to spend seconds on here
 * and completely unacceptable on a Vercel cold start, where it would land on
 * whichever unlucky player woke the function. So the answer is computed once,
 * by hand, and committed as data.
 *
 * THE PUZZLE
 *
 * Wend is a tiling puzzle wearing a word game's clothes. Every open tile must
 * belong to exactly one word, and words are traced through orthogonally
 * adjacent tiles, bending freely around the walls. Finding a word that reads
 * correctly is not enough - if it strands a tile that no other word can reach,
 * it is the wrong path.
 *
 * Construction runs backwards from that rule: lay the words down first as
 * disjoint self-avoiding paths, then whatever cells are left over become the
 * walls. Every generated board is therefore solvable by construction, and the
 * only thing left to check is that it is solvable exactly one way.
 */

const SIZE = 7;

/**
 * The ladder: 8 FOSS and Onam words, totalling 45 of the 49 cells, leaving 4 walls.
 */
const WORDS = ["GNU", "FOSS", "LINUX", "MAVELI", "KERNEL", "DEBIAN", "PAYASAM", "POOKALAM"];

const total = WORDS.reduce((n, w) => n + w.length, 0);
if (total > SIZE * SIZE) {
  throw new Error(`${total} letters will not fit in a ${SIZE}x${SIZE} grid`);
}

/* ------------------------------------------------------------------- rng */

function makeRng(seed) {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }
  state >>>= 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffled = (items, rand) => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const idx = (r, c) => r * SIZE + c;
const CELLS = Array.from({ length: SIZE * SIZE }, (_, i) => i);

/** Orthogonal neighbours only. The whole game is "no diagonals". */
const NEIGHBOURS = CELLS.map((cell) => {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  const out = [];
  if (r > 0) out.push(idx(r - 1, c));
  if (r < SIZE - 1) out.push(idx(r + 1, c));
  if (c > 0) out.push(idx(r, c - 1));
  if (c < SIZE - 1) out.push(idx(r, c + 1));
  return out;
});

/* ------------------------------------------------------------ generation */

/**
 * Lays the words down as disjoint paths. `used[cell]` holds the word index that
 * claimed a cell, or -1.
 *
 * Longest word first: it has the fewest legal paths, so committing to it early
 * is what stops the search thrashing. (Same reasoning as the old word-search
 * generator, and one of the few things worth keeping from it.)
 */
function layout(rand) {
  const order = WORDS.slice().sort((a, b) => b.length - a.length);
  const used = new Int8Array(SIZE * SIZE).fill(-1);
  const paths = new Map();

  const extend = (wordIndex, word, path) => {
    if (path.length === word.length) {
      paths.set(word, path.slice());
      return true;
    }
    const from = path[path.length - 1];
    for (const next of shuffled(NEIGHBOURS[from], rand)) {
      if (used[next] !== -1) continue;
      used[next] = wordIndex;
      path.push(next);
      if (extend(wordIndex, word, path)) return true;
      path.pop();
      used[next] = -1;
    }
    return false;
  };

  const place = (wordIndex) => {
    if (wordIndex === order.length) return true;
    const word = order[wordIndex];
    for (const start of shuffled(CELLS, rand)) {
      if (used[start] !== -1) continue;
      used[start] = wordIndex;
      if (extend(wordIndex, word, [start])) {
        if (place(wordIndex + 1)) return true;
        for (const cell of paths.get(word)) used[cell] = -1;
        paths.delete(word);
      } else {
        used[start] = -1;
      }
    }
    return false;
  };

  if (!place(0)) return null;

  const letters = Array.from({ length: SIZE * SIZE }, () => null);
  for (const [word, path] of paths) {
    path.forEach((cell, i) => {
      letters[cell] = word[i];
    });
  }
  return { letters, paths };
}

/* -------------------------------------------------------------- solving */

/**
 * Counts distinct solutions, stopping at `cap`.
 *
 * A board with two solutions is a bad puzzle: two players can both be right and
 * only one gets the "expected" answer. Since `verify` accepts any valid tiling
 * that would not be unfair, but it does mean the puzzle has less of a click to
 * it - so boards are re-rolled until exactly one solution exists.
 */
function countSolutions(letters, cap = 2) {
  const open = CELLS.filter((cell) => letters[cell] !== null);
  const used = new Uint8Array(SIZE * SIZE);
  const order = WORDS.slice().sort((a, b) => b.length - a.length);
  let found = 0;
  let remaining = open.length;

  /** Cheap prune: no free region smaller than the shortest word left can ever be filled. */
  const regionsAreFillable = (shortest) => {
    const seen = new Uint8Array(SIZE * SIZE);
    for (const cell of open) {
      if (used[cell] || seen[cell]) continue;
      let size = 0;
      const stack = [cell];
      seen[cell] = 1;
      while (stack.length) {
        const at = stack.pop();
        size += 1;
        for (const next of NEIGHBOURS[at]) {
          if (letters[next] === null || used[next] || seen[next]) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      if (size < shortest) return false;
    }
    return true;
  };

  const extend = (word, path, then) => {
    if (path.length === word.length) return then();
    const from = path[path.length - 1];
    for (const next of NEIGHBOURS[from]) {
      if (used[next] || letters[next] !== word[path.length]) continue;
      used[next] = 1;
      remaining -= 1;
      path.push(next);
      if (extend(word, path, then)) return true;
      path.pop();
      remaining += 1;
      used[next] = 0;
    }
    return false;
  };

  /** Returns true once `cap` solutions have been seen, to unwind the search. */
  const place = (wordIndex) => {
    if (wordIndex === order.length) {
      if (remaining === 0) found += 1;
      return found >= cap;
    }
    const word = order[wordIndex];
    const shortest = Math.min(...order.slice(wordIndex).map((w) => w.length));
    if (!regionsAreFillable(shortest)) return false;

    for (const start of open) {
      if (used[start] || letters[start] !== word[0]) continue;
      used[start] = 1;
      remaining -= 1;
      if (extend(word, [start], () => place(wordIndex + 1))) return true;
      remaining += 1;
      used[start] = 0;
    }
    return false;
  };

  place(0);
  return found;
}

/* ----------------------------------------------------------------- main */

const baseSeed = process.argv[2] ?? "wend-canonical-v2";
let board = null;
let attempts = 0;

for (let salt = 0; salt < 20_000 && !board; salt += 1) {
  attempts = salt + 1;
  const candidate = layout(makeRng(`${baseSeed}:${salt}`));
  if (!candidate) continue;
  if (countSolutions(candidate.letters) !== 1) continue;
  board = candidate;
}

if (!board) {
  console.error("No uniquely-solvable board found. Widen the word list or the salt range.");
  process.exit(1);
}

const grid = [];
for (let r = 0; r < SIZE; r += 1) {
  grid.push(Array.from({ length: SIZE }, (_, c) => board.letters[idx(r, c)]));
}

console.error(`Found a uniquely-solvable board after ${attempts} attempt(s).\n`);
for (const row of grid) console.error(row.map((x) => x ?? "#").join(" "));
console.error("");
for (const [word, path] of board.paths) {
  console.error(
    `${word.padEnd(9)} ${path.map((c) => `${Math.floor(c / SIZE)}${c % SIZE}`).join(" ")}`,
  );
}
console.error("");

// stdout carries only the pasteable literal, so it can be redirected cleanly.
const quote = (cell) => (cell === null ? '""' : `"${String(cell)}"`);
const rows = grid.map((row) => `  [${row.map(quote).join(", ")}],`);
console.log(`export const GRID_SIZE = ${SIZE};

/** Words to find. Order is irrelevant - the player finds them however they like. */
export const WORDS = [${WORDS.map((w) => `"${w}"`).join(", ")}] as const;

/**
 * THE canonical board. Empty string is a wall.
 *
 * Generated by \`node scripts/make-wend-board.mjs ${baseSeed}\` and verified to
 * have exactly one solution. Do not hand-edit: a single changed letter can make
 * it unsolvable or ambiguous, and neither failure is visible by eye.
 */
export const BOARD: readonly (readonly string[])[] = [
${rows.join("\n")}
];`);
