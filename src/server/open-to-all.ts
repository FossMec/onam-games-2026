import { getServerEnv } from "~/server/env";

/**
 * "Open to all" mode.
 *
 * The festival normally runs on a clock: one game a day, a closed beta while
 * testers poke at it, and a Google sign-in so a result can be tied to a real
 * person. That is the right shape for a scheduled event and the wrong shape for
 * a public demo or an open-source deployment where anybody should be able to
 * wander in and play.
 *
 * When `OPEN_TO_ALL` is on, three things change:
 *
 *   access   the closed-beta door is lifted; the shell is public
 *   schedule every published game reads as `live`, with no end time, so
 *            `startAttempt` will open it and `finishAttempt` will not file the
 *            run as "after deadline" and quietly drop it from the board
 *   sign-in  name-only accounts (`createGuestAccount`) replace Google OAuth
 *
 * It is deliberately an environment variable rather than an app setting: this
 * is a deployment-level decision about what kind of site this is, and it wants
 * to be visible in the same place as the database URL, not buried in /admin.
 *
 * The flag is read on the server only. The client learns the mode from
 * `getAuthMode` / the shell, so a stale `VITE_` copy can never disagree with the
 * code that actually enforces it.
 */
export function isOpenToAll(): boolean {
  const raw = getServerEnv("OPEN_TO_ALL");
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}
