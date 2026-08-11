import { and, asc, eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { games } from "~/server/db/schema";
import { getSetting } from "~/server/settings/service";

export type GameStatus = "upcoming" | "tester" | "live" | "closed";
export type ViewerRole = "player" | "tester" | "admin";

export interface GameCard {
  id: string;
  slug: string;
  day: number;
  title: string;
  hint: string | null;
  gameType: string;
  difficulty: string;
  releaseAt: string | null;
  endAt: string | null;
  testerReleaseAt: string | null;
  status: GameStatus;
  config: unknown;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function parseTimeSetting(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * HOUR_MS + Number(match[2]) * 60 * 1000;
}

function parseDateSetting(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * Given a Day-N game, compute its release instant in UTC using the global
 * schedule settings (event start date + daily release time, both IST). A
 * per-game explicit releaseAt overrides the computed value.
 */
async function computeRelease(game: typeof games.$inferSelect): Promise<Date | null> {
  if (game.releaseAt) return game.releaseAt;
  const [startDate, timeOfDay] = await Promise.all([
    getSetting<string>("schedule.event_start_date", ""),
    getSetting<string>("schedule.release_time", "19:00"),
  ]);
  const start = parseDateSetting(startDate);
  const timeMs = parseTimeSetting(timeOfDay);
  if (!start || timeMs === null) return null;
  const dayOffset = (game.day - 1) * 24 * HOUR_MS;
  const midnightIstUtc = start.getTime() - IST_OFFSET_MS + dayOffset;
  return new Date(midnightIstUtc + timeMs);
}

export async function resolveSchedule(
  game: typeof games.$inferSelect,
  viewerRole: ViewerRole,
): Promise<{
  releaseAt: Date | null;
  endAt: Date | null;
  testerReleaseAt: Date | null;
  status: GameStatus;
}> {
  const releaseAt = await computeRelease(game);
  if (!releaseAt) {
    return { releaseAt: null, endAt: null, testerReleaseAt: null, status: "upcoming" };
  }
  const durationHours = await getSetting<number>("schedule.game_duration_hours", 24);
  const endAt = game.endAt ?? new Date(releaseAt.getTime() + durationHours * HOUR_MS);
  const testerEarlyHours = game.testerEarlyHours ?? 24;
  const testerReleaseAt = new Date(releaseAt.getTime() - testerEarlyHours * HOUR_MS);

  const now = Date.now();
  let status: GameStatus;
  if (now >= endAt.getTime()) {
    status = "closed";
  } else if (viewerRole !== "player" && now >= testerReleaseAt.getTime()) {
    status = "tester";
  } else if (now >= releaseAt.getTime()) {
    status = "live";
  } else {
    status = "upcoming";
  }
  return { releaseAt, endAt, testerReleaseAt, status };
}

function toCard(
  game: typeof games.$inferSelect,
  schedule: {
    releaseAt: Date | null;
    endAt: Date | null;
    testerReleaseAt: Date | null;
    status: GameStatus;
  },
): GameCard {
  return {
    id: game.id,
    slug: game.slug,
    day: game.day,
    title: game.title,
    hint: game.hint,
    gameType: game.gameType,
    difficulty: game.difficulty,
    releaseAt: schedule.releaseAt?.toISOString() ?? null,
    endAt: schedule.endAt?.toISOString() ?? null,
    testerReleaseAt: schedule.testerReleaseAt?.toISOString() ?? null,
    status: schedule.status,
    config: game.configJson,
  };
}

export async function getGamesList(viewerRole: ViewerRole): Promise<GameCard[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(games)
    .where(eq(games.published, true))
    .orderBy(asc(games.day));
  return Promise.all(
    rows.map(async (game) => toCard(game, await resolveSchedule(game, viewerRole))),
  );
}

export async function getGameBySlug(
  slug: string,
  viewerRole: ViewerRole,
): Promise<GameCard | null> {
  const db = getDb();
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.slug, slug), eq(games.published, true)))
    .limit(1);
  if (!game) return null;
  return toCard(game, await resolveSchedule(game, viewerRole));
}
