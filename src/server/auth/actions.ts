"use server";

import { ZodError } from "zod";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { completeOAuthSignIn, getCurrentUser, signOut, type OAuthSession } from "./service";
import { completeOnboarding, uploadAvatar, type OnboardingInput } from "./onboarding";
import { acknowledgeWarning, banMessage, describeBan } from "./bans";
import { getSetting } from "~/server/settings/service";

export async function getMe() {
  return getCurrentUser();
}

export interface AccessState {
  /** True while the site is testers-only. */
  closedBeta: boolean;
  /** Whether this visitor gets to see the site at all. */
  allowed: boolean;
  /** Signed in but not on the list — the case that needs an explanation. */
  signedIn: boolean;
}

/**
 * Who is allowed past the front door during the closed beta.
 *
 * Tester status is decided at sign-in from the `testers` email list, so this is
 * just a role read. Note that it gates the *shell*: it is a door, not a vault.
 * Everything that matters — starting an attempt, submitting a score, reading an
 * unreleased game — is already checked server-side on its own, and none of
 * those checks depend on this one.
 */
export async function getAccessState(): Promise<AccessState> {
  const closedBeta = await getSetting<boolean>("access.closed_beta", true);
  const user = await getCurrentUser();
  const privileged = user?.role === "tester" || user?.role === "admin";
  return {
    closedBeta,
    allowed: !closedBeta || privileged,
    signedIn: !!user,
  };
}

/** Ban state for the current user, shaped for the UI. */
export async function getMyBanState() {
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
  return completeOAuthSignIn(session, fingerprint, fpVisitorId);
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
