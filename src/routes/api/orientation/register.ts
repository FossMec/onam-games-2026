import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { HttpError } from "~/server/errors";
import { registerOrientationParticipant } from "~/server/orientation/service";

const schema = z.object({
  name: z.string().min(2).max(80),
  batch: z.string().min(1).max(20),
});

export async function POST({ request }: APIEvent) {
  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
    const participant = await registerOrientationParticipant(body.data.name, body.data.batch);
    return Response.json({ participant });
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
