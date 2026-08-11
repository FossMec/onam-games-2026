import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { createAsync } from "@solidjs/router";
import { Show } from "solid-js";
import { getMe, signOutAction } from "~/server/auth/actions";

export default function Home() {
  const navigate = useNavigate();
  const me = createAsync(() => getMe());

  const signOut = async () => {
    await signOutAction();
    navigate("/", { replace: true });
  };

  return (
    <main>
      <Title>FOSS Onam Games</Title>
      <h1>FOSS Onam Games</h1>
      <p>A week of daily logic games. Fastest solves win.</p>

      <Show when={!me()}>
        <a href="/auth/signin">Sign in with Google</a>
      </Show>

      <Show when={me()}>
        <p>Hi, {me()!.name}</p>
        <p>
          Streak: {me()!.streakCount} · Best: {me()!.bestStreak}
        </p>
        <Show when={!me()!.onboardingCompleted}>
          <a href="/onboarding">Complete your profile</a>
        </Show>
        <Show when={me()!.onboardingCompleted}>
          <a href="/leaderboard">Leaderboard</a>
        </Show>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </Show>
    </main>
  );
}
