/**
 * Adaptive duration formatting for game timers.
 *
 * - >= 1h  → `Xh Ym` (e.g. 2h 13m)
 * - >= 1m  → `Xm Ys` (e.g. 4m 12s)
 * - < 1m   → `S.cc s` with 2 decimal places (e.g. 42.35s)
 *
 * Below 1 minute the leaderboard (and every other consumer) now shows
 * seconds + centiseconds (`SS.cc s`, e.g. `12.34s`) so sub-minute time
 * games can be ranked visually at 10ms precision. Callers that
 * need the old integer-second view should floor before calling.
 */

export function formatAdaptiveDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "0s";
  const totalMs = Math.floor(ms);
  const totalSec = Math.floor(totalMs / 1000);
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
  // 2 decimal places (centiseconds) — round to nearest 10ms
  const totalCs = Math.round(totalMs / 10);
  const sec = Math.floor(totalCs / 100);
  const cs = totalCs % 100;
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }
  return `${sec}.${String(cs).padStart(2, "0")}s`;
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
