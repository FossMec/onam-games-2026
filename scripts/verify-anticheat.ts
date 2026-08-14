/**
 * Anti-cheat demonstration harness.
 *
 *   ./node_modules/.bin/tsx scripts/verify-anticheat.ts
 *
 * Runs the real verifiers against forged submissions and prints whether each
 * forgery was rejected. This exercises the same `verify()` functions the finish
 * endpoint calls, so a PASS here is the actual production behaviour, not a
 * mock.
 *
 * It deliberately does NOT touch the database or the HTTP layer — those are
 * checked separately (see the curl block printed at the end), because the two
 * failure modes are different: this file answers "can a forged payload score",
 * and curl answers "can an unauthenticated request get that far at all".
 */

import * as jigsaw from "../src/server/games/impl/jigsaw";
import * as jump from "../src/server/games/impl/jump";
import * as tinder from "../src/server/games/impl/tinder";
import * as vallam from "../src/server/games/impl/vallam";
import * as wend from "../src/server/games/impl/wend";
import {
  MAX_FRAMES,
  initialState,
  packInputs,
  platformX,
  simulate,
  step,
} from "../src/lib/jump-sim";
import type { JumpView } from "../src/server/games/impl/jump";
import type { VallamView } from "../src/server/games/impl/vallam";
import type { WendView } from "../src/server/games/impl/wend";

const SEED = "attack-seed-0123456789abcdef";

