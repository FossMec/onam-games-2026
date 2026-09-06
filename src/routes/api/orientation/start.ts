import { HttpError } from "~/server/errors";
import { startOrientationAttempt } from "~/server/orientation/service";
import { checkRateLimit } from "~/server/anti-cheat/ratelimit";
import { getRequestMeta } from "~/server/request";

export async function POST() {
  try {
    const meta = getRequestMeta();
    const rate = await checkRateLimit({
      key: `orientation-start:${meta.ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (rate.unavailable)
      return Response.json({ error: "Rate limiter unavailable" }, { status: 503 });
    if (!rate.success) return Response.json({ error: "Too many requests" }, { status: 429 });
    const result = await startOrientationAttempt();
    return Response.json(result);
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
