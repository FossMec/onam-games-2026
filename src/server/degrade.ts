import { HttpError } from "./errors";

/**
 * How long a page-render read may take before it is treated as never arriving.
 *
 * A healthy in-region query answers in single-digit milliseconds and the whole
 * home page needs about a second, so anything past this is not slow — it is
 * gone.
 */
export const READ_DEADLINE_MS = 8_000;

class DeadlineError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} did not answer within ${ms}ms`);
    this.name = "DeadlineError";
  }
}

/**
 * Rejects if `work` has not settled in time.
 *
 * The abandoned promise is *not* cancelled — nothing here can cancel a query
 * already written to a socket — it is merely stopped being waited on, with its
 * eventual rejection swallowed so it cannot surface later as an unhandled
 * rejection against a request that has long since been answered.
 */
function withDeadline<T>(what: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(what, ms)), ms);
  });
  work.catch(() => {});
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer)) as Promise<T>;
}

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
 * The deadline is the other half, and it is the half that actually matters in
 * production. A fallback only helps when the read *fails*; a read that simply
 * never answers hangs the render forever, and that is not hypothetical — it is
 * the default behaviour of this stack. `postgres` has no query timeout, so a
 * statement written to a socket that died while the serverless instance was
 * frozen waits for a reply that is never coming. TCP will not notice for two
 * hours. The Suspense boundary never resolves, the streamed response never
 * closes, the visitor watches a spinner, and the platform bills the full
 * five-minute invocation before killing it.
 *
 * So every read here gets a deadline, and missing it is treated exactly like
 * failing: log it, serve the fallback, finish the page.
 *
 * Writes never come through here. A failed write must fail loudly.
 */
export async function readOrDegrade<T>(
  what: string,
  fallback: T,
  read: () => Promise<T>,
  deadlineMs = READ_DEADLINE_MS,
): Promise<T> {
  try {
    return await withDeadline(what, deadlineMs, read());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error(`[degraded] ${what} — serving fallback`, error);
    return fallback;
  }
}
