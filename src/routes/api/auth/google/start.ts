import type { APIEvent } from "@solidjs/start/server";
import { beginGoogleAuth, isDirectGoogleEnabled } from "~/server/auth/google";

/** Sends the player to Google's consent screen, from our own domain. */
function bounce(to: string): Response {
  return new Response(null, { status: 302, headers: { location: to } });
}

function backToSignIn(message: string): Response {
  return bounce(`/auth/signin?error=${encodeURIComponent(message)}`);
}

export async function GET({ request }: APIEvent) {
  const origin = new URL(request.url).origin;
  // Not configured is not an error worth showing anyone: the sign-in page only
  // routes here when the server said it was on, so this is a deploy that lost
  // its credentials mid-flight. Send them back to the working button.
  if (!isDirectGoogleEnabled()) return bounce("/auth/signin");
  try {
    return bounce(await beginGoogleAuth(origin));
  } catch (error) {
    console.error("[google] could not start sign-in:", error);
    return backToSignIn("Could not reach Google. Please try again.");
  }
}
