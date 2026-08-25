import { getMultiStoreSync, setMultiStoreSync } from "./multi-store";

const DAILY_LIMIT_KEY = "onam-games:pookalam-daily-limit";
export const POOKALAM_CREDITS_EVENT = "onam-games:pookalam-credits";
export const DEFAULT_DAILY_LIMIT = 30;

export const pookalamDailyLimit = () => {
  if (typeof window === "undefined") return DEFAULT_DAILY_LIMIT;
  const val = Number(getMultiStoreSync(DAILY_LIMIT_KEY));
  return Number.isFinite(val) && val > 0 ? val : DEFAULT_DAILY_LIMIT;
};

export const pookalamMaxCredits = (daily: number) => Math.ceil(daily / 3);

export function setPookalamDailyLimit(value: number): void {
  if (typeof window !== "undefined" && Number.isFinite(value) && value >= 0) {
    setMultiStoreSync(DAILY_LIMIT_KEY, String(Math.floor(value)));
  }
}

export function addPookalamCredits(amount: number): void {
  if (typeof window === "undefined" || amount <= 0) return;
  const key = "collab-pookalam:token-bucket";
  const daily = pookalamDailyLimit();
  const maxBalloons = Math.max(1, Math.floor(daily / 5));
  try {
    const raw = getMultiStoreSync(key);
    const current = raw ? JSON.parse(raw) : null;
    const today = new Date().toISOString().slice(0, 10);
    const bucket = current?.day === today ? current : null;
    if (!bucket || (bucket.balloonsToday ?? 0) < maxBalloons) {
      const cap = pookalamMaxCredits(daily);
      setMultiStoreSync(
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

export interface PookalamCreditState {
  credits: number;
  maxCredits: number;
  dailyLimit: number;
  balloonsToday: number;
  maxBalloonsToday: number;
  isFull: boolean;
  canCollectBalloon: boolean;
}

export function getPookalamCreditState(): PookalamCreditState {
  if (typeof window === "undefined") {
    const daily = DEFAULT_DAILY_LIMIT;
    const maxCredits = pookalamMaxCredits(daily);
    return {
      credits: maxCredits,
      maxCredits,
      dailyLimit: daily,
      balloonsToday: 0,
      maxBalloonsToday: Math.max(1, Math.floor(daily / 5)),
      isFull: true,
      canCollectBalloon: false,
    };
  }

  const daily = pookalamDailyLimit();
  const maxCredits = pookalamMaxCredits(daily);
  const maxBalloonsToday = Math.max(1, Math.floor(daily / 5));

  if (daily <= 0) {
    return {
      credits: 0,
      maxCredits: 0,
      dailyLimit: 0,
      balloonsToday: 0,
      maxBalloonsToday: 0,
      isFull: true,
      canCollectBalloon: false,
    };
  }

  try {
    const raw = getMultiStoreSync("collab-pookalam:token-bucket");
    const bucket = raw
      ? (JSON.parse(raw) as {
          day?: string;
          credits?: number;
          balloonsToday?: number;
          lastCreditAt?: number;
        })
      : null;
    const today = new Date().toISOString().slice(0, 10);

    let credits = maxCredits;
    let balloonsToday = 0;

    if (bucket && bucket.day === today) {
      credits =
        typeof bucket.credits === "number"
          ? Math.min(maxCredits, Math.max(0, bucket.credits))
          : maxCredits;
      balloonsToday =
        typeof bucket.balloonsToday === "number" ? Math.max(0, bucket.balloonsToday) : 0;
    }

    const isFull = credits >= maxCredits;
    const canCollectBalloon = !isFull && balloonsToday < maxBalloonsToday;

    return {
      credits,
      maxCredits,
      dailyLimit: daily,
      balloonsToday,
      maxBalloonsToday,
      isFull,
      canCollectBalloon,
    };
  } catch {
    return {
      credits: maxCredits,
      maxCredits,
      dailyLimit: daily,
      balloonsToday: 0,
      maxBalloonsToday,
      isFull: true,
      canCollectBalloon: false,
    };
  }
}

export function canCollectPookalamBalloon(): boolean {
  return getPookalamCreditState().canCollectBalloon;
}
