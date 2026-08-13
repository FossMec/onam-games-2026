import type { GeneratedInstance, VerifyInput, VerifyResult } from "../registry";
import { createRng } from "../rng";
import { TINDER_CARDS, type TinderCard } from "../data/tinder-cards";

/**
 * Open Source Tinder.
 *
 * Swipe right for open source, left for proprietary. Cards you get wrong come
 * back at the end of the deck. The run ends when the deck is empty, so the only
 * score is how long it took — the game is self-verifying in the sense that an
 * incorrect answer cannot end the run.
 *
 * ANTI-CHEAT SHAPE
 *
 * The browser never receives the answer key. It plays a pass, posts that pass
 * to `/check`, and gets back only the ids it got wrong — information the player
 * already earned by guessing. At finish, the full transcript is replayed here
 * and must reconstruct exactly: the right cards, in the right order, ending
 * with a clean pass. A fabricated transcript fails on order alone.
 */

export const TINDER_DECK_SIZE = 20;
/** Guaranteed minimum of brand-trap cards (Chromium vs Chrome, etc). */
const MIN_TRICKY = 6;

export interface TinderDecision {
  id: string;
  /** The player's call: true = swiped right = "open source". */
  open: boolean;
}

export interface TinderSubmission {
  /** One entry per pass through the deck, in play order. */
  passes: TinderDecision[][];
}

/**
 * Deterministically deal a deck. Balanced roughly 50/50 so neither swipe
 * direction is a winning default, and salted with tricky cards.
 */
export function dealDeck(seed: string): TinderCard[] {
  const rng = createRng(seed);
  const open = TINDER_CARDS.filter((c) => c.open);
  const closed = TINDER_CARDS.filter((c) => !c.open);

  const half = Math.floor(TINDER_DECK_SIZE / 2);
  const trickyOpen = rng.shuffle(open.filter((c) => c.tricky));
  const trickyClosed = rng.shuffle(closed.filter((c) => c.tricky));
  const plainOpen = rng.shuffle(open.filter((c) => !c.tricky));
  const plainClosed = rng.shuffle(closed.filter((c) => !c.tricky));

  const trickyPerSide = Math.ceil(MIN_TRICKY / 2);
  const picked = [...trickyOpen.slice(0, trickyPerSide), ...trickyClosed.slice(0, trickyPerSide)];
  picked.push(...plainOpen.slice(0, half - trickyPerSide));
  picked.push(...plainClosed.slice(0, TINDER_DECK_SIZE - half - trickyPerSide));

  return rng.shuffle(picked);
}

/** id -> correct answer, regenerated from the seed. Never serialised. */
function answerKey(seed: string): Map<string, boolean> {
  return new Map(dealDeck(seed).map((card) => [card.id, card.open]));
}

export function generate(seed: string): GeneratedInstance {
  const deck = dealDeck(seed);
  return {
    // Name only. No `open`, no `why`, no `tricky` — those are the answers.
    view: {
      kind: "tinder",
      cards: deck.map((card) => ({ id: card.id, name: card.name })),
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

  for (const pass of submission.passes) {
    if (!Array.isArray(pass)) return { valid: false, reason: "Malformed pass." };
    if (expected.length === 0) {
      return { valid: false, reason: "Extra passes after the deck was cleared." };
    }
    const result = checkPass(input.seed, expected, pass);
    if (!result.ok) return { valid: false, reason: result.reason };
    moves += pass.length;
    // Misses recycle, keeping their relative order.
    expected = expected.filter((id) => result.wrongIds.includes(id));
  }

  if (expected.length > 0) {
    return { valid: false, reason: "You left cards unsorted. DWAAAA..." };
  }
  return { valid: true, movesCount: moves };
}

/**
 * The recap shown after a win: what each card was and why. Safe to send only
 * once the attempt is submitted.
 */
export function revealDeck(seed: string): { name: string; open: boolean; why: string }[] {
  return dealDeck(seed).map((card) => ({ name: card.name, open: card.open, why: card.why }));
}
