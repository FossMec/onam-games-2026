import { getSetting } from "~/server/settings/service";
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
const DEFAULT_POOKALAM = "/pookalam-placeholder.svg";

/**
 * Tokens get typed off a phone screen, read off paper, and pasted out of URLs.
 * Normalising away case, spacing and punctuation means a correct answer is not
 * rejected over a stray hyphen — without widening what actually counts.
 */
function normalizeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * The game registry — one place that owns how every game *behaves*.
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
 *     is what actually keeps an unreleased game secret — not hiding the JS.
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
}

export interface VerifyResult {
  valid: boolean;
  /** Shown to the player when invalid. Keep it in voice, keep it useless to a cheater. */
  reason?: string;
  /**
   * Server-derived score for `metric: "score"` games. Any score the client
   * claimed is discarded — this value is the only one that reaches the DB.
   */
  score?: number;
  /** Server-counted moves, for anomaly detection. */
  movesCount?: number;
}

/**
 * Admin-editable assets from `games.assets_json`. Public by definition — these
 * reach the browser — so puzzle secrets never belong here.
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
  /** An attempt open longer than this is void — stops all-day tab parking. */
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

export const GAMES: readonly GameDef[] = [
  /* ---------------------------------------------------------------- day 1 */
  {
    slug: "open-source-tinder",
    day: 1,
    gameType: "tinder",
    metric: "time",
    maxAttempts: 1,
    // A 30-card deck at even a frantic 250ms/swipe is ~7.5s.
    minPlausibleMs: 6_000,
    maxDurationMs: 20 * MINUTE,
    maxSubmissionBytes: 32_000,
    public: {
      title: "Open Source Tinder",
      tagline: "Swipe right on freedom. Swipe left on the EULA.",
      hint: "Some of these logos are lying to you.",
      howTo: [
        "Swipe right if the project is open source.",
        "Swipe left if it is proprietary.",
        "Get one wrong and it comes back at the end of the deck. Repeatedly.",
        "The deck ends when every card is sorted correctly. Fastest wins.",
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
    minPlausibleMs: 20_000,
    maxDurationMs: 45 * MINUTE,
    maxSubmissionBytes: 64_000,
    public: {
      title: "Pookalam Jigsaw",
      tagline: "Radial symmetry was a mistake and you are about to find out why.",
      hint: "Every piece looks like every other piece. That is the joke.",
      howTo: [
        "Drag the pieces onto the board.",
        "Edges snap when they are close enough and actually correct.",
        "The pookalam is rotationally symmetric. Good luck with that.",
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
    minPlausibleMs: 15_000,
    maxDurationMs: 30 * MINUTE,
    maxSubmissionBytes: 16_000,
    public: {
      title: "Wend",
      tagline: "Six words, one grid, and absolutely no room to spare.",
      hint: "If a word leaves a tile stranded, it's the wrong word.",
      howTo: [
        "Tap a tile, then tap next to it to trace a word. Paths bend — up, down, left, right, never diagonally.",
        "Six words are hiding: one of every length from three to eight letters.",
        "Every tile belongs to exactly one word. Nothing may be left over.",
        "Fastest correct board wins.",
      ],
    },
    /**
     * Variant policy: ONE canonical board for the whole event, presented under
     * a seed-chosen isomorphism. Distinct boards were rejected deliberately —
     * different boards mean different difficulty, and you cannot rank players
     * fairly across puzzles that are not equally hard.
     *
     * Every transform below is difficulty-preserving by construction:
     *   - 8 dihedral presentations (4 rotations x optional reflection)
     *   - 4! = 24 group colour/label permutations
     *   => 192 presentations of a provably identical puzzle.
     *
     * The accepted tradeoff: a shared screenshot still leaks the *solution
     * structure* to anyone willing to mentally re-orient it. That is inherent
     * to any simultaneous single-puzzle release; the transforms raise the cost
     * of copying without ever changing what a player is asked to solve.
     */
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
    minPlausibleMs: 10_000,
    maxDurationMs: 30 * MINUTE,
    maxSubmissionBytes: 32_000,
    public: {
      title: "Escape the Vallam",
      tagline: "Chundan vallam. Traffic jam. Vallamkali has never been this bureaucratic.",
      hint: "The snake boat only moves the long way. Everything else is in the way.",
      howTo: [
        "Slide boats along their own axis to clear a path.",
        "Get your vallam out of the right edge.",
        "Fastest escape wins. Move count is recorded but does not rank you.",
      ],
    },
    /**
     * Every board is generated backwards from a BFS solver, so it is provably
     * solvable and its true minimum move count is known before it ships. The
     * generator rejects boards below a par floor — a puzzle you clear in three
     * moves does not separate 500 players.
     */
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
     * Retries are the whole appeal, but unbounded retries are both unfair
     * against four one-shot games and an open compute tap for replay
     * verification. Twelve keeps the "one more go" hook and bounds both.
     */
    maxAttempts: 12,
    minPlausibleMs: 3_000,
    maxDurationMs: 6 * MINUTE,
    /** ~40k frames of delta-encoded input, with headroom. */
    maxSubmissionBytes: 128_000,
    public: {
      title: "Maveli Jump",
      tagline: "One year of freedom. Infinite platforms. Zero dignity.",
      hint: "Paathalam is below. Kerala is above. Start climbing.",
      howTo: [
        "Hold the left or right half of the board to steer. Maveli jumps on his own — he has done this before.",
        "Yellow platforms break, blue ones move, pink ones launch you.",
        "Height above Paathalam is your score.",
        "Twelve runs today. Your best one is the one that counts.",
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
    metric: "fcfs",
    maxAttempts: 1,
    /** No floor: the hunt runs for hours and the clock is the point. */
    minPlausibleMs: 0,
    maxDurationMs: 24 * 60 * MINUTE,
    maxSubmissionBytes: 4_000,
    public: {
      title: "The Hunt",
      tagline: "The website knows more than it is telling you.",
      hint: "Clue one is here. The rest are not.",
      howTo: [
        "Follow the clues. Some are on this site. Some are very much not.",
        "The last stage hands you a token — scan it, or paste it here.",
        "First correct submission wins. There is no second prize worth having.",
      ],
    },
    generate: () => ({
      // Nothing to generate: the hunt's content lives in the physical world and
      // in other pages. The attempt row exists only to own the clock.
      view: { kind: "hunt", prompt: "Enter the token from the final stage." },
      solution: null,
    }),
    verify: async ({ submission }) => {
      const claimed =
        submission && typeof submission === "object"
          ? (submission as { token?: unknown }).token
          : undefined;
      if (typeof claimed !== "string") {
        return { valid: false, reason: "No token submitted." };
      }
      const expected = await getSetting<string>("hunt.final_token", "");
      // Fail closed: an unset token must never accept an arbitrary guess.
      if (!expected.trim()) {
        return { valid: false, reason: "The hunt is not accepting tokens yet." };
      }
      return normalizeToken(claimed) === normalizeToken(expected)
        ? { valid: true }
        : { valid: false, reason: "That is not the token. Keep looking." };
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
