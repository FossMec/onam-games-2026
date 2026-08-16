import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import type { PublicUser } from "./service";

/**
 * Ban levels. Deliberately graduated rather than a single boolean, because at
 * a college event most "suspicious" signals are false positives - a whole
 * hostel shares one NAT IP, and siblings share laptops. A warning that costs
 * an honest player nothing is worth far more than a ban that costs them the week.
 */
export const BAN_LEVELS = {
  NONE: 0,
  WARNING: 1,
  SOFT_3H: 2,
  SOFT_24H: 3,
  HARD: 4,
} as const;

export type BanLevel = (typeof BAN_LEVELS)[keyof typeof BAN_LEVELS];

/** How long each level benches a player. Null = not time-based. */
const BAN_DURATION_MS: Record<number, number | null> = {
  0: null,
  1: null,
  2: 3 * 60 * 60 * 1000,
  3: 24 * 60 * 60 * 1000,
  4: null,
};

export interface BanState {
  level: number;
  reason: string | null;
  /** Level 2/3 only. */
  until: Date | null;
  /** Level 1 only: warning still needs dismissing. */
  needsAck: boolean;
  /** True when the player may not start or finish a game right now. */
  blocksPlay: boolean;
}

export function describeBan(user: {
  banLevel: number;
  banUntil: Date | string | null;
  banReason: string | null;
  banAckedAt: Date | string | null;
}): BanState {
  const until = user.banUntil ? new Date(user.banUntil) : null;
  const expired = until !== null && until.getTime() <= Date.now();

  // A soft ban whose clock has run out is over; treat it as clear.
  const level = (user.banLevel === 2 || user.banLevel === 3) && expired ? 0 : user.banLevel;

  return {
    level,
    reason: user.banReason,
    until: level === 2 || level === 3 ? until : null,
    needsAck: level === 1 && !user.banAckedAt,
    blocksPlay: level >= 2,
  };
}

/** Player-facing copy. Honest about what happened, without a lecture. */
export function banMessage(state: BanState): string {
  switch (state.level) {
    case 1:
      return "We saw something odd on your account. Consider this your one warning - do it again and you sit out.";
    case 2:
    case 3: {
      const when = state.until
        ? state.until.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            timeStyle: "short",
            dateStyle: "medium",
          })
        : "later";
      return `You're benched until ${when} IST. The leaderboard is still yours to watch.`;
    }
    case 4:
      return "Your account is out of the games. Contact the organisers if you think this is wrong.";
    default:
      return "";
  }
}

/**
 * Gate for *playing* only - never for browsing.
 *
 * Levels 2 and 3 deliberately leave the leaderboard, the schedule and every
 * other page reachable. A benched player who can still watch the board has a
 * reason to come back when the timer runs out; one who gets a wall does not.
 */
export function assertCanPlay(user: PublicUser): void {
  const state = describeBan(user);
  if (state.blocksPlay) {
    throw new HttpError(403, banMessage(state));
  }
}

/** Dismisses a level-1 warning. Re-armed by clearing `banAckedAt` on a new incident. */
export async function acknowledgeWarning(userId: string): Promise<void> {
  await getDb().update(users).set({ banAckedAt: new Date() }).where(eq(users.id, userId));
}

/**
 * Applies a ban level. Level 4 is intentionally not reachable from automated
 * anti-cheat - escalation can propose it, but a human confirms it.
 */
export async function setBanLevel(
  userId: string,
  level: BanLevel,
  reason: string | null,
): Promise<void> {
  const duration = BAN_DURATION_MS[level];
  await getDb()
    .update(users)
    .set({
      banLevel: level,
      banReason: level === 0 ? null : reason,
      banUntil: duration ? new Date(Date.now() + duration) : null,
      // Clearing the ack re-arms the warning modal for a repeat offender.
      banAckedAt: null,
    })
    .where(eq(users.id, userId));
}
