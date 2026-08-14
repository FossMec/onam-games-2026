import { Title } from "@solidjs/meta";
import { Confetti } from "~/components/art/Confetti";
import { getBrowserSupabase } from "~/lib/supabase-client";

export default function SignIn() {
  const signIn = async () => {
    const origin = window.location.origin;
    await getBrowserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: { access_type: "offline" },
      },
    });
  };

  return (
    <main class="container flex min-h-[70vh] items-center justify-center py-8">
      <Title>Sign in — FOSS Onam Games</Title>

      <div
        class="relative w-full max-w-sm overflow-hidden rounded-lg p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="signin" count={8} animate />
        <div class="art-over space-y-5">
          <p class="wordmark text-3xl" data-text="FOSS ONAM">
            FOSS ONAM
          </p>
          <p class="font-semibold">A week of daily games. Sign in to get on the leaderboard.</p>
          <button type="button" onClick={signIn} class="btn-brand w-full">
            Continue with Google
          </button>
          <p class="comment">one account per person. play nice.</p>
        </div>
      </div>
    </main>
  );
}
