import type { APIEvent } from "@solidjs/start/server";
import { finishGoogleAuth, isDirectGoogleEnabled } from "~/server/auth/google";

/**
 * Where Google returns.
 *
 * Redeems the code and parks the Supabase session in a sealed cookie, then
 * hands off to `/auth/callback`, which collects the device fingerprint and
 * finishes sign-in. The tokens never touch the URL or any JavaScript - the
 * page claims them through a server function that reads the cookie.
 */
function bounce(to: string): Response {
  return new Response(null, { status: 302, headers: { location: to } });
}

export async function GET({ request }: APIEvent) {
  const url = new URL(request.url);

  // Credentials pulled mid-flight, or someone poking the URL by hand. Either
  // way the player has nothing to act on, so they get the working button back
  // rather than the name of a missing environment variable.
  if (!isDirectGoogleEnabled()) return bounce("/auth/signin");

  // The player pressed cancel, or Google refused outright.
  const denied = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (denied) {
    return bounce(`/auth/signin?error=${encodeURIComponent(denied)}`);
  }

  try {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
    const origin = `${proto}://${host}`;
    await finishGoogleAuth(url, origin);
    return bounce("/auth/callback?direct=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed. Please try again.";
    console.error("[google] callback failed:", error);
    return bounce(`/auth/signin?error=${encodeURIComponent(message)}`);
  }
}
