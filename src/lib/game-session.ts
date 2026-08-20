const STORE_PREFIX = "og_attempt:";
const PROGRESS_PREFIX = "og_progress:";
const DONE_PREFIX = "og_done:";

/**
 * Local game session storage.
 *
 * Three separate things live here, and the difference matters:
 *
 *   attempt   which attempt is open, so a refresh can resume it
 *   progress  how far into the board the player has got
 *   done      the board they finished, so they can look at it afterwards
 *
 * NONE OF IT IS TRUSTED. Everything stored here is either something the server
 * already told us (the attempt token, which the server re-validates) or
 * something the server will re-derive anyway (the move list, which is replayed
 * at verification). Progress is deliberately the player's *moves*, never a
 * score or an elapsed time - those come from the server and are never written
 * here, so editing localStorage buys nothing but a rejected submission.
 *
 * Progress is keyed by attempt token rather than by slug: a retry game issues a
 * new token per run, and half-finished state leaking from one run into the next
 * would be both wrong and confusing.
 */

import { getMultiStoreSync, removeMultiStoreSync, setMultiStoreSync } from "./multi-store";

export interface StoredAttempt {
  attemptToken: string;
  startedAt: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = getMultiStoreSync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Malformed or unavailable storage must never break a game in progress.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    setMultiStoreSync(key, JSON.stringify(value));
  } catch {
    // Best effort: private mode and full quotas are both survivable. The
    // attempt itself lives on the server; this only costs the player a resume.
  }
}

function drop(key: string): void {
  try {
    removeMultiStoreSync(key);
  } catch {
    // best effort
  }
}

/* --------------------------------------------------------------- attempt */

export function getStoredAttempt(slug: string): StoredAttempt | null {
  return read<StoredAttempt>(STORE_PREFIX + slug);
}

export function storeAttempt(slug: string, attempt: StoredAttempt): void {
  write(STORE_PREFIX + slug, attempt);
}

export function clearAttempt(slug: string): void {
  drop(STORE_PREFIX + slug);
}

/* -------------------------------------------------------------- progress */

/** Mid-attempt board state. Shape is whatever that game's board component uses. */
export function getProgress<T>(attemptToken: string): T | null {
  return read<T>(PROGRESS_PREFIX + attemptToken);
}

export function saveProgress(attemptToken: string, progress: unknown): void {
  write(PROGRESS_PREFIX + attemptToken, progress);
}

export function clearProgress(attemptToken: string): void {
  drop(PROGRESS_PREFIX + attemptToken);
}

/* ------------------------------------------------------------- completed */

/**
 * A finished board, kept so the player can still see what they did after a
 * reload. Keyed by slug, not by attempt: what a player wants to look back at is
 * "the day I finished", and for a retry game that is their last completed run.
 */
export interface FinishedBoard {
  /** The board the server handed out, so it can be re-rendered exactly. */
  view: unknown;
  /** What the player submitted, replayed into the board read-only. */
  submission: unknown;
  finishedAt: string;
}

export function getFinished(slug: string): FinishedBoard | null {
  return read<FinishedBoard>(DONE_PREFIX + slug);
}

export function saveFinished(slug: string, board: FinishedBoard): void {
  write(DONE_PREFIX + slug, board);
}

/* ------------------------------------------------------- hub entry gate */

const HUB_ENTRY_KEY = "og_arena_from_hub";

/**
 * Marks that the player reached the arena by clicking through the games hub,
 * not by deep-linking or refreshing the /games/<slug> URL directly. The arena
 * page uses this to bounce direct hits back to the hub, so a completed/locked
 * board is never the first thing someone lands on. Scoped to the tab via
 * sessionStorage: a fresh tab or a manually typed URL has no flag and is sent
 * back to the hub.
 */
export function markArenaFromHub(): void {
  try {
    sessionStorage.setItem(HUB_ENTRY_KEY, "1");
  } catch {
    // best effort — without the flag the arena just bounces to the hub
  }
}

export function enteredArenaFromHub(): boolean {
  try {
    return sessionStorage.getItem(HUB_ENTRY_KEY) === "1";
  } catch {
    return false;
  }
}
