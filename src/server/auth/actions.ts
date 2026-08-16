"use server";

import { ZodError } from "zod";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { completeOAuthSignIn, getCurrentUser, signOut, type OAuthSession } from "./service";
import { isDirectGoogleEnabled, takePendingSession } from "./google";
import { completeOnboarding, uploadAvatar, type OnboardingInput } from "./onboarding";
import { acknowledgeWarning, banMessage, describeBan } from "./bans";
import { readSetting } from "~/server/settings/service";
import { readOrDegrade } from "~/server/degrade";

/**
 * The viewer, for rendering.
 *
 * Degrades to `null` - signed out - when the session cannot be read at all.
 * Every page treats a signed-out viewer as a page it can still draw, so an
 * outage costs the visitor their name in the header, not the whole site. The
 * server functions that *act* on a user call `requireCurrentUser` instead, and
 * that one still throws.
 */
export async function getMe() {
  return readOrDegrade("auth.me", null, getCurrentUser);
}

export interface AccessState {
  /** True while the site is testers-only. */
  closedBeta: boolean;
  /** Whether this visitor gets to see the site at all. */
  allowed: boolean;
  /** Signed in but not on the list - the case that needs an explanation. */
  signedIn: boolean;
}

/**
 * Who is allowed past the front door during the closed beta.
 *
 * Tester status is decided at sign-in from the `testers` email list, so this is
 * just a role read. Note that it gates the *shell*: it is a door, not a vault.
 * Everything that matters - starting an attempt, submitting a score, reading an
 * unreleased game - is already checked server-side on its own, and none of
 * those checks depend on this one.
 */
export async function getAccessState(): Promise<AccessState> {
  /*
   * The door defaults *shut* when the flag is merely absent, and *open* when
   * the database cannot answer - because without it there is no way to prove
   * anybody is a tester either, and a locked door would then mean nobody at
   * all gets in, testers included. The site behind it is the static half of
   * the landing page; the vault is untouched, since every action that matters
   * authorises itself and will fail on its own.
   *
   * This gate wraps every page, so it needs the deadline as much as the
   * fallback: a read that never answers here hangs the entire site, not one
   * section of it.
   */
  return readOrDegrade<AccessState>(
    "auth.access",
    { closedBeta: false, allowed: true, signedIn: false },
    async () => {
      // Independent reads: the flag does not depend on who is asking. Awaiting
      // them one after the other cost two serial round trips on every page.
      const [closedBeta, user] = await Promise.all([
        readSetting<boolean>("access.closed_beta", true),
        getCurrentUser(),
      ]);
      const privileged = user?.role === "tester" || user?.role === "admin";
      return {
        closedBeta,
        allowed: !closedBeta || privileged,
        signedIn: !!user,
      };
    },
  );
}

export interface BanNoticeState {
  level: number;
  needsAck: boolean;
  blocksPlay: boolean;
  until: string | null;
  message: string;
}

/**
 * Ban state for the current user, shaped for the UI.
 *
 * Mounted on every page, so it degrades to "nothing to say". The banner is a
 * reminder, not the enforcement - `assertCanPlay` is, and it re-reads the user
 * on every attempt.
 */
export async function getMyBanState(): Promise<BanNoticeState | null> {
  return readOrDegrade<BanNoticeState | null>("auth.banState", null, async () => {
    const user = await getCurrentUser();
    if (!user) return null;
    const state = describeBan(user);
    if (state.level === 0) return null;
    return {
      level: state.level,
      needsAck: state.needsAck,
      blocksPlay: state.blocksPlay,
      until: state.until?.toISOString() ?? null,
      message: banMessage(state),
    };
  });
}

export async function ackWarningAction() {
  const user = await getCurrentUser();
  if (user) await acknowledgeWarning(user.id);
}

export async function completeSignIn(
  session: OAuthSession,
  fingerprint: FingerprintSignals,
  fpVisitorId?: string | null,
) {
  try {
    return await completeOAuthSignIn(session, fingerprint, fpVisitorId);
  } catch (error) {
    console.error("[server] completeSignIn failed:", error);
    throw error;
  }
}

/**
 * Which sign-in path the button should take.
 *
 * Asked of the server rather than read from a `VITE_` flag so the two can never
 * disagree: a build-time flag that says "direct" against a deploy whose Google
 * credentials are missing is a sign-in page that cannot sign anybody in. The
 * page defaults to the Supabase redirect until this resolves, so the slow case
 * degrades to the flow that has always worked.
 */
export async function getAuthMode() {
  return { direct: isDirectGoogleEnabled() };
}

/**
 * Finishes a sign-in started at `/api/auth/google/start`.
 *
 * Same work as `completeSignIn`, except the Supabase session comes from the
 * sealed cookie the callback route parked rather than from the browser, so no
 * token is ever exposed to page JavaScript. The fingerprint still has to come
 * from the client - that is the whole reason this step exists as a round trip
 * instead of finishing inside the redirect.
 */
export async function completeDirectSignIn(
  fingerprint: FingerprintSignals,
  fpVisitorId?: string | null,
) {
  const session = await takePendingSession();
  if (!session) {
    throw new Error("Your sign-in expired before it finished. Please try again.");
  }
  try {
    return await completeOAuthSignIn(session, fingerprint, fpVisitorId);
  } catch (error) {
    console.error("[server] completeDirectSignIn failed:", error);
    throw error;
  }
}

export async function signOutAction() {
  await signOut();
}

export async function submitOnboarding(input: OnboardingInput) {
  try {
    await completeOnboarding(input);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false as const,
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    throw error;
  }
}

export async function uploadAvatarAction(dataUrl: string) {
  return uploadAvatar(dataUrl);
}
