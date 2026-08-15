import { HttpError } from "./errors";

/**
 * How long a page-render read may take before it is treated as never arriving.
 *
 * A healthy in-region query answers in single-digit milliseconds and the whole
 * home page needs less than a second, so anything past 3s is an anomaly.
 */
export const READ_DEADLINE_MS = 3_000;

export class DeadlineError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} did not answer within ${ms}ms`);
    this.name = "DeadlineError";
  }
}

/**
 * Rejects if `work` has not settled in time.
 */
function withDeadline<T>(what: string, ms: number, work: Promise<T>): Promise<T> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      console.error(`[DEADLINE EXCEEDED] ⏱️ "${what}" took longer than ${ms}ms to respond!`);
      reject(new DeadlineError(what, ms));
    }, ms);
  });

  work
    .then(() => {
      const elapsed = Date.now() - start;
      if (elapsed > 1200) {
        console.warn(`[SLOW READ] ⚠️ "${what}" answered in ${elapsed}ms`);
      }
    })
    .catch((err) => {
      console.error(`[READ ERROR] ❌ "${what}" failed:`, err);
    });

  return Promise.race([work, deadline]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * A read whose failure must not take the whole page down with it.
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
    console.error(`[DEGRADED READ] ⚠️ "${what}" — serving fallback due to:`, error);
    return fallback;
  }
}
