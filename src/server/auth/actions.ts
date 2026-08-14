import { query } from "@solidjs/router";
import { ZodError } from "zod";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { completeOAuthSignIn, getCurrentUser, signOut, type OAuthSession } from "./service";
import { completeOnboarding, uploadAvatar, type OnboardingInput } from "./onboarding";
import { acknowledgeWarning, banMessage, describeBan } from "./bans";

export const getMe = query(async () => {
  "use server";
  return getCurrentUser();
}, "users:me");

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
