import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";
import { createRng } from "../rng";
import { TINDER_CARDS, type TinderCard } from "../data/tinder-cards";

/**
 * Open Source Tinder.
 *
 * Swipe right for open source, left for proprietary. A wrong call costs three
 * seconds and the card comes back at the end of the deck. The run ends when the
 * deck is empty, so the only score is how long it took — the game is
 * self-verifying in the sense that an incorrect answer cannot end the run.
 *
 * ANTI-CHEAT SHAPE
 *
 * The browser never receives the answer key. It posts each swipe to `/check`
 * and gets back only whether *that* card was wrong, plus the licence note for
 * it if it was — information the player has already earned by guessing, and is
 * about to be shown as the penalty screen anyway. Nothing is ever said about a
 * card they have not answered.
 *
 * At finish, the full transcript is replayed here and must reconstruct exactly:
 * the right cards, in the right order, misses recycling into the next pass,
 * ending with a clean pass. A fabricated transcript fails on order alone, and
 * the time penalty is counted from the replay rather than from anything the
 * client reported.
 */

export const TINDER_DECK_SIZE = 20;

/**
 * Time added to the clock for every card called wrong.
 *
 * Recycling a miss to the back of the deck was the only cost of guessing, and
 * it is a weak one: a fast player could swipe blind, take the free grading, and
 * still beat a careful player who read every card. Three seconds makes a guess
 * genuinely more expensive than a moment's thought, without ending the run.
 *
 * Applied server-side in `verify`, from the replayed transcript — the browser
 * displays a running total but never gets a vote on the number.
 */
export const WRONG_SWIPE_PENALTY_MS = 3_000;

export interface TinderDecision {
  id: string;
  /** The player's call: true = swiped right = "open source". */
  open: boolean;
}

export interface TinderSubmission {
  /** One entry per pass through the deck, in play order. */
  passes: TinderDecision[][];
}

export function dealDeck(seed: string): TinderCard[] {
  const rng = createRng(seed);
  const open = rng.shuffle(TINDER_CARDS.filter((c) => c.open));
  const closed = rng.shuffle(TINDER_CARDS.filter((c) => !c.open));

  const half = Math.floor(TINDER_DECK_SIZE / 2);
  const picked = [...open.slice(0, half), ...closed.slice(0, TINDER_DECK_SIZE - half)];

  return rng.shuffle(picked);
}

/** id -> correct answer, regenerated from the seed. Never serialised. */
function answerKey(seed: string): Map<string, boolean> {
  return new Map(dealDeck(seed).map((card) => [card.id, card.open]));
}

export function generate(seed: string): GeneratedInstance {
  const deck = dealDeck(seed);
  return {
    // Name and category only. No `open`, no `why`, no `tricky` — those are the
    // answers. `category` is deliberately shared across both sides of the deck
    // (see `data/tinder-cards.ts`), so it dresses the card without grading it.
    view: {
      kind: "tinder",
      cards: deck.map((card) => ({ id: card.id, name: card.name, category: card.category })),
    },
    solution: deck.map((card) => ({ id: card.id, open: card.open })),
  };
}

/**
 * Grades one pass and returns only the ids that were wrong.
 *
 * Deliberately reveals nothing about cards the player has not answered: you
 * learn only that your own guess was wrong, which you would learn anyway when
 * the card came back around.
 */
export function checkPass(
  seed: string,
  expectedIds: readonly string[],
  decisions: readonly TinderDecision[],
): { ok: true; wrongIds: string[] } | { ok: false; reason: string } {
  const key = answerKey(seed);

  if (decisions.length !== expectedIds.length) {
    return { ok: false, reason: "Pass length does not match the deck" };
  }
  const wrongIds: string[] = [];
  for (let i = 0; i < decisions.length; i += 1) {
    const decision = decisions[i];
    // Order is enforced: you must answer the card you were actually shown.
    if (decision.id !== expectedIds[i]) {
      return { ok: false, reason: "Cards answered out of order" };
    }
    const correct = key.get(decision.id);
    if (correct === undefined) return { ok: false, reason: "Unknown card" };
    if (decision.open !== correct) wrongIds.push(decision.id);
  }
  return { ok: true, wrongIds };
}

/**
 * The teaching moment for cards the player just got wrong.
 *
 * Only ever called with ids `checkPass` has already graded as wrong, and it is
 * the caller's job to keep it that way: `why` names the licence, so handing it
 * over for an unanswered card would be handing over the answer. For a card the
 * player has already missed it reveals nothing they were not just told.
 */
export function explainCards(
  seed: string,
  ids: readonly string[],
): { id: string; open: boolean; why: string; fact: string }[] {
  const deck = new Map(dealDeck(seed).map((card) => [card.id, card]));
  return ids.flatMap((id) => {
    const card = deck.get(id);
    return card ? [{ id: card.id, open: card.open, why: card.why, fact: card.fact }] : [];
  });
}

/**
 * Replays the whole transcript. The deck must be dealt in order on pass 1,
 * each later pass must contain exactly the previous pass's misses in the same
 * relative order, and the last pass must be clean.
 */
export function verify(input: VerifyInput): VerifyResult {
  const submission = input.submission as TinderSubmission | null;
  if (!submission || !Array.isArray(submission.passes) || submission.passes.length === 0) {
    return { valid: false, reason: "Nothing submitted." };
  }
  // Bound the work: a legitimate run converges in a handful of passes.
  if (submission.passes.length > 40) {
    return { valid: false, reason: "Too many passes." };
  }

  let expected: string[] = dealDeck(input.seed).map((card) => card.id);
  let moves = 0;
  let wrongSwipes = 0;

  for (const pass of submission.passes) {
    if (!Array.isArray(pass)) return { valid: false, reason: "Malformed pass." };
    if (expected.length === 0) {
      return { valid: false, reason: "Extra passes after the deck was cleared." };
    }
    const result = checkPass(input.seed, expected, pass);
    if (!result.ok) return { valid: false, reason: result.reason };
    moves += pass.length;
    wrongSwipes += result.wrongIds.length;
    // Misses recycle, keeping their relative order.
    expected = expected.filter((id) => result.wrongIds.includes(id));
  }

  if (expected.length > 0) {
    return { valid: false, reason: "You left cards unsorted. DWAAAA..." };
  }
  return {
    valid: true,
    movesCount: moves,
    durationPenaltyMs: wrongSwipes * WRONG_SWIPE_PENALTY_MS,
  };
}

/**
 * The recap shown after a win: what each card was and why. Safe to send only
 * once the attempt is submitted.
 */
export function revealDeck(
  seed: string,
): { id: string; name: string; category: string; open: boolean; why: string; fact: string }[] {
  return dealDeck(seed).map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    open: card.open,
    why: card.why,
    fact: card.fact,
  }));
}
