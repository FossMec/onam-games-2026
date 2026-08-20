/**
 * Canonical site origin - configurable for Cloudflare Workers.
 * VITE_SITE_URL is set in Cloudflare Pages/Workers Variables (e.g. https://onam-games.fossmec.workers.dev)
 * Falls back to the preview onrender URL for backwards compatibility.
 */
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ??
  (typeof process !== "undefined"
    ? (process.env as Record<string, string>).SITE_URL?.replace(/\/$/, "")
    : undefined) ??
  "https://onam-games.fossmec.workers.dev";

export const SITE_ORIGIN = SITE_URL;
