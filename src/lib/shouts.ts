/**
 * Comic onomatopoeia, in Manglish.
 *
 * Every shout is Malayalam — never POW/BAM. That is the one part of this
 * identity nobody else can copy, and it is the difference between "a Memphis
 * template" and "our college's thing".
 *
 * All player-facing exclamations live here so the voice stays consistent and
 * a single edit re-tunes the whole site's mood.
 */

export type ShoutMood =
  /** Rank 1, or a new personal best. The loudest thing we ever say. */
  | "triumph"
  /** A genuinely good result. */
  | "great"
  /** Respectable. Not podium. */
  | "decent"
  /** Mid-table. Affectionate needling. */
  | "mid"
  /** Submission rejected / wrong answer. */
  | "fail"
  /** Nonsense state — bad payload, 404, something broke. */
  | "confused"
  /** Correct, but after the deadline. */
  | "late";

/**
 * Several options per mood so a player who replays Maveli Jump twelve times
 * is not read the same line twelve times.
 */
const SHOUTS: Record<ShoutMood, readonly string[]> = {
  triumph: ["THEE THANNE NEE!", "THAKARPPAN!", "ADIPOLI!", "YAYYYY!"],
  great: ["ADIPOLI!", "PWOLI!", "THAKARPPAN!", "YAYYYY!"],
  decent: ["KOLLALO ATH!", "OK-ish!"],
  mid: ["MWONEEE...", "PAAVAM."],
  fail: ["DWAAAA...", "AYYO"],
  confused: ["ENTHUVA!", "ENTHUVA IDHU?"],
  late: ["AYYO", "LATE AAYI"],
};

/**
 * Pick a shout for a mood.
 *
 * `key` makes the choice stable for a given result — pass an attempt id and a
 * player sees the same word on refresh instead of it reshuffling under them.
 * Omit it for a fresh random pick.
 */
export function shout(mood: ShoutMood, key?: string): string {
  const options = SHOUTS[mood];
  if (!key) return options[Math.floor(Math.random() * options.length)];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return options[hash % options.length];
}

/** The colour a shout is inked in, so mood reads before the word does. */
export const SHOUT_COLOR: Record<ShoutMood, string> = {
  triumph: "var(--pop-yellow)",
  great: "var(--pop-teal)",
  decent: "var(--pop-blue)",
  mid: "var(--pop-purple)",
  fail: "var(--pop-red)",
  confused: "var(--pop-pink)",
  late: "var(--pop-red)",
};

/**
 * Maps a finished attempt to a mood. Kept here rather than in the page so the
 * game page and the leaderboard cannot disagree about what counts as good.
 */
export function moodForResult(input: {
  valid: boolean;
  afterDeadline: boolean;
  isPersonalBest: boolean;
  rank?: number | null;
  fieldSize?: number | null;
}): ShoutMood {
  if (!input.valid) return "fail";
  if (input.afterDeadline) return "late";
  if (input.rank === 1 || input.isPersonalBest) return "triumph";

  const { rank, fieldSize } = input;
  if (rank && fieldSize && fieldSize > 1) {
    const percentile = 1 - (rank - 1) / (fieldSize - 1);
    if (percentile >= 0.8) return "great";
    if (percentile >= 0.5) return "decent";
    return "mid";
  }
  return "great";
}
