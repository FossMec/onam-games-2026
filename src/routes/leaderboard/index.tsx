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
    <main>
      <Title>Leaderboard — FOSS Onam Games</Title>
      <h1>Leaderboard</h1>

      <div>
        <select value={view() ?? ""} onChange={(e) => setView(e.currentTarget.value || null)}>
          <option value="">Global</option>
          <For each={games()}>
            {(game) => (
              <option value={game.id}>
                Day {game.day} — {game.title}
              </option>
            )}
          </For>
        </select>
        <button type="button" onClick={refresh} disabled={cooldownLeft() > 0}>
          {cooldownLeft() > 0 ? `Refresh in ${Math.ceil(cooldownLeft() / 1000)}s` : "Refresh"}
        </button>
      </div>

      <Show when={selectedGame()?.status === "closed"}>
        <p>This game has ended. Late submissions count for the global board only.</p>
      </Show>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>College</th>
            <th>{view() === null ? "Games" : "Time"}</th>
            <th>{view() === null ? "Score" : ""}</th>
          </tr>
        </thead>
        <tbody>
          <For each={data()?.entries ?? []}>
            {(raw) => {
              const entry = raw as DailyEntry & GlobalEntry;
              return (
                <tr style={entry.isMe ? "font-weight: bold" : undefined}>
                  <td>{entry.rank}</td>
                  <td>{entry.name}</td>
                  <td>
                    {entry.college ?? "-"}
                    {entry.branch ? ` · ${entry.branch}` : ""}
                  </td>
                  <td>
                    {entry.durationMs != null
                      ? formatDuration(entry.durationMs)
                      : entry.gamesCompleted}
                  </td>
                  <td>{entry.weightedTotal != null ? entry.weightedTotal.toFixed(3) : ""}</td>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>

      <Show when={data()?.myEntry && !data()!.entries.some((e) => e.isMe)}>
        <p>Your rank: #{data()!.myEntry!.rank}</p>
      </Show>
    </main>
  );
}
