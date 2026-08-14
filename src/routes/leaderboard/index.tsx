import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup, useTransition } from "solid-js";
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

/**
 * Rank colour. Emoji medals were the first attempt and looked wrong against
 * ink-drawn everything else — a flat pop fill in a bordered chip is the same
 * information in the page's own language.
 */
const rankPop = (rank: number): string =>
  rank === 1
    ? "var(--pop-yellow)"
    : rank === 2
      ? "var(--paper-3)"
      : rank === 3
        ? "var(--pop-red)"
        : "transparent";

export default function Leaderboard() {
  const games = createAsync(() => getGames());
  const [view, setView] = createSignal<string | null>(null);
  const [version, setVersion] = createSignal(0);
  const [lastRefresh, setLastRefresh] = createSignal(Date.now());
  const [now, setNow] = createSignal(Date.now());

  /*
   * Every board switch and every poll goes through this transition.
   *
   * `createAsync` returns `undefined` while it refetches, so a bare
   * `setView(id)` made `<Show when={daily()}>` fall through, unmount the whole
   * table, and mount it again a moment later — the screen "blinked". The
   * two-minute poll did exactly the same thing, just less visibly.
   *
   * A transition holds the current render until the new data has resolved, so
   * the old board stays on screen and is simply swapped. `pending` dims it, so
   * something clearly happened without the layout ever collapsing.
   */
  const [pending, startTransition] = useTransition();
  const show = (id: string | null) => void startTransition(() => setView(id));

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
        void startTransition(() => setVersion((v) => v + 1));
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
    void startTransition(() => setVersion((v) => v + 1));
  };

  const selectedGame = () =>
    view() === null ? null : (games()?.find((g) => g.id === view()) ?? null);

  const isEmpty = () =>
    view() === null ? global()?.entries.length === 0 : daily()?.entries.length === 0;

  return (
    <main
      class="container space-y-6 py-8"
      style={{
        // Opacity only: no layout property may change here, or the fix for the
        // blink would reintroduce a smaller one.
        opacity: pending() ? 0.55 : 1,
        transition: "opacity 140ms ease-out",
      }}
    >
      <Title>Leaderboard — FOSS Onam Games</Title>

      <section class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="space-y-2 flex-1">
          <h1 class="rule">Leaderboard</h1>
          <p class="font-semibold">
            {view() === null
              ? "Every game is worth up to 1050 points, awarded by where you finished in that day's field — so a fast jigsaw and a high jump are worth the same thing."
              : "Ranked in this game's own units. Points are awarded from your rank when the day closes."}
          </p>
        </div>
        <img
          src="/images/memes/failure-is-not-an-option.png"
          alt="Failure is not an option meme"
          class="w-32 sm:w-40 h-auto object-contain shrink-0 select-none hidden xs:block"
          style={{ filter: "drop-shadow(3px 3px 0 var(--ink))" }}
        />
      </section>

      {/*
        Day chips rather than a dropdown. Seven options is right at the edge
        where a select stops being faster than tapping, and the chips also show
        which days exist at a glance — which a collapsed select cannot.
      */}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="badge"
          style={{
            "--pop": view() === null ? "var(--pop-teal)" : "var(--paper-2)",
            cursor: "pointer",
          }}
          onClick={() => show(null)}
        >
          Overall
        </button>
        <For each={games()}>
          {(game) => (
            <button
              type="button"
              class="badge"
              style={{
                "--pop": view() === game.id ? "var(--pop-teal)" : "var(--paper-2)",
                cursor: "pointer",
              }}
              onClick={() => show(game.id)}
            >
              Day {game.day}
            </button>
          )}
        </For>
        <button
          type="button"
          onClick={refresh}
          disabled={cooldownLeft() > 0}
          class="btn-ghost ml-auto"
        >
          {cooldownLeft() > 0 ? `Refresh in ${Math.ceil(cooldownLeft() / 1000)}s` : "Refresh"}
        </button>
      </div>

      <Show when={selectedGame()}>
        <p class="font-extrabold" style={{ "font-family": "var(--font-stack-display)" }}>
          Day {selectedGame()!.day} — {selectedGame()!.title}
        </p>
      </Show>

      <Show when={selectedGame()?.status === "closed"}>
        <p class="comment">that one's over. late submissions still count for the overall board.</p>
      </Show>

      <Show when={daily() && !daily()!.settled && daily()!.entries.length > 0}>
        <p class="comment">still live — positions can still move.</p>
      </Show>

      <Show when={isEmpty()}>
        <div class="card pop-yellow text-center">
          <p class="font-extrabold">Nobody has finished yet.</p>
          <p class="comment">be the first. it counts for exactly as much as being the last.</p>
        </div>
      </Show>

      {/* ------------------------------------------------------------ daily */}
      <Show when={daily()}>
        <div class="card overflow-x-auto">
          <table>
            <thead>
              <tr class="text-left text-xs font-extrabold tracking-widest uppercase">
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
                  <tr style={{ background: entry.isMe ? "var(--pop-yellow)" : "transparent" }}>
                    <td class="py-2">
                      <RankChip rank={entry.rank} />
                    </td>
                    <td class="py-2 font-extrabold">
                      {entry.name}
                      {entry.isMe && <span class="comment"> that's you</span>}
                    </td>
                    <td class="py-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                      {entry.college ?? "-"}
                      {entry.branch ? ` · ${entry.branch}` : ""}
                    </td>
                    <Show when={daily()!.metric === "score"}>
                      <td
                        class="py-2 text-right font-mono tabular-nums"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        {entry.attemptsUsed}
                      </td>
                    </Show>
                    <td class="py-2 text-right font-mono font-bold tabular-nums">
                      {formatMetric(entry)}
                    </td>
                    <td
                      class="py-2 text-right font-mono font-extrabold tabular-nums"
                      style={{ color: entry.isProvisional ? "var(--ink-soft)" : "var(--ink)" }}
                      title={entry.isProvisional ? "Not final while the day is still running" : ""}
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
          <div class="card pop-yellow">
            <p class="font-extrabold">
              You: #{daily()!.myEntry!.rank} of {daily()!.fieldSize} ·{" "}
              {formatMetric(daily()!.myEntry!)} · {daily()!.myEntry!.points} pts
            </p>
          </div>
        </Show>
      </Show>

      {/* ----------------------------------------------------------- global */}
      <Show when={global()}>
        <div class="card overflow-x-auto">
          <table>
            <thead>
              <tr class="text-left text-xs font-extrabold tracking-widest uppercase">
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
                  <tr style={{ background: entry.isMe ? "var(--pop-yellow)" : "transparent" }}>
                    <td class="py-2">
                      <RankChip rank={entry.rank} />
                    </td>
                    <td class="py-2 font-extrabold">
                      {entry.name}
                      {entry.isMe && <span class="comment"> that's you</span>}
                    </td>
                    <td class="py-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                      {entry.college ?? "-"}
                    </td>
                    <td class="py-2 text-right font-mono tabular-nums">{entry.gamesCompleted}</td>
                    <td
                      class="py-2 text-right font-mono tabular-nums"
                      style={{ color: "var(--ink-soft)" }}
                      title="Bonus for playing consecutive days"
                    >
                      {entry.streakBonus > 0 ? `+${entry.streakBonus}` : "—"}
                    </td>
                    <td class="py-2 text-right font-mono font-extrabold tabular-nums">
                      {entry.totalPoints}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={global()!.myEntry && !global()!.entries.some((e) => e.isMe)}>
          <div class="card pop-yellow">
            <p class="font-extrabold">
              You: #{global()!.myEntry!.rank} · {global()!.myEntry!.totalPoints} pts
            </p>
          </div>
        </Show>
      </Show>
    </main>
  );
}

/**
 * Rank marker. The top three get a filled chip; everyone else gets the number
 * on paper, so the podium reads instantly without three more colours competing
 * down the whole table.
 */
function RankChip(props: { rank: number }) {
  return (
    <span
      class="inline-grid place-items-center font-mono font-extrabold tabular-nums"
      style={{
        "min-width": "2rem",
        padding: "0.1rem 0.4rem",
        background: rankPop(props.rank),
        border: props.rank <= 3 ? "var(--ink-w) solid var(--ink)" : "none",
        "border-radius": "999px",
      }}
    >
      {props.rank}
    </span>
  );
}
