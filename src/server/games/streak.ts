import { eq, sql } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { users } from "~/server/db/schema";

const DAY_MS = 86400000;

/** The calendar date (UTC, YYYY-MM-DD) of an event day, given the event start date. */
function dayDate(day: number, eventStartDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventStartDate.trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + (day - 1)))
    .toISOString()
    .slice(0, 10);
}

/**
 * Called on a valid, on-time completion. A streak increments only when the
 * player completes the event's consecutive days; a missed day resets it to 1.
 *
 * `eventStartDate` comes from the schedule settings the caller already loaded
 * (see `resolveSchedule`), so this costs exactly one write - the new streak is
 * derived in SQL from the row's own previous values.
 */
export async function updateStreak(
  userId: string,
  day: number,
  eventStartDate: string,
): Promise<void> {
  const current = dayDate(day, eventStartDate);
  if (!current) return;
  const db = getDb();
  const prev = new Date(new Date(`${current}T00:00:00Z`).getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);

  const newStreak = sql`case
    when ${users.lastStreakDay} = ${current} then ${users.streakCount}
    when ${users.lastStreakDay} = ${prev} then ${users.streakCount} + 1
    else 1
  end`;

  await db
    .update(users)
    .set({
      streakCount: newStreak,
      bestStreak: sql`greatest(${users.bestStreak}, ${newStreak})`,
      lastStreakDay: current,
    })
    .where(eq(users.id, userId));
}
