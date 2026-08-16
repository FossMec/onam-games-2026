import type { APIEvent } from "@solidjs/start/server";
import {
  deleteCollabMessage,
  getCollabMessages,
  postCollabMessage,
} from "~/server/pookalam/comments";

export async function GET() {
  try {
    const data = await getCollabMessages();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Failed to fetch messages" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const result = await postCollabMessage(body?.message);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, reason: err?.message || "Failed to post message" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function DELETE(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const result = await deleteCollabMessage(body?.messageId);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, reason: err?.message || "Failed to delete message" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
