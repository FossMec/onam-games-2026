import { createMiddleware } from "@solidjs/start/middleware";
import { getRequestEvent } from "solid-js/web";
import { isIpBlocked } from "~/server/anti-cheat/ip";
import { getRequestMeta } from "~/server/request";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default createMiddleware([
  async (event, next) => {
    const requestEvent = getRequestEvent();
    if (requestEvent) {
      requestEvent.locals.requestId = crypto.randomUUID();
    }

    event.res.headers.set("X-Content-Type-Options", "nosniff");
    event.res.headers.set("X-Frame-Options", "DENY");
    event.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    event.res.headers.set("Permissions-Policy", "microphone=(), geolocation=()");

    const path = new URL(event.req.url).pathname;
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

    return next();
  },
]);
