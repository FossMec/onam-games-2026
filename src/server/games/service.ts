import { asc, eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { games } from "~/server/db/schema";
import type { GameMetric } from "./registry";
import { getGameDefByType } from "./registry";
import { getSettings } from "~/server/settings/service";
import { sharedRead } from "~/server/cache";
import { getConfig } from "~/server/pookalam/service";
import type { PhaseState } from "~/server/pookalam/window";

/**
 * Where a game sits in its day.
 *
 *   upcoming  nothing is known: a "???" card with a countdown
 *   preview   the reveal - title, art and rules visible, still not playable
 *   tester    testers and admins only, ahead of the public release
 *   live      open to everyone
 *   closed    past its window; still playable for fun, off the daily board
 */
export type GameStatus = "upcoming" | "preview" | "tester" | "live" | "closed";
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
  /** When the details stop being hidden. Drives the "opens in" countdown copy. */
  previewAt: string | null;
  testerReleaseAt: string | null;
  status: GameStatus;
  /** Registry copy - safe for every game at every status. */
  tagline: string;
  /** The cryptic locked-card one-liner. Ships even when the card is masked. */
  teaser: string | null;
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
  previewHours: number;
  testerMode?: boolean;
};

/**
 * One query for the whole schedule.
 *
 * These four keys are always read together, and reading them one at a time cost
 * a round trip each on every request that resolves a game's status - which is
 * the home page, the game page and the leaderboard. Adding the preview window
 * here made that four; batching makes it one.
 */
