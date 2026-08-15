import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Flame,
  FlaskConical,
  GraduationCap,
  Lock,
  RefreshCw,
  Trophy,
} from "lucide-solid";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useTransition,
} from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { ShareCardModal } from "~/components/games/ShareCard";
import { collegeLabel } from "~/lib/profile";
import type { ShareCardData } from "~/lib/share-card";
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
  const [viewMode, setViewMode] = createSignal<"main" | "tester">("main");
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

  // Auto-set tab to tester if currently selected game is in tester preview
  createEffect(() => {
    const g = selectedGame();
    if (g && g.status === "tester" && isTesterOrAdmin()) {
      setViewMode("tester");
    }
  });

  const [pending, startTransition] = useTransition();
  const [sharing, setSharing] = createSignal(false);
  const [page, setPage] = createSignal(1);

  const daily = createAsync<DailyBoard | null>(() => {
    void version();
    const g = selectedGame();
    const mode = isTesterOrAdmin() ? viewMode() : "main";
    return g ? getDaily(g.id, mode, page(), 50) : Promise.resolve(null);
  });

  /**
   * The viewer's own row, as a share card.
   *
   * Seeded exactly the way the game page seeds it, so the card offered here is
   * the same card the player was shown when they finished — same meme, same
   * joke, same picture. Two different cards for one run would read as a bug.
   */
  const shareData = createMemo<ShareCardData | null>(() => {
    const g = selectedGame();
    const board = daily();
    const entry = board?.myEntry;
    const user = me();
    if (!g || !entry || !user) return null;
    return {
      playerName: user.name,
      college: collegeLabel(user.college, user.collegeOther),
      instagram: user.instagramHandle,
      gameTitle: g.title,
      gameSlug: g.slug,
      day: g.day,
      metric: entry.metric,
      durationMs: entry.durationMs,
      score: entry.score,
      rank: entry.rank,
      fieldSize: board.fieldSize,
      afterDeadline: false,
      origin: typeof window === "undefined" ? "" : window.location.origin,
      seed: `${g.slug}-${entry.durationMs ?? 0}-${entry.score ?? 0}`,
    };
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
      setPage(1);
      setSelectedDay((d) => (d > 1 ? d - 1 : 7));
    });
  };

  const nextDay = () => {
    void startTransition(() => {
      setPage(1);
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
    // Preview counts as locked here: the board cannot have entries before the
    // game opens, so a player following the reveal should get the teaser rather
    // than an empty table.
    return g.status === "upcoming" || g.status === "preview" || g.status === "tester";
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
        <div class="art-over flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <SpriteIcon name="tux-king" size={30} animate="float" interactive />
              <h1 class="text-2xl sm:text-3xl font-extrabold m-0">Daily Leaderboard</h1>
            </div>
            <p class="text-xs sm:text-sm font-semibold mt-0.5" style={{ color: "var(--ink-soft)" }}>
              Daily mini-game results & rankings · Top 1 wins ₹200 daily prize
            </p>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            {/* Desktop right-side meme sticker */}
            <img
              src="/images/memes/meme-leaderboard.webp"
              alt="Leaderboard Festival Meme"
              class="hidden sm:block w-20 md:w-24 h-auto object-contain select-none opacity-90 hover:opacity-100 transition-opacity rounded-md"
            />

            <button
              type="button"
              onClick={refresh}
              disabled={cooldownLeft() > 0}
              class="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
            >
              <RefreshCw size={13} strokeWidth={2.5} class={pending() ? "animate-spin" : ""} />
              <span>
                {cooldownLeft() > 0 ? `Wait ${Math.ceil(cooldownLeft() / 1000)}s` : "Refresh"}
              </span>
            </button>
          </div>
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
                    onClick={() =>
                      startTransition(() => {
                        setPage(1);
                        setSelectedDay(d);
                      })
                    }
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

      {/* ---------------------------------------------------- Tester vs Main Leaderboard Tabs (Admin / Tester Only) */}
      <Show when={isTesterOrAdmin()}>
        <div class="flex items-center gap-2 bg-[var(--paper-2)] p-1.5 rounded-lg border-2 border-[var(--ink)]">
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                setPage(1);
                setViewMode("main");
              })
            }
            class={`flex-1 py-1.5 px-3 rounded text-xs font-black transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              viewMode() === "main"
                ? "bg-[var(--pop-yellow)] text-[var(--ink)] border-2 border-[var(--ink)] shadow-xs"
                : "bg-transparent text-[var(--ink-soft)] hover:text-[var(--ink)] opacity-70 hover:opacity-100"
            }`}
          >
            <Trophy size={13} strokeWidth={2.5} />
            <span>Official Public Leaderboard</span>
          </button>

          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                setPage(1);
                setViewMode("tester");
              })
            }
            class={`flex-1 py-1.5 px-3 rounded text-xs font-black transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              viewMode() === "tester"
                ? "bg-[var(--pop-teal)] text-[var(--ink)] border-2 border-[var(--ink)] shadow-xs"
                : "bg-transparent text-[var(--ink-soft)] hover:text-[var(--ink)] opacity-70 hover:opacity-100"
            }`}
          >
            <FlaskConical size={13} strokeWidth={2.5} />
            <span>Tester Preview Runs</span>
          </button>
        </div>
      </Show>

      {/* ---------------------------------------------------- Tester Notice (When Viewing Tester Runs) */}
      <Show when={isTesterOrAdmin() && viewMode() === "tester"}>
        <div class="card p-3 bg-[var(--pop-teal)]/20 border-2 border-[var(--ink)] flex items-center justify-between text-xs font-bold">
          <div class="flex items-center gap-2">
            <FlaskConical size={16} class="text-[var(--ink)] shrink-0" />
            <span>
              Tester Mode: Showing pre-release / test runs for Day {selectedDay()} (
              {selectedGame()?.title}). These results are isolated from public players.
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
                <Show
                  when={top.avatarUrl}
                  fallback={
                    <SpriteIcon name="tux-king" size={36} animate="wobble" class="shrink-0" />
                  }
                >
                  <img
                    src={top.avatarUrl!}
                    alt={top.name}
                    class="w-10 h-10 rounded-full object-cover shrink-0 select-none block"
                    style={{ border: "2px solid var(--ink)" }}
                  />
                </Show>
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
                    {/* Main Row: Standing, Avatar, Name, Score */}
                    <div class="px-4 py-3 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <RankChip rank={entry.rank} />
                        <Show
                          when={entry.avatarUrl}
                          fallback={
                            <div
                              class="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden grid place-items-center shrink-0 text-[10px] sm:text-xs font-black select-none"
                              style={{
                                border: "1.5px solid var(--ink)",
                                background: entry.isMe ? "var(--pop-yellow)" : "var(--paper-3)",
                                color: "var(--ink)",
                              }}
                            >
                              {entry.name.slice(0, 1).toUpperCase()}
                            </div>
                          }
                        >
                          <img
                            src={entry.avatarUrl!}
                            alt={entry.name}
                            class="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 select-none block"
                            style={{ border: "1.5px solid var(--ink)" }}
                            loading="lazy"
                          />
                        </Show>
                        <div class="min-w-0">
                          <p class="font-extrabold text-sm truncate flex items-center gap-1.5">
                            <span>{entry.name}</span>
                            {entry.isMe && <span class="comment text-[11px]">you</span>}
                            {entry.isTester && (
                              <span class="badge text-[9px] py-0 px-1 bg-[var(--pop-teal)] uppercase">
                                Tester
                              </span>
                            )}
                            {/*
                              The streak rides along on the row the board is
                              already fetching — `users.streak_count` is part of
                              the same join, so this costs nothing. Shown from
                              two days up: a "streak" of one is just today.
                            */}
                            {entry.streakCount > 1 && (
                              <span
                                class="badge text-[9px] py-0 px-1 tabular-nums"
                                style={{ "--pop": "var(--pop-red)" }}
                                title={`${entry.streakCount}-day streak`}
                              >
                                <Flame size={10} strokeWidth={3} />
                                {entry.streakCount}
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
                          <Show when={entry.streakCount > 0}>
                            <span class="inline-flex items-center gap-1">
                              <Flame size={12} />
                              {entry.streakCount} day{entry.streakCount === 1 ? "" : "s"} in a row
                            </span>
                          </Show>
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

        {/* ---------------------------------------------------- Pagination Controls */}
        <Show when={daily() && daily()!.totalPages > 1}>
          <div class="card card-plain p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--paper-2)]">
            <span class="text-xs font-bold text-[var(--ink-soft)]">
              Showing {(daily()!.page - 1) * daily()!.pageSize + 1}–
              {Math.min(daily()!.page * daily()!.pageSize, daily()!.fieldSize)} of{" "}
              {daily()!.fieldSize} players
            </span>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="btn-ghost text-xs px-3 py-1.5 cursor-pointer"
                disabled={daily()!.page <= 1}
                onClick={() => {
                  void startTransition(() => setPage((p) => Math.max(1, p - 1)));
                }}
              >
                Previous
              </button>

              <span class="text-xs font-black px-2.5 py-1 bg-[var(--paper)] rounded border border-[var(--ink)]">
                Page {daily()!.page} of {daily()!.totalPages}
              </span>

              <button
                type="button"
                class="btn-ghost text-xs px-3 py-1.5 cursor-pointer"
                disabled={daily()!.page >= daily()!.totalPages}
                onClick={() => {
                  void startTransition(() => setPage((p) => Math.min(daily()!.totalPages, p + 1)));
                }}
              >
                Next
              </button>
            </div>
          </div>
        </Show>

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

        {/*
          A rank is only worth having if you can show it to somebody. Available
          from the board as well as the game page, because the bragging usually
          happens a while after the run.
        */}
        <Show when={shareData()}>
          <div class="card pop-pink flex flex-wrap items-center justify-between gap-3 p-3.5">
            <p class="comment">can you beat me? put it on their timeline.</p>
            <button type="button" class="btn-brand" onClick={() => setSharing(true)}>
              Share my card
            </button>
          </div>
        </Show>
      </Show>

      {/* Mobile Bottom Meme Sticker */}
      <div class="sm:hidden flex justify-center py-4">
        <img
          src="/images/memes/meme-leaderboard.webp"
          alt="Leaderboard Festival Meme"
          class="w-28 h-auto object-contain select-none opacity-90 hover:opacity-100 rounded-md"
        />
      </div>

      <Show when={sharing() && shareData()}>
        <ShareCardModal data={shareData()!} onClose={() => setSharing(false)} />
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