/** Minimal Wend solver, so the harness can produce a genuinely valid board. */
function solveWend(grid: string[][]): { word: string; cells: { r: number; c: number }[] }[] {
  const n = grid.length;
  const used = new Set<string>();
  const open: { r: number; c: number }[] = [];
  for (let r = 0; r < n; r += 1)
    for (let c = 0; c < n; c += 1) if (grid[r][c] !== "") open.push({ r, c });
  const near = (a: { r: number; c: number }, b: { r: number; c: number }) =>
    Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  const order = [...wend.WORDS].sort((a, b) => b.length - a.length);
  const out: { word: string; cells: { r: number; c: number }[] }[] = [];

  const extend = (
    word: string,
    cells: { r: number; c: number }[],
    then: () => boolean,
  ): boolean => {
    if (cells.length === word.length) return then();
    for (const cell of open) {
      if (!near(cells[cells.length - 1], cell)) continue;
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
    for (const start of open) {
      const k = `${start.r},${start.c}`;
      if (used.has(k) || grid[start.r][start.c] !== order[i][0]) continue;
      used.add(k);
      const cells = [start];
      if (
        extend(order[i], cells, () => {
          out.push({ word: order[i], cells: [...cells] });
          if (place(i + 1)) return true;
          out.pop();
          return false;
        })
      )
        return true;
      used.delete(k);
    }
    return false;
  };
  place(0);
  return out;
}
let failures = 0;

/** `expectRejected` is the whole point: every case here MUST come back invalid. */
function expectRejected(what: string, result: { valid: boolean; reason?: string }) {
  const ok = !result.valid;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "\x1b[32mREJECTED\x1b[0m" : "\x1b[31mACCEPTED — THIS IS A HOLE\x1b[0m"}  ${what}`,
    ok && result.reason ? `\x1b[2m(${result.reason})\x1b[0m` : "",
  );
}

function expectAccepted(what: string, result: { valid: boolean; reason?: string }) {
  const ok = result.valid;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "\x1b[32mACCEPTED\x1b[0m" : "\x1b[31mREJECTED — honest play was refused\x1b[0m"}  ${what}`,
    !ok && result.reason ? `\x1b[2m(${result.reason})\x1b[0m` : "",
  );
}

const base = { seed: SEED, difficulty: "hard", durationMs: 120_000 };

/* ------------------------------------------------------------------ wend */
console.log("\n\x1b[1mWend\x1b[0m — one canonical board, per-player orientation");
{
  const view = wend.generate(SEED).view as WendView;
  expectRejected("empty submission", wend.verify({ ...base, submission: { found: [] } }));
  expectRejected(
    "every word claimed with invented coordinates",
    wend.verify({
      ...base,
      submission: {
        found: view.words.map((word) => ({
          word,
          cells: Array.from({ length: word.length }, (_, i) => ({ r: 0, c: i })),
        })),
      },
    }),
  );
  // The screenshot-sharing attack: a real solution traced on someone else's board.
  const other = Array.from({ length: 20 }, (_, i) => `rival-${i}`).find(
    (s) => JSON.stringify(wend.transformFor(s)) !== JSON.stringify(wend.transformFor(SEED)),
  )!;
  const rival = wend.generate(other).view as WendView;
  expectRejected(
    "another player's screenshot, replayed on my board",
    wend.verify({ ...base, submission: { found: solveWend(rival.grid) } }),
  );
  expectRejected(
    "a diagonal path — this is not a word search",
    wend.verify({
      ...base,
      submission: {
        found: [
          {
            word: view.words[0],
            cells: [
              { r: 0, c: 0 },
              { r: 1, c: 1 },
            ],
          },
        ],
      },
    }),
  );
}

/* ---------------------------------------------------------------- vallam */
console.log("\n\x1b[1mEscape the Vallam\x1b[0m — server replays every move");
{
  const view = vallam.generate(SEED, "hard").view as VallamView;
  expectRejected("no moves, claiming a win", vallam.verify({ ...base, submission: { moves: [] } }));
  expectRejected(
    "teleport the vallam straight to the exit",
    vallam.verify({
      ...base,
      submission: { moves: [{ b: 0, d: vallam.BOARD - 2 - view.boats[0].c }] },
    }),
  );
  expectRejected(
    "move a boat that does not exist",
    vallam.verify({ ...base, submission: { moves: [{ b: 99, d: 1 }] } }),
  );
}

/* ---------------------------------------------------------------- jigsaw */
console.log("\n\x1b[1mPookalam Jigsaw\x1b[0m — placement replay + monotonic clock");
{
  expectRejected("nothing placed", jigsaw.verify({ ...base, submission: { moves: [] } }));
  expectRejected(
    "junk payload",
    jigsaw.verify({ ...base, submission: { moves: "everything is correct" } }),
  );
}

/* ---------------------------------------------------------------- tinder */
console.log("\n\x1b[1mOpen Source Tinder\x1b[0m — full transcript replay");
{
  expectRejected("empty transcript", tinder.verify({ ...base, submission: { passes: [] } }));
  expectRejected(
    "claiming a clean sweep with no swipes recorded",
    tinder.verify({ ...base, submission: { passes: [{ answers: [] }] } }),
  );
}

/* ------------------------------------------------------------------ jump */
console.log("\n\x1b[1mMaveli Jump\x1b[0m — server re-simulates the input trace");
{
  const seed = (jump.generate().view as JumpView).seed;

  // A genuine run, produced by actually playing the simulation.
  const state = initialState(seed);
  const trace: { f: number; d: number }[] = [];
  let dir = 0;
  while (state.alive && state.frame < MAX_FRAMES) {
    const apex = state.py + (state.vy > 0 ? (state.vy * state.vy) / (2 / 15) : 0);
    state.level.ensure(apex + 60);
    let target = null;
    for (const p of state.level.platforms) {
      if (p.y > apex) break;
      if (p.y < state.cameraY) continue;
      target = p;
    }
    let want = 0;
    if (target) {
      let dx = platformX(target, state.frame) + 11 - state.px;
      if (dx > 50) dx -= 100;
      if (dx < -50) dx += 100;
      want = dx > 1.2 ? 1 : dx < -1.2 ? -1 : 0;
    }
    if (want !== dir) {
      dir = want;
      trace.push({ f: state.frame, d: dir });
    }
    step(state, dir);
  }
  const honest = packInputs(trace);
  const real = simulate(seed, honest)!;
  const honestMs = (real.frames / 60) * 1000;
  console.log(
    `  \x1b[2ma genuine run: ${real.score} m over ${(honestMs / 1000).toFixed(0)}s of play\x1b[0m`,
  );

  expectAccepted(
    "the genuine run, submitted with a matching clock",
    jump.verify({ seed, difficulty: "hard", submission: { inputs: honest }, durationMs: honestMs }),
  );
  expectRejected(
    "same run, handed over 4 seconds after starting (a fast-forwarded bot)",
    jump.verify({ seed, difficulty: "hard", submission: { inputs: honest }, durationMs: 4_000 }),
  );
  /*
   * The naive attack: bolt a score onto the payload and hope. There is nowhere
   * for it to land — the submission type has no score field and `verify`
   * returns whatever the replay produced.
   *
   * The duration here is deliberately generous. A short one would get this
   * rejected by the clock check instead, which would prove a different point
   * than the one this case exists to make.
   */
  const claimed = jump.verify({
    seed,
    difficulty: "hard",
    submission: { inputs: [], score: 999_999, height: 999_999 },
    durationMs: 400_000,
  });
  const ignored = claimed.valid && (claimed.score ?? -1) < 100;
  console.log(
    `  ${ignored ? "\x1b[32mIGNORED\x1b[0m " : "\x1b[31mLEAKED\x1b[0m  "} a client-claimed score of 999,999 — server derived ${claimed.score ?? "nothing"} from the trace`,
  );
  if (!ignored) failures += 1;

  expectRejected(
    "hand-written trace with two inputs on the same frame",
    jump.verify({
      seed,
      difficulty: "hard",
      submission: { inputs: [12, 1] },
      durationMs: 300_000,
    }),
  );
}

console.log(
  failures === 0
    ? "\n\x1b[32m\x1b[1mAll forgeries rejected, honest play accepted.\x1b[0m\n"
    : `\n\x1b[31m\x1b[1m${failures} case(s) behaved wrongly.\x1b[0m\n`,
);

console.log(`\x1b[1mHTTP layer — run these against a live server:\x1b[0m
\x1b[2m# Naive direct POST. Must be 401: no session, no attempt, no score.\x1b[0m
curl -i -X POST localhost:3000/api/game/wend/finish \\
  -H 'Content-Type: application/json' \\
  -d '{"attemptToken":"made-up","submittedState":{},"durationMs":1,"score":999999}'

\x1b[2m# Same for starting an attempt.\x1b[0m
curl -i -X POST localhost:3000/api/game/wend/start
`);

process.exit(failures === 0 ? 0 : 1);
