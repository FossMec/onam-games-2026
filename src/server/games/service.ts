import { and, asc, eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { games } from "~/server/db/schema";
import type { GameMetric } from "./registry";
import { getGameDefByType } from "./registry";
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
  /** Registry copy — safe for every game at every status. */
  tagline: string;
  howTo: string[];
  metric: GameMetric;
  maxAttempts: number;
  /** Public asset references only. Never puzzle data. */
  assets: unknown;
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
type ScheduleSettings = {
  eventStartDate: string;
  releaseTime: string;
  durationHours: number;
};

async function getScheduleSettings(): Promise<ScheduleSettings> {
  const [eventStartDate, releaseTime, durationHours] = await Promise.all([
    getSetting<string>("schedule.event_start_date", ""),
    getSetting<string>("schedule.release_time", "19:00"),
    getSetting<number>("schedule.game_duration_hours", 24),
  ]);
  return { eventStartDate, releaseTime, durationHours };
}

function computeRelease(game: typeof games.$inferSelect, settings: ScheduleSettings): Date | null {
  if (game.releaseAt) return game.releaseAt;
  const start = parseDateSetting(settings.eventStartDate);
  const timeMs = parseTimeSetting(settings.releaseTime);
  if (!start || timeMs === null) return null;
  const dayOffset = (game.day - 1) * 24 * HOUR_MS;
  const midnightIstUtc = start.getTime() - IST_OFFSET_MS + dayOffset;
  return new Date(midnightIstUtc + timeMs);
}

export async function resolveSchedule(
  game: typeof games.$inferSelect,
  viewerRole: ViewerRole,
  settings?: ScheduleSettings,
): Promise<{
  releaseAt: Date | null;
  endAt: Date | null;
  testerReleaseAt: Date | null;
  status: GameStatus;
}> {
  const scheduleSettings = settings ?? (await getScheduleSettings());
  const releaseAt = computeRelease(game, scheduleSettings);
  if (!releaseAt) {
    return { releaseAt: null, endAt: null, testerReleaseAt: null, status: "upcoming" };
  }
  const endAt =
    game.endAt ?? new Date(releaseAt.getTime() + scheduleSettings.durationHours * HOUR_MS);
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
  const def = getGameDefByType(game.gameType);
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
    // Only registry *copy* ships here. The previous version returned
    // `configJson` wholesale for every published game — including unreleased
    // ones — which handed tomorrow's setup to anyone who called the action.
    // Puzzle data now reaches the browser solely through `/start`, which
    // refuses to run until the game is live.
    tagline: def?.public.tagline ?? "",
    howTo: def?.public.howTo ?? [],
    metric: def?.metric ?? "time",
    maxAttempts: def?.maxAttempts ?? 1,
    assets: game.assetsJson,
  };
}

/**
 * Strips everything about a game that has not been released yet.
 *
 * Done here rather than in the UI on purpose: `getGames` is a server function
 * any signed-in browser can call directly, so hiding tomorrow's title behind a
 * `<Show>` would hide it from nobody. The reveal is most of the fun of a daily
 * event and it only works if the data genuinely is not sent.
 *
 * What survives is what a locked card legitimately needs: which day it is, when
 * it opens, and that it is locked.
 */
function maskCard(card: GameCard): GameCard {
  return {
    ...card,
    // The slug names the game as plainly as the title does.
    slug: "",
    title: "???",
    hint: null,
    tagline: "",
    howTo: [],
    gameType: "",
    difficulty: "",
    assets: null,
  };
}

export async function getGamesList(viewerRole: ViewerRole): Promise<GameCard[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(games)
    .where(eq(games.published, true))
    .orderBy(asc(games.day));
  const settings = await getScheduleSettings();
  const cards = await Promise.all(
    rows.map(async (game) => toCard(game, await resolveSchedule(game, viewerRole, settings))),
  );
  return cards.map((card) => (card.status === "upcoming" ? maskCard(card) : card));
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
  const card = toCard(game, await resolveSchedule(game, viewerRole));
  /*
   * Masked here too, but the slug is left intact: the caller already typed it,
   * so blanking it would only break the page they are looking at. Everything
   * that actually describes the game is still withheld.
   */
  return card.status === "upcoming" ? { ...maskCard(card), slug: card.slug } : card;
}
