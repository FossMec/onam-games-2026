import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { AlertCircle, Loader2 } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { getBrowserSupabase } from "~/lib/supabase-client";

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>("");

  const urlError = () => searchParams.error_description || searchParams.error || error();

  const signIn = async () => {
    try {
      setLoading(true);
      setError("");
      const origin = window.location.origin;
      const { error: oauthError } = await getBrowserSupabase().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: { access_type: "offline" },
        },
      });
      if (oauthError) {
        console.error("[SignIn] signInWithOAuth failed:", oauthError);
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error("[SignIn] Error launching OAuth:", err);
      setError((err as Error)?.message || "Failed to start Google sign in.");
      setLoading(false);
    }
  };

  return (
    <main class="container flex min-h-[70vh] flex-col items-center justify-center py-8 gap-4">
      <Title>Sign in — FOSS Onam Games</Title>

      <img
        src="/images/memes/need-more-tokens.webp"
        alt="Need More Tokens Meme"
        class="w-36 sm:w-44 h-auto object-contain select-none animate-bounce-short"
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

          <Show when={urlError()}>
            <div class="p-3 rounded-lg bg-[var(--paper)] border-2 border-[var(--pop-red)] text-left flex items-start gap-2 text-xs text-[var(--pop-red)] font-bold">
              <AlertCircle size={16} class="shrink-0 mt-0.5" />
              <div class="min-w-0">
                <p class="font-extrabold">Sign in problem:</p>
                <p class="font-medium mt-0.5 opacity-90 break-words">{urlError()}</p>
              </div>
            </div>
          </Show>

          <button
            type="button"
            onClick={signIn}
            disabled={loading()}
            class="btn-brand w-full py-2.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Show when={loading()} fallback={<span>Continue with Google</span>}>
              <Loader2 size={16} class="animate-spin" />
              <span>Redirecting to Google…</span>
            </Show>
          </button>
          <p class="comment text-xs">one account per person. play nice.</p>
        </div>
      </div>
    </main>
  );
}
