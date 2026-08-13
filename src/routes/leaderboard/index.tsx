import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { getGames } from "~/server/games/actions";
import { getDaily, getGlobal } from "~/server/leaderboard/actions";
import type { DailyBoard, DailyEntry, GlobalEntry } from "~/server/leaderboard/service";

const POLL_MS = 120_000;
const REFRESH_COOLDOWN_MS = 10_000;

function formatDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Each board renders in its own units — a time game shows seconds, Maveli Jump
 * shows height, the hunt shows when you finished. Points are the only number
 * that crosses between games, and they live on the global board.
 */
function formatMetric(entry: DailyEntry): string {
  switch (entry.metric) {
    case "score":
      return `${(entry.score ?? 0).toLocaleString("en-IN")} m`;
    case "fcfs":
      return formatClock(entry.submittedAt);
    default:
      return entry.durationMs != null ? formatDuration(entry.durationMs) : "—";
  }
}

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "");

export default function Leaderboard() {
  const games = createAsync(() => getGames());
  const [view, setView] = createSignal<string | null>(null);
  const [version, setVersion] = createSignal(0);
  const [lastRefresh, setLastRefresh] = createSignal(Date.now());
  const [now, setNow] = createSignal(Date.now());

  const daily = createAsync<DailyBoard | null>(() => {
    void version();
    const id = view();
    return id === null ? Promise.resolve(null) : getDaily(id);
  });

  const global = createAsync<{ entries: GlobalEntry[]; myEntry: GlobalEntry | null } | null>(() => {
    void version();
    return view() === null ? getGlobal() : Promise.resolve(null);
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

  const isEmpty = () =>
    view() === null ? global()?.entries.length === 0 : daily()?.entries.length === 0;

  return (
    <main class="container space-y-6 py-8">
      <Title>Leaderboard — FOSS Onam Games</Title>

      <section class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p class="text-muted">
          {view() === null
            ? "Every game is worth up to 1050 points, awarded by where you finished in that day's field — so a fast jigsaw and a high jump are worth the same thing."
            : "Ranked in this game's own units. Points are awarded from your rank when the day closes."}
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

      <Show when={daily() && !daily()!.settled && daily()!.entries.length > 0}>
        <p class="rounded border border-line bg-surface-3 px-3 py-2 text-sm text-muted">
          Still live — points shown are a projection and settle when the day closes.
        </p>
      </Show>

      <Show when={isEmpty()}>
        <p class="text-muted">No results yet.</p>
      </Show>

      {/* ------------------------------------------------------------ daily */}
      <Show when={daily()}>
        <div class="card overflow-x-auto">
          <table>
            <thead>
              <tr class="text-left text-xs uppercase tracking-widest text-muted">
                <th class="py-2">#</th>
                <th class="py-2">Player</th>
                <th class="py-2">College</th>
                <Show when={daily()!.metric === "score"}>
                  <th class="py-2 text-right">Runs</th>
                </Show>
                <th class="py-2 text-right">{daily()!.metricLabel}</th>
                <th class="py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              <For each={daily()!.entries}>
                {(entry) => (
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
                    <Show when={daily()!.metric === "score"}>
                      <td class="py-2 text-right font-mono tabular-nums text-muted">
                        {entry.attemptsUsed}
                      </td>
                    </Show>
                    <td class="py-2 text-right font-mono tabular-nums">{formatMetric(entry)}</td>
                    <td
                      class={`py-2 text-right font-mono tabular-nums ${
                        entry.isProvisional ? "text-muted" : "text-brand"
                      }`}
                    >
                      {entry.points}
                      {entry.isProvisional ? "*" : ""}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={daily()!.myEntry && !daily()!.entries.some((e) => e.isMe)}>
          <p class="text-sm text-muted">
            Your rank: <span class="font-semibold text-ink">#{daily()!.myEntry!.rank}</span> of{" "}
            {daily()!.fieldSize} · {formatMetric(daily()!.myEntry!)} ·{" "}
            <span class="font-semibold text-ink">{daily()!.myEntry!.points} pts</span>
          </p>
        </Show>
      </Show>

      {/* ----------------------------------------------------------- global */}
      <Show when={global()}>
        <div class="card overflow-x-auto">
          <table>
            <thead>
              <tr class="text-left text-xs uppercase tracking-widest text-muted">
                <th class="py-2">#</th>
                <th class="py-2">Player</th>
                <th class="py-2">College</th>
                <th class="py-2 text-right">Games</th>
                <th class="py-2 text-right">Streak</th>
                <th class="py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              <For each={global()!.entries}>
                {(entry) => (
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
                    <td class="py-2 text-muted">{entry.college ?? "-"}</td>
                    <td class="py-2 text-right font-mono tabular-nums">{entry.gamesCompleted}</td>
                    <td class="py-2 text-right font-mono tabular-nums text-muted">
                      {entry.streakBonus > 0 ? `+${entry.streakBonus}` : "—"}
                    </td>
                    <td class="py-2 text-right font-mono tabular-nums font-semibold text-brand">
                      {entry.totalPoints}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={global()!.myEntry && !global()!.entries.some((e) => e.isMe)}>
          <p class="text-sm text-muted">
            Your rank: <span class="font-semibold text-ink">#{global()!.myEntry!.rank}</span> ·{" "}
            <span class="font-semibold text-ink">{global()!.myEntry!.totalPoints} pts</span>
          </p>
        </Show>
      </Show>
    </main>
  );
}
