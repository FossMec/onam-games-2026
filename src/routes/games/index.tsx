import { Meta, Title } from "@solidjs/meta";
import { A, createAsync, revalidate, useNavigate, useSearchParams } from "@solidjs/router";
import type { RouteDefinition } from "@solidjs/router";
import { AlertCircle, ChevronLeft, ChevronRight, HelpCircle, Lock } from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { SpriteIcon } from "~/components/art/SpriteIcon";
import { Countdown } from "~/components/Countdown";
import { LoadingScreen } from "~/components/LoadingScreen";
import { FairPlayModal, hasAcknowledgedFairPlay } from "~/components/games/FairPlayModal";
import { HowToPlayModal } from "~/components/games/HowToPlay";
import { clearAttempt, getStoredAttempt, markArenaFromHub, storeAttempt } from "~/lib/game-session";
import { gameBySlug, gamesList, myAttempt as myAttemptQuery, viewer } from "~/lib/queries";
import { teaserIcon } from "~/lib/game-teasers";
import { gameImageForType } from "~/lib/img";
import { SITE_URL } from "~/lib/site";
import type { GameCard } from "~/server/games/service";

const DAY_POPS = [
  "pop-yellow",
  "pop-teal",
  "pop-pink",
  "pop-blue",
  "pop-purple",
  "pop-red",
  "pop-yellow",
];

const statusSticker: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  preview: { label: "Opens soon", pop: "var(--pop-yellow)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Ended", pop: "var(--paper-3)" },
};

/**
 * Start the page's reads the moment the router knows we are heading here,
 * rather than after this chunk has downloaded and mounted. `query` dedupes
 * against the `createAsync` below, so this costs nothing when it is early and
 * saves a full round trip when it is not.
 */
export const route = {
  preload() {
    void viewer();
    void gamesList();
  },
} satisfies RouteDefinition;

