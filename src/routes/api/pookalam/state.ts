import type { APIEvent } from "@solidjs/start/server";
import { getCurrentUser } from "~/server/auth/service";
import { getCollabState } from "~/server/pookalam/collab";

export async function GET(_event: APIEvent) {
  try {
    const user = await getCurrentUser();
    const state = await getCollabState(!!user);
    return Response.json(state);
  } catch (err: any) {
    return Response.json({ error: err?.message || "Failed to load state" }, { status: 500 });
  }
}