async function getScheduleSettings(): Promise<ScheduleSettings> {
  const values = await getSettings([
    "schedule.event_start_date",
    "schedule.release_time",
    "schedule.game_duration_hours",
    "schedule.preview_hours",
    "access.tester_mode",
  ]);
  const read = <T>(key: string, fallback: T): T => (values.get(key) as T) ?? fallback;
  return {
    eventStartDate: read("schedule.event_start_date", ""),
    releaseTime: read("schedule.release_time", "19:00"),
    durationHours: read("schedule.game_duration_hours", 24),
    previewHours: read("schedule.preview_hours", 24),
    testerMode: read("access.tester_mode", true),
  };
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

/**
 * When a game stops being a mystery.
 *
 * A per-game `previewAt` wins; otherwise it is `preview_hours` before the
 * release. Zero (or negative) hours means the reveal and the release are the
 * same instant, which switches the preview window off entirely.
 */
function computePreview(
  game: typeof games.$inferSelect,
  releaseAt: Date,
  settings: ScheduleSettings,
): Date {
  if (game.previewAt) return game.previewAt;
  // Settings come back from jsonb and have been seen stored as strings, so the
  // arithmetic is done on a number we coerced ourselves rather than a maybe.
  const hours = Math.max(0, Number(settings.previewHours) || 0);
  return new Date(releaseAt.getTime() - hours * HOUR_MS);
}

export async function resolveSchedule(
  game: typeof games.$inferSelect,
  viewerRole: ViewerRole,
  settings?: ScheduleSettings,
): Promise<{
  releaseAt: Date | null;
  endAt: Date | null;
  previewAt: Date | null;
  testerReleaseAt: Date | null;
  status: GameStatus;
  /** Raw `schedule.event_start_date` - lets callers reuse the settings fetch. */
  eventStartDate: string;
}> {
  const scheduleSettings = settings ?? (await getScheduleSettings());
  const releaseAt = computeRelease(game, scheduleSettings);
  if (!releaseAt) {
    return {
      releaseAt: null,
      endAt: null,
      previewAt: null,
      testerReleaseAt: null,
      status: "upcoming",
      eventStartDate: scheduleSettings.eventStartDate,
    };
  }
  const endAt =
    game.endAt ?? new Date(releaseAt.getTime() + scheduleSettings.durationHours * HOUR_MS);
  const testerEarlyHours = game.testerEarlyHours ?? 24;
  const testerReleaseAt = new Date(releaseAt.getTime() - testerEarlyHours * HOUR_MS);
  const previewAt = computePreview(game, releaseAt, scheduleSettings);

  /*
   * Order matters, and it is not the order the fields are declared in.
   *
   * `tester` sits above `live` so a privileged viewer keeps early access, and
   * `preview` sits *below* both: it is the weakest claim on the page, granting
   * sight of a game and nothing else. A tester inside their window therefore
   * still gets "tester" (playable) rather than being demoted to a preview.
   */
  const now = Date.now();
  let status: GameStatus;
  if (now >= endAt.getTime()) {
    status = "closed";
  } else if (
    scheduleSettings.testerMode !== false &&
    viewerRole !== "player" &&
    now >= testerReleaseAt.getTime()
  ) {
    status = "tester";
  } else if (now >= releaseAt.getTime()) {
    status = "live";
  } else if (now >= previewAt.getTime()) {
    status = "preview";
  } else {
    status = "upcoming";
  }
  return {
    releaseAt,
    endAt,
    previewAt,
    testerReleaseAt,
    status,
    eventStartDate: scheduleSettings.eventStartDate,
  };
}

function toCard(
  game: typeof games.$inferSelect,
  schedule: {
    releaseAt: Date | null;
    endAt: Date | null;
    previewAt: Date | null;
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
    previewAt: schedule.previewAt?.toISOString() ?? null,
    testerReleaseAt: schedule.testerReleaseAt?.toISOString() ?? null,
    status: schedule.status,
    tagline: def?.public.tagline ?? "",
    teaser: game.hint || (def?.public.teaser ?? null),
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
 * it opens, and that it is locked. The `teaser` also survives - it is written to
 * be shown exactly when the title cannot be - while the real `hint`, title,
 * tagline and rules all go.
 *
 * Only `upcoming` gets this treatment. A game in `preview` has deliberately
 * given its details up - that is the entire point of the status - and hiding
 * them again here would make the reveal do nothing.
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

/**
 * The published rows, cached per instance.
 *
 * Deliberately the *rows* and not the finished cards. A card carries a status
 * computed against the current clock, and a game going live is the one moment
 * of the day when being thirty seconds behind is unforgivable - a player
 * staring at a countdown that hit zero. The rows themselves only change when
 * an admin edits them, so caching those is free of that problem, and the
 * status is still recomputed on every single request.
 */
function publishedGameRows() {
  return sharedRead("games:rows", () =>
    getDb().select().from(games).where(eq(games.published, true)).orderBy(asc(games.day)),
  );
}

export async function getGamesList(viewerRole: ViewerRole): Promise<GameCard[]> {
  // The schedule settings do not depend on the rows, so the two go out
  // together rather than one after the other.
  const [rows, settings] = await Promise.all([publishedGameRows(), getScheduleSettings()]);
  const cards = await Promise.all(
    rows.map(async (game) => toCard(game, await resolveSchedule(game, viewerRole, settings))),
  );
  const list = cards.map((card) => (card.status === "upcoming" ? maskCard(card) : card));

  // Day 7 is not a `games` row - it is the Code-a-Pookalam voting arena - so it
  // never comes out of the query above. Appending it here means every schedule
  // consumer (landing page, games hub, game page nav, leaderboard) reads the
  // same seventh card from the API instead of each page hand-building its own
  // copy. It is never masked: its title is not a reveal to protect.
  //
  // Only when the week is real, though. An empty schedule means an outage or a
  // half-configured deploy, and a lone Day 7 would dress that up as a festival
  // week that does not exist.
  if (list.length > 0 && !list.some((card) => card.day === 7)) {
    // When voting has no window configured, fall back to "the day after the
    // last scheduled game" so the card keeps a real countdown instead of a
    // dead lock. Derived here, from the same schedule the card sits in.
    const anchor = list.filter((g) => g.releaseAt).sort((a, b) => b.day - a.day)[0];
    const day7ReleaseAt = anchor?.releaseAt
      ? new Date(new Date(anchor.releaseAt).getTime() + (7 - anchor.day) * DAY_MS).toISOString()
      : null;
    list.push(day7Card((await getConfig()).voting, day7ReleaseAt));
  }
  return list;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Day 7 arena card, derived from the pookalam voting window.
 *
 * Status mirrors what the clock says about voting, with the same fallbacks the
 * old client-side copies used: forced-open votes are "live", a finished vote is
 * "closed", and before that the card is a countdown that turns into a "preview"
 * on its last day. Without a configured window it stays "upcoming" - the card
 * must never claim it is live when the admin has not set it up.
 */
function day7Card(voting: PhaseState, derivedReleaseAt: string | null): GameCard {
  const opensAt = voting.opensAt;
  const releaseAt = opensAt?.toISOString() ?? derivedReleaseAt;
  let status: GameStatus = "upcoming";
  if (voting.open) {
    status = "live";
  } else if (voting.reason === "over") {
    status = "closed";
  } else if (releaseAt && new Date(releaseAt).getTime() - Date.now() <= DAY_MS) {
    status = "preview";
  }
  return {
    id: "day-7-vote",
    slug: "code-a-pookalam-vote",
    day: 7,
    title: "Code-a-Pookalam ELO Voting",
    tagline: "1v1 Elo voting showdown. Community settles the podium.",
    hint: "Vote on community coded pookalams in 1v1 faceoffs.",
    teaser: "Vote on community coded pookalams in 1v1 faceoffs.",
    howTo: [],
    gameType: "vote",
    difficulty: "community",
    metric: "fcfs",
    maxAttempts: 1,
    releaseAt,
    endAt: voting.closesAt?.toISOString() ?? null,
    previewAt: null,
    testerReleaseAt: null,
    status,
    assets: null,
  };
}

export async function getGameBySlug(
  slug: string,
  viewerRole: ViewerRole,
): Promise<GameCard | null> {
  // Same as the list: the row and the schedule settings are independent reads.
  // The row comes out of the same cached set the list uses, so a game page and
  // the schedule behind it cost one query between them rather than two.
  const [rows, settings] = await Promise.all([publishedGameRows(), getScheduleSettings()]);
  const game = rows.find((row) => row.slug === slug);
  if (!game) return null;
  const card = toCard(game, await resolveSchedule(game, viewerRole, settings));
  /*
   * Masked here too, but the slug is left intact: the caller already typed it,
   * so blanking it would only break the page they are looking at. Everything
   * that actually describes the game is still withheld.
   */
  return card.status === "upcoming" ? { ...maskCard(card), slug: card.slug } : card;
}
