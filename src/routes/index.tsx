import { Title } from "@solidjs/meta";
import { createAsync, useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { getMe, signOutAction } from "~/server/auth/actions";
import { getGames } from "~/server/games/actions";

const statusStyle: Record<string, string> = {
  live: "bg-ok/10 text-ok border-ok/30",
  tester: "bg-warn/10 text-warn border-warn/30",
  upcoming: "bg-surface-3 text-muted border-line",
  closed: "bg-surface-3 text-muted border-line",
};

const statusLabel: Record<string, string> = {
  live: "Live now",
  tester: "Tester access",
  upcoming: "Coming soon",
  closed: "Ended",
};

export default function Home() {
  const navigate = useNavigate();
  const me = createAsync(() => getMe());
  const games = createAsync(() => getGames());

  const signOut = async () => {
    await signOutAction();
    navigate("/", { replace: true });
  };

  return (
    <main class="container space-y-8 py-8">
      <Title>FOSS Onam Games</Title>

      <section class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">FOSS Onam Games</h1>
        <p class="text-muted">A week of daily logic games. Fastest solves win. One attempt each.</p>
      </section>

      <Show when={!me()}>
        <div class="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold">Sign in to play</p>
            <p class="text-sm text-muted">Google sign-in. We take your streaks seriously.</p>
          </div>
          <a href="/auth/signin" class="btn-brand">
            Sign in with Google
          </a>
        </div>
      </Show>

      <Show when={me()}>
        <div class="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold">Hi, {me()!.name}</p>
            <p class="text-sm text-muted">
              Streak: {me()!.streakCount} · Best: {me()!.bestStreak}
              {me()!.role === "admin" ? " · Admin" : ""}
            </p>
          </div>
          <div class="flex gap-2">
            <Show when={!me()!.onboardingCompleted}>
              <a href="/onboarding" class="btn-ghost">
                Complete profile
              </a>
            </Show>
            <a href="/leaderboard" class="btn-ghost">
              Leaderboard
            </a>
            <button type="button" onClick={signOut} class="btn-ghost">
              Sign out
            </button>
          </div>
        </div>
      </Show>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold">This week's games</h2>

        <Show when={!games()}>
          <p class="text-muted">Loading schedule…</p>
        </Show>
        <Show when={games() && games()!.length === 0}>
          <p class="text-muted">No games scheduled yet.</p>
        </Show>

        <div class="grid gap-3 sm:grid-cols-2">
          <For each={games()}>
            {(game) => (
              <article class="card space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-medium uppercase tracking-widest text-muted">
                    Day {game.day}
                  </span>
                  <span
                    class={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle[game.status] ?? statusStyle.upcoming}`}
                  >
                    {statusLabel[game.status] ?? game.status}
                  </span>
                </div>
                <a
                  href={`/games/${game.slug}`}
                  class="block text-lg font-semibold text-brand hover:underline"
                >
                  {game.title}
                </a>
                <p class="text-sm capitalize text-muted">{game.gameType}</p>

                <Show when={game.status === "upcoming" && game.hint}>
                  <p class="text-sm italic text-muted">Hint: {game.hint}</p>
                </Show>

                <div class="text-sm">
                  <Show
                    when={game.status === "upcoming" && game.releaseAt}
                    fallback={
                      <span class="text-muted">
                        {game.status === "live" ? "Play now →" : game.status}
                      </span>
                    }
                  >
                    <span class="text-muted">Releases in </span>
                    <span class="font-mono tabular-nums">
                      <Countdown target={new Date(game.releaseAt!)} />
                    </span>
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>
    </main>
  );
}
