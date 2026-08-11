"use server";

import { ZodError } from "zod";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { completeOAuthSignIn, getCurrentUser, signOut, type OAuthSession } from "./service";
import { completeOnboarding, uploadAvatar, type OnboardingInput } from "./onboarding";

export async function getMe() {
  return getCurrentUser();
}

export async function completeSignIn(session: OAuthSession, fingerprint: FingerprintSignals) {
  return completeOAuthSignIn(session, fingerprint);
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
