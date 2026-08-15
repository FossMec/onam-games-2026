import { defineConfig } from "vite-plus";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";

import { solidStart } from "@solidjs/start/config";
import { lazyPlugins } from "vite-plus";

/**
 * Refuses to produce a production bundle with no Supabase in it.
 *
 * `VITE_*` values are constant-folded at build time, so a missing one does not
 * fail the build — it silently compiles the browser client down to a single
 * `throw`, and every sign-in in production dies with "VITE_SUPABASE_URL is not
 * set". That is exactly what shipped once already: an empty `.env.production.
 * local` left behind by `vercel env pull` outranks `.env` in production mode,
 * and a `--prebuilt` deploy uploaded the result.
 *
 * A build is the last place this is cheap to catch, so catch it here. Local
 * URLs are only warned about — building against a local Supabase to test a
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
            `Check for an empty .env.production.local (delete it — 'vercel env pull' writes ` +
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
    tailwindcss(),
    solidStart({ middleware: "./src/middleware/index.ts" }),
    nitro({
      vercel: {
        functions: {
          regions: ["sin1"],
          /*
           * Ten seconds, against a platform default of 300.
           *
           * Nothing here is slow on purpose: a page render is one or two
           * in-region queries and finishes in about a second, and the heaviest
           * request in the app — re-simulating a Maveli Jump run to verify it —
           * is milliseconds of arithmetic. Anything still running at ten
           * seconds is stuck, not working.
           *
           * The default matters because a *stuck* request is billed for the
           * whole 300s. One unreachable database turned every page view into a
           * five-minute invocation, which burns a free-tier month in an
           * afternoon while showing the visitor a spinner the entire time.
           * Failing at ten seconds costs 1/30th as much and, with the read
           * fallbacks in place, still renders the page.
           */
          maxDuration: 10,
        },
      },
    }),
  ]),
});
