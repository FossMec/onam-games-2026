import { HttpError } from "./errors";

/**
 * A read whose failure must not take the page down with it.
 *
 * The landing page is mostly not database content: the hero, the Pookalam
 * pitch, the prizes, the letter, the rules and the FAQ are all static copy that
 * lives in the bundle. Before this, one unreachable database turned every one
 * of those into a blank screen — `createAsync` rethrows on the client, the
 * error escapes hydration, and the whole shell dies for the sake of a schedule
 * nobody could read anyway.
 *
 * So reads that only *decorate* a page degrade to a fallback and let the page
 * render around the hole. Deliberate refusals (`HttpError` — 401, 403, 404) are
 * rethrown untouched: those are answers, not outages, and callers depend on
 * them.
 *
 * Writes never come through here. A failed write must fail loudly.
 */
export async function readOrDegrade<T>(
  what: string,
  fallback: T,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error(`[degraded] ${what} — serving fallback`, error);
    return fallback;
  }
}
