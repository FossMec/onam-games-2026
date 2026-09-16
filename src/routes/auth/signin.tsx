import { Title } from "@solidjs/meta";
import { createAsync, revalidate, useSearchParams } from "@solidjs/router";
import { CircleAlert, LoaderCircle, Sparkles, UserRound, UserRoundCheck } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { getBrowserSupabase } from "~/lib/supabase-client";
import { authMode } from "~/lib/queries";
import { memeImage } from "~/lib/img";
import { joinAsGuestAction } from "~/server/auth/actions";

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = createSignal(false);
  const [joining, setJoining] = createSignal(false);
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal<string>("");

  /*
   * Falls back to the Supabase/Google flow until the server answers. Someone
   * who taps the instant the page paints gets the old flow, which works - the
   * open mode is a server decision, and the server is the only thing that can
   * make it true.
   */
  const mode = createAsync(() => authMode(), {
    initialValue: { direct: false, openToAll: false },
  });

  const urlError = () => searchParams.error_description || searchParams.error || error();

  /** Where to land after signing in - a same-origin path from `?next=`, or home. */
  const next = () => {
    const raw = searchParams.next;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" && value.startsWith("/") ? value : "/";
  };

  const signIn = async () => {
    try {
      setLoading(true);
      setError("");

      /*
       * Our own domain on Google's consent screen. A full navigation rather
       * than fetch: the whole point is that Google's page is reached from our
       * origin, and the route sets a sealed cookie on the way out.
       */
      if (mode().direct) {
        window.location.href = "/api/auth/google/start";
        return;
      }

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

  const join = async (event: SubmitEvent) => {
    event.preventDefault();
    if (joining()) return;
    setJoining(true);
    setError("");
    try {
      const result = await joinAsGuestAction(name());
      if (!result.ok) {
        setError(result.error);
        setJoining(false);
        return;
      }
      // The session cookie is HttpOnly and was just set, so a full navigation
      // is the honest way to pick it up everywhere (shell, nav, game APIs).
      await Promise.all([revalidate("shell"), revalidate("viewer")]);
      window.location.assign(next());
    } catch (err: unknown) {
      console.error("[SignIn] join failed:", err);
      setError((err as Error)?.message || "Could not join just now. Please try again.");
      setJoining(false);
    }
  };

  return (
    <main class="container flex min-h-[70vh] flex-col items-center justify-center py-8 gap-4">
      <Title>Sign in - Onam Games</Title>

      <img
        src={memeImage("need-more-tokens.webp")}
        alt="Need More Tokens Meme"
        // Intrinsic size, so the browser reserves the box from the aspect ratio
        // instead of collapsing to zero height and shoving the card down when
        // the meme finally lands.
        width={512}
        height={511}
        loading="eager"
        class="w-36 sm:w-44 h-auto object-contain select-none animate-bounce-short"
      />

      <div
        class="relative w-full max-w-sm overflow-hidden rounded-lg p-6 sm:p-8 text-center"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <Confetti seed="signin" count={8} animate />
        <div class="art-over space-y-4">
          <p class="wordmark text-3xl" data-text="ONAM GAMES">
            ONAM GAMES
          </p>

          <Show
            when={mode().openToAll}
            fallback={
              <>
                <p class="font-semibold text-sm sm:text-base">
                  A week of daily games. Sign in to get on the leaderboard and win daily cash
                  prizes.
                </p>

                <Show when={urlError()}>
                  <div class="p-3 rounded-lg bg-[var(--paper)] border-2 border-[var(--pop-red)] text-left flex items-start gap-2 text-xs text-[var(--pop-red)] font-bold">
                    <CircleAlert size={16} class="shrink-0 mt-0.5" />
                    <div class="min-w-0">
                      <p class="font-extrabold">Sign in problem:</p>
                      <p class="font-medium mt-0.5 opacity-90 break-words">{urlError()}</p>
                    </div>
                  </div>
                </Show>

                {/*
                  Above the button, not below it.
                  The account someone picks is bound to this device for the whole
                  festival, and there is no undo - the only way out is an organiser
                  clearing the binding by hand. Discovering that afterwards, from an
                  error page, is a bad way to learn it, so the warning has to be read
                  before the tap rather than after it.
                */}
                <div
                  class="rounded-lg p-3 text-left flex items-start gap-2.5"
                  style={{
                    background: "var(--paper)",
                    border: "var(--ink-w) solid var(--ink)",
                    "border-left": "6px solid var(--pop-yellow)",
                  }}
                >
                  <span class="shrink-0 mt-0.5">
                    <UserRoundCheck size={17} strokeWidth={2.5} />
                  </span>
                  <div class="min-w-0 space-y-1">
                    <p class="font-black text-sm m-0">Pick the right account - you only get one.</p>
                    <p class="font-semibold text-xs leading-relaxed m-0" style={{ opacity: 0.85 }}>
                      You can't swap the google account later, and nobody else can sign in on this
                      device.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={signIn}
                  disabled={loading()}
                  class="btn-brand w-full py-2.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Show when={loading()} fallback={<span>Continue with Google</span>}>
                    <LoaderCircle size={16} class="animate-spin" />
                    <span>Redirecting to Google…</span>
                  </Show>
                </button>
                <p class="comment text-lg">
                  google will ask which account - choose carefully, it's final.
                </p>
              </>
            }
          >
            {/* Open-to-all mode: a name is the whole sign-up. */}
            <p class="font-semibold text-sm sm:text-base">
              Pick a name and play. No account, no password, no waiting.
            </p>

            <Show when={urlError()}>
              <div class="p-3 rounded-lg bg-[var(--paper)] border-2 border-[var(--pop-red)] text-left flex items-start gap-2 text-xs text-[var(--pop-red)] font-bold">
                <CircleAlert size={16} class="shrink-0 mt-0.5" />
                <div class="min-w-0">
                  <p class="font-extrabold">Could not join:</p>
                  <p class="font-medium mt-0.5 opacity-90 break-words">{urlError()}</p>
                </div>
              </div>
            </Show>

            <div
              class="rounded-lg p-3 text-left flex items-start gap-2.5"
              style={{
                background: "var(--paper)",
                border: "var(--ink-w) solid var(--ink)",
                "border-left": "6px solid var(--pop-teal)",
              }}
            >
              <span class="shrink-0 mt-0.5">
                <Sparkles size={17} strokeWidth={2.5} />
              </span>
              <div class="min-w-0 space-y-1">
                <p class="font-black text-sm m-0">This is the name on the leaderboard.</p>
                <p class="font-semibold text-xs leading-relaxed m-0" style={{ opacity: 0.85 }}>
                  It stays on this device, so come back with the same browser to keep your runs.
                </p>
              </div>
            </div>

            <form onSubmit={join} class="space-y-3 text-left">
              <label for="guest-name" class="sr-only">
                Your name
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-3 text-[var(--ink-soft)]">
                  <UserRound size={16} strokeWidth={2.5} />
                </span>
                <input
                  id="guest-name"
                  type="text"
                  required
                  minlength={2}
                  maxlength={40}
                  autocomplete="nickname"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="Your name"
                  class="input pl-9 font-bold text-base"
                />
              </div>
              <button
                type="submit"
                disabled={joining() || name().trim().length < 2}
                class="btn-brand w-full py-2.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Show when={joining()} fallback={<span>Start playing →</span>}>
                  <LoaderCircle size={16} class="animate-spin" />
                  <span>Getting you in…</span>
                </Show>
              </button>
            </form>
            <p class="comment text-lg">no sign-in. just a name.</p>
          </Show>
        </div>
      </div>
    </main>
  );
}
