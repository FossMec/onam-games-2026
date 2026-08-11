import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { collectFingerprint } from "~/lib/fingerprint";
import { getBrowserSupabase } from "~/lib/supabase-client";
import { completeSignIn } from "~/server/auth/actions";

export default function AuthCallback() {
  const navigate = useNavigate();

  onMount(async () => {
    const { data, error } = await getBrowserSupabase().auth.getSession();
    if (error || !data.session) {
      navigate("/auth/signin", { replace: true });
      return;
    }
    const session = data.session;
    try {
      const fingerprint = await collectFingerprint();
      const result = await completeSignIn(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at ?? undefined,
        },
        fingerprint,
      );
      navigate(result.onboardingCompleted ? "/" : "/onboarding", {
        replace: true,
      });
    } catch {
      navigate("/auth/signin", { replace: true });
    }
  });

  return (
    <main>
      <p>Signing you in…</p>
    </main>
  );
}
