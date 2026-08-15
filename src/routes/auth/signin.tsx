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
    <main class="container flex min-h-[70vh] flex-col items-center justify-center py-8 gap-4">
      <Title>Sign in — FOSS Onam Games</Title>

      <img
        src="/images/memes/need-more-tokens.webp"
        alt="Need More Tokens Meme"
        class="w-36 sm:w-44 h-auto object-contain select-none animate-bounce-short"
        style={{ filter: "drop-shadow(3px 3px 0 var(--ink))" }}
      />

      <div
        class="relative w-full max-w-sm overflow-hidden rounded-lg p-6 sm:p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="signin" count={8} animate />
        <div class="art-over space-y-4">
          <p class="wordmark text-3xl" data-text="FOSS ONAM">
            FOSS ONAM
          </p>
          <p class="font-semibold text-sm sm:text-base">
            A week of daily games. Sign in to get on the leaderboard and win daily cash prizes.
          </p>
          <button type="button" onClick={signIn} class="btn-brand w-full py-2.5">
            Continue with Google
          </button>
          <p class="comment text-xs">one account per person. play nice.</p>
        </div>
      </div>
    </main>
  );
}
