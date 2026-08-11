const STORE_PREFIX = "og_attempt:";

export interface StoredAttempt {
  attemptToken: string;
  startedAt: string;
}

export function getStoredAttempt(slug: string): StoredAttempt | null {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + slug);
    return raw ? (JSON.parse(raw) as StoredAttempt) : null;
  } catch {
    return null;
  }
}

export function storeAttempt(slug: string, attempt: StoredAttempt): void {
  try {
    localStorage.setItem(STORE_PREFIX + slug, JSON.stringify(attempt));
  } catch {
    // best effort
  }
}

export function clearAttempt(slug: string): void {
  try {
    localStorage.removeItem(STORE_PREFIX + slug);
  } catch {
    // best effort
  }
}
