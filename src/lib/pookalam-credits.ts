const DAILY_LIMIT_KEY = "onam-games:pookalam-daily-limit";
export const POOKALAM_CREDITS_EVENT = "onam-games:pookalam-credits";

export const pookalamDailyLimit = () =>
  typeof window === "undefined" ? 0 : Number(localStorage.getItem(DAILY_LIMIT_KEY)) || 0;

export function setPookalamDailyLimit(value: number): void {
  if (typeof window !== "undefined" && Number.isFinite(value) && value >= 0) {
    localStorage.setItem(DAILY_LIMIT_KEY, String(Math.floor(value)));
  }
}

export function addPookalamCredits(amount: number): void {
  if (typeof window === "undefined" || amount <= 0) return;
  const key = "collab-pookalam:token-bucket";
  const daily = pookalamDailyLimit();
  try {
    const raw = localStorage.getItem(key);
    const current = raw ? JSON.parse(raw) : null;
    const today = new Date().toISOString().slice(0, 10);
    const bucket = current?.day === today ? current : null;
    if (!bucket || (bucket.balloonsToday ?? 0) < Math.floor(daily / 5)) {
      const cap = Math.min(Math.ceil(daily / 3), 100);
      localStorage.setItem(
        key,
        JSON.stringify({
          day: today,
          credits: Math.min(cap, (bucket?.credits ?? 0) + Math.floor(amount)),
          lastCreditAt: bucket?.lastCreditAt ?? Date.now(),
          balloonsToday: (bucket?.balloonsToday ?? 0) + 1,
        }),
      );
    }
  } catch {
    /* The pookalam still receives the live event if storage is unavailable. */
  }
  window.dispatchEvent(
    new CustomEvent<number>(POOKALAM_CREDITS_EVENT, { detail: Math.floor(amount) }),
  );
}

export function canCollectPookalamBalloon(): boolean {
  if (typeof window === "undefined") return false;
  const daily = pookalamDailyLimit();
  if (daily <= 0) return false;
  try {
    const raw = localStorage.getItem("collab-pookalam:token-bucket");
    const bucket = raw ? (JSON.parse(raw) as { day?: string; balloonsToday?: number }) : null;
    const today = new Date().toISOString().slice(0, 10);
    if (bucket?.day !== today) return true;
    const credits = Number((bucket as { credits?: number }).credits) || 0;
    const creditCap = Math.min(Math.ceil(daily / 3), 100);
    return credits < creditCap && (bucket?.balloonsToday ?? 0) < Math.floor(daily / 5);
  } catch {
    return true;
  }
}
