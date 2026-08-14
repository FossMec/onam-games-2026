import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  GraduationCap,
  RefreshCw,
  Trophy,
  Zap,
} from "lucide-solid";
import { For, Show, createEffect, createSignal, onCleanup, useTransition } from "solid-js";
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
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [version, setVersion] = createSignal(0);
  const [lastRefresh, setLastRefresh] = createSignal(Date.now());
  const [now, setNow] = createSignal(Date.now());

  const currentActiveDay = () => {
    const list = games();
    if (!list || list.length === 0) return 1;

    // 1. Live or tester game right now
    const live = list.find((g) => g.status === "live" || g.status === "tester");
    if (live) return live.day;

    // 2. Most recent game that has released by date
    const now = Date.now();
    const released = list
      .filter((g) => g.releaseAt && new Date(g.releaseAt).getTime() <= now)
      .sort((a, b) => b.day - a.day);
    if (released.length > 0) return released[0].day;

    // 3. Fallback to latest closed game or Day 1
    const closed = list.filter((g) => g.status === "closed").sort((a, b) => b.day - a.day);
    if (closed.length > 0) return closed[0].day;

    return 1;
  };

  // Only show days that have released / unlocked up to current active day
  const availableDays = () => {
    const maxDay = currentActiveDay();
    return Array.from({ length: Math.max(1, maxDay) }, (_, i) => i + 1);
  };

  // Auto-select the current day's game when loaded
  createEffect(() => {
    const day = currentActiveDay();
    setSelectedDay(day);
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
    const days = availableDays();
    if (days.length <= 1) return;
    void startTransition(() => {
      setSelectedDay((d) => {
        const idx = days.indexOf(d);
        return idx > 0 ? days[idx - 1] : days[days.length - 1];
      });
    });
  };

  const nextDay = () => {
    const days = availableDays();
    if (days.length <= 1) return;
    void startTransition(() => {
      setSelectedDay((d) => {
        const idx = days.indexOf(d);
        return idx >= 0 && idx < days.length - 1 ? days[idx + 1] : days[0];
      });
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <main
      class="container space-y-4 py-6 max-w-4xl"
      style={{
        opacity: pending() ? 0.65 : 1,
        transition: "opacity 140ms ease-out",
      }}
    >
      <Title>Leaderboard — FOSS Onam Games</Title>

      {/* ---------------------------------------------------- Compact Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div class="flex items-center gap-2">
            <SpriteIcon name="tux-king" size={30} animate="float" interactive />
            <h1 class="text-2xl sm:text-3xl font-extrabold m-0">Leaderboard</h1>
          </div>
          <p class="text-xs sm:text-sm font-semibold mt-0.5" style={{ color: "var(--ink-soft)" }}>
            {tab() === "daily"
              ? "Daily mini-game results · Top 1 wins ₹200 daily"
              : "Overall 7-day championship standings · 1050 pts max/game"}
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={cooldownLeft() > 0}
          class="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={13} strokeWidth={2.5} class={pending() ? "animate-spin" : ""} />
          <span>
            {cooldownLeft() > 0 ? `Wait ${Math.ceil(cooldownLeft() / 1000)}s` : "Refresh"}
          </span>
        </button>
      </div>

      {/* ---------------------------------------------------- Unified Minimal Toolbar */}
      <div class="card card-plain p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--paper-2)]">
        {/* 2 Main Segmented Tabs */}
        <div class="inline-flex rounded-md p-1 bg-[var(--paper-3)] border-2 border-[var(--ink)] w-full sm:w-auto">
          <button
            type="button"
            class={`flex-1 sm:flex-initial text-xs sm:text-sm font-extrabold px-4 py-1.5 rounded transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              tab() === "daily"
                ? "bg-[var(--pop-teal)] text-[var(--ink)] font-black"
                : "opacity-75 hover:opacity-100"
            }`}
            onClick={() => startTransition(() => setTab("daily"))}
          >
            <Zap size={14} strokeWidth={2.5} />
            <span>Daily</span>
          </button>
          <button
            type="button"
            class={`flex-1 sm:flex-initial text-xs sm:text-sm font-extrabold px-4 py-1.5 rounded transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              tab() === "overall"
                ? "bg-[var(--pop-teal)] text-[var(--ink)] font-black"
                : "opacity-75 hover:opacity-100"
            }`}
            onClick={() => startTransition(() => setTab("overall"))}
          >
            <Trophy size={14} strokeWidth={2.5} />
            <span>Overall</span>
          </button>
        </div>

        {/* Daily Minimal Day Chips (Only showing unlocked / released dates) */}
        <Show when={tab() === "daily"}>
          <div class="flex items-center gap-1.5 flex-wrap justify-center">
            <Show when={availableDays().length > 1}>
              <button
                type="button"
                onClick={prevDay}
                class="w-7 h-7 rounded grid place-items-center bg-[var(--paper)] border border-[var(--ink-soft)]/40 hover:border-[var(--ink)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-all shrink-0"
                aria-label="Previous Day"
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
            </Show>
            <For each={availableDays()}>
              {(d) => {
                const isSel = d === selectedDay();
                return (
                  <button
                    type="button"
                    onClick={() => startTransition(() => setSelectedDay(d))}
                    class={`w-7 h-7 rounded font-extrabold text-xs grid place-items-center transition-all cursor-pointer ${
                      isSel
                        ? "bg-[var(--pop-yellow)] border-2 border-[var(--ink)] font-black scale-105"
                        : "bg-[var(--paper)] border border-[var(--ink-soft)]/40 opacity-75 hover:opacity-100"
                    }`}
                    title={`Day ${d}`}
                  >
                    {d}
                  </button>
                );
              }}
            </For>
            <Show when={availableDays().length > 1}>
              <button
                type="button"
                onClick={nextDay}
                class="w-7 h-7 rounded grid place-items-center bg-[var(--paper)] border border-[var(--ink-soft)]/40 hover:border-[var(--ink)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-all shrink-0"
                aria-label="Next Day"
              >
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </Show>
          </div>
        </Show>
      </div>

      {/* ---------------------------------------------------- Subtle Day Meta Row */}
      <Show when={tab() === "daily" && selectedGame()}>
        <div
          class="flex items-center justify-between text-xs font-bold px-1.5"
          style={{ color: "var(--ink-soft)" }}
        >
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 font-extrabold text-[var(--ink)]">
              Day {selectedDay()}: {selectedGame()!.title}
            </span>
          </div>
          <span class="badge text-[10px] py-0.5 px-2.5 uppercase font-black">
            {selectedGame()!.status === "closed" ? "Closed / Final" : selectedGame()!.status}
          </span>
        </div>
      </Show>

      {/* ---------------------------------------------------- Compact Top #1 Winner Callout */}
      <Show when={tab() === "daily" && topDailyWinner()}>
        {(() => {
          const top = topDailyWinner()!;
          const isSettled = daily()?.settled || selectedGame()?.status === "closed";

          return (
            <div class="card card-plain p-4 bg-[var(--pop-yellow)] flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <SpriteIcon name="tux-king" size={36} animate="wobble" class="shrink-0" />
                <div class="min-w-0">
                  <div class="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
                    <Show when={isSettled} fallback={<Zap size={12} strokeWidth={3} />}>
                      <Trophy size={12} strokeWidth={3} />
                    </Show>
                    <span>{isSettled ? "Day Winner · ₹200 Cash" : "#1 Leader"}</span>
                  </div>
                  <p class="font-black text-base sm:text-lg mt-1 truncate">{top.name}</p>
                </div>
              </div>
              <div class="text-right font-mono font-black text-sm sm:text-base shrink-0">
                <p>{formatMetric(top)}</p>
                <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {top.points} pts
                </p>
              </div>
            </div>
          );
        })()}
      </Show>

      <Show when={tab() === "overall" && topGlobalWinner()}>
        {(() => {
          const top = topGlobalWinner()!;

          return (
            <div class="card card-plain p-4 bg-[var(--pop-yellow)] flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <SpriteIcon name="maveli-laptop" size={36} animate="float" class="shrink-0" />
                <div class="min-w-0">
                  <div class="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
                    <Trophy size={12} strokeWidth={3} />
                    <span>#1 Grand Champion</span>
                  </div>
                  <p class="font-black text-base sm:text-lg mt-1 truncate">{top.name}</p>
                </div>
              </div>
              <div class="text-right font-mono font-black text-sm sm:text-base shrink-0">
                <p>{top.totalPoints} pts</p>
                <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {top.gamesCompleted}/7 games
                </p>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* ---------------------------------------------------- Empty State */}
      <Show when={isEmpty()}>
        <div class="card card-plain pop-yellow text-center p-8 space-y-2">
          <SpriteIcon name="octocat-garland" size={44} animate="wobble" class="mx-auto" />
          <p class="font-black text-lg">No submissions yet.</p>
          <p class="comment text-xs">be the first to finish and claim the #1 spot!</p>
        </div>
      </Show>

      {/* ---------------------------------------------------- DAILY LEADERBOARD TABLE (Standing, Name, Score) */}
      <Show when={tab() === "daily" && daily() && daily()!.entries.length > 0}>
        <div class="card card-plain p-0 overflow-hidden">
          <div
            class="bg-[var(--paper-2)] px-4 py-2.5 border-b-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider"
            style={{ color: "var(--ink-soft)" }}
          >
            <span>Rank & Player</span>
            <span class="text-right">{daily()!.metricLabel} · Points</span>
          </div>

          <div class="divide-y divide-[var(--ink-soft)]/20">
            <For each={daily()!.entries}>
              {(entry) => {
                const isExpanded = () => expandedId() === `daily-${entry.userId}`;
                return (
                  <div
                    class={`transition-colors cursor-pointer ${
                      entry.isMe ? "bg-[var(--pop-yellow)]/60" : "hover:bg-[var(--paper-2)]"
                    }`}
                    onClick={() => toggleExpand(`daily-${entry.userId}`)}
                  >
                    {/* Main Row: Standing, Name, Score */}
                    <div class="px-4 py-3 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <RankChip rank={entry.rank} />
                        <div class="min-w-0">
                          <p class="font-extrabold text-sm truncate flex items-center gap-1.5">
                            <span>{entry.name}</span>
                            {entry.isMe && <span class="comment text-[11px]">you</span>}
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center gap-3 shrink-0 text-right">
                        <div class="font-mono tabular-nums text-sm font-extrabold">
                          <span>{formatMetric(entry)}</span>
                          <span
                            class="text-xs font-semibold ml-1.5"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            ({entry.points} pts)
                          </span>
                        </div>
                        <span class="text-[var(--ink-soft)] select-none">
                          <Show
                            when={isExpanded()}
                            fallback={<ChevronDown size={15} strokeWidth={2.5} />}
                          >
                            <ChevronUp size={15} strokeWidth={2.5} />
                          </Show>
                        </span>
                      </div>
                    </div>

                    {/* Expandable Details Drawer */}
                    <Show when={isExpanded()}>
                      <div class="px-4 py-3 text-xs border-t border-[var(--ink-soft)]/15 bg-[var(--paper-3)]/70 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-1.5">
                          <GraduationCap size={14} class="shrink-0 opacity-70" />
                          <span class="font-semibold">
                            {entry.college ?? "Independent"}
                            {entry.branch ? ` · ${entry.branch}` : ""}
                          </span>
                        </div>
                        <div class="flex items-center gap-3 font-mono text-[11px] opacity-85">
                          <Show when={daily()!.metric === "score"}>
                            <span>Runs: {entry.attemptsUsed}</span>
                          </Show>
                          <span class="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {formatClock(entry.submittedAt)}
                          </span>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        <Show when={daily()!.myEntry && !daily()!.entries.some((e) => e.isMe)}>
          <div class="card pop-yellow p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <SpriteIcon name="foss-mec-badge" size={24} />
              <p class="font-extrabold text-sm">
                Your Rank: #{daily()!.myEntry!.rank} of {daily()!.fieldSize}
              </p>
            </div>
            <p class="font-mono font-black text-sm">
              {formatMetric(daily()!.myEntry!)} · {daily()!.myEntry!.points} pts
            </p>
          </div>
        </Show>
      </Show>

      {/* ---------------------------------------------------- OVERALL LEADERBOARD TABLE (Standing, Name, Score) */}
      <Show when={tab() === "overall" && global() && global()!.entries.length > 0}>
        <div class="card p-0 overflow-hidden">
          <div
            class="bg-[var(--paper-2)] px-4 py-3 border-b-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider"
            style={{ color: "var(--ink-soft)" }}
          >
            <span>Rank & Player</span>
            <span class="text-right">Total Points</span>
          </div>

          <div class="divide-y divide-[var(--ink-soft)]/20">
            <For each={global()!.entries}>
              {(entry) => {
                const isExpanded = () => expandedId() === `global-${entry.userId}`;
                return (
                  <div
                    class={`transition-colors cursor-pointer ${
                      entry.isMe ? "bg-[var(--pop-yellow)]/60" : "hover:bg-[var(--paper-2)]"
                    }`}
                    onClick={() => toggleExpand(`global-${entry.userId}`)}
                  >
                    {/* Main Row: Standing, Name, Score */}
                    <div class="px-4 py-3 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <RankChip rank={entry.rank} />
                        <div class="min-w-0">
                          <p class="font-extrabold text-sm truncate flex items-center gap-1.5">
                            <span>{entry.name}</span>
                            {entry.isMe && <span class="comment text-[11px]">you</span>}
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center gap-3 shrink-0 text-right">
                        <span class="font-mono tabular-nums text-sm font-black">
                          {entry.totalPoints} pts
                        </span>
                        <span class="text-[var(--ink-soft)] select-none">
                          <Show
                            when={isExpanded()}
                            fallback={<ChevronDown size={15} strokeWidth={2.5} />}
                          >
                            <ChevronUp size={15} strokeWidth={2.5} />
                          </Show>
                        </span>
                      </div>
                    </div>

                    {/* Expandable Details Drawer */}
                    <Show when={isExpanded()}>
                      <div class="px-4 py-3 text-xs border-t border-[var(--ink-soft)]/15 bg-[var(--paper-3)]/70 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-1.5">
                          <GraduationCap size={14} class="shrink-0 opacity-70" />
                          <span class="font-semibold">{entry.college ?? "Independent"}</span>
                        </div>
                        <div class="flex items-center gap-3 font-mono text-[11px] opacity-85">
                          <span>Games: {entry.gamesCompleted}/7</span>
                          <span>
                            Streak Bonus: {entry.streakBonus > 0 ? `+${entry.streakBonus}` : "None"}
                          </span>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        <Show when={global()!.myEntry && !global()!.entries.some((e) => e.isMe)}>
          <div class="card pop-yellow p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <SpriteIcon name="foss-mec-badge" size={24} />
              <p class="font-extrabold text-sm">Your Global Rank: #{global()!.myEntry!.rank}</p>
            </div>
            <p class="font-mono font-black text-sm">{global()!.myEntry!.totalPoints} pts</p>
          </div>
        </Show>
      </Show>
    </main>
  );
}

function RankChip(props: { rank: number }) {
  return (
    <span
      class="inline-grid place-items-center font-mono font-extrabold tabular-nums text-xs"
      style={{
        "min-width": "1.75rem",
        padding: "0.15rem 0.4rem",
        background: rankPop(props.rank),
        border: props.rank <= 3 ? "var(--ink-w) solid var(--ink)" : "1px solid var(--ink-soft)",
        "border-radius": "999px",
      }}
    >
      {props.rank}
    </span>
  );
}
