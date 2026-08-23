import { getDb } from "~/server/db/client";

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

  await db`
    UPDATE users
    SET
      streak_count = CASE
        WHEN last_streak_day = ${current} THEN streak_count
        WHEN last_streak_day = ${prev} THEN streak_count + 1
        ELSE 1
      END,
      best_streak = GREATEST(
        best_streak,
        CASE
          WHEN last_streak_day = ${current} THEN streak_count
          WHEN last_streak_day = ${prev} THEN streak_count + 1
          ELSE 1
        END
      ),
      last_streak_day = ${current},
      updated_at = NOW()
    WHERE id = ${userId}
  `;
}
