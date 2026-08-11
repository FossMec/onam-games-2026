import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { getSetting } from "~/server/settings/service";

const DAY_MS = 86400000;

async function eventDayDate(day: number): Promise<string | null> {
  const startDate = await getSetting<string>("schedule.event_start_date", "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate.trim());
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + (day - 1)),
  );
  return date.toISOString().slice(0, 10);
}

function isNextDay(previous: string | null, current: string): boolean {
  if (!previous) return false;
  const prev = new Date(`${previous}T00:00:00Z`).getTime();
  const curr = new Date(`${current}T00:00:00Z`).getTime();
  return curr - prev === DAY_MS;
}

/**
 * Called on a valid, on-time completion. A streak increments only when the
 * player completes the event's consecutive days; a missed day resets it to 1.
 */
export async function updateStreak(userId: string, day: number): Promise<void> {
  const current = await eventDayDate(day);
  if (!current) return;
  const db = getDb();
  const [user] = await db
    .select({
      streakCount: users.streakCount,
      bestStreak: users.bestStreak,
      lastStreakDay: users.lastStreakDay,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  let streak = 1;
  if (user.lastStreakDay === current) {
    streak = user.streakCount;
  } else if (isNextDay(user.lastStreakDay, current)) {
    streak = user.streakCount + 1;
  }

  await db
    .update(users)
    .set({
      streakCount: streak,
      bestStreak: Math.max(user.bestStreak, streak),
      lastStreakDay: current,
    })
    .where(eq(users.id, userId));
}
