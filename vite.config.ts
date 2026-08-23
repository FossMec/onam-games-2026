import { defineConfig } from "vite-plus";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";

import { solidStart } from "@solidjs/start/config";
import { lazyPlugins } from "vite-plus";
import { imagetools } from "vite-imagetools";

/**
 * Refuses to produce a production bundle with no Supabase in it.
 *
 * `VITE_*` values are constant-folded at build time, so a missing one does not
 * fail the build - it silently compiles the browser client down to a single
 * `throw`, and every sign-in in production dies with "VITE_SUPABASE_URL is not
 * set". That is exactly what shipped once already: an empty `.env.production.
 * local` left behind by `vercel env pull` outranks `.env` in production mode,
 * and a `--prebuilt` deploy uploaded the result.
 *
 * A build is the last place this is cheap to catch, so catch it here. Local
 * URLs are only warned about - building against a local Supabase to test a
 * production bundle is a real thing to want.
 */
function guardPublicEnv() {
  return {
    name: "foss-onam:guard-public-env",
    apply: "build" as const,
    configResolved(config: { command: string; mode: string; env: Record<string, unknown> }) {
      if (config.mode !== "production") return;
      const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter(
        (key) => !config.env[key],
      );
      if (missing.length > 0) {
        throw new Error(
          `Production build is missing ${missing.join(" and ")}.\n` +
            `The browser bundle would ship without Supabase and every sign-in would fail.\n` +
            `Check for an empty .env.production.local (delete it - 'vercel env pull' writes ` +
            `blanks for encrypted values), or set the variables in the build environment.`,
        );
      }
      const url = String(config.env.VITE_SUPABASE_URL);
      if (url.includes("localhost") || url.includes("127.0.0.1")) {
        console.warn(
          `\n[guard-public-env] Production bundle is being built against ${url}.\n` +
            `Nothing but this machine can reach that. Do not deploy this build.\n`,
        );
      }
    },
  };
}

export default defineConfig({
  server: {
    port: Number(process.env.PORT ?? 3000),
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [
    guardPublicEnv(),
    /*
     * Build-time image transforms, per import site.
     *
     * `import icon from "~/assets/x.webp?w=136&format=webp"` emits exactly a
     * 136px WebP - so each usage gets the size it actually draws at instead of
     * whatever the source happened to be. The sprite sheet alone was 31 files
     * at 192px for something never drawn above 68.
     *
     * Only reaches *imported* assets, which is why `src/assets` exists at all.
     * Anything addressed by a runtime string - the jigsaw artwork chosen in
     * `games.assets_json`, the og:image other servers fetch by absolute URL -
     * has no import site and stays in `public/` untouched.
     */
    imagetools({
      defaultDirectives: (url) =>
        // Everything is WebP unless a call site says otherwise; without a
        // default, an import with no query passes through untransformed.
        url.searchParams.has("format")
          ? url.searchParams
          : new URLSearchParams({ format: "webp", ...Object.fromEntries(url.searchParams) }),
    }),
    tailwindcss(),
    solidStart({ middleware: "./src/middleware/index.ts" }),
    nitro({
      preset: "cloudflare-pages",
      compressPublicAssets: true,
      prerender: {
        routes: ["/terms", "/privacy", "/comics", "/design", "/letter"],
        crawlLinks: false,
      },
      cloudflare: {
        pages: {
          routes: {
            exclude: [
              "/terms",
              "/privacy",
              "/comics",
              "/design",
              "/letter",
              "/_build/*",
              "/images/*",
              "/sprites/*",
              "/fonts/*",
              "/cursors/*",
              "/previous-pookalam/*",
              "/favicon.ico",
              "/favicon-*.png",
              "/favicon.png",
              "/icon-*.png",
              "/apple-touch-icon.png",
              "/logo.svg",
              "/foss-logo-original.webp",
              "/site.webmanifest",
              "/robots.txt",
              "/sitemap.xml",
            ],
          },
        },
      },
      routeRules: {
        // SSR pages with personalized shell (me, ban, access) must NEVER be
        // public cached — SSR serializes `getShellData()` (full PublicUser incl.
        // whatsapp) into HTML payload, and `public, s-maxage` would serve User A's
        // HTML to User B. See src/server/shell.ts:77 / src/server/auth/service.ts:214.
        "/": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
            vary: "Cookie",
          },
        },
        "/games/**": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
            vary: "Cookie",
          },
        },
        "/leaderboard/**": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
            vary: "Cookie",
          },
        },
        "/onboarding": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
            vary: "Cookie",
          },
        },
        "/code-a-pookalam/**": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
            vary: "Cookie",
          },
        },
        // Server RPC & API endpoints: NEVER cache at the edge
        "/_server/**": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
          },
        },
        "/api/**": {
          headers: {
            "cache-control": "private, no-cache, no-store, must-revalidate",
          },
        },
        // Static content pages: Prerendered / 24h Edge Caching
        "/comics/**": {
          headers: {
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        },
        "/design/**": {
          headers: {
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        },
        "/letter/**": {
          headers: {
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        },
        "/terms": {
          headers: {
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        },
        "/privacy": {
          headers: {
            "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        },

        // Static Assets
        "/_build/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
        "/images/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
        "/sprites/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
        "/fonts/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
        "/cursors/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
        "/previous-pookalam/**": {
          headers: { "cache-control": "public, max-age=31536000, immutable" },
        },
        // Stable shell assets
        "/favicon.ico": {
          headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
        },
        "/favicon-*.png": {
          headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
        },
        "/icon-*.png": {
          headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
        },
        "/apple-touch-icon.png": {
          headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
        },
        "/logo.svg": {
          headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
        },
        "/foss-logo-original.webp": {
          headers: { "cache-control": "public, max-age=604800, stale-while-revalidate=86400" },
        },
        "/site.webmanifest": {
          headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
        },
      },
    }),
  ]),
});
