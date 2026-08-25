import { FPS, MAX_FRAMES, MAX_INPUTS, simulate } from "~/lib/jump-sim";
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

  // Replay on the attempt's own seed — deterministic per-attempt level via sha256,
  // no Math.random. Legacy attempts fall back to the canonical seed.
  const seed = typeof input.seed === "string" && input.seed.length > 0 ? input.seed : LEVEL_SEED;
  const run = simulate(seed, submission.inputs);
  if (!run) {
    return { valid: false, reason: "That run could not be verified — please try again." };
  }

  const impliedMs = (run.frames / FPS) * 1000;
  if (impliedMs > input.durationMs * CLOCK_TOLERANCE + CLOCK_GRACE_MS) {
    // Either a fast-forwarded bot or a tampered clock. Both are the same answer.
    return { valid: false, reason: "That run claims more play time than actually passed." };
  }

  return { valid: true, score: run.score, movesCount: submission.inputs.length };
}
