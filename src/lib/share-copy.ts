/**
 * Every word that can end up printed on a share card.
 *
 * Kept out of the renderer for the same reason `event-content.ts` is kept out
 * of the landing page: the jokes will be rewritten a dozen times before the
 * event, and whoever rewrites them should not have to read canvas code to do
 * it. Nothing here draws anything — it only decides *what* gets said.
 *
 * The voice is the site's voice: Manglish shouts (see `shouts.ts`), Linux-club
 * sarcasm, and never a sentence that congratulates the player earnestly.
 */

export type ShareTier =
  /** Rank 1. The only tier allowed to be smug without irony. */
  | "champion"
  /** Ranks 2–3. */
  | "podium"
  /** Top 10% of the field. */
  | "sharp"
  /** Top half. */
  | "middle"
  /** Bottom half. The funniest tier — a bad rank is a better joke than a good one. */
  | "tail"
  /** Correct, but after the day closed. */
  | "late"
  /** No board position: catch-up run, tester, or the standing query came back empty. */
  | "unranked";

export interface StandingInput {
  rank: number | null;
  fieldSize: number | null;
  afterDeadline: boolean;
}

/**
 * Which tier a result lands in.
 *
 * Deliberately mirrors the percentile cuts in `moodForResult` (`shouts.ts`) so
 * a card can never call a run "top 10%" while the win modal calls it mid-table.
 */
export function tierFor(input: StandingInput): ShareTier {
  if (input.afterDeadline) return "late";
  const { rank, fieldSize } = input;
  if (!rank || !fieldSize || fieldSize < 1) return "unranked";
  if (rank === 1) return "champion";
  if (rank <= 3) return "podium";
  if (fieldSize <= 1) return "champion";
  const percentile = 1 - (rank - 1) / (fieldSize - 1);
  if (percentile >= 0.9) return "sharp";
  if (percentile >= 0.5) return "middle";
  return "tail";
}

/**
 * The big comic shout across the card. Short, all-caps, readable from a
 * thumbnail in someone's story feed — that is the entire brief.
 */
const TAUNTS: Record<ShareTier, readonly string[]> = {
  champion: ["CAN YOU BEAT ME?", "TOP OF THE BOARD.", "THEE THANNE NJAN!"],
  podium: ["CAN YOU BEAT ME?", "ALMOST THERE.", "PODIUM ANU!"],
  sharp: ["CAN YOU BEAT ME?", "TRY ME.", "KOLLALLO?"],
  middle: ["COME AT ME.", "CAN YOU BEAT ME?", "BEAT IT. I DARE YOU."],
  tail: ["I FINISHED.", "STILL BETTER THAN NOT PLAYING.", "CAN YOU DO WORSE?"],
  late: ["LATE, BUT LANDED.", "MERGED ANYWAY."],
  unranked: ["CAN YOU BEAT ME?", "YOUR MOVE.", "PWOLI ALLE?"],
};

/**
 * The sarcastic line under the shout. Longer, lower-case, and the place where
 * the joke actually lives — the shout only sets it up.
 */
const BRAGS: Record<ShareTier, readonly string[]> = {
  champion: [
    "rank one. sudo not required.",
    "first place. i'll wait — htop is open.",
    "topped the board and still made it to sadya.",
  ],
  podium: [
    "podium finish. someone please rm -rf the ones above me.",
    "so close to first that it is basically a rounding error.",
    "top three. the two ahead of me clearly had fibre.",
  ],
  sharp: [
    "top ten percent. my cpu throttled, not my will.",
    "faster than ninety percent of this college. no big deal.",
    "did this in one run. no retries, no regrets.",
  ],
  middle: [
    "mid-table and proud. at least it compiled.",
    "solidly average. the backbone of every open source project.",
    "not the fastest, but i did read the docs.",
  ],
  tail: [
    "somebody has to hold up the bottom of the leaderboard. i do it with dignity.",
    "participation is a feature, not a bug.",
    "exit 0. that is the whole achievement.",
    "finished last-ish, but finished. that is more than the fork count of most repos.",
  ],
  late: [
    "submitted after the deadline, like every pull request i have ever opened.",
    "the board closed, i kept playing. this is called dedication.",
  ],
  unranked: [
    "just for fun. the leaderboard does not know what it missed.",
    "off the board, still on the sadya.",
  ],
};

/**
 * A handwritten margin note, in the site's sarcasm channel (`.comment`).
 *
 * Picked independently of the tier so two people with the same rank do not get
 * the same card. Every line has to work under *any* result.
 */
