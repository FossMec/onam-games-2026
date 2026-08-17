import { Title } from "@solidjs/meta";
import { A, createAsync, useSearchParams } from "@solidjs/router";
import { ChevronLeft, ChevronRight, HelpCircle, Lock } from "lucide-solid";
import { For, Show } from "solid-js";

import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { Countdown } from "~/components/Countdown";
import { LoadingScreen } from "~/components/LoadingScreen";
import { type SpriteName } from "~/lib/sprites";
import { getMe } from "~/server/auth/actions";
import { getGames } from "~/server/games/actions";
import { getPookalamState } from "~/server/pookalam/actions";

const DAY_POPS = [
  "pop-yellow",
  "pop-teal",
  "pop-pink",
  "pop-blue",
  "pop-purple",
  "pop-red",
  "pop-yellow",
];

const GAME_IMAGES: Record<string, string> = {
  "open-source-tinder": "/images/games/open-source-tinder.webp",
  "pookalam-jigsaw": "/images/games/pookalam-jigsaw.webp",
  wend: "/images/games/wend.webp",
  "escape-the-vallam": "/images/games/escape-the-vallam.webp",
  "maveli-jump": "/images/games/maveli-jump.webp",
  "treasure-hunt": "/images/games/treasure-hunt.webp",
  "code-a-pookalam-vote": "/images/games/code-a-pookalam.webp",
};

