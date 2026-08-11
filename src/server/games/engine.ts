import { randomBytes } from "node:crypto";

export interface StartPayload {
  seed: string;
  initialState: unknown;
}

/**
 * Game engine. `startGame` must be deterministic given a seed so a resumed
 * attempt reproduces the same initial state. Real per-game generation and
 * verification logic is implemented here per game type as games are finalised.
 *
 * `braindead` is a temporary testing game: no logic, no skill — press start,
 * press the button, done. Time based like every other game. We'll delete it.
 */
export function startGame(gameType: string, difficulty: string, seed?: string): StartPayload {
  const resolvedSeed = seed ?? randomBytes(16).toString("hex");

  if (gameType === "braindead") {
    return {
      seed: resolvedSeed,
      initialState: {
        kind: "braindead",
        mission: "Press the button. That's it. That's the whole game.",
        buttonLabel: "THE BUTTON",
        seed: resolvedSeed,
      },
    };
  }

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
  gameType: string,
  _seed: string,
  submittedState: unknown,
): Promise<ValidationResult> {
  if (gameType === "braindead") {
    if (
      submittedState &&
      typeof submittedState === "object" &&
      (submittedState as { pressed?: boolean }).pressed === true
    ) {
      return { valid: true };
    }
    return { valid: false, reason: "You didn't press the button. Impressive." };
  }

  if (!submittedState || typeof submittedState !== "object") {
    return { valid: false, reason: "Missing submitted state" };
  }
  return { valid: true };
}
