import { FPS, INPUT_LEVELS, MAX_FRAMES, MAX_INPUTS, simulate } from "~/lib/jump-sim";
import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";

/**
 * Maveli Jump - server half.
 *
 * All the physics lives in `~/lib/jump-sim`, which the browser imports too;
 * this file only decides what to *believe*. The rules:
 *
 *   1. The client's score is not read. Ever. It is not even in the payload
 *      schema. The score is whatever re-running the trace produces here.
 *   2. The trace must be plausible in wall-clock terms. The simulation runs at
 *      a fixed 60Hz, so 21,600 frames means six real minutes happened; a bot
 *      that produces a perfect trace instantly is rejected on the clock alone.
 *      This is the check that makes automation cost the same time as playing.
 *   3. Nothing about the level is secret. The seed ships to the browser and the
 *      browser generates the same platforms. Hiding the level would not stop
 *      anyone and would only mean the game could not render.
 *
 * What this does *not* stop: someone who writes a good bot and lets it run in
 * real time for six minutes. That is a deliberate line - defeating it would
 * mean behavioural fingerprinting of input timing, which has false positives on
 * exactly the players least able to argue about it (cheap phones, screen
 * readers, anyone using a keyboard). Twelve attempts a day bounds the damage.
 */

/** Fallback seed for legacy attempts that predate per-attempt seeding. */
export const LEVEL_SEED = "maveli-jump-canonical-v1";

/**
 * A known and accepted property: the score has a ceiling of roughly 11,200.
 *
 * Six minutes at a fixed 60Hz is a *rate* limit - a player who simply never
 * dies climbs at a near-constant speed, so anyone flawless for the whole run
 * arrives at the same number. Tuning was tried in both directions and could not
 * remove it: widening gaps past the jump apex only converts skill into luck,
 * and no density of breakable or moving platforms troubles a player who never
 * misses. Measured runs at realistic human error rates spread from 45 to 8,600,
 * so the ceiling only affects the very top of the field.
 *
 * That is fine, because ranking is by percentile and ties share a rank: several
 * people who each played six flawless minutes *should* share first place. It is
 * also a useful signal - an 11,200 is either a genuinely extraordinary run or a
 * bot, and either way it is worth an admin glancing at.
 */

export interface JumpView {
  kind: "jump";
  /** The level seed. Public by design - see rule 3. */
  seed: string;
  fps: number;
  maxFrames: number;
}

export interface JumpSubmission {
  /** Packed steering deltas. Note the absence of a score field. */
  inputs: number[];
  /**
   * Total frames the client's simulation ran (state.frame at game-end).
   *
   * Sent so the server can do an O(1) clock check instead of scanning the
   * entire input array.  The server treats it as a hint only:
   *   - Too low  → frameCap shrinks → server-derived score is lower (self-punishing)
   *   - Too high → clock check rejects the run
   * Omitting it falls back to the O(inputs) scan for backwards compatibility
   * with any in-flight requests from old client builds.
   */
  traceFrames?: number;
  /** Lightweight FNV-1a hash of seed+inputs+traceFrames — O(n) hash, <0.1ms, PB-only check */
  hash?: string;
}

export function generate(seed: string = LEVEL_SEED): GeneratedInstance {
  return {
    view: { kind: "jump", seed, fps: FPS, maxFrames: MAX_FRAMES } satisfies JumpView,
    // There is no solution to withhold: the level is public and the score is
    // derived from the player's own inputs at verify time.
    solution: null,
  };
}

/**
 * Slack on the wall-clock check.
 *
 * The simulation advances one frame per animation frame, so a device that
 * cannot hold 60fps simulates *slower* than real time - that direction is fine
 * and needs no allowance. The allowance exists for the other direction: the
 * clock starts at `/start`, and page setup, asset decode and the player's own
 * "wait, how do I play" pause all land before frame one. A run can therefore
 * never legitimately be faster than its frame count implies, only slower.
 */
const CLOCK_TOLERANCE = 1.1;
const CLOCK_GRACE_MS = 3_000;

export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as JumpSubmission | null;
  if (!submission || !Array.isArray(submission.inputs)) {
    return { valid: false, reason: "Nothing submitted." };
  }
  if (submission.inputs.length > MAX_INPUTS) {
    return { valid: false, reason: "That is more steering than anyone has ever done." };
  }

  // ── O(1) clock check ─────────────────────────────────────────────────────
  //
  // The client sends state.frame at game-end as `traceFrames`.  One integer
  // read replaces the O(inputs) delta-accumulation scan.
  //
  // If the client is an old build that didn't send traceFrames, fall back to
  // the O(inputs) scan so no in-flight session is rejected mid-game.
  let traceFrames: number;
  if (typeof submission.traceFrames === "number" && Number.isFinite(submission.traceFrames)) {
    traceFrames = Math.max(0, Math.floor(submission.traceFrames));
  } else {
    // Fallback: scan packed input deltas (O(inputs))
    let lastInputFrame = -1;
    for (const packed of submission.inputs) {
      if (typeof packed !== "number" || !Number.isInteger(packed) || packed < 0) break;
      lastInputFrame += Math.floor(packed / INPUT_LEVELS);
    }
    traceFrames = Math.max(0, lastInputFrame + 1);
  }

  const impliedMs = (traceFrames / FPS) * 1000;
  if (impliedMs > input.durationMs * CLOCK_TOLERANCE + CLOCK_GRACE_MS) {
    return { valid: false, reason: "That run claims more play time than actually passed." };
  }

  // ── Frame-capped replay ───────────────────────────────────────────────────
  //
  // Simulate only as far as the trace needs, plus a 1 800-frame (30 s) grace
  // period.  The grace covers:
  //   • spring / balloon combos that add height after the last steering input
  //   • moving platforms drifting into position and catching the player
  //   • the full arc of any jump still in flight when inputs end
  //
  // For real players this is always generous — maxY peaks during or well before
  // the grace window, never after.  The savings are proportional to how early
  // the player's run ended:
  //
  //   8 000 score (~2 min, ~7 200 trace frames) → ~9 000 replay frames
  //                                                 instead of 21 600  (2.4×)
  //   5 000 score (~75 s, ~4 500 trace frames)  → ~6 300 replay frames  (3.4×)
  //   ceiling run (6 min, ~21 600 trace frames)  → 21 600 replay frames (same)
  //
  // No false positives: the score is Math.floor(state.maxY), which increases
  // only while the player is still climbing.  Once maxY is set it never falls,
  // so stopping simulation after the peak costs the player nothing.
  const FRAME_GRACE = 1_800;
  const frameCap = Math.min(MAX_FRAMES, traceFrames + FRAME_GRACE);

  const seed = typeof input.seed === "string" && input.seed.length > 0 ? input.seed : LEVEL_SEED;
  const run = simulate(seed, submission.inputs, frameCap);
  if (!run) {
    return { valid: false, reason: "That run could not be verified — please try again." };
  }

  return { valid: true, score: run.score, movesCount: submission.inputs.length };
}