export default function GamesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const games = createAsync(() => gamesList());
  const me = createAsync(() => viewer());

  const [showFairPlay, setShowFairPlay] = createSignal(false);
  const [activeModalGame, setActiveModalGame] = createSignal<GameCard | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  const fullSchedule = () => games() ?? [];

  const activeGame = () => {
    const list = fullSchedule();
    if (list.length === 0) return null;

    // 1. If explicit game slug is requested via ?game= or ?slug=
    const requestedSlug = searchParams.game || searchParams.slug;
    if (typeof requestedSlug === "string" && requestedSlug) {
      const matchSlug = list.find((g) => g.slug === requestedSlug);
      if (matchSlug) return matchSlug;
    }

    // 2. If day is requested via ?day=
    const requestedDay = Number(searchParams.day);
    if (!Number.isNaN(requestedDay) && requestedDay >= 1 && requestedDay <= 7) {
      const matchDay = list.find((g) => g.day === requestedDay);
      if (matchDay) return matchDay;
    }

    // 3. Fallback to live, preview, or first game
    const live = list.find((g) => g.status === "live" || g.status === "tester");
    if (live) return live;
    const preview = list.find((g) => g.status === "preview");
    if (preview) return preview;
    return list[0];
  };

  const currentAttempt = createAsync(async () => {
    const slug = activeGame()?.slug;
    if (!slug || !me()) return null;
    return myAttemptQuery(slug);
  });

  const isRunning = () => {
    const g = activeGame();
    if (!g) return false;
    if (g.status === "closed" && !g.testerMode) return false;
    const a = currentAttempt();
    if (a) {
      return a.status === "in_progress";
    }
    const stored = getStoredAttempt(g.slug);
    return !!stored;
  };

  const isCompleted = () => {
    const a = currentAttempt();
    if (!a) return false;
    return a.status === "submitted" && a.attemptsRemaining === 0 && !a.unlimited;
  };

  // Schedule exact revalidation when a locked/preview game flips to live.
  // Works without hover/tick drift — critical for mobile where hover never fires.
  const handleReleaseFlip = () => {
    // slight jitter avoids thundering herd when many phones hit at 19:00:00.000
    const jitter = Math.floor(Math.random() * 700);
    setTimeout(() => void revalidate("games"), jitter + 250);
  };

  // Warm only today's game chunk — upcoming games stay masked and their JS never leaves the server.
  const warmChunkForType = (type: string) => {
    switch (type) {
      case "tinder":
        return import("~/components/games/TinderGame");
      case "jigsaw":
        return import("~/components/games/JigsawGame");
      case "wend":
        return import("~/components/games/WendGame");
      case "unblock":
        return import("~/components/games/VallamGame");
      case "jump":
        return import("~/components/games/JumpGame");
      default:
        return Promise.resolve();
    }
  };

  // Prewarm arena data + chunk when game card enters view (mobile: no hover).
  // Hover alone is useless on touch devices, so we trigger on view + touch.
  // Also warms the JS chunk for *this* game only — future games' JS is never prefetched.
  const prewarmArena = (slug: string) => {
    if (!slug) return;
    const g = fullSchedule().find((x) => x.slug === slug);
    // Never warm upcoming — keeps future JS off the wire
    if (g && g.status === "upcoming") return;
    void gameBySlug(slug);
    void myAttemptQuery(slug);
    if (g?.gameType) {
      void warmChunkForType(g.gameType);
      const img = new Image();
      img.src = gameImageForType(g.gameType);
    }
  };
  let arenaPrewarmed = "";

  // When locked card comes into view and is about to open, prewarm.
  createEffect(() => {
    const g = activeGame();
    if (!g?.slug || g.status === "closed") return;
    // viewport prewarm: if game will open within 60s, warm now
    if (g.releaseAt) {
      const ms = new Date(g.releaseAt).getTime() - Date.now();
      if (ms > 0 && ms < 60_000 && arenaPrewarmed !== g.slug) {
        arenaPrewarmed = g.slug;
        prewarmArena(g.slug);
      }
    }
    // If already live/tester and in viewport, warm as well for instant tap
    if ((g.status === "live" || g.status === "tester") && arenaPrewarmed !== g.slug) {
      arenaPrewarmed = g.slug;
      prewarmArena(g.slug);
    }
  });

  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const cur = activeGame();
        if (cur?.status === "upcoming" || cur?.status === "preview") void revalidate("games");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() => document.removeEventListener("visibilitychange", onVisible));
  });

  const handlePlayClick = (game: GameCard) => {
    if (!me()) {
      window.location.href = `/auth/signin?next=${encodeURIComponent(`/games?day=${game.day}&game=${game.slug}`)}`;
      return;
    }
    if (!me()!.onboardingCompleted) {
      navigate(
        `/onboarding?next=${encodeURIComponent(`/games?day=${game.day}&game=${game.slug}`)}`,
      );
      return;
    }

    // A completed game skips the locked arena page and goes straight to the
    // day's leaderboard — that's the result the player actually wants.
    if (isCompleted()) {
      navigate(`/leaderboard?day=${game.day}`);
      return;
    }

    // Active run or in-progress attempt: jump into the arena without the rules modal.
    if (getStoredAttempt(game.slug) || currentAttempt()?.status === "in_progress") {
      markArenaFromHub();
      navigate(`/games/${game.slug}`);
      return;
    }

    setError("");
    setActiveModalGame(game);
    if (!hasAcknowledgedFairPlay()) {
      setShowFairPlay(true);
    }
  };

  const startAndLaunch = async () => {
    const game = activeModalGame();
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      // Ensure today's game JS is downloaded before the server clock starts.
      // Otherwise `startedAt` ticks while the phone still fetches the chunk (1-2s waste).
      await warmChunkForType(game.gameType);
      const res = await fetch(`/api/game/${game.slug}/start`, { method: "POST" });
      const data = (await res.json()) as {
        attemptToken?: string;
        startedAt?: string;
        error?: string;
      };
      if (!res.ok || !data.attemptToken || !data.startedAt) {
        setError(data.error ?? "Failed to start attempt");
        clearAttempt(game.slug);
        return;
      }
      storeAttempt(game.slug, {
        attemptToken: data.attemptToken,
        startedAt: data.startedAt,
      });
      setActiveModalGame(null);
      markArenaFromHub();
      navigate(`/games/${game.slug}`);
    } catch {
      setError("Network hiccup - please check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const selectedDay = () => activeGame()?.day ?? 1;

  const gamesForActiveDay = () => {
    const dayNum = selectedDay();
    return fullSchedule().filter((g) => g.day === dayNum);
  };

  const selectGame = (dayNum: number, gameSlug?: string) => {
    setSearchParams(
      {
        day: dayNum,
        ...(gameSlug ? { game: gameSlug } : {}),
      },
      { replace: true, scroll: false },
    );
  };

  const selectDay = (dayNum: number) => {
    const match = fullSchedule().find((g) => g.day === dayNum);
    selectGame(dayNum, match?.slug);
  };

  return (
    <main class="container space-y-8 py-6">
      <Title>Daily Mini-Games Arena - Onam Games</Title>
      <Meta
        name="description"
        content="Play a fun new mini-game every evening at Onam Games by FOSSMEC — six daily puzzle challenges across the festival week, with ₹200 daily bounties and a ₹5K+ prize pool."
      />
      <Meta property="og:title" content="Daily Mini-Games Arena - Onam Games" />
      <Meta
        property="og:description"
        content="Play a fun new mini-game every evening at Onam Games by FOSSMEC — six daily puzzle challenges across the festival week, with ₹200 daily bounties and a ₹5K+ prize pool."
      />
      <Meta property="og:url" content={`${SITE_URL}/games`} />
      <Meta property="og:image" content={`${SITE_URL}/images/games-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content="Daily Mini-Games Arena - Onam Games" />
      <Meta
        name="twitter:description"
        content="Play a fun new mini-game every evening at Onam Games by FOSSMEC — six daily puzzle challenges across the festival week, with ₹200 daily bounties and a ₹5K+ prize pool."
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/games-og.webp`} />

      {/* Header Banner */}
      {/* <section */}
      {/*   class="relative overflow-hidden rounded-lg px-4 py-8 text-center sm:px-6 sm:py-10 space-y-4" */}
      {/*   style={{ */}
      {/*     border: "var(--ink-w-bold) solid var(--ink)", */}
      {/*     background: "var(--paper-2)", */}
      {/*   }} */}
      {/* > */}
      {/*   <Confetti seed="games-hero" count={8} opacity={0.4} animate /> */}
      {/*   <SpriteScatter */}
      {/*     seed="games-hero-sprites" */}
      {/*     count={5} */}
      {/*     pool={[ */}
      {/*       "maveli-laptop", */}
      {/*       "tux-king", */}
      {/*       "sadya-leaf", */}
      {/*       "octocat-garland", */}
      {/*       "arch-crown", */}
      {/*       "ferris-crab", */}
      {/*       "gopher-king", */}
      {/*     ]} */}
      {/*     minSize={32} */}
      {/*     maxSize={48} */}
      {/*     opacity={0.85} */}
      {/*     animate */}
      {/*   /> */}
      {/**/}
      {/*   <div class="art-over space-y-3 max-w-3xl mx-auto"> */}
      {/*     <div class="flex justify-center"> */}
      {/*       <span class="badge" style={{ "--pop": "var(--pop-teal)" }}> */}
      {/*         ₹200 Daily Cash Bounties · 7 Days of Challenges */}
      {/*       </span> */}
      {/*     </div> */}
      {/**/}
      {/*     <div class="flex items-center justify-center gap-3"> */}
      {/*       <SpriteIcon name="maveli-laptop" size={38} animate="float" interactive /> */}
      {/*       <h1 */}
      {/*         class="wordmark tracking-wider m-0" */}
      {/*         data-text="DAILY GAMES ARENA" */}
      {/*         style={{ "font-size": "clamp(1.5rem, 6vw, 3.25rem)" }} */}
      {/*       > */}
      {/*         DAILY GAMES ARENA */}
      {/*       </h1> */}
      {/*       <SpriteIcon name="tux-king" size={38} animate="float" delay={1.2} interactive /> */}
      {/*     </div> */}
      {/**/}
      {/*     <p class="mx-auto max-w-xl text-sm sm:text-base font-semibold leading-relaxed"> */}
      {/*       One fresh mini-game unlocks every evening! Solve fast to top that day's verified */}
      {/*       leaderboard and win cash bounties. Same puzzle, same seed, 100% fair. */}
      {/*     </p> */}
      {/*   </div> */}
      {/* </section> */}

      {/* Main Arena Showcase */}
      <Show when={games()} fallback={<LoadingScreen compact message="Loading games arena…" />}>
        <Show when={activeGame()}>
          {(() => {
            const current = activeGame()!;
            const locked = current.status === "upcoming";
            const previewing = current.status === "preview";
            const sticker = statusSticker[current.status] ?? statusSticker.upcoming;
            const teaser = current.teaser ?? "A mystery game";
            const isDay7 = current.day === 7;
            const targetHref = isDay7 ? "/code-a-pookalam/vote" : `/games/${current.slug}`;
            const playHref = me() ? targetHref : "/auth/signin";

            return (
              <section id="arena-hero-card" class="space-y-6 max-w-4xl mx-auto">
                {/* Control bar */}
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectDay(selectedDay() > 1 ? selectedDay() - 1 : 7)}
                      class="btn-ghost px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                      aria-label="Previous Day"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                      <span class="font-extrabold">Prev Day</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectDay(selectedDay() < 7 ? selectedDay() + 1 : 1)}
                      class="btn-ghost px-3 py-1.5 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                      aria-label="Next Day"
                    >
                      <span class="font-extrabold">Next Day</span>
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div class="flex items-center gap-2">
                    <span
                      class="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full"
                      style={{
                        background: "var(--paper-2)",
                        border: "2px solid var(--ink)",
                      }}
                    >
                      Day {current.day} of 7
                    </span>
                    <a
                      href="#how-it-works"
                      class="text-xs font-extrabold underline decoration-2 underline-offset-4 px-2 py-1 inline-flex items-center gap-1"
                      style={{ color: "var(--ink)" }}
                    >
                      <HelpCircle size={14} strokeWidth={2.5} />
                      <span>Rules & Help ↓</span>
                    </a>
                  </div>
                </div>

                {/* Multi-game switcher for days with more than 1 challenge */}
                <Show when={gamesForActiveDay().length > 1}>
                  <div
                    class="flex rounded p-0.5 gap-1"
                    style={{
                      background: "var(--paper-3)",
                      border: "var(--ink-w) solid var(--ink)",
                    }}
                  >
                    <For each={gamesForActiveDay()}>
                      {(g) => {
                        const isCurrent =
                          g.slug === activeGame()?.slug || g.id === activeGame()?.id;
                        return (
                          <button
                            type="button"
                            onClick={() => selectGame(g.day, g.slug)}
                            class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-black transition-colors cursor-pointer text-center outline-none"
                            style={
                              isCurrent
                                ? {
                                    background: "var(--pop-yellow)",
                                    border: "var(--ink-w) solid var(--ink)",
                                    color: "var(--ink)",
                                  }
                                : {
                                    background: "transparent",
                                    border: "var(--ink-w) solid transparent",
                                    color: "var(--ink-soft)",
                                  }
                            }
                          >
                            <SpriteIcon name={teaserIcon(g)} size={14} />
                            <span class="truncate">{g.title}</span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>

                {/* Showcase Card */}
                <article
                  class={`card ${DAY_POPS[(current.day - 1) % DAY_POPS.length]} relative overflow-hidden p-5 sm:p-7 space-y-5`}
                >
                  <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* Artwork */}
                    <div
                      class="relative overflow-hidden rounded-lg aspect-square w-full sm:w-64 md:w-72 shrink-0 bg-[var(--paper-3)] flex items-center justify-center"
                      style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
                    >
                      <Show
                        when={!locked}
                        fallback={
                          <div class="relative h-full w-full overflow-hidden flex flex-col items-center justify-center text-center p-4 bg-[var(--paper-3)]">
                            <img
                              src={gameImageForType(current.gameType)}
                              alt="Classified preview"
                              class="absolute inset-0 h-full w-full object-cover blur-xl opacity-40 grayscale"
                            />
                            <div class="relative z-10 space-y-2">
                              <SpriteIcon name={teaserIcon(current)} size={48} animate="wobble" />
                              <p
                                class="text-xl font-extrabold uppercase tracking-widest"
                                style={{
                                  "font-family": "var(--font-stack-display)",
                                }}
                              >
                                ? ? ? ?
                              </p>
                              <span
                                class="sticker inline-flex items-center gap-1"
                                style={{ "--pop": "var(--pop-red)" }}
                              >
                                <Lock size={12} strokeWidth={2.5} />
                                <span>Classified</span>
                              </span>
                            </div>
                          </div>
                        }
                      >
                        <img
                          src={gameImageForType(current.gameType)}
                          alt={current.title}
                          loading="eager"
                          class="h-full w-full object-cover aspect-square"
                        />
                      </Show>
                    </div>

                    {/* Game Details */}
                    <div class="space-y-4 flex-1 w-full text-center md:text-left">
                      <div class="flex items-center justify-center md:justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                          <SpriteIcon
                            name={teaserIcon(current)}
                            size={28}
                            animate="wobble"
                            interactive
                          />
                          <span
                            class="text-xs font-extrabold uppercase tracking-widest"
                            style={{
                              "font-family": "var(--font-stack-display)",
                            }}
                          >
                            Day {current.day}
                          </span>
                        </div>
                        <span class="sticker" style={{ "--pop": sticker.pop }}>
                          {sticker.label}
                        </span>
                      </div>

                      <h2 class="text-2xl sm:text-3xl m-0">
                        <Show when={!locked} fallback={<span>Day {current.day}: ????????</span>}>
                          <A href={playHref} class="underline decoration-2 underline-offset-4">
                            {current.title}
                          </A>
                        </Show>
                      </h2>

                      <Show
                        when={!locked}
                        fallback={
                          <div class="space-y-2">
                            <p
                              class="text-sm sm:text-base font-extrabold"
                              style={{ color: "var(--ink-soft)" }}
                            >
                              Teaser:
                            </p>
                            <p class="comment text-lg font-semibold">"{teaser}"</p>
                          </div>
                        }
                      >
                        <p class="text-base font-semibold leading-relaxed">{current.tagline}</p>
                      </Show>

                      <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                        <span class="badge">{current.difficulty}</span>
                        <span class="badge">
                          {current.maxAttempts > 100
                            ? "unlimited tries"
                            : current.maxAttempts > 1
                              ? `${current.maxAttempts} runs`
                              : "one shot"}
                        </span>
                        <span class="badge">
                          {current.metric === "score"
                            ? "highest score wins"
                            : isDay7
                              ? "community vote"
                              : "fastest wins"}
                        </span>
                      </div>

                      {/* Main Action Area */}
                      <div class="pt-3 space-y-2">
                        <Show when={locked && current.releaseAt}>
                          <div class="card card-plain flex flex-col items-center justify-center gap-2 p-3 text-center">
                            <p class="comment text-sm">Unlocks in</p>
                            <Countdown
                              target={new Date(current.releaseAt!)}
                              compact
                              onDone={handleReleaseFlip}
                            />
                          </div>
                        </Show>

                        <Show when={locked && !current.releaseAt}>
                          <div class="card card-plain text-center py-2">
                            <p class="comment font-semibold">
                              Unlocks on Day {current.day} evening
                            </p>
                          </div>
                        </Show>

                        <Show when={previewing}>
                          <div class="card card-plain flex flex-col items-center justify-center gap-2 p-3 text-center">
                            <p class="comment text-sm">Playable in</p>
                            <Show
                              when={current.releaseAt}
                              fallback={<p class="font-extrabold">Later today</p>}
                            >
                              <Countdown
                                target={new Date(current.releaseAt!)}
                                onDone={handleReleaseFlip}
                              />
                            </Show>
                          </div>
                          <Show
                            when={
                              (current.testerMode ?? true) &&
                              (me()?.role === "tester" || me()?.role === "admin")
                            }
                          >
                            <A
                              href={playHref}
                              onClick={() => markArenaFromHub()}
                              class="btn-ghost w-full text-center text-base py-2.5 block"
                            >
                              Take a look before it opens →
                            </A>
                          </Show>
                        </Show>

                        <Show when={!locked && !previewing && current.endAt}>
                          <div class="card card-plain flex flex-col items-center justify-center gap-1 p-3 text-center">
                            <p class="comment text-sm">Time left to play today</p>
                            <Countdown
                              target={new Date(current.endAt!)}
                              doneLabel="Game closed"
                              onDone={handleReleaseFlip}
                              compact
                            />
                          </div>
                        </Show>

                        <Show when={current.status === "live" || current.status === "tester"}>
                          <Show
                            when={isDay7}
                            fallback={
                              <button
                                type="button"
                                onClick={() => handlePlayClick(current)}
                                onMouseEnter={() => prewarmArena(current.slug)}
                                onTouchStart={() => prewarmArena(current.slug)}
                                onFocus={() => prewarmArena(current.slug)}
                                disabled={busy()}
                                class="btn-brand w-full text-center text-lg py-3 block font-black cursor-pointer"
                              >
                                <Show when={me()} fallback={`Sign in & Play Day ${current.day} →`}>
                                  {busy() && activeModalGame()?.slug === current.slug
                                    ? "Starting…"
                                    : isRunning()
                                      ? `Resume Day ${current.day} Challenge →`
                                      : isCompleted()
                                        ? `View Day ${current.day} Result →`
                                        : (currentAttempt()?.attemptsUsed ?? 0) > 0
                                          ? `Play Day ${current.day} (Attempt ${(currentAttempt()?.attemptsUsed ?? 0) + 1}) →`
                                          : `Play Day ${current.day} Now →`}
                                </Show>
                              </button>
                            }
                          >
                            <A
                              href={playHref}
                              class="btn-brand w-full text-center text-lg py-3 block font-black"
                            >
                              <Show when={me()} fallback="Sign in to Vote in ELO Showdown →">
                                Vote in ELO Showdown →
                              </Show>
                            </A>
                          </Show>
                        </Show>

                        <Show when={current.status === "closed"}>
                          <Show
                            when={
                              (me()?.role === "tester" || me()?.role === "admin") &&
                              current.testerMode
                            }
                            fallback={
                              <A
                                href={
                                  isDay7
                                    ? "/code-a-pookalam/vote"
                                    : currentAttempt()?.status === "submitted"
                                      ? `/leaderboard?day=${current.day}`
                                      : `/games/${current.slug}`
                                }
                                onClick={() => markArenaFromHub()}
                                class="btn-ghost w-full text-center text-base py-2.5 block"
                              >
                                <Show
                                  when={isDay7}
                                  fallback={
                                    currentAttempt()?.status === "submitted"
                                      ? `View Day ${current.day} Result →`
                                      : `View Day ${current.day} →`
                                  }
                                >
                                  View Final Results →
                                </Show>
                              </A>
                            }
                          >
                            <Show
                              when={isDay7}
                              fallback={
                                <button
                                  type="button"
                                  onClick={() => handlePlayClick(current)}
                                  disabled={busy()}
                                  class="btn-accent w-full text-center text-base py-2.5 block font-black cursor-pointer"
                                >
                                  {busy() && activeModalGame()?.slug === current.slug
                                    ? "Starting…"
                                    : isRunning()
                                      ? `Resume Day ${current.day} Challenge →`
                                      : `Play Day ${current.day} (Tester Access) →`}
                                </button>
                              }
                            >
                              <A
                                href="/code-a-pookalam/vote"
                                class="btn-accent w-full text-center text-base py-2.5 block font-black"
                              >
                                View Final Results →
                              </A>
                            </Show>
                          </Show>
                        </Show>
                      </div>
                    </div>
                  </div>
                </article>

                {/* 7-Day Selector Strip */}
                <div class="space-y-2">
                  <p
                    class="text-xs font-extrabold uppercase tracking-widest text-center"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    Select Day to Preview
                  </p>
                  <div class="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
                    <For each={fullSchedule()}>
                      {(item) => {
                        const isSelected =
                          item.slug && activeGame()?.slug
                            ? item.slug === activeGame()?.slug
                            : item.day === selectedDay();
                        const isLock = item.status === "upcoming";
                        const st = statusSticker[item.status] ?? statusSticker.upcoming;

                        return (
                          <button
                            type="button"
                            onClick={() => selectGame(item.day, item.slug)}
                            class={`flex flex-col items-center gap-1.5 p-2 rounded-lg text-center transition-all cursor-pointer select-none shrink-0 w-24 sm:w-auto ${
                              isSelected
                                ? "pop-yellow shadow-md scale-[1.02]"
                                : "bg-[var(--paper-2)] opacity-85 hover:opacity-100"
                            }`}
                            style={{
                              border: isSelected
                                ? "var(--ink-w-bold) solid var(--ink)"
                                : "var(--ink-w) solid var(--ink)",
                            }}
                          >
                            <span class="text-xs font-black uppercase tracking-wider">
                              Day {item.day}
                            </span>

                            <div
                              class="w-12 h-12 rounded-lg overflow-hidden border border-[var(--ink)] bg-[var(--paper-3)] shrink-0 relative"
                              style={{
                                filter: isLock ? "grayscale(100%)" : "none",
                              }}
                            >
                              <Show
                                when={!isLock}
                                fallback={
                                  <div class="w-full h-full grid place-items-center bg-[var(--paper-3)] relative">
                                    <div class="absolute inset-0 opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]" />
                                    <div class="relative z-10 w-6 h-6 rounded-full bg-[var(--paper-2)] border border-[var(--ink)] grid place-items-center text-[var(--ink)]">
                                      <Lock size={12} strokeWidth={2.5} />
                                    </div>
                                  </div>
                                }
                              >
                                <img
                                  src={gameImageForType(item.gameType)}
                                  alt={item.title}
                                  loading="lazy"
                                  class="h-full w-full object-cover aspect-square"
                                />
                              </Show>
                            </div>

                            <span class="text-[10px] font-extrabold truncate w-full">
                              {isLock ? "Locked" : item.title}
                            </span>
                            <span
                              class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                              style={{
                                background: st.pop,
                                border: "1px solid var(--ink)",
                              }}
                            >
                              {st.label}
                            </span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </section>
            );
          })()}
        </Show>
      </Show>

      {/* Rules & Help Section */}
      <section id="how-it-works" class="space-y-4 pt-4">
        <h2 class="rule">Daily Challenge Rules</h2>
        <div class="grid md:grid-cols-3 gap-3">
          <div class="card pop-yellow space-y-1.5">
            <div class="flex items-center gap-2">
              <SpriteIcon name="maveli-laptop" size={24} interactive />
              <h3 class="font-black text-base m-0">1. A Game a Day</h3>
            </div>
            <p class="text-xs font-semibold leading-relaxed text-muted m-0">
              A new puzzle unlocks each evening. Complete the challenge fast to take home daily ₹200
              cash bounties.
            </p>
          </div>

          <div class="card pop-teal space-y-1.5">
            <div class="flex items-center gap-2">
              <SpriteIcon name="tux-king" size={24} interactive />
              <h3 class="font-black text-base m-0">2. Identical Seeds</h3>
            </div>
            <p class="text-xs font-semibold leading-relaxed text-muted m-0">
              Same board, same seed, same difficulty for every player. Cryptographically validated
              on the server with zero client trust.
            </p>
          </div>

          <div class="card pop-pink space-y-1.5">
            <div class="flex items-center gap-2">
              <SpriteIcon name="sadya-leaf" size={24} interactive />
              <h3 class="font-black text-base m-0">3. Daily Sprints</h3>
            </div>
            <p class="text-xs font-semibold leading-relaxed text-muted m-0">
              Each puzzle has a strict 24-hour competition window. Solve before the daily deadline
              to lock in your score and rank!
            </p>
          </div>
        </div>
      </section>

      {/* Fair Play Modal */}
      <Show when={showFairPlay()}>
        <FairPlayModal
          onAccept={() => {
            setShowFairPlay(false);
          }}
          onClose={() => {
            setShowFairPlay(false);
            setActiveModalGame(null);
          }}
        />
      </Show>

      {/* How to Play Modal with Start Button */}
      <Show when={activeModalGame() && !showFairPlay()}>
        <HowToPlayModal
          gameType={activeModalGame()!.gameType}
          title={activeModalGame()!.title}
          steps={activeModalGame()!.howTo}
          error={error()}
          startLabel={
            busy()
              ? "STARTING…"
              : activeModalGame()?.gameType === "hunt"
                ? "ENTER THE HUNT"
                : activeModalGame()?.gameType === "jump"
                  ? "START CLIMB"
                  : "START THE CLOCK"
          }
          busy={busy()}
          onStart={() => void startAndLaunch()}
          onClose={() => {
            setError("");
            setActiveModalGame(null);
          }}
        />
      </Show>

      {/* Error Toast - Top Right, Clean Border, No Shadows, No Emoji Face */}
      <Show when={error() && !activeModalGame()}>
        <div class="fixed top-5 right-5 z-[100] max-w-sm card pop-red p-3.5 space-y-2.5 shadow-none border-2 border-[var(--ink)]">
          <div class="flex items-start gap-2.5">
            <AlertCircle size={18} class="shrink-0 text-white mt-0.5" />
            <p class="flex-1 font-bold text-xs sm:text-sm text-white m-0 leading-snug">{error()}</p>
          </div>
          <button
            type="button"
            class="btn-ghost text-xs py-1 w-full cursor-pointer bg-white/20 hover:bg-white/30 text-white font-bold rounded"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      </Show>
    </main>
  );
}