const ASIDES: readonly string[] = [
  "maveli checks the leaderboard once a year. make it count.",
  "pookalam is just a radial for-loop.",
  "onasadya first, benchmarks later.",
  "works on my machine. and apparently on the leaderboard.",
  "no shadows were used in the making of this card.",
  "git blame says it was the lag.",
  "free as in speech, fast as in this.",
  "vallam went left. i went right.",
  "ten kinds of people: those who play, and those who fork.",
  "onam is the only release cycle kerala respects.",
];

/**
 * Every comic meme in `public/images/memes`, one per card.
 *
 * Keep this list in step with the folder. The card picks from it by seed, so a
 * new meme starts appearing on roughly one card in eight the moment it is added
 * — no other wiring needed.
 */
export const SHARE_MEMES = [
  "/images/memes/sudo-mkdir-pookalam.webp",
  "/images/memes/talk-is-cheap-sadya.webp",
  "/images/memes/need-more-tokens.webp",
  "/images/memes/failure-is-not-an-option.webp",
  "/images/memes/meme-celebrate.webp",
  "/images/memes/meme-deploy.webp",
  "/images/memes/meme-footer.webp",
] as const;

/**
 * Which sprite gets slapped on the card, by tier. `papad-face` is the site's
 * designated smart-arse, so it guards the two tiers that are taking the piss.
 */
const TIER_SPRITES: Record<ShareTier, readonly string[]> = {
  champion: ["tux-king", "arch-crown"],
  podium: ["maveli-laptop", "gopher-king"],
  sharp: ["ferris-crab", "terminal-star"],
  middle: ["maveli-laptop", "octocat-garland"],
  tail: ["papad-face", "floppy-onam"],
  late: ["papad-face", "nilavilakku"],
  unranked: ["sadya-leaf", "muthukuda"],
};

/** FNV-1a, same shape as the one in `shouts.ts` — stable choice from a seed. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic pick. The same attempt always produces the same card, so a
 * player who re-opens the share sheet does not get handed a different joke —
 * and a card they already posted still matches the one on their screen.
 */
export function pick<T>(options: readonly T[], seed: string): T {
  return options[hash(seed) % options.length];
}

export const taunt = (tier: ShareTier, seed: string) => pick(TAUNTS[tier], `${seed}-taunt`);
export const brag = (tier: ShareTier, seed: string) => pick(BRAGS[tier], `${seed}-brag`);
export const aside = (seed: string) => pick(ASIDES, `${seed}-aside`);
export const memeFor = (seed: string) => pick(SHARE_MEMES, `${seed}-meme`);
export const spriteFor = (tier: ShareTier, seed: string) =>
  pick(TIER_SPRITES[tier], `${seed}-sprite`);

export interface FigureInput {
  metric: "time" | "score" | "fcfs";
  durationMs: number | null;
  score: number | null;
}

/**
 * The headline number and its unit, in the same words the game page uses
 * (`ResultFigures` in `routes/games/[slug].tsx`). Split into two strings
 * because the card sets them at wildly different sizes.
 */
export function figureFor(input: FigureInput): { value: string; label: string } {
  if (input.metric === "score") {
    return {
      value: (input.score ?? 0).toLocaleString("en-IN"),
      label: "M ABOVE PAATHALAM",
    };
  }
  // Minutes past the minute mark, exactly as the leaderboard writes them —
  // "184.3s" is a number, "3m 4s" is a time, and the two screens must agree.
  const seconds = (input.durationMs ?? 0) / 1000;
  const value =
    seconds < 60
      ? `${seconds.toFixed(1)}s`
      : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return { value, label: input.metric === "fcfs" ? "FINISHED IN" : "ON THE CLOCK" };
}

export interface CaptionInput {
  playerName: string;
  gameTitle: string;
  day: number;
  rank: number | null;
  fieldSize: number | null;
  figure: string;
  tier: ShareTier;
  seed: string;
  origin: string;
}

/**
 * The text that rides along with the image.
 *
 * Instagram throws it away, WhatsApp and Twitter keep it — so the image has to
 * stand alone and this is a bonus, never the payload. Ends with the URL because
 * that is the only part doing any work.
 */
export function buildCaption(input: CaptionInput): string {
  const standing =
    input.rank && input.fieldSize
      ? `#${input.rank} of ${input.fieldSize}`
      : "played just for the fun of it";
  return [
    `Day ${input.day} · ${input.gameTitle} — ${input.figure} (${standing}).`,
    brag(input.tier, input.seed),
    `${taunt(input.tier, input.seed)} ${input.origin}`,
  ].join("\n");
}

/** Downloaded files land in a camera roll full of screenshots. Name them well. */
export const shareFileName = (slug: string) => `foss-onam-${slug}.png`;
