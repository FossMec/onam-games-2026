import { Title } from "@solidjs/meta";
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
      <div class="card w-full max-w-sm space-y-6 p-8 text-center">
        <div>
          <h1 class="text-2xl font-bold">FOSS ✕ Onam Games</h1>
          <p class="mt-2 text-sm text-muted">
            A week of daily logic games. Sign in with Google to join the leaderboard.
          </p>
        </div>
        <button type="button" onClick={signIn} class="btn-brand w-full">
          Continue with Google
        </button>
        <p class="text-xs text-muted">
          One account per device. Cheaters get ratioed on the leaderboard.
        </p>
      </div>
    </main>
  );
}
