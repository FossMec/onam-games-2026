import { useSession } from "@solidjs/start/http";
import { getSupabaseAnon } from "~/server/supabase/client";
import { getServerEnv } from "~/server/env";
import type { OAuthSession } from "./service";

/**
 * Google sign-in run from our own domain.
 *
 * Supabase's `signInWithOAuth` sends the browser to
 * `<project-ref>.supabase.co/auth/v1/authorize`, and Google's consent screen
 * prints the host of whatever `redirect_uri` it was handed - so a player is
 * asked to sign in to "zejotrgmxdawjlurukpg.supabase.co", which is ugly and,
 * to someone who has been told to watch for phishing, alarming.
 *
 * That host cannot be changed from our side. GoTrue builds the outbound
 * authorize URL server-side from its own configured external URL, so putting a
 * reverse proxy in front of Supabase rewrites the wrong direction: it changes
 * what the browser sends *in*, never what GoTrue stamps *out*. Unlocking that
 * field is exactly what Supabase's paid custom-domain add-on sells.
 *
 * So we run the authorization-code exchange ourselves, against our own OAuth
 * client whose redirect URI is on our own domain, and hand the resulting ID
 * token to Supabase through the `id_token` grant. Supabase mints the same
 * session it always would: the Google `sub` is unchanged, so it resolves to the
 * same Supabase user, and accounts created through the old redirect flow keep
 * working. Everything downstream of `completeOAuthSignIn` is untouched.
 *
 * ROLLBACK
 *
 * The two credentials below are the switch. Unset them, redeploy, and the app
 * falls back to `signInWithOAuth` - no code change. This is deliberate: it is
 * the sign-in path for a live event, and a broken one locks out every player.
 */

const OAUTH_COOKIE = "og_oauth";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Ten minutes covers a slow reader on the Google screen and little else. This
 * cookie carries a live Supabase session between the callback route and the
 * page that finishes sign-in, so it is worth stealing - it should not outlive
 * the redirect that needs it.
 */
const PENDING_MAX_AGE_S = 60 * 10;

/**
 * Non-sensitive scopes only, and that is a constraint rather than a default:
 * the moment anything here needs Google's review, the app is back in the
 * verification queue, which cannot be cleared from a custom deployment domain.
 */
const SCOPES = "openid email profile";

interface PendingOAuth {
  /** CSRF token, echoed by Google in `state`. */
  state?: string;
  /** PKCE code verifier. */
  verifier?: string;
  /** Supabase session, once exchanged, waiting for the page to claim it. */
  session?: OAuthSession;
}

export function isDirectGoogleEnabled(): boolean {
  return !!getServerEnv("GOOGLE_OAUTH_CLIENT_ID") && !!getServerEnv("GOOGLE_OAUTH_CLIENT_SECRET");
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = getServerEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getServerEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
}

function getSecret(): string {
  const secret = getServerEnv("SESSION_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

/**
 * Sealed, HttpOnly, and separate from `og_session`.
 *
 * Kept apart from the real auth cookie so that a half-finished sign-in can
 * never touch a live one - clearing this on failure must not sign out the
 * person who was already signed in.
 */
async function pendingCookie() {
  const isLocal = getServerEnv("NODE_ENV") === "development" && !getServerEnv("CF_PAGES");
  return useSession<PendingOAuth>({
    name: OAUTH_COOKIE,
    password: getSecret(),
    maxAge: PENDING_MAX_AGE_S,
    cookie: {
      httpOnly: true,
      secure: !isLocal,
      // `lax` still arrives on Google's top-level GET redirect back to us,
      // which is the only cross-site navigation this cookie has to survive.
      sameSite: "lax",
      path: "/",
    },
  });
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * PKCE on top of a confidential client.
 *
 * The client secret alone would satisfy Google here. The verifier costs three
 * lines and closes the case where an authorization code leaks out of the
 * redirect - through a referrer header, a shared browser, a logging proxy -
 * before we redeem it.
 */
async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function redirectUri(origin: string): string {
  const configured = getServerEnv("AUTH_ORIGIN", "VITE_SITE_URL", "SITE_URL");
  let base = (configured ? configured : origin).trim();
  // Reverse proxies like Render/Cloudflare forward requests over HTTP internally.
  // Force https:// for all non-local hosts so Google OAuth receives the matching https redirect URI.
  if (!base.includes("localhost") && !base.includes("127.0.0.1")) {
    base = base.replace(/^http:\/\//i, "https://");
  }
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

/** Where to send the browser, having stashed the CSRF and PKCE material. */
export async function beginGoogleAuth(origin: string): Promise<string> {
  const { clientId } = credentials();
  const state = randomToken();
  const { verifier, challenge } = await pkce();

  const cookie = await pendingCookie();
  // Drops any session left by an abandoned attempt along with it.
  await cookie.update({ state, verifier });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    /*
     * `select_account` rather than the default. One device is one player here,
     * and silently reusing whichever Google account the browser last touched is
     * how somebody ends up entered under their sibling's name.
     */
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

interface GoogleTokens {
  id_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Redeems the code and parks the resulting Supabase session in the cookie.
 *
 * Throws with a message meant for a player, not a log line - every one of these
 * ends up rendered on the sign-in page.
 */
export async function finishGoogleAuth(url: URL, origin: string): Promise<void> {
  const { clientId, clientSecret } = credentials();
  const cookie = await pendingCookie();
  const expected = cookie.data.state;
  const verifier = cookie.data.verifier;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Clear before doing anything else: whether this succeeds or fails, the
  // one-shot material must not be replayable.
  await cookie.clear();

  if (!code) throw new Error("Google did not return an authorization code.");
  if (!expected || !verifier) {
    throw new Error("Your sign-in took too long and expired. Please try again.");
  }
  if (state !== expected) {
    throw new Error("Sign-in could not be verified. Please start again from this site.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = (await response.json()) as GoogleTokens;
  if (!response.ok || !tokens.id_token) {
    console.error("[google] token exchange failed:", tokens.error, tokens.error_description);
    throw new Error("Google would not complete the sign-in. Please try again.");
  }

  /*
   * No nonce is sent to Google, so the ID token carries no nonce claim and
   * Supabase has nothing to check. The replay window a nonce would close is
   * already shut here: the code was redeemed server-to-server over TLS with a
   * client secret, and `state` covered the leg through the browser.
   *
   * For Supabase to accept this token at all, our client ID has to be listed
   * under the Google provider's authorized client IDs - otherwise the audience
   * is one it does not recognise and it rejects the grant.
   */
  const { data, error } = await getSupabaseAnon().auth.signInWithIdToken({
    provider: "google",
    token: tokens.id_token,
  });
  if (error || !data.session) {
    console.error("[google] signInWithIdToken failed:", error);
    throw new Error("We could not start your session. Please try again.");
  }

  const fresh = await pendingCookie();
  await fresh.update({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ?? undefined,
    },
  });
}

/** Reads the parked session exactly once. */
export async function takePendingSession(): Promise<OAuthSession | null> {
  const cookie = await pendingCookie();
  const session = cookie.data.session ?? null;
  await cookie.clear();
  return session;
}
