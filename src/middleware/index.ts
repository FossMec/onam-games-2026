import { createMiddleware } from "@solidjs/start/middleware";
import { getRequestEvent } from "solid-js/web";
import { isIpBlocked } from "~/server/anti-cheat/ip";
import { getRequestMeta } from "~/server/request";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Extensions that are only ever served off disk, never rendered.
 *
 * If a request for one of these reaches the router, the static handler has
 * already failed to find it - the file does not exist.
 */
const ASSET_EXT =
  /\.(webp|png|jpe?g|gif|avif|svg|ico|woff2?|ttf|otf|css|mjs|map|txt|xml|webmanifest)$/i;

export default createMiddleware([
  async (event, next) => {
    const start = performance.now();
    const requestEvent = getRequestEvent();
    if (requestEvent) {
      requestEvent.locals.requestId = crypto.randomUUID();
    }

    event.res.headers.set("X-Content-Type-Options", "nosniff");
    event.res.headers.set("X-Frame-Options", "DENY");
    event.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    event.res.headers.set("Permissions-Policy", "microphone=(), geolocation=()");

    const path = new URL(event.req.url).pathname;

    /*
     * A missing asset must not cost a rendered page.
     *
     * Anything reaching the router with an asset extension has already missed
     * the static handler, so the file is gone - but the catch-all route was
     * happily rendering the full 404 *page* for it: 27 KB of HTML, with the
     * shell, the fonts and the nav, served with `content-type: text/html` to
     * something that asked for a `.webp`. One stale image URL in the database
     * was costing more bandwidth than the image would have.
     *
     * The browser cannot use it either way, so send nothing.
     */
    if (event.req.method === "GET" && ASSET_EXT.test(path)) {
      return new Response(null, {
        status: 404,
        headers: {
          // Briefly cacheable: a broken URL tends to be on a page that is
          // about to be re-rendered, and re-asking every time helps nobody.
          "cache-control": "public, max-age=60",
        },
      });
    }

    const isSensitive =
      path.startsWith("/api") || path.startsWith("/auth") || MUTATING.has(event.req.method);

    if (isSensitive) {
      const { ip } = getRequestMeta();
      if (ip) {
        const blocked = await isIpBlocked(ip);
        if (blocked) {
          return new Response("Forbidden", { status: 403 });
        }
      }
    }

    try {
      return await next();
    } finally {
      const duration = Math.round((performance.now() - start) * 100) / 100;
      event.res.headers.set("Server-Timing", `total;dur=${duration}`);
    }
  },
]);
