/**
 * Lightweight health check endpoint for UptimeRobot / Uptime monitors.
 * Zero database queries, ultra-fast response, 2-byte payload.
 */
export function GET() {
  return new Response("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
