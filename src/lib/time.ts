/**
 * Adaptive duration formatting for game timers.
 *
 * - >= 1h  → `Xh Ym` (e.g. 2h 13m)
 * - >= 1m  → `Xm Ys` (e.g. 4m 12s)
 * - < 1m   → `Xs`    (e.g. 42s)
 *
 * Seconds are integer-floored to keep the value stable next to a ticking
 * countdown. Callers that need sub-second (leaderboard tenths) should use
 * `formatDurationTenths` directly.
 */

export function formatAdaptiveDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }
  return `${totalSec}s`;
}

export function formatAdaptiveClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  }
  return `${s}s`;
}
