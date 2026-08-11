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
    <main>
      <Title>Sign in — FOSS Onam Games</Title>
      <h1>FOSS Onam Games</h1>
      <p>Sign in with Google to play.</p>
      <button type="button" onClick={signIn}>
        Continue with Google
      </button>
    </main>
  );
}
