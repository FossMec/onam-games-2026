import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FlaskConical,
  GraduationCap,
  Lock,
  RefreshCw,
  Trophy,
} from "lucide-solid";
import { For, Show, createEffect, createSignal, onCleanup, useTransition } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { getMe } from "~/server/auth/actions";
import { getGames } from "~/server/games/actions";
import { getDaily } from "~/server/leaderboard/actions";
import type { DailyBoard, DailyEntry } from "~/server/leaderboard/service";

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
  const me = createAsync(() => getMe());
  const games = createAsync(() => getGames());
  const [selectedDay, setSelectedDay] = createSignal<number>(1);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [version, setVersion] = createSignal(0);
  const [lastRefresh, setLastRefresh] = createSignal(Date.now());
  const [now, setNow] = createSignal(Date.now());

  const isTesterOrAdmin = () => me()?.role === "tester" || me()?.role === "admin";

  const currentActiveDay = () => {
    const list = games();
    if (!list || list.length === 0) return 1;

    // 1. Live game right now
    const live = list.find((g) => g.status === "live");
    if (live) return live.day;

    // 2. Tester game if tester/admin
    if (isTesterOrAdmin()) {
      const testerGame = list.find((g) => g.status === "tester");
      if (testerGame) return testerGame.day;
    }

    // 3. Most recent released game
    const nowTime = Date.now();
    const released = list
      .filter((g) => g.releaseAt && new Date(g.releaseAt).getTime() <= nowTime)
      .sort((a, b) => b.day - a.day);
    if (released.length > 0) return released[0].day;

    // 4. Latest closed game or Day 1
    const closed = list.filter((g) => g.status === "closed").sort((a, b) => b.day - a.day);
    if (closed.length > 0) return closed[0].day;

    return 1;
  };

  // All 7 festival days are always navigable
  const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

  // Auto-select the current day's game when loaded
  createEffect(() => {
    const day = currentActiveDay();
    setSelectedDay(day);
  });

  const selectedGame = () => games()?.find((g) => g.day === selectedDay()) ?? null;

  const [pending, startTransition] = useTransition();

  const daily = createAsync<DailyBoard | null>(() => {
    void version();
    const g = selectedGame();
    return g ? getDaily(g.id) : Promise.resolve(null);
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

  const isEmpty = () => (daily()?.entries.length ?? 0) === 0;
  const topDailyWinner = () => (daily()?.entries.length ? daily()!.entries[0] : null);

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

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const isLockedForPlayer = () => {
    const g = selectedGame();
    if (!g) return false;
    if (isTesterOrAdmin()) return false;
    return g.status === "upcoming" || g.status === "tester";
  };

  return (
    <main
      class="container space-y-4 py-6 max-w-4xl"
      style={{
        opacity: pending() ? 0.65 : 1,
        transition: "opacity 140ms ease-out",
      }}
    >
      <Title>Daily Leaderboard — FOSS Onam Games</Title>

      {/* Header Banner */}
      <div
        class="relative overflow-hidden rounded-lg px-4 py-5"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="leaderboard-hero" count={8} animate />
        <div class="art-over flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="flex items-center gap-2">
              <SpriteIcon name="tux-king" size={30} animate="float" interactive />
              <h1 class="text-2xl sm:text-3xl font-extrabold m-0">Daily Leaderboard</h1>
            </div>
            <p class="text-xs sm:text-sm font-semibold mt-0.5" style={{ color: "var(--ink-soft)" }}>
              Daily mini-game results & rankings · Top 1 wins ₹200 daily prize
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
      </div>

      {/* ---------------------------------------------------- Day Selection Bar with Left/Right Arrows */}
      <div class="card card-plain p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--paper-2)]">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase tracking-wider text-[var(--ink-soft)]">
            Select Day:
          </span>

          <div class="flex items-center gap-1.5 flex-wrap justify-center">
            {/* Left Arrow Button */}
            <button
              type="button"
              onClick={prevDay}
              class="w-7 h-7 rounded grid place-items-center bg-[var(--paper)] border-2 border-[var(--ink)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-all shrink-0 active:scale-95 shadow-xs"
              aria-label="Previous Day"
              title="Previous Day"
            >
              <ChevronLeft size={16} strokeWidth={3} />
            </button>

            {/* Day 1 through Day 7 Buttons */}
            <For each={ALL_DAYS}>
              {(d) => {
                const isSel = () => d === selectedDay();
                return (
                  <button
                    type="button"
                    onClick={() => startTransition(() => setSelectedDay(d))}
                    class={`w-8 h-8 rounded font-black text-xs grid place-items-center transition-all cursor-pointer ${
                      isSel()
                        ? "bg-[var(--pop-teal)] text-[var(--ink)] border-2 border-[var(--ink)] scale-105 shadow-xs"
                        : "bg-[var(--paper)] border border-[var(--ink-soft)]/50 opacity-80 hover:opacity-100 hover:bg-[var(--paper-3)]"
                    }`}
                    title={`Day ${d}`}
                  >
                    Day {d}
                  </button>
                );
              }}
            </For>

            {/* Right Arrow Button */}
            <button
              type="button"
              onClick={nextDay}
              class="w-7 h-7 rounded grid place-items-center bg-[var(--paper)] border-2 border-[var(--ink)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-all shrink-0 active:scale-95 shadow-xs"
              aria-label="Next Day"
              title="Next Day"
            >
              <ChevronRight size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Selected Game Title & Status Badge */}
        <Show when={selectedGame()}>
          <div class="flex items-center gap-2">
            <span class="text-xs font-black truncate max-w-[200px] text-[var(--ink)]">
              {selectedGame()!.title}
            </span>
            <Show when={selectedGame()!.status === "tester" && isTesterOrAdmin()}>
              <span class="badge text-[10px] py-0.5 px-2 bg-[var(--pop-teal)] text-[var(--ink)] font-black uppercase inline-flex items-center gap-1">
                <FlaskConical size={11} />
                Tester Preview
              </span>
            </Show>
            <Show when={selectedGame()!.status !== "tester" || !isTesterOrAdmin()}>
              <span class="badge text-[10px] py-0.5 px-2 uppercase font-black">
                {selectedGame()!.status === "closed" ? "Closed / Final" : selectedGame()!.status}
              </span>
            </Show>
          </div>
        </Show>
      </div>

      {/* ---------------------------------------------------- Tester Notice (When Viewing Tester Runs) */}
      <Show
        when={
          isTesterOrAdmin() &&
          (selectedGame()?.status === "tester" || selectedGame()?.status === "upcoming")
        }
      >
        <div class="card p-3 bg-[var(--pop-teal)]/20 border-2 border-[var(--ink)] flex items-center justify-between text-xs font-bold">
          <div class="flex items-center gap-2">
            <FlaskConical size={16} class="text-[var(--ink)] shrink-0" />
            <span>
              Tester Access: Showing runs for Day {selectedDay()} ({selectedGame()?.title}). These
              results are isolated to testers.
            </span>
          </div>
          <span class="badge text-[10px] py-0 px-1.5 bg-[var(--pop-teal)] uppercase font-black">
            Tester View
          </span>
        </div>
      </Show>

      {/* ---------------------------------------------------- Locked Day Teaser for Regular Players */}
      <Show when={isLockedForPlayer()}>
        <div class="card card-plain p-8 text-center space-y-3 bg-[var(--paper-2)] border-2 border-[var(--ink)]">
          <Lock size={36} class="mx-auto opacity-70" />
          <h2 class="font-black text-xl">Day {selectedDay()} Challenge Unlocks Soon</h2>
          <p class="font-semibold text-sm max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
            {selectedGame()?.hint
              ? `Teaser: "${selectedGame()!.hint}"`
              : "This daily challenge has not unlocked yet. Check back when the countdown hits zero!"}
          </p>
          <a href="/" class="btn-brand inline-block text-xs px-4 py-2 font-bold">
            Back to Festival Schedule
          </a>
        </div>
      </Show>

      {/* ---------------------------------------------------- Top #1 Winner Callout (when day is closed) */}
      <Show when={!isLockedForPlayer() && topDailyWinner() && selectedGame()?.status === "closed"}>
        {(() => {
          const top = topDailyWinner()!;
          return (
            <div class="relative overflow-hidden card card-plain p-4 bg-[var(--pop-yellow)] flex items-center justify-between gap-4">
              <Confetti seed="winner-callout" count={6} animate />
              <div class="art-over flex items-center gap-3 min-w-0">
                <SpriteIcon name="tux-king" size={36} animate="wobble" class="shrink-0" />
                <div class="min-w-0">
                  <div class="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
                    <Trophy size={12} strokeWidth={3} />
                    <span>Day Winner · ₹200 Cash Prize</span>
                  </div>
                  <p class="font-black text-base sm:text-lg mt-1 truncate">{top.name}</p>
                </div>
              </div>
              <div class="art-over text-right font-mono font-black text-sm sm:text-base shrink-0">
                <p>{formatMetric(top)}</p>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* ---------------------------------------------------- Empty State */}
      <Show when={!isLockedForPlayer() && isEmpty()}>
        <div class="card card-plain pop-yellow text-center p-8 space-y-2">
          <SpriteIcon name="octocat-garland" size={44} animate="wobble" class="mx-auto" />
          <p class="font-black text-lg">No submissions yet for Day {selectedDay()}.</p>
          <p class="comment text-xs">be the first to finish and claim the #1 spot!</p>
        </div>
      </Show>

      {/* ---------------------------------------------------- DAILY LEADERBOARD TABLE */}
      <Show when={!isLockedForPlayer() && daily() && daily()!.entries.length > 0}>
        <div class="card card-plain p-0 overflow-hidden">
          <div
            class="bg-[var(--paper-2)] px-4 py-2.5 border-b-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider"
            style={{ color: "var(--ink-soft)" }}
          >
            <span>Rank & Player</span>
            <span class="text-right">{daily()!.metricLabel}</span>
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
                            {entry.isTester && (
                              <span class="badge text-[9px] py-0 px-1 bg-[var(--pop-teal)] uppercase">
                                Tester
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center gap-3 shrink-0 text-right">
                        <div class="font-mono tabular-nums text-sm font-extrabold">
                          <span>{formatMetric(entry)}</span>
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
            <p class="font-mono font-black text-sm">{formatMetric(daily()!.myEntry!)}</p>
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
