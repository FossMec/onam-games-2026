import { randomBytes } from "node:crypto";

export interface StartPayload {
  seed: string;
  initialState: unknown;
}

/**
 * Game engine placeholder. The real per-game generation/verification logic is
 * implemented once each game is finalised. `startGame` must be deterministic
 * given a seed so a resumed attempt reproduces the same initial state.
 */
export function startGame(gameType: string, difficulty: string, seed?: string): StartPayload {
  const resolvedSeed = seed ?? randomBytes(16).toString("hex");
  return {
    seed: resolvedSeed,
    initialState: {
      placeholder: true,
      gameType,
      difficulty,
      seed: resolvedSeed,
    },
  };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies a submitted final state against the seeded game instance.
 * Placeholder: structurally sane submissions are accepted for now; real
 * per-game verification is wired in once the games are finalised.
 */
export async function validateSubmission(
  _gameType: string,
  _seed: string,
  submittedState: unknown,
): Promise<ValidationResult> {
  if (!submittedState || typeof submittedState !== "object") {
    return { valid: false, reason: "Missing submitted state" };
  }
  return { valid: true };
}
