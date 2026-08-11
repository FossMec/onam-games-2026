import { Title } from "@solidjs/meta";
import { createAsync, useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { getMe, signOutAction } from "~/server/auth/actions";
import { getGames } from "~/server/games/actions";

export default function Home() {
  const navigate = useNavigate();
  const me = createAsync(() => getMe());
  const games = createAsync(() => getGames());

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

      <section>
        <h2>This week's games</h2>
        <Show when={!games()}>
          <p>Loading schedule…</p>
        </Show>
        <Show when={games() && games()!.length === 0}>
          <p>No games scheduled yet.</p>
        </Show>
        <For each={games()}>
          {(game) => (
            <article>
              <h3>
                Day {game.day} — <a href={`/games/${game.slug}`}>{game.title}</a>
              </h3>
              <p>{game.gameType}</p>
              <Show when={game.status === "upcoming" && game.hint}>
                <p>Hint: {game.hint}</p>
              </Show>
              <p>
                <Show
                  when={game.status === "upcoming" && game.releaseAt}
                  fallback={game.status === "live" ? "Live now" : game.status}
                >
                  Releases in <Countdown target={new Date(game.releaseAt!)} />
                </Show>
              </p>
            </article>
          )}
        </For>
      </section>
    </main>
  );
}
