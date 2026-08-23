import { getDb } from "~/server/db/client";
import type { HuntQuestion } from "~/server/db/schema";
import * as jigsaw from "./impl/jigsaw";
import * as jump from "./impl/jump";
import * as tinder from "./impl/tinder";
import * as vallam from "./impl/vallam";
import * as wend from "./impl/wend";

/**
 * Fallback jigsaw artwork. Overridden per-game by `games.assets_json.imageUrl`,
 * so dropping in the real pookalam is a DB edit, not a deploy. Regenerate the
 * placeholder with `node scripts/make-pookalam.mjs`.
 */
const DEFAULT_POOKALAM = "/images/games/pookalam.webp";

/**
 * The game registry - one place that owns how every game *behaves*.
 *
 * Split of responsibilities, on purpose:
 *   - this file  : behaviour, limits, secrets, generation, verification.
 *   - `games` row: schedule and operational state (release, status, published)
 *                  so an admin can retime or pull a game without a deploy.
 *
 * Two rules everything else depends on:
 *
 *  1. `generate` is a pure function of (seed, difficulty). A resumed attempt
 *     regenerates its own instance, and verification regenerates the solution,
 *     so no puzzle state is ever persisted or trusted from the client.
 *  2. `generate` returns `view` and `solution` separately. Only `view` is ever
 *     serialised into a response. The solution never leaves the server, which
 *     is what actually keeps an unreleased game secret - not hiding the JS.
 */

/** How a game's field is ordered. Decides ranking direction and UI labels. */
export type GameMetric =
  /** Fastest valid completion wins. One shot. */
  | "time"
  /** Highest server-verified score wins. Retries allowed. */
  | "score"
  /** First correct submission wins; ranked by wall-clock submit time. */
  | "fcfs";

export interface GeneratedInstance {
  /** Safe to send to the browser. Must never contain the answer. */
  view: unknown;
  /** Server-only. Regenerated at verify time; never serialised. */
  solution: unknown;
}

export interface VerifyInput {
  seed: string;
  difficulty: string;
  /** Whatever the client posted. Untrusted. */
  submission: unknown;
  /** Server-measured elapsed time. The client does not get a vote on this. */
  durationMs: number;
  userId?: string;
  startedAt?: Date;
}

export interface VerifyResult {
  valid: boolean;
  /** Shown to the player when invalid. Keep it in voice, keep it useless to a cheater. */
  reason?: string;
  /**
   * Server-derived score for `metric: "score"` games. Any score the client
   * claimed is discarded - this value is the only one that reaches the DB.
   */
  score?: number;
  /** Server-counted moves, for anomaly detection. */
  movesCount?: number;
  /**
   * Time added to the measured duration as an in-game penalty - Tinder charges
   * three seconds per wrong swipe. Derived here from the replayed submission,
   * never accepted from the client, and added on top of the server-measured
   * clock so the stored duration is the one the leaderboard ranks.
   */
  durationPenaltyMs?: number;
}

/**
 * Admin-editable assets from `games.assets_json`. Public by definition - these
 * reach the browser - so puzzle secrets never belong here.
 *
 * This is the seam that makes artwork swappable without a deploy: the jigsaw
 * paints whatever `imageUrl` points at into its clip paths.
 */
export interface GameAssets {
  imageUrl?: string;
}

export interface GamePublicCopy {
  title: string;
  tagline: string;
  hint: string;
  /**
   * The cryptic one-liner a locked card shows instead of the title. Deliberately
   * vaguer than `hint` - it must tease without leaking what the game is.
   */
  teaser: string;
  howTo: string[];
}

export interface GameDef {
  slug: string;
  day: number;
  /** Matches `games.game_type`; the join between DB row and this registry. */
  gameType: string;
  metric: GameMetric;
  /** Attempts a player gets per day. 1 for every one-shot game. */
  maxAttempts: number;
  /**
   * Below this, a valid completion is flagged as anomalous. Per-game because
   * "impossibly fast" for a 64-piece jigsaw is nothing like it is for Tinder.
   */
  minPlausibleMs: number;
  /** An attempt open longer than this is void - stops all-day tab parking. */
  maxDurationMs: number;
  /** Hard cap on the posted body, enforced before parsing. Bounds replay cost. */
  maxSubmissionBytes: number;
  public: GamePublicCopy;
  generate(seed: string, difficulty: string, assets?: GameAssets): GeneratedInstance;
  verify(input: VerifyInput): VerifyResult | Promise<VerifyResult>;
}

