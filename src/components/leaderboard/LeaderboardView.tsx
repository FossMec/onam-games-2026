import { A, createAsync, useSearchParams } from "@solidjs/router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
  FlaskConical,
  GraduationCap,
  Lock,
  RefreshCw,
  Share2,
  Trophy,
} from "lucide-solid";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useTransition,
} from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { LoadingScreen } from "~/components/LoadingScreen";
import { ShareCardModal } from "~/components/games/ShareCard";
import { PookalamBoards } from "~/components/pookalam/PookalamBoards";
import { collegeLabel } from "~/lib/profile";
import type { ShareCardData } from "~/lib/share-card";
import { dailyBoard, gamesList, shell } from "~/lib/queries";
import type { DailyBoard, DailyEntry } from "~/server/leaderboard/service";
import { memeImage } from "~/lib/img";
import { formatAdaptiveDuration } from "~/lib/time";

const POLL_MS = 300_000;
const REFRESH_COOLDOWN_MS = 10_000;

function formatDuration(ms: number): string {
  return formatAdaptiveDuration(ms);
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
  if (
    entry.gameType === "hunt" ||
    (entry.metric === "score" && entry.durationMs == null && (entry.score ?? 0) <= 20)
  ) {
    const s = entry.score ?? 0;
    return s === 10 ? "10/10 Relics 👑" : `${s}/10 Relics`;
  }
  switch (entry.metric) {
    case "score":
      return `${(entry.score ?? 0).toLocaleString("en-IN")} m`;
    case "fcfs":
      return formatClock(entry.submittedAt);
    default:
      return entry.durationMs != null ? formatDuration(entry.durationMs) : "-";
  }
}

const rankPop = (rank: number): string => (rank === 1 ? "var(--pop-yellow)" : "transparent");

const clientBoardCache = new Map<string, { data: DailyBoard | null; timestamp: number }>();

