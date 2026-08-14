import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup, useTransition } from "solid-js";
import { Burst, Halftone } from "~/components/art/Burst";
import { SpriteIcon } from "~/components/art/SpriteIcon";
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
  const [tab, setTab] = createSignal<"daily" | "overall">("daily");
  const [selectedDay, setSelectedDay] = createSignal<number>(1);
  const [version, setVersion] = createSignal(0);
  const [lastRefresh, setLastRefresh] = createSignal(Date.now());
  const [now, setNow] = createSignal(Date.now());

  // Auto-select the live game's day when loaded
  createEffect(() => {
    const list = games();
    if (list && list.length > 0) {
      const live = list.find((g) => g.status === "live" || g.status === "tester");
      if (live) {
        setSelectedDay(live.day);
      }
    }
  });

  const selectedGame = () => games()?.find((g) => g.day === selectedDay()) ?? null;

  const [pending, startTransition] = useTransition();

  const daily = createAsync<DailyBoard | null>(() => {
    void version();
    if (tab() !== "daily") return Promise.resolve(null);
    const g = selectedGame();
    return g ? getDaily(g.id) : Promise.resolve(null);
  });

  const global = createAsync<{ entries: GlobalEntry[]; myEntry: GlobalEntry | null } | null>(() => {
    void version();
    if (tab() !== "overall") return Promise.resolve(null);
    return getGlobal();
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

  const isEmpty = () =>
    tab() === "overall"
      ? (global()?.entries.length ?? 0) === 0
      : (daily()?.entries.length ?? 0) === 0;

  const topDailyWinner = () => (daily()?.entries.length ? daily()!.entries[0] : null);
  const topGlobalWinner = () => (global()?.entries.length ? global()!.entries[0] : null);

  const prevDay = () => {
    void startTransition(() => {
      setSelectedDay((d) => (d > 1 ? d - 1 : 7));
    });
  };

  const nextDay = () => {
    void startTransition(() => {
      setSelectedDay((d) => (d < 7 ? d + 1 : 1));
    });
  };

  return (
    <main
      class="container space-y-6 py-8"
      style={{
        opacity: pending() ? 0.65 : 1,
        transition: "opacity 140ms ease-out",
      }}
    >
      <Title>Leaderboard — FOSS Onam Games</Title>

      {/* ---------------------------------------------------- Header Banner */}
      <section class="relative overflow-hidden rounded-lg p-5 sm:p-7 bg-[var(--paper-2)] border-2 border-[var(--ink)]">
        <Halftone opacity={0.12} />
        <div class="art-over flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="space-y-2 text-center sm:text-left flex-1">
            <div class="flex items-center justify-center sm:justify-start gap-2">
              <SpriteIcon name="tux-king" size={36} animate="float" interactive />
              <h1 class="text-3xl sm:text-4xl">Leaderboard</h1>
            </div>
            <p class="font-semibold text-sm sm:text-base leading-relaxed">
              {tab() === "daily"
                ? "Daily mini-game rankings and cash prize winners. Top 1 wins ₹200 every day!"
                : "Overall 7-day championship board. Every game awards up to 1050 relative points + streak bonuses."}
            </p>
          </div>
          <img
            src="/images/memes/failure-is-not-an-option.png"
            alt="Failure is not an option meme"
            class="w-32 sm:w-40 h-auto object-contain shrink-0 select-none hidden xs:block"
            style={{ filter: "drop-shadow(3px 3px 0 var(--ink))" }}
          />
        </div>
      </section>

      {/* ---------------------------------------------------- 2 Main Tabs */}
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
        <div class="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            class={`btn font-extrabold text-sm sm:text-base py-2.5 px-6 rounded-md cursor-pointer transition-all ${
              tab() === "daily" ? "btn-brand shadow-none" : "btn-ghost"
            }`}
            onClick={() => startTransition(() => setTab("daily"))}
          >
            ⚡ Daily Games
          </button>
          <button
            type="button"
            class={`btn font-extrabold text-sm sm:text-base py-2.5 px-6 rounded-md cursor-pointer transition-all ${
              tab() === "overall" ? "btn-brand shadow-none" : "btn-ghost"
            }`}
            onClick={() => startTransition(() => setTab("overall"))}
          >
            🏆 Overall Standings
          </button>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={cooldownLeft() > 0}
          class="btn-ghost text-xs sm:text-sm px-4 py-2 self-end sm:self-auto"
        >
          {cooldownLeft() > 0 ? `Refresh in ${Math.ceil(cooldownLeft() / 1000)}s` : "🔄 Refresh"}
        </button>
      </div>

      {/* ---------------------------------------------------- Daily Controls & Carousel */}
      <Show when={tab() === "daily"}>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2 flex-wrap bg-[var(--paper-2)] p-3 rounded-lg border-2 border-[var(--ink)]">
            {/* Prev / Next Day Controls */}
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={prevDay}
                class="btn-ghost px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-1 cursor-pointer"
                aria-label="Previous Day"
              >
                <span>←</span>
                <span class="font-extrabold">Prev Day</span>
              </button>
              <button
                type="button"
                onClick={nextDay}
                class="btn-ghost px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-1 cursor-pointer"
                aria-label="Next Day"
              >
                <span class="font-extrabold">Next Day</span>
                <span>→</span>
              </button>
            </div>

            {/* Current Day Label */}
            <div class="flex items-center gap-2">
              <span
                class="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full uppercase"
                style={{
                  background: "var(--pop-yellow)",
                  border: "2px solid var(--ink)",
                  "font-family": "var(--font-stack-display)",
                }}
              >
                Day {selectedDay()} of 7
              </span>
              <Show when={selectedGame()}>
                <span class="font-extrabold text-sm sm:text-base">{selectedGame()!.title}</span>
              </Show>
            </div>
          </div>

          {/* 7-Day Quick Strip */}
          <div class="grid grid-cols-4 sm:grid-cols-7 gap-2">
            <For
              each={
                games() ??
                [1, 2, 3, 4, 5, 6, 7].map((d) => ({
                  id: String(d),
                  day: d,
                  title: `Day ${d}`,
                  status: "upcoming",
                }))
              }
            >
              {(g) => {
                const isSelected = g.day === selectedDay();
                return (
                  <button
                    type="button"
                    class={`card p-2 text-center text-xs font-extrabold cursor-pointer transition-all ${
                      isSelected
                        ? "pop-teal ring-2 ring-[var(--ink)] font-bold scale-[1.02]"
                        : "bg-[var(--paper-2)] opacity-80 hover:opacity-100"
                    }`}
                    onClick={() => startTransition(() => setSelectedDay(g.day))}
                  >
                    <span>Day {g.day}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* ---------------------------------------------------- TOP #1 WINNER SHOWCASE */}
      <Show when={tab() === "daily" && topDailyWinner()}>
        {(() => {
          const top = topDailyWinner()!;
          const isSettled = daily()?.settled || selectedGame()?.status === "closed";

          return (
            <div
              class="relative overflow-hidden rounded-lg p-5 sm:p-6 text-center space-y-3 bg-[var(--pop-yellow)]"
              style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
            >
              <div class="art-over flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <Burst color="var(--pop-yellow)" seed="winner-crown" spikes={12} />
                    <SpriteIcon name="tux-king" size={54} animate="wobble" interactive />
                  </div>
                  <div class="text-center sm:text-left">
                    <span
                      class="sticker"
                      style={{ "--pop": isSettled ? "var(--pop-teal)" : "var(--pop-pink)" }}
                    >
                      {isSettled ? "👑 Day Winner (₹200 Cash)" : "⚡ Current #1 Leader"}
                    </span>
                    <h3 class="text-2xl sm:text-3xl mt-1 font-black">{top.name}</h3>
                    <p
                      class="text-xs sm:text-sm font-semibold"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {top.college ?? "Independent"} {top.branch ? `· ${top.branch}` : ""}
                    </p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-3">
                  <div class="card card-plain p-2.5 text-center min-w-[5rem]">
                    <span
                      class="text-[10px] font-extrabold uppercase"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {daily()!.metricLabel}
                    </span>
                    <p class="text-lg font-black font-mono">{formatMetric(top)}</p>
                  </div>
                  <div class="card card-plain p-2.5 text-center min-w-[5rem]">
                    <span
                      class="text-[10px] font-extrabold uppercase"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      Points
                    </span>
                    <p class="text-lg font-black font-mono">{top.points} pts</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>

      <Show when={tab() === "overall" && topGlobalWinner()}>
        {(() => {
          const top = topGlobalWinner()!;

          return (
            <div
              class="relative overflow-hidden rounded-lg p-5 sm:p-6 text-center space-y-3 bg-[var(--pop-yellow)]"
              style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
            >
              <div class="art-over flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <Burst color="var(--pop-yellow)" seed="overall-crown" spikes={12} />
                    <SpriteIcon name="maveli-laptop" size={54} animate="float" interactive />
                  </div>
                  <div class="text-center sm:text-left">
                    <span class="sticker" style={{ "--pop": "var(--pop-teal)" }}>
                      👑 Current #1 Grand Champion
                    </span>
                    <h3 class="text-2xl sm:text-3xl mt-1 font-black">{top.name}</h3>
                    <p
                      class="text-xs sm:text-sm font-semibold"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {top.college ?? "Independent"}
                    </p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-3">
                  <div class="card card-plain p-2.5 text-center min-w-[5rem]">
                    <span
                      class="text-[10px] font-extrabold uppercase"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      Games Played
                    </span>
                    <p class="text-lg font-black font-mono">{top.gamesCompleted} / 7</p>
                  </div>
                  <div class="card card-plain p-2.5 text-center min-w-[5rem]">
                    <span
                      class="text-[10px] font-extrabold uppercase"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      Total Points
                    </span>
                    <p class="text-lg font-black font-mono">{top.totalPoints} pts</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* ---------------------------------------------------- Empty State */}
      <Show when={isEmpty()}>
        <div class="card pop-yellow text-center p-6 space-y-2">
          <SpriteIcon name="octocat-garland" size={48} animate="wobble" class="mx-auto" />
          <p class="font-extrabold text-lg">No submissions yet.</p>
          <p class="comment">be the first to finish and claim the #1 spot!</p>
        </div>
      </Show>

      {/* ---------------------------------------------------- DAILY LEADERBOARD TABLE */}
      <Show when={tab() === "daily" && daily() && daily()!.entries.length > 0}>
        <div class="card overflow-x-auto p-0">
          <table class="w-full">
            <thead class="bg-[var(--paper-2)] border-b-2 border-[var(--ink)]">
              <tr class="text-left text-xs font-extrabold tracking-widest uppercase">
                <th class="py-3 px-3">#</th>
                <th class="py-3 px-3">Player</th>
                <th class="py-3 px-3">College</th>
                <Show when={daily()!.metric === "score"}>
                  <th class="py-3 px-3 text-right">Runs</th>
                </Show>
                <th class="py-3 px-3 text-right">{daily()!.metricLabel}</th>
                <th class="py-3 px-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20">
              <For each={daily()!.entries}>
                {(entry) => (
                  <tr style={{ background: entry.isMe ? "var(--pop-yellow)" : "transparent" }}>
                    <td class="py-3 px-3">
                      <RankChip rank={entry.rank} />
                    </td>
                    <td class="py-3 px-3 font-extrabold">
                      <div class="flex items-center gap-1.5">
                        <Show when={entry.rank === 1}>
                          <SpriteIcon name="tux-king" size={20} />
                        </Show>
                        <span>{entry.name}</span>
                        {entry.isMe && <span class="comment text-xs"> that's you</span>}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-xs sm:text-sm" style={{ color: "var(--ink-soft)" }}>
                      {entry.college ?? "-"}
                      {entry.branch ? ` · ${entry.branch}` : ""}
                    </td>
                    <Show when={daily()!.metric === "score"}>
                      <td
                        class="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        {entry.attemptsUsed}
                      </td>
                    </Show>
                    <td class="py-3 px-3 text-right font-mono font-bold tabular-nums text-xs sm:text-sm">
                      {formatMetric(entry)}
                    </td>
                    <td
                      class="py-3 px-3 text-right font-mono font-extrabold tabular-nums text-xs sm:text-sm"
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
          <div class="card pop-yellow p-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <SpriteIcon name="foss-mec-badge" size={28} />
              <p class="font-extrabold">
                Your Rank: #{daily()!.myEntry!.rank} of {daily()!.fieldSize}
              </p>
            </div>
            <p class="font-mono font-black text-base">
              {formatMetric(daily()!.myEntry!)} · {daily()!.myEntry!.points} pts
            </p>
          </div>
        </Show>
      </Show>

      {/* ---------------------------------------------------- OVERALL LEADERBOARD TABLE */}
      <Show when={tab() === "overall" && global() && global()!.entries.length > 0}>
        <div class="card overflow-x-auto p-0">
          <table class="w-full">
            <thead class="bg-[var(--paper-2)] border-b-2 border-[var(--ink)]">
              <tr class="text-left text-xs font-extrabold tracking-widest uppercase">
                <th class="py-3 px-3">#</th>
                <th class="py-3 px-3">Player</th>
                <th class="py-3 px-3">College</th>
                <th class="py-3 px-3 text-right">Games</th>
                <th class="py-3 px-3 text-right">Streak</th>
                <th class="py-3 px-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20">
              <For each={global()!.entries}>
                {(entry) => (
                  <tr style={{ background: entry.isMe ? "var(--pop-yellow)" : "transparent" }}>
                    <td class="py-3 px-3">
                      <RankChip rank={entry.rank} />
                    </td>
                    <td class="py-3 px-3 font-extrabold">
                      <div class="flex items-center gap-1.5">
                        <Show when={entry.rank === 1}>
                          <SpriteIcon name="maveli-laptop" size={20} />
                        </Show>
                        <span>{entry.name}</span>
                        {entry.isMe && <span class="comment text-xs"> that's you</span>}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-xs sm:text-sm" style={{ color: "var(--ink-soft)" }}>
                      {entry.college ?? "-"}
                    </td>
                    <td class="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm">
                      {entry.gamesCompleted} / 7
                    </td>
                    <td
                      class="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm"
                      style={{ color: "var(--ink-soft)" }}
                      title="Bonus for playing consecutive days"
                    >
                      {entry.streakBonus > 0 ? `+${entry.streakBonus}` : "—"}
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-extrabold tabular-nums text-xs sm:text-sm">
                      {entry.totalPoints}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={global()!.myEntry && !global()!.entries.some((e) => e.isMe)}>
          <div class="card pop-yellow p-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <SpriteIcon name="foss-mec-badge" size={28} />
              <p class="font-extrabold">Your Global Rank: #{global()!.myEntry!.rank}</p>
            </div>
            <p class="font-mono font-black text-base">{global()!.myEntry!.totalPoints} pts</p>
          </div>
        </Show>
      </Show>
    </main>
  );
}

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
