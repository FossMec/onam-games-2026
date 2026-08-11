import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { getGames } from "~/server/games/actions";
import { getDaily, getGlobal } from "~/server/leaderboard/actions";
import type { DailyEntry, GlobalEntry } from "~/server/leaderboard/service";

const POLL_MS = 120_000;
const REFRESH_COOLDOWN_MS = 10_000;

function formatDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "");

export default function Leaderboard() {
  const games = createAsync(() => getGames());
  const [view, setView] = createSignal<string | null>(null);
  const [version, setVersion] = createSignal(0);
  const [lastRefresh, setLastRefresh] = createSignal(Date.now());
  const [now, setNow] = createSignal(Date.now());

  const data = createAsync<{
    entries: DailyEntry[] | GlobalEntry[];
    myEntry: DailyEntry | GlobalEntry | null;
  }>(() => {
    void version();
    if (view() === null) return getGlobal();
    return getDaily(view()!);
  });

  createEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") {
        setVersion((v) => v + 1);
      }
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => {
      clearInterval(timer);
      clearInterval(tick);
    });
  });

  const cooldownLeft = () => Math.max(0, REFRESH_COOLDOWN_MS - (now() - lastRefresh()));

  const refresh = () => {
    if (cooldownLeft() > 0) return;
    setLastRefresh(Date.now());
    setNow(Date.now());
    setVersion((v) => v + 1);
  };

  const selectedGame = () =>
    view() === null ? null : (games()?.find((g) => g.id === view()) ?? null);

  return (
    <main class="container space-y-6 py-8">
      <Title>Leaderboard — FOSS Onam Games</Title>

      <section class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p class="text-muted">
          Daily boards rank by fastest time (ties broken by who started first). Global ranks by
          games completed, then percentile-weighted time.
        </p>
      </section>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={view() ?? ""}
          onChange={(e) => setView(e.currentTarget.value || null)}
          class="input sm:w-auto"
        >
          <option value="">Global</option>
          <For each={games()}>
            {(game) => (
              <option value={game.id}>
                Day {game.day} — {game.title}
              </option>
            )}
          </For>
        </select>
        <button type="button" onClick={refresh} disabled={cooldownLeft() > 0} class="btn-ghost">
          {cooldownLeft() > 0 ? `Refresh in ${Math.ceil(cooldownLeft() / 1000)}s` : "Refresh"}
        </button>
      </div>

      <Show when={selectedGame()?.status === "closed"}>
        <p class="rounded border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          This game has ended. Late submissions count for the global board only.
        </p>
      </Show>

      <Show when={data()?.entries.length === 0}>
        <p class="text-muted">No results yet.</p>
      </Show>

      <div class="card overflow-x-auto">
        <table>
          <thead>
            <tr class="text-left text-xs uppercase tracking-widest text-muted">
              <th class="py-2">#</th>
              <th class="py-2">Player</th>
              <th class="py-2">College</th>
              <th class="py-2 text-right">{view() === null ? "Games" : "Time"}</th>
              <Show when={view() === null}>
                <th class="py-2 text-right">Score</th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <For each={data()?.entries ?? []}>
              {(raw) => {
                const entry = raw as DailyEntry & GlobalEntry;
                return (
                  <tr class={`border-t border-line ${entry.isMe ? "bg-brand-soft" : ""}`}>
                    <td class="py-2">
                      <span class="inline-flex min-w-6 items-center gap-1">
                        {medal(entry.rank)}
                        {entry.rank}
                      </span>
                    </td>
                    <td class="py-2 font-medium">
                      {entry.name}
                      {entry.isMe && <span class="text-xs text-brand"> · you</span>}
                    </td>
                    <td class="py-2 text-muted">
                      {entry.college ?? "-"}
                      {entry.branch ? ` · ${entry.branch}` : ""}
                    </td>
                    <td class="py-2 text-right font-mono tabular-nums">
                      {entry.durationMs != null
                        ? formatDuration(entry.durationMs)
                        : entry.gamesCompleted}
                    </td>
                    <Show when={view() === null}>
                      <td class="py-2 text-right font-mono tabular-nums text-muted">
                        {entry.weightedTotal != null ? entry.weightedTotal.toFixed(3) : ""}
                      </td>
                    </Show>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={data()?.myEntry && !data()!.entries.some((e) => e.isMe)}>
        <p class="text-sm text-muted">
          Your rank: <span class="font-semibold text-ink">#{data()!.myEntry!.rank}</span>
        </p>
      </Show>
    </main>
  );
}
