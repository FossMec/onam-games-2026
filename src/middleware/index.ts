import { createMiddleware } from "@solidjs/start/middleware";
import { getRequestEvent } from "solid-js/web";

export default createMiddleware([
  async (event, next) => {
    const requestEvent = getRequestEvent();
    if (requestEvent) {
      requestEvent.locals.requestId = crypto.randomUUID();
    }
    event.res.headers.set("X-Content-Type-Options", "nosniff");
    event.res.headers.set("X-Frame-Options", "DENY");
    event.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    event.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return next();
  },
]);