export function LeaderboardView() {
  const s = createAsync(() => shell());
  const me = () => s()?.me ?? null;
  const games = createAsync(() => gamesList());
  const [searchParams, setSearchParams] = useSearchParams();

  const parseQueryDay = () => {
    const raw = Array.isArray(searchParams.day) ? searchParams.day[0] : searchParams.day;
    if (!raw) return null;
    const num = parseInt(raw, 10);
    return num >= 1 && num <= 7 ? num : null;
  };

  const [selectedDay, setSelectedDay] = createSignal<number>(parseQueryDay() ?? 1);
  const [viewMode, setViewMode] = createSignal<"main" | "tester">(
    searchParams.view === "tester" ? "tester" : "main",
  );
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

  // Sync day and viewMode with search params or fallback to current active day
  createEffect(() => {
    const qDay = parseQueryDay();
    const qView = searchParams.view === "tester" ? "tester" : "main";
    if (qDay) {
      if (qDay !== selectedDay()) setSelectedDay(qDay);
    } else {
      const day = currentActiveDay();
      if (day !== selectedDay()) setSelectedDay(day);
    }
    if (qView !== viewMode()) {
      setViewMode(qView);
    }
  });

  const selectedGame = () => games()?.find((g) => g.day === selectedDay()) ?? null;

  /**
   * Day 7 is Code-a-Pookalam, which has no `games` row and no timed run, so
   * none of the daily chrome below applies to it - no duration column, no
   * tester split, no "be the first to finish". It gets the two Elo boards
   * instead, in the same day slot, because it is still just a day of the
   * festival and a second leaderboard URL would only be a thing to go find.
   */
  const isDay7 = () =>
    selectedDay() === 7 && (selectedGame()?.gameType === "vote" || !selectedGame());

  const [pending, startTransition] = useTransition();
  const [sharing, setSharing] = createSignal(false);
  const [page, setPage] = createSignal(1);
  const [lastKnownBoard, setLastKnownBoard] = createSignal<DailyBoard | null>(null);

  const daily = createAsync<DailyBoard | null>(async () => {
    const v = version();
    const g = selectedGame();
    const mode = isTesterOrAdmin() ? viewMode() : "main";
    if (!g || g.gameType === "vote") return null;

    const cacheKey = `${g.id}:${mode}:${page()}:${v}`;
    const nowTime = Date.now();
    const cached = clientBoardCache.get(cacheKey);
    if (cached && nowTime - cached.timestamp < 60_000) {
      setLastKnownBoard(cached.data);
      return cached.data;
    }

    const res = await dailyBoard(g.id, mode, page(), 50);
    clientBoardCache.set(cacheKey, { data: res, timestamp: nowTime });
    setLastKnownBoard(res);
    return res;
  });

  const activeBoard = () => daily() ?? lastKnownBoard();
  const isEmpty = () => !activeBoard() || activeBoard()!.entries.length === 0;

  /**
   * The viewer's own row, as a share card.
   */
  const shareData = createMemo<ShareCardData | null>(() => {
    const g = selectedGame();
    const board = activeBoard();
    const entry = board?.myEntry;
    const user = me();
    if (!g || !entry || !user) return null;
    return {
      playerName: user.name,
      avatarUrl: user.avatarUrl,
      college: collegeLabel(user.college, user.collegeOther),
      branch: user.branch,
      branchOther: user.branchOther,
      batch: user.batch,
      occupation: user.occupation,
      instagram: user.instagramHandle,
      gameTitle: g.title,
      gameSlug: g.slug,
      gameType: g.gameType,
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

  onMount(() => {
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

  // Pin the true #1 winner when we see it so pagination doesn't promote page-local #51 to winner.
  const [pinnedWinner, setPinnedWinner] = createSignal<DailyEntry | null>(null);
  createEffect(() => {
    const board = activeBoard();
    if (!board) return;
    const w = board.entries.find((e) => e.rank === 1) ?? null;
    if (w) setPinnedWinner(w);
    else if (board.page === 1) setPinnedWinner(null);
  });
  const topDailyWinner = () => activeBoard()?.entries.find((e) => e.rank === 1) ?? pinnedWinner();

  const prevDay = () => {
    void startTransition(() => {
      setPage(1);
      const next = selectedDay() > 1 ? selectedDay() - 1 : 7;
      setSelectedDay(next);
      setSearchParams(
        { day: next, ...(viewMode() === "tester" ? { view: "tester" } : {}) },
        { replace: true },
      );
    });
  };

  const nextDay = () => {
    void startTransition(() => {
      setPage(1);
      const next = selectedDay() < 7 ? selectedDay() + 1 : 1;
      setSelectedDay(next);
      setSearchParams(
        { day: next, ...(viewMode() === "tester" ? { view: "tester" } : {}) },
        { replace: true },
      );
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const isLockedForPlayer = () => {
    const g = selectedGame();
    if (!g) return false;
    if (isTesterOrAdmin()) return false;
    return g.status === "upcoming" || g.status === "preview" || g.status === "tester";
  };

  return (
    <main class="container min-h-[30rem] relative space-y-4 py-6 max-w-4xl mx-auto">
      {/* Desktop Inked Sidebar: Code-a-Pookalam Card + Festival Meme + Share Card Widget */}
      <aside class="hidden 2xl:flex flex-col gap-3.5 absolute left-[calc(100%+2rem)] top-6 w-68 pointer-events-auto">
        {/* Code-a-Pookalam Mega Prize Card */}
        <A
          href="/code-a-pookalam"
          class="card pop-yellow p-4 space-y-2.5 text-center block  hover:brightness-105 no-underline cursor-pointer border-2 border-[var(--ink)]"
        >
          <div class="flex items-center justify-center gap-1.5">
            <SpriteIcon name="pookalam-flower" size={20} />
            <span class="badge text-[10px] py-0.5 px-2 bg-[var(--pop-teal)] uppercase font-black text-[var(--ink)]">
              Open All Week
            </span>
          </div>

          <div class="space-y-0.5">
            <p class="text-[10px] font-black uppercase tracking-wider text-[var(--ink-soft)]">
              Featured Competition
            </p>
            <h3 class="font-display font-black text-base uppercase text-[var(--ink)] leading-tight m-0">
              Code-a-Pookalam
            </h3>
          </div>

          <div class="py-2 px-2 bg-[var(--paper-2)] rounded-lg border-2 border-[var(--ink)] inline-block w-full">
            <span class="text-[10px] font-black uppercase text-[var(--pop-red)] block leading-none">
              Cash Prize Pool
            </span>
            <span class="font-display font-black text-4xl text-[var(--ink)] block leading-tight my-0.5">
              ₹3,000
            </span>
            <span class="text-[9px] font-mono font-extrabold text-[var(--ink-soft)] block">
              1st ₹1,500 · 2nd ₹1,000 · 3rd ₹500
            </span>
          </div>

          <p class="text-[11px] font-extrabold text-[var(--ink)] leading-snug m-0">
            Design an intricate pookalam purely using code!
          </p>

          <span class="btn-brand text-xs py-1.5 px-2 w-full font-black inline-flex items-center justify-center gap-1">
            <span>Explore & Submit →</span>
          </span>
        </A>

        <div>
          <img
            src={memeImage("failure-is-not-an-option.webp")}
            alt="Leaderboard Festival Meme"
            class="w-full h-auto object-contain rounded-xl border-2 border-[var(--ink)] block"
            loading="lazy"
            decoding="async"
          />
          <p class="text-xs font-black text-center mt-2 text-[var(--ink)] uppercase tracking-wider">
            {isDay7() ? "₹200 Voter Prize · FOSS Onam" : "₹250 Daily Prize · FOSS Onam"}
          </p>
        </div>

        <Show when={shareData()}>
          <div class="card pop-pink p-3.5 space-y-2 text-center">
            <Show when={daily()?.myEntry}>
              <div class="flex items-center justify-between text-xs font-black text-[var(--ink)] pb-1.5 border-b border-[var(--ink)]/20">
                <span>Rank #{daily()!.myEntry!.rank}</span>
                <span class="font-mono">{formatMetric(daily()!.myEntry!)}</span>
              </div>
            </Show>
            <p class="text-xs font-extrabold text-[var(--ink)] leading-snug">
              Can you beat me? Put it on their timeline.
            </p>
            <button
              type="button"
              class="btn-brand text-xs px-3 py-2 w-full font-bold cursor-pointer inline-flex items-center justify-center gap-1.5"
              onClick={() => setSharing(true)}
            >
              <Share2 size={14} strokeWidth={2.5} />
              <span>Share my card</span>
            </button>
          </div>
        </Show>
      </aside>

      {/* UNIFIED Master Header Card */}
      <div class="relative overflow-hidden rounded-xl p-3.5 sm:p-5 space-y-3.5 bg-[var(--paper-2)] border-2 border-[var(--ink)]">
        <Confetti seed="leaderboard-hero" count={4} class="opacity-15 pointer-events-none" />

        {/* Top Row: Title + Refresh */}
        <div class="relative z-10 flex items-start sm:items-center justify-between gap-2.5">
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2">
              <SpriteIcon
                name={isDay7() ? "concentric-pookalam" : "tux-king"}
                size={26}
                animate="float"
                interactive
              />
              <h1 class="text-xl sm:text-2xl md:text-3xl font-extrabold m-0 text-[var(--ink)] leading-tight">
                {isDay7() ? "Pookalam Arena" : "Daily Leaderboard"}
              </h1>
            </div>
            <p class="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] leading-snug">
              {isDay7()
                ? "Community vote · Pookalams ₹3,000 · Best judges ₹200"
                : "Daily mini-game results & rankings · Top 1 wins ₹250 daily prize"}
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={cooldownLeft() > 0}
            class="btn-ghost text-xs px-2.5 sm:px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Refresh Leaderboard"
          >
            <RefreshCw size={13} strokeWidth={2.5} class={pending() ? "animate-spin" : ""} />
            <span class="hidden xs:inline">
              {cooldownLeft() > 0 ? `${Math.ceil(cooldownLeft() / 1000)}s` : "Refresh"}
            </span>
          </button>
        </div>

        {/* Controls Row: Compact < Day X > Stepper + Current Game Title + Tester Toggle */}
        <div class="relative z-10 pt-3 border-t border-[var(--ink-soft)]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Day Stepper + Game Title */}
          <div class="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={prevDay}
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-md grid place-items-center bg-[var(--paper)] border-2 border-[var(--ink)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-all shrink-0 active:scale-95"
                aria-label="Previous Day"
                title="Previous Day"
              >
                <ChevronLeft size={15} strokeWidth={3} />
              </button>

              <div class="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-md font-black text-xs sm:text-sm bg-[var(--pop-teal)] text-[var(--ink)] border-2 border-[var(--ink)] select-none flex items-center gap-1">
                <span>Day {selectedDay()}</span>
                <span class="text-[10px] opacity-75 font-semibold">/ 7</span>
              </div>

              <button
                type="button"
                onClick={nextDay}
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-md grid place-items-center bg-[var(--paper)] border-2 border-[var(--ink)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-all shrink-0 active:scale-95"
                aria-label="Next Day"
                title="Next Day"
              >
                <ChevronRight size={15} strokeWidth={3} />
              </button>
            </div>

            <Show when={selectedGame()}>
              <span class="text-xs sm:text-sm font-black text-[var(--ink)] truncate">
                {selectedGame()!.title}
              </span>
            </Show>
          </div>

          {/* Right: Tester Toggle */}
          <Show when={isTesterOrAdmin()}>
            <div class="inline-flex rounded-md border-2 border-[var(--ink)] p-0.5 bg-[var(--paper)] self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    setPage(1);
                    setViewMode("main");
                    setSearchParams({ day: selectedDay(), view: undefined }, { replace: true });
                  })
                }
                class={`px-2.5 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                  viewMode() === "main"
                    ? "bg-[var(--pop-yellow)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                Official
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    setPage(1);
                    setViewMode("tester");
                    setSearchParams({ day: selectedDay(), view: "tester" }, { replace: true });
                  })
                }
                class={`px-2.5 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                  viewMode() === "tester"
                    ? "bg-[var(--pop-teal)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                Tester Runs
              </button>
            </div>
          </Show>
        </div>

        {/* Tester Mode notice */}
        <Show when={isTesterOrAdmin() && viewMode() === "tester"}>
          <div class="relative z-10 flex items-center gap-2 text-xs font-bold text-[var(--ink)] bg-[var(--paper-3)] p-2.5 rounded-lg border-2 border-[var(--ink)]">
            <FlaskConical size={15} class="text-[var(--pop-teal-deep)] shrink-0" />
            <span>
              Tester Mode: Showing pre-release / test runs for Day {selectedDay()} (
              {selectedGame()?.title}).
            </span>
          </div>
        </Show>
      </div>

      {/* Day 7: the pookalam arena */}
      <Show when={isDay7()}>
        <PookalamBoards />
      </Show>

      <Show when={!isDay7()}>
        {/* Locked Day Teaser for Regular Players */}
        <Show when={isLockedForPlayer()}>
          <div class="card card-plain p-8 text-center space-y-3 bg-[var(--paper-2)] border-2 border-[var(--ink)]">
            <Lock size={36} class="mx-auto opacity-70" />
            <h2 class="font-black text-xl">Day {selectedDay()} Challenge Unlocks Soon</h2>
            <p class="font-semibold text-sm max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
              {selectedGame()?.hint
                ? `Teaser: "${selectedGame()!.hint}"`
                : "This daily challenge has not unlocked yet. Check back when the countdown hits zero!"}
            </p>
            <A href="/" class="btn-brand inline-block text-xs px-4 py-2 font-bold">
              Back to Festival Schedule
            </A>
          </div>
        </Show>

        {/* Top #1 Winner Callout — not for Day 7 pookalam (has its own ₹3k podium) */}
        <Show
          when={
            !isDay7() &&
            !isLockedForPlayer() &&
            topDailyWinner() &&
            selectedGame()?.status === "closed"
          }
        >
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
                      <span>Day Winner · ₹250 Cash Prize</span>
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

        {/* Loading State */}
        <Show when={!isLockedForPlayer() && !activeBoard()}>
          <div class="card card-plain bg-[var(--paper-2)] border-2 border-[var(--ink)]">
            <LoadingScreen compact message={`Inking Day ${selectedDay()} leaderboard…`} />
          </div>
        </Show>

        {/* Empty State */}
        <Show when={!isLockedForPlayer() && activeBoard() && isEmpty()}>
          <div class="card card-plain pop-yellow text-center p-8 space-y-2">
            <SpriteIcon name="octocat-garland" size={44} animate="wobble" class="mx-auto" />
            <p class="font-black text-lg">No submissions yet for Day {selectedDay()}.</p>
            <p class="comment text-xs">be the first to finish and claim the #1 spot!</p>
          </div>
        </Show>

        {/* DAILY LEADERBOARD TABLE */}
        <Show when={!isLockedForPlayer() && activeBoard() && activeBoard()!.entries.length > 0}>
          <div class="card card-plain p-0 overflow-hidden">
            <div
              class="bg-[var(--paper-2)] px-4 py-2.5 border-b-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider"
              style={{ color: "var(--ink-soft)" }}
            >
              <span>Rank & Player</span>
              <span class="text-right">{activeBoard()!.metricLabel}</span>
            </div>

            <div class="divide-y divide-[var(--ink-soft)]/20">
              <For each={activeBoard()!.entries}>
                {(entry) => {
                  const isExpanded = () => expandedId() === `daily-${entry.userId}`;
                  return (
                    <div
                      class={`transition-colors cursor-pointer ${
                        entry.isMe ? "bg-[var(--pop-yellow)]/60" : "hover:bg-[var(--paper-2)]"
                      }`}
                      onClick={() => toggleExpand(`daily-${entry.userId}`)}
                    >
                      {/* Main Row */}
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
                            <Show
                              when={entry.college || entry.branch}
                              fallback={<span class="comment text-[11px] uppercase">Player</span>}
                            >
                              <div
                                class="flex items-center gap-1 text-[11px] uppercase truncate"
                                style={{ color: "var(--ink-soft)" }}
                              >
                                <GraduationCap size={11} class="shrink-0" />
                                <span class="truncate uppercase font-bold">
                                  {entry.college ?? "Independent"}
                                  {entry.branch ? ` · ${entry.branch}` : ""}
                                </span>
                              </div>
                            </Show>
                          </div>
                        </div>

                        {/* Metric & Expand Chevron */}
                        <div class="flex items-center gap-2 shrink-0">
                          <span
                            class="font-mono font-black text-xs sm:text-sm text-[var(--ink)]"
                            title={`Finished: ${new Date(entry.submittedAt).toLocaleTimeString()}`}
                          >
                            {formatMetric(entry)}
                          </span>
                          <Show
                            when={isExpanded()}
                            fallback={<ChevronDown size={14} class="opacity-50" />}
                          >
                            <ChevronUp size={14} class="opacity-75" />
                          </Show>
                        </div>
                      </div>

                      {/* Expandable Player Details Drawer */}
                      <Show when={isExpanded()}>
                        <div
                          class="px-4 py-3 bg-[var(--paper-2)] border-t border-[var(--ink-soft)]/20 space-y-2 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <span
                                class="uppercase text-[9px] font-black block"
                                style={{ color: "var(--ink-soft)" }}
                              >
                                College
                              </span>
                              <span class="font-bold uppercase">
                                {entry.college || "Not shared"}
                              </span>
                            </div>
                            <div>
                              <span
                                class="uppercase text-[9px] font-black block"
                                style={{ color: "var(--ink-soft)" }}
                              >
                                Branch / Batch
                              </span>
                              <span class="font-bold uppercase">
                                {entry.branch || "—"} {entry.batch ? `'${entry.batch}` : ""}
                              </span>
                            </div>
                            <div>
                              <span
                                class="uppercase text-[9px] font-black block"
                                style={{ color: "var(--ink-soft)" }}
                              >
                                Current Streak
                              </span>
                              <span class="font-bold">
                                {entry.streakCount} {entry.streakCount === 1 ? "day" : "days"}
                              </span>
                            </div>
                            <div>
                              <span
                                class="uppercase text-[9px] font-black block"
                                style={{ color: "var(--ink-soft)" }}
                              >
                                Finished At
                              </span>
                              <span class="font-mono font-bold">
                                {formatClock(entry.submittedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Inked Pagination Footer */}
            <div
              class="px-4 py-3 bg-[var(--paper-2)] border-t-2 border-[var(--ink)] flex items-center justify-between gap-3 flex-wrap text-xs font-bold"
              style={{ color: "var(--ink-soft)" }}
            >
              <span>
                Page {activeBoard()!.page} of {activeBoard()!.totalPages} · Total{" "}
                {activeBoard()!.fieldSize} players
              </span>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="btn-ghost text-xs px-2.5 py-1 disabled:opacity-35 cursor-pointer"
                  disabled={activeBoard()!.page <= 1}
                  onClick={() => {
                    void startTransition(() => setPage((p) => Math.max(1, p - 1)));
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  class="btn-ghost text-xs px-2.5 py-1 disabled:opacity-35 cursor-pointer"
                  disabled={activeBoard()!.page >= activeBoard()!.totalPages}
                  onClick={() => {
                    void startTransition(() =>
                      setPage((p) => Math.min(activeBoard()!.totalPages, p + 1)),
                    );
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <Show when={activeBoard()!.myEntry && !activeBoard()!.entries.some((e) => e.isMe)}>
            <div class="card pop-yellow p-3.5 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <SpriteIcon name="foss-mec-badge" size={24} />
                <p class="font-extrabold text-sm">
                  Your Rank: #{activeBoard()!.myEntry!.rank} of {activeBoard()!.fieldSize}
                </p>
              </div>
              <p class="font-mono font-black text-sm">{formatMetric(activeBoard()!.myEntry!)}</p>
            </div>
          </Show>

          {/* On mobile / small screens, show share card at the bottom */}
          <Show when={shareData()}>
            <div class="2xl:hidden card pop-pink p-3.5 space-y-2">
              <Show when={activeBoard()?.myEntry}>
                <div class="flex items-center justify-between text-xs font-black text-[var(--ink)] pb-1 border-b border-[var(--ink)]/20">
                  <span>Your Rank: #{activeBoard()!.myEntry!.rank}</span>
                  <span class="font-mono">{formatMetric(activeBoard()!.myEntry!)}</span>
                </div>
              </Show>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-xs font-extrabold text-[var(--ink)]">
                  Can you beat me? Put it on their timeline.
                </p>
                <button type="button" class="btn-brand text-xs" onClick={() => setSharing(true)}>
                  Share my card
                </button>
              </div>
            </div>
          </Show>
        </Show>
      </Show>

      {/* Mobile Code-a-Pookalam Promo Card */}
      <div class="2xl:hidden pt-2">
        <A
          href="/code-a-pookalam"
          class="card pop-yellow p-4 space-y-2.5 text-center block no-underline cursor-pointer border-2 border-[var(--ink)]"
        >
          <div class="flex items-center justify-center gap-1.5">
            <SpriteIcon name="pookalam-flower" size={20} />
            <span class="badge text-[10px] py-0.5 px-2 bg-[var(--pop-teal)] uppercase font-black text-[var(--ink)]">
              Open All Week
            </span>
          </div>

          <div class="py-2 px-2 bg-[var(--paper-2)] rounded-lg border-2 border-[var(--ink)] inline-block w-full">
            <span class="text-[10px] font-black uppercase text-[var(--pop-red)] block leading-none">
              Cash Prize Pool
            </span>
            <span class="font-display font-black text-3xl sm:text-4xl text-[var(--ink)] block leading-tight my-0.5">
              ₹3,000
            </span>
            <span class="text-[10px] font-mono font-extrabold text-[var(--ink-soft)] block">
              1st ₹1,500 · 2nd ₹1,000 · 3rd ₹500
            </span>
          </div>

          <p class="text-xs font-extrabold text-[var(--ink)] leading-snug m-0">
            Waiting for tomorrow's game? Code your pookalam using Canvas, SVG, CSS or Python!
          </p>

          <span class="btn-brand text-xs py-1.5 px-3 w-full font-black inline-flex items-center justify-center gap-1">
            <span>Enter Code-a-Pookalam →</span>
          </span>
        </A>
      </div>

      {/* Mobile Bottom Meme Sticker */}
      <div class="2xl:hidden flex justify-center py-4">
        <img
          src={memeImage("failure-is-not-an-option.webp")}
          alt="Leaderboard Festival Meme"
          class="max-w-xs sm:max-w-sm w-full h-auto object-contain select-none rounded-xl border-2 border-[var(--ink)] block"
          loading="lazy"
          decoding="async"
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
        border: props.rank === 1 ? "var(--ink-w) solid var(--ink)" : "1px solid var(--ink-soft)",
        "border-radius": "999px",
      }}
    >
      {props.rank}
    </span>
  );
}
