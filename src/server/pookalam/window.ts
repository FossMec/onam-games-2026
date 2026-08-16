/**
 * When each Code-a-Pookalam phase is open.
 *
 * The contest runs on a clock, not on somebody remembering to flip a switch:
 * the entry form opens a few days before the deadline, closes at a configured
 * instant on day 6, voting runs day 7, and results land after that. All four
 * boundaries live in `app_settings` as IST wall-clock strings so they can be
 * moved from /admin without a deploy.
 *
 * Each phase also keeps a boolean **force** flag. That is the manual override
 * for rehearsals and for the moment something goes wrong at 11pm — it opens the
 * phase regardless of the clock, and it is the only thing that works before the
 * dates are configured. With neither a window nor a force flag a phase is
 * closed, which is the right way for a half-configured deploy to fail.
 *
 * Pure functions with no database: `service.ts` supplies the settings.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * `YYYY-MM-DDTHH:MM` (or with a space, or with seconds) read as IST.
 *
 * Deliberately not `new Date(value)`: that would read a bare datetime as UTC on
 * the server and as the browser's zone on a phone, so the same setting would
 * mean two different instants. Every time in this app is IST, and this is where
 * that is enforced.
 */
export function parseIstDateTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const utcMs = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  const date = new Date(utcMs - IST_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface PhaseState {
  /** Is the phase accepting traffic right now? */
  open: boolean;
  /** Configured start, if any. Drives "opens in …" countdowns. */
  opensAt: Date | null;
  /** Configured end, if any. Drives "closes in …" countdowns. */
  closesAt: Date | null;
  /** True when the phase is open only because an admin forced it. */
  forced: boolean;
  /** Why it is shut — lets the page say something better than "closed". */
  reason: "open" | "not_yet" | "over" | "unscheduled";
}

/**
 * Resolves one phase against the clock.
 *
 * `now` is passed in rather than read from `Date.now()` so the whole page can
 * resolve every phase against a single instant — otherwise a render could show
 * submissions closed and voting not yet open across a millisecond boundary.
 */
export function resolvePhase(
  now: number,
  force: boolean,
  opensAt: Date | null,
  closesAt: Date | null,
): PhaseState {
  const base = { opensAt, closesAt };
  if (closesAt && now >= closesAt.getTime() && !force) {
    return { ...base, open: false, forced: false, reason: "over" };
  }
  if (force) return { ...base, open: true, forced: true, reason: "open" };
  if (!opensAt) return { ...base, open: false, forced: false, reason: "unscheduled" };
  if (now < opensAt.getTime()) {
    return { ...base, open: false, forced: false, reason: "not_yet" };
  }
  return { ...base, open: true, forced: false, reason: "open" };
}
