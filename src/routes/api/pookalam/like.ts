import type { APIEvent } from "@solidjs/start/server";
import { toggleCollabMessageLike } from "~/server/pookalam/comments";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const result = await toggleCollabMessageLike(body?.messageId);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, reason: err?.message || "Failed to like message" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
