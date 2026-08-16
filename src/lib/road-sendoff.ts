/**
 * The send-off on the submit page, assembled from what the person actually did.
 *
 * A fixed paragraph is worse than nothing here: everybody who reaches this
 * point has spent evenings on the road, and a message that would read
 * identically for somebody who ticked four boxes and somebody who walked all
 * nine and filled the margins with notes is a form letter with a name slotted
 * in. So the text is built from their own trail - stops cleared, notes written,
 * how they rated the hard ones, whether git and GitHub are behind them.
 *
 * Nothing here is random. Two people get different words because they did
 * different things, and the same person gets the same words on a refresh; a
 * message that reshuffles itself on reload stops reading as something meant.
 *
 * Tone rules, learnt the hard way over several drafts: warm, short, and never
 * congratulating somebody for something they did not do. No signature, no
 * costume voice, no paragraph about their journey.
 */

export interface SendOffInput {
  /** First name, when we know it. */
  name?: string;
  /** Stop ids ticked off. */
  done: string[];
  /** Stop id -> the note they typed. Blank ones are ignored. */
  notes: Record<string, string>;
  /** Stop id -> 1..5, where 1 is "brutal". */
  ratings: Record<string, number>;
  /** Stop id -> title, for naming the one they found hardest. */
  titles: Record<string, string>;
  /** How many stops exist in total. */
  total: number;
}

export interface SendOff {
  title: string;
  /** Two or three short lines. The last one is always the send-off proper. */
  lines: string[];
}

const RATING_WORDS = ["brutal", "hard", "fine", "easy", "too easy"];

/** The three stops where you actually draw something. */
const DRAWING_STOPS = ["first-shape", "make-it-round", "rings-and-colour"];

export function buildSendOff(input: SendOffInput): SendOff {
  const done = new Set(input.done);
  const cleared = input.done.length;
  const written = Object.values(input.notes).filter((note) => note.trim()).length;
  const rated = Object.entries(input.ratings).filter(([, score]) => score >= 1 && score <= 5);

  /* ---------------------------------------------------------------- opening */

  const who = input.name ? `Hey ${input.name}, ` : "Hey, ";
  const title =
    cleared >= input.total
      ? `${who}you walked the whole thing.`
      : cleared >= input.total - 2
        ? `${who}it's been a good ride.`
        : `${who}it's been a good ride so far.`;

  /* ------------------------------------------------------------ what you did */

  const lines: string[] = [];

  if (written >= 3) {
    lines.push(
      `${cleared} stops cleared, and ${written} notes left along the way in your own words.`,
    );
  } else if (written > 0) {
    lines.push(`${cleared} stops cleared, ${written} of them with a note left behind.`);
  } else {
    lines.push(`${cleared} stops cleared, no notes needed.`);
  }

  /* --------------------------------------------- one line about the hard part */

  const hardest = rated.reduce<{ id: string; score: number } | null>((worst, [id, score]) => {
    if (!worst || score < worst.score) return { id, score };
    return worst;
  }, null);

  const drawingDone = DRAWING_STOPS.every((id) => done.has(id));
  const versionControlDone = done.has("git") && done.has("github");
  /** Somebody who rated everything easy is not on their first day of code. */
  const breezedIt = rated.length >= 3 && rated.every(([, score]) => score >= 4);

  if (hardest && hardest.score <= 2) {
    const title = input.titles[hardest.id] ?? "one of them";
    lines.push(
      `You marked "${title}" as ${RATING_WORDS[hardest.score - 1]} and got through it anyway - that is the part that counts.`,
    );
  } else if (breezedIt) {
    lines.push("You called nearly all of it easy, which is either talent or a very good week.");
  } else if (versionControlDone && drawingDone) {
    lines.push(
      "Loops, a bit of maths, git, and a public repo with your name on it - that lot outlasts Onam by a long way.",
    );
  } else if (versionControlDone) {
    lines.push("git and a public repo are behind you now. That pair alone was worth the week.");
  } else if (drawingDone) {
    lines.push(
      "One circle, then a ring, then four rings. That is the whole trick and you have it.",
    );
  }

  /* ---------------------------------------------------------------- send-off */

  /*
   * The "first go at programming" line is the warmest thing here and the
   * easiest to get wrong: said to somebody who just rated every stop easy, or
   * who finished the whole road including git, it reads as a misjudgement of
   * who they are. They get the plain version instead.
   */
  lines.push(
    cleared >= input.total || breezedIt
      ? "Hope you learnt something you keep. Waiting to see your pookalam - hope you win it."
      : "Hope you learnt something new, and if this was your first go at programming, yayy! Waiting to see your pookalam - hope you win it.",
  );

  return { title, lines };
}