const GAME_TEASERS: Record<number, { hint: string; icon: SpriteName }> = {
  1: {
    hint: "Swipe right on open source, swipe left on proprietary EULAs.",
    icon: "tux-king",
  },
  2: {
    hint: "Radial symmetry was a mistake and you're about to find out why.",
    icon: "sadya-leaf",
  },
  3: {
    hint: "A word puzzle entangled in banana leaves.",
    icon: "octocat-garland",
  },
  4: {
    hint: "Unblock the snake boat before the floodwaters rise.",
    icon: "docker-pookalam",
  },
  5: {
    hint: "Help the king hop the platforms back to earth.",
    icon: "ferris-crab",
  },
  6: {
    hint: "Clue one is here. The rest are hidden in the source.",
    icon: "gopher-king",
  },
  7: {
    hint: "Vote on community coded pookalams in 1v1 faceoffs.",
    icon: "pookalam-flower",
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface VotingPhase {
  open: boolean;
  reason: string;
  opensAt: string | null;
  closesAt: string | null;
}

function day7Schedule(
  scheduled: { day: number; releaseAt: string | null }[],
  voting: VotingPhase | undefined,
): { status: string; releaseAt: string | null } {
  const opensAt = voting?.opensAt ?? derivedDay7Release(scheduled);
  if (voting?.open) return { status: "live", releaseAt: opensAt };
  if (voting?.reason === "over") return { status: "closed", releaseAt: opensAt };
  if (!opensAt) return { status: "upcoming", releaseAt: null };
  const untilOpen = new Date(opensAt).getTime() - Date.now();
  return { status: untilOpen <= DAY_MS ? "preview" : "upcoming", releaseAt: opensAt };
}

function derivedDay7Release(scheduled: { day: number; releaseAt: string | null }[]): string | null {
  const anchor = scheduled.filter((game) => game.releaseAt).sort((a, b) => b.day - a.day)[0];
  if (!anchor?.releaseAt) return null;
  return new Date(new Date(anchor.releaseAt).getTime() + (7 - anchor.day) * DAY_MS).toISOString();
}

const statusSticker: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  preview: { label: "Opens soon", pop: "var(--pop-yellow)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Catch up", pop: "var(--pop-blue)" },
};

export default function GamesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const games = createAsync(() => getGames());
  const pookalamState = createAsync(() => getPookalamState());
  const me = createAsync(() => getMe());

  const fullSchedule = () => {
    const list = games();
    if (!list) return [];
    const scheduled = list.map((g) => ({ day: g.day, releaseAt: g.releaseAt }));
    const d7 = day7Schedule(scheduled, pookalamState()?.phases.voting);
    const day7Item = {
      id: "day-7-vote",
      slug: "code-a-pookalam-vote",
      day: 7,
      title: "The Pookalam Arena",
      tagline: "1v1 Elo voting showdown. Community settles the podium.",
      status: d7.status,
      difficulty: "community",
      metric: "fcfs",
      maxAttempts: 1,
      releaseAt: d7.releaseAt,
      endAt: pookalamState()?.phases.voting?.closesAt ?? null,
    };
    return [...list, day7Item];
  };

  const activeGame = () => {
    const list = fullSchedule();
    if (list.length === 0) return null;
    const requested = Number(searchParams.day);
    if (!Number.isNaN(requested) && requested >= 1 && requested <= 7) {
      const match = list.find((g) => g.day === requested);
      if (match) return match;
    }
    const live = list.find((g) => g.status === "live" || g.status === "tester");
    if (live) return live;
    const preview = list.find((g) => g.status === "preview");
    if (preview) return preview;
    return list[0];
  };

  const selectedDay = () => activeGame()?.day ?? 1;

  const selectDay = (dayNum: number) => {
    setSearchParams({ day: dayNum }, { replace: true, scroll: false });
  };

  return (
    <main class="container space-y-8 py-6">
      <Title>Daily Mini-Games Arena - FOSS Onam</Title>

      {/* Header Banner */}
      <section
        class="relative overflow-hidden rounded-lg px-4 py-8 text-center sm:px-6 sm:py-10 space-y-4"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <Confetti seed="games-hero" count={8} opacity={0.4} animate />
        <SpriteScatter
          seed="games-hero-sprites"
          count={5}
          pool={[
            "maveli-laptop",
            "tux-king",
            "sadya-leaf",
            "octocat-garland",
            "arch-crown",
            "ferris-crab",
            "gopher-king",
          ]}
          minSize={32}
          maxSize={48}
          opacity={0.85}
          animate
        />

        <div class="art-over space-y-3 max-w-3xl mx-auto">
          <div class="flex justify-center">
            <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
              ₹200 Daily Cash Bounties · 7 Days of Challenges
            </span>
          </div>

          <div class="flex items-center justify-center gap-3">
            <SpriteIcon name="maveli-laptop" size={38} animate="float" interactive />
            <h1
              class="wordmark tracking-wider m-0"
              data-text="DAILY GAMES ARENA"
              style={{ "font-size": "clamp(1.5rem, 6vw, 3.25rem)" }}
            >
              DAILY GAMES ARENA
            </h1>
            <SpriteIcon name="tux-king" size={38} animate="float" delay={1.2} interactive />
          </div>

          <p class="mx-auto max-w-xl text-sm sm:text-base font-semibold leading-relaxed">
            One fresh mini-game unlocks every evening! Solve fast to top that day's verified
            leaderboard and win cash bounties. Same puzzle, same seed, 100% fair.
          </p>
        </div>
      </section>

      {/* Main Arena Showcase */}
      <Show when={games()} fallback={<LoadingScreen compact message="Loading games arena…" />}>
        <Show when={activeGame()}>
          {(() => {
            const current = activeGame()!;
            const locked = current.status === "upcoming";
            const previewing = current.status === "preview";
            const sticker = statusSticker[current.status] ?? statusSticker.upcoming;
            const teaser = GAME_TEASERS[current.day] ?? {
              hint: "A mystery game",
              icon: "tux-king",
            };
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
                              src={
                                GAME_IMAGES[current.slug] ?? "/images/games/open-source-tinder.webp"
                              }
                              alt="Classified preview"
                              class="absolute inset-0 h-full w-full object-cover blur-xl opacity-40 grayscale"
                            />
                            <div class="relative z-10 space-y-2">
                              <SpriteIcon name={teaser.icon} size={48} animate="wobble" />
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
                          src={GAME_IMAGES[current.slug] ?? "/images/games/open-source-tinder.webp"}
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
                          <SpriteIcon name={teaser.icon} size={28} animate="wobble" interactive />
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
                            <p class="comment text-lg font-semibold">"{teaser.hint}"</p>
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
                            <Countdown target={new Date(current.releaseAt!)} />
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
                              <Countdown target={new Date(current.releaseAt!)} />
                            </Show>
                          </div>
                          <A
                            href={playHref}
                            class="btn-ghost w-full text-center text-base py-2.5 block"
                          >
                            Take a look before it opens →
                          </A>
                        </Show>

                        <Show when={current.status === "live" || current.status === "tester"}>
                          <A
                            href={playHref}
                            class="btn-brand w-full text-center text-lg py-3 block"
                          >
                            <Show
                              when={me()}
                              fallback={
                                isDay7
                                  ? "Sign in to Vote in ELO Showdown →"
                                  : `Sign in & Play Day ${current.day} →`
                              }
                            >
                              {isDay7 ? "Vote in ELO Showdown →" : `Play Day ${current.day} Now →`}
                            </Show>
                          </A>
                        </Show>

                        <Show when={current.status === "closed"}>
                          <A
                            href={playHref}
                            class="btn-ghost w-full text-center text-base py-2.5 block"
                          >
                            <Show
                              when={me()}
                              fallback={
                                isDay7 ? "Sign in to View Results →" : "Sign in to Play Catch-up →"
                              }
                            >
                              {isDay7 ? "View Results →" : `Play Catch-up (Unranked) →`}
                            </Show>
                          </A>
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
                        const isSelected = item.day === selectedDay();
                        const isLock = item.status === "upcoming";
                        const st = statusSticker[item.status] ?? statusSticker.upcoming;

                        return (
                          <button
                            type="button"
                            onClick={() => selectDay(item.day)}
                            class={`card w-[7.5rem] shrink-0 snap-start sm:w-auto p-2 text-center flex flex-col items-center justify-between gap-1.5 transition-all cursor-pointer ${
                              DAY_POPS[(item.day - 1) % DAY_POPS.length]
                            } ${
                              isSelected
                                ? "ring-4 ring-[var(--ink)] translate-y-[-2px] shadow-none font-bold"
                                : "opacity-85 hover:opacity-100 hover:translate-y-[-1px]"
                            }`}
                            style={{
                              border: isSelected
                                ? "var(--ink-w-bold) solid var(--ink)"
                                : "var(--ink-w) solid var(--ink)",
                            }}
                          >
                            <span
                              class="text-[11px] font-extrabold uppercase tracking-wider"
                              style={{
                                "font-family": "var(--font-stack-display)",
                              }}
                            >
                              Day {item.day}
                            </span>

                            <div
                              class="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded aspect-square overflow-hidden bg-[var(--paper-3)] shrink-0 relative flex items-center justify-center"
                              style={{
                                border: "var(--ink-w) solid var(--ink)",
                              }}
                            >
                              <Show
                                when={!isLock}
                                fallback={
                                  <div class="relative w-full h-full flex items-center justify-center">
                                    <img
                                      src={
                                        GAME_IMAGES[item.slug] ??
                                        "/images/games/open-source-tinder.webp"
                                      }
                                      alt="Locked preview"
                                      class="absolute inset-0 w-full h-full object-cover blur-sm opacity-40 grayscale"
                                    />
                                    <div class="relative z-10 w-6 h-6 rounded-full bg-[var(--paper-2)] border border-[var(--ink)] grid place-items-center text-[var(--ink)]">
                                      <Lock size={12} strokeWidth={2.5} />
                                    </div>
                                  </div>
                                }
                              >
                                <img
                                  src={
                                    GAME_IMAGES[item.slug] ??
                                    "/images/games/open-source-tinder.webp"
                                  }
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
              <h3 class="font-black text-base m-0">3. Catch-Up Play</h3>
            </div>
            <p class="text-xs font-semibold leading-relaxed text-muted m-0">
              Missed earlier days? All past games stay open in unranked practice mode all festival
              long!
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
