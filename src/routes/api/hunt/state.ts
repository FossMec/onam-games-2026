import { requireCurrentUser } from "~/server/auth/service";
import { HttpError } from "~/server/errors";
import { getUserHuntState } from "~/server/games/hunt/service";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const state = await getUserHuntState(user.id);
    return Response.json(state);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