/** Higher-is-better games rank descending; everything else ranks ascending. */
export function higherIsBetter(metric: GameMetric): boolean {
  return metric === "score";
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const GAMES: readonly GameDef[] = [
  /* ---------------------------------------------------------------- day 1 */
  {
    slug: "open-source-tinder",
    day: 1,
    gameType: "tinder",
    metric: "time",
    maxAttempts: 1,
    minPlausibleMs: 1_500,
    maxDurationMs: 24 * HOUR,
    maxSubmissionBytes: 32_000,
    public: {
      title: "Open Source Tinder",
      tagline: "Swipe right on freedom. Swipe left on the EULA.",
      hint: "Some of these logos are lying to you.",
      teaser: "An interface you'll find most useful in your life.",
      howTo: [
        "Swipe right if it's open source. Swipe left if it's proprietary. Arrow keys work too.",
        "Open source means you can read the code, change it, and share it. Not just that it's free to download - plenty of things cost nothing and still own you.",
        "Guess wrong and it costs you 3 seconds. You'll spend them reading what the thing actually is, so at least you get something for your money.",
        "Wrong cards come back at the end of the deck. Again. And again.",
        "Some of these are traps. Chrome is not Chromium. You have been warned.",
        "Deck's done when every card is sorted right. Fastest time wins.",
      ],
    },
    generate: (seed) => tinder.generate(seed),
    verify: (input) => tinder.verify(input),
  },

  /* ---------------------------------------------------------------- day 2 */
  {
    slug: "pookalam-jigsaw",
    day: 2,
    gameType: "jigsaw",
    metric: "time",
    maxAttempts: 1,
    minPlausibleMs: 3_000,
    maxDurationMs: 24 * HOUR,
    maxSubmissionBytes: 64_000,
    public: {
      title: "Pookalam Jigsaw",
      tagline: "Radial symmetry was a mistake and you are about to find out why.",
      hint: "Every piece looks like every other piece. That is the joke.",
      teaser: "Radial symmetry was a mistake and you're about to find out why.",
      howTo: [
        "Every piece is loose on one board. Drag them around.",
        "There are no slots. Pieces join to each other - get two neighbours close enough and they snap together.",
        "Once joined they move as one lump, so drag the lump.",
        "You're done when everything is a single lump. It can sit anywhere on the board.",
        "The pookalam is rotationally symmetric, so every piece looks like every other piece. That is the joke, and it is on you.",
      ],
    },
    generate: (seed, difficulty, assets) =>
      jigsaw.generate(seed, difficulty, assets?.imageUrl ?? DEFAULT_POOKALAM),
    verify: (input) => jigsaw.verify(input),
  },

  /* ---------------------------------------------------------------- day 3 */
  {
    slug: "wend",
    day: 3,
    gameType: "wend",
    metric: "time",
    maxAttempts: 1,
    minPlausibleMs: 3_000,
    maxDurationMs: 24 * HOUR,
    maxSubmissionBytes: 16_000,
    public: {
      title: "Wend",
      tagline: "Six words, one grid, and absolutely no room to spare.",
      hint: "If a word leaves a tile stranded, it's the wrong word.",
      teaser: "A word puzzle entangled in banana leaves.",
      howTo: [
        "Drag across the letters to trace a word. Paths bend - up, down, left, right, never diagonally.",
        "You don't get the words. You get how many there are and how long each one is.",
        "Every tile belongs to exactly one word. Nothing may be left over.",
        "Fastest correct board wins.",
      ],
    },
    generate: (seed) => wend.generate(seed),
    verify: (input) => wend.verify(input),
  },

  /* ---------------------------------------------------------------- day 4 */
  {
    slug: "escape-the-vallam",
    day: 4,
    gameType: "unblock",
    metric: "time",
    maxAttempts: 1,
    minPlausibleMs: 2_000,
    maxDurationMs: 24 * HOUR,
    maxSubmissionBytes: 32_000,
    public: {
      title: "Escape the Vallam",
      tagline: "Chundan vallam. Traffic jam. Vallamkali has never been this bureaucratic.",
      hint: "The snake boat only moves the long way. Everything else is in the way.",
      teaser: "Unblock the snake boat before the floodwaters rise.",
      howTo: [
        "Slide boats along their own axis to clear a path.",
        "Get your vallam out of the right edge.",
        "Fastest escape wins. Move count is recorded but does not rank you.",
      ],
    },
    generate: (seed, difficulty) => vallam.generate(seed, difficulty),
    verify: (input) => vallam.verify(input),
  },

  /* ---------------------------------------------------------------- day 5 */
  {
    slug: "maveli-jump",
    day: 5,
    gameType: "jump",
    metric: "score",
    /**
     * Unlimited runs allowed for all players. Best score counts.
     */
    maxAttempts: 999_999,
    minPlausibleMs: 1_000,
    maxDurationMs: 24 * HOUR,
    /** ~40k frames of delta-encoded input, with headroom. */
    maxSubmissionBytes: 128_000,
    public: {
      title: "Maveli Jump",
      tagline: "One year of freedom. Infinite platforms. Zero dignity.",
      hint: "Paathalam is below. Kerala is above. Start climbing.",
      teaser: "Help the king hop the platforms back to earth.",
      howTo: [
        "Hold the left or right half of the board or tilt your phone to steer. Maveli jumps on his own.",
        "Mint platforms are safe, orange platforms launch high, blue ones move, yellow ones break.",
        "Height above Paathalam is your score.",
        "Unlimited tries! Climb as many times as you like, your best height is what counts.",
      ],
    },
    /**
     * The only `score` game, and the reason the whole leaderboard is ranked on
     * percentile points rather than raw numbers: "4,300 metres" and "12.4
     * seconds" are not comparable, but "beat 87% of the field" is.
     *
     * The client submits an input trace, never a score. The server re-runs the
     * simulation to derive the height, and cross-checks the trace's implied
     * duration against the server clock. See `impl/jump.ts`.
     */
    generate: () => jump.generate(),
    verify: (input) => jump.verify(input),
  },

  /* ---------------------------------------------------------------- day 6 */
  {
    slug: "treasure-hunt",
    day: 6,
    gameType: "hunt",
    metric: "score",
    maxAttempts: 1,
    /** Realistically at least 20s to solve and submit across 10 clues */
    minPlausibleMs: 20_000,
    maxDurationMs: 24 * 60 * MINUTE,
    maxSubmissionBytes: 4_000,
    public: {
      title: "The Treasure Hunt",
      tagline: "Unearth legendary Linux relics hidden across the realm.",
      hint: "Clues are hidden throughout the website and festival.",
      teaser: "A grand quest for the lost Linux distribution relics.",
      howTo: [
        "It's a treasure hunt with 10 hidden clues to solve, one after the other.",
        "Some clues and answers are hidden right here on the website — others are somewhere else on the internet. Look everywhere!",
        "Each clue asks for either a 6-letter code or a short answer. Stuck? Ask for more hints in the comments on our Instagram.",
        "Get it right and you earn a treasure — a legendary Linux distro logo — and the next clue unlocks.",
        "You can try again every 30 seconds if you get it wrong.",
        "Unlike other games, the clock for this game starts the moment the game day begins.",
      ],
    },
    generate: () => ({
      view: { kind: "hunt", prompt: "Enter the token from the final stage." },
      solution: null,
    }),
    verify: async ({ submission, userId, startedAt }) => {
      const claimed =
        submission && typeof submission === "object"
          ? (submission as { token?: unknown }).token
          : undefined;
      if (typeof claimed !== "string") {
        return { valid: false, reason: "No token submitted." };
      }

      if (!userId) {
        return { valid: false, reason: "Unauthorized attempt." };
      }

      const db = getDb();
      const progressRows = await db<
        {
          completed_at: Date | null;
          solved_question_ids: string[];
        }[]
      >`
        SELECT completed_at, solved_question_ids
        FROM user_hunt_progress
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      const progress = progressRows[0];

      const allActive = await db<HuntQuestion[]>`
        SELECT id FROM hunt_questions WHERE active = true
      `;

      if (
        !progress ||
        !progress.completed_at ||
        (progress.solved_question_ids?.length ?? 0) < allActive.length
      ) {
        return { valid: false, reason: "You have not discovered all 10 treasure hunt relics yet." };
      }

      // Verify that completedAt was achieved during this attempt (or within 15s grace of startedAt)
      if (startedAt && new Date(progress.completed_at).getTime() < startedAt.getTime() - 15_000) {
        return {
          valid: false,
          reason:
            "Invalid run: The hunt was solved before this attempt started. Please start a fresh run.",
        };
      }

      return { valid: true };
    },
  },
];

const BY_TYPE = new Map(GAMES.map((g) => [g.gameType, g]));
const BY_SLUG = new Map(GAMES.map((g) => [g.slug, g]));

export function getGameDefByType(gameType: string): GameDef | null {
  return BY_TYPE.get(gameType) ?? null;
}

export function getGameDefBySlug(slug: string): GameDef | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Registry entry for a DB row, or throws. Every attempt path goes through this,
 * so a `games` row whose `game_type` has no implementation is unplayable rather
 * than silently free points.
 */
export function requireGameDef(gameType: string): GameDef {
  const def = BY_TYPE.get(gameType);
  if (!def) throw new Error(`No registry entry for game type "${gameType}"`);
  return def;
}
