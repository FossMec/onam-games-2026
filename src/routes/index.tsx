import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createEffect, createSignal } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { Bubble, Burst, Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { EVENT, POOKALAM } from "~/lib/event-content";
import { type SpriteName } from "~/lib/sprites";
import { getMe } from "~/server/auth/actions";
import { signOutAndReload } from "~/lib/sign-out";
import { getGames } from "~/server/games/actions";

/** Each day gets its own pop colour so the week reads as a strip of panels. */
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
  "open-source-tinder": "/images/games/open-source-tinder.jpeg",
  "pookalam-jigsaw": "/images/games/pookalam-jigsaw.jpeg",
  wend: "/images/games/wend.jpeg",
  "escape-the-vallam": "/images/games/escape-the-vallam.jpeg",
  "maveli-jump": "/images/games/maveli-jump.jpeg",
  "treasure-hunt": "/images/games/treasure-hunt.jpeg",
  "code-a-pookalam-vote": "/images/games/code-a-pookalam.jpeg",
};

const GAME_TEASERS: Record<number, { hint: string; icon: SpriteName }> = {
  1: {
    hint: "An interface you'll find most useful in your life.",
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

const statusSticker: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Catch up", pop: "var(--pop-blue)" },
};

function Section(props: { title: string; children: unknown; id?: string }) {
  return (
    <section id={props.id} class="space-y-5">
      <h2 class="rule">{props.title}</h2>
      {props.children as never}
    </section>
  );
}

export default function Home() {
  const games = createAsync(() => getGames());
  const me = createAsync(() => getMe());
  const [signingOut, setSigningOut] = createSignal(false);
  const [selectedDay, setSelectedDay] = createSignal<number>(1);

  const liveGame = () => games()?.find((g) => g.status === "live" || g.status === "tester");

  // Auto-focus on currently live game if available
  createEffect(() => {
    const live = liveGame();
    if (live) {
      setSelectedDay(live.day);
    }
  });

  // Assemble full 7-day schedule
  const fullSchedule = () => {
    const rawGames = games() ?? [];
    const list = [...rawGames];

    // Check if Day 7 is in the DB games list, otherwise append Day 7 ELO Voting
    if (!list.some((g) => g.day === 7)) {
      list.push({
        id: "day-7-vote",
        slug: "code-a-pookalam-vote",
        day: 7,
        title: "Code-a-Pookalam ELO Voting",
        hint: "Vote on community coded pookalams in 1v1 faceoffs.",
        tagline: "Head-to-head pookalam showdown: judge pairs of coded art to crown the champion.",
        difficulty: "community",
        metric: "vote" as never,
        maxAttempts: 1,
        status: "upcoming",
        releaseAt: null,
        statusLabel: "Locked",
      } as never);
    }

    return list.sort((a, b) => a.day - b.day);
  };

  const activeGame = () => {
    const sched = fullSchedule();
    return sched.find((g) => g.day === selectedDay()) ?? sched[0];
  };

  return (
    <main class="container space-y-14 py-6">
      <Title>{EVENT.name}</Title>

      {/* ------------------------------------------------------------- hero */}
      <section
        class="relative overflow-hidden rounded-lg px-5 py-10 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="hero" count={10} animate />
        <SpriteScatter
          seed="hero-sprites"
          count={7}
          pool={[
            "maveli-laptop",
            "tux-king",
            "sadya-leaf",
            "octocat-garland",
            "arch-crown",
            "docker-pookalam",
            "ferris-crab",
            "gopher-king",
            "foss-mec-badge",
          ]}
          minSize={36}
          maxSize={54}
          opacity={0.9}
          animate
        />
        <div class="art-over space-y-4">
          <div class="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
            <SpriteIcon
              name="maveli-laptop"
              size={56}
              animate="float"
              interactive
              class="hidden xs:inline-flex"
            />
            <p class="wordmark text-4xl sm:text-6xl" data-text="FOSS ONAM">
              FOSS ONAM
            </p>
            <SpriteIcon
              name="linus-torvalds"
              size={64}
              animate="wobble"
              delay={0.4}
              interactive
              class="inline-flex"
            />
            <SpriteIcon
              name="tux-king"
              size={56}
              animate="float"
              delay={1.2}
              interactive
              class="hidden xs:inline-flex"
            />
          </div>
          <p
            class="mx-auto max-w-lg text-lg font-extrabold"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            {EVENT.tagline}
          </p>
          <p class="mx-auto max-w-2xl font-semibold leading-relaxed">{EVENT.blurb}</p>

          <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Show
              when={me()}
              fallback={
                <a href="/auth/signin" class="btn-brand">
                  Sign in & play
                </a>
              }
            >
              <Show
                when={liveGame()}
                fallback={
                  <a href="/leaderboard" class="btn-brand">
                    See the board
                  </a>
                }
              >
                <a href={`/games/${liveGame()!.slug}`} class="btn-brand">
                  Play today's game (Day {liveGame()!.day})
                </a>
              </Show>
            </Show>
            <a href="#pookalam" class="btn-accent">
              Code-a-Pookalam
            </a>
            <a href="#games-arena" class="btn-ghost">
              Explore 7 Days ↓
            </a>
          </div>

          <Show when={!me()}>
            <p class="comment">{EVENT.registerNote}</p>
          </Show>
        </div>
      </section>

      {/* ---------------------------------------------------- signed-in bar */}
      <Show when={me()}>
        <div class="card card-plain flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <SpriteIcon name="foss-mec-badge" size={40} animate="wobble" interactive />
            <div>
              <p class="text-lg font-extrabold">Hi, {me()!.name}</p>
              <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                Streak {me()!.streakCount} · Best {me()!.bestStreak}
                {me()!.role === "admin" ? " · Admin" : ""}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Show when={!me()!.onboardingCompleted}>
              <a href="/onboarding" class="btn-accent">
                Finish profile
              </a>
            </Show>
            <a href="/leaderboard" class="btn-ghost">
              Leaderboard
            </a>
            <button
              type="button"
              class="btn-ghost"
              disabled={signingOut()}
              onClick={() => {
                setSigningOut(true);
                void signOutAndReload();
              }}
            >
              {signingOut() ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </Show>

      {/* -------------------------------------------------------- code-a-pookalam */}
      <Section title="Code-a-Pookalam" id="pookalam">
        <div
          class="relative overflow-hidden rounded-lg p-4 sm:p-6"
          style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-pink)" }}
        >
          <Halftone opacity={0.12} />
          <div class="art-over flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
            {/* 1:1 Square Artwork */}
            <div
              class="relative overflow-hidden rounded-lg aspect-square w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 shrink-0 shadow-none bg-[var(--paper-2)]"
              style={{
                border: "var(--ink-w-bold) solid var(--ink)",
              }}
            >
              <img
                src="/images/games/code-a-pookalam.jpeg"
                alt="Code-a-Pookalam Artwork"
                loading="lazy"
                class="h-full w-full object-cover aspect-square"
              />
            </div>

            {/* Content Area */}
            <div class="space-y-3 flex-1 min-w-0 text-center sm:text-left w-full">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <SpriteIcon name="pookalam-flower" size={26} animate="wobble" interactive />
                  <h3 class="text-xl sm:text-2xl font-extrabold">{POOKALAM.title}</h3>
                </div>
                <span class="sticker shrink-0" style={{ "--pop": "var(--pop-yellow)" }}>
                  Open All Week
                </span>
              </div>

              <p
                class="font-extrabold text-sm sm:text-base"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                {POOKALAM.tagline}
              </p>
              <p
                class="text-xs sm:text-sm font-semibold leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                {POOKALAM.blurb}
              </p>

              {/* Inline badges row */}
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                <span class="badge text-[11px]" style={{ "--pop": "var(--paper-2)" }}>
                  Submit by {POOKALAM.submitBy}
                </span>
                <span class="badge text-[11px]" style={{ "--pop": "var(--pop-teal)" }}>
                  ₹3,000 Prize Pool
                </span>
              </div>

              {/* Single action button */}
              <div class="pt-1">
                <a
                  href="/code-a-pookalam"
                  class="btn-brand text-xs sm:text-sm py-2 px-4 inline-flex items-center gap-1.5"
                >
                  <span>Explore Code-a-Pookalam</span>
                  <span>→</span>
                </a>
              </div>
              <p class="comment text-xs">{POOKALAM.aside}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- daily games arena */}
      <Section title="Daily Games Arena" id="games-arena">
        <Show when={!games()}>
          <p class="font-semibold text-center py-6">Loading the schedule…</p>
        </Show>

        <Show when={activeGame()}>
          {(() => {
            const current = activeGame()!;
            const locked = current.status === "upcoming";
            const sticker = statusSticker[current.status] ?? statusSticker.upcoming;
            const teaser = GAME_TEASERS[current.day] ?? {
              hint: "A mystery game",
              icon: "tux-king",
            };
            const isDay7 = current.day === 7;
            const targetHref = isDay7 ? "/code-a-pookalam/vote" : `/games/${current.slug}`;
            const playHref = me() ? targetHref : "/auth/signin";

            return (
              <div class="space-y-6 max-w-4xl mx-auto">
                {/* Control bar: Prev / Day Selector / Next / Help */}
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDay((prev) => (prev > 1 ? prev - 1 : 7))}
                      class="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                      aria-label="Previous Day"
                    >
                      <span>←</span>
                      <span class="font-extrabold">Prev Day</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDay((prev) => (prev < 7 ? prev + 1 : 1))}
                      class="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                      aria-label="Next Day"
                    >
                      <span class="font-extrabold">Next Day</span>
                      <span>→</span>
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
                      class="text-xs font-extrabold underline decoration-2 underline-offset-4 px-2 py-1"
                      style={{ color: "var(--ink)" }}
                    >
                      Rules & Help ↓
                    </a>
                  </div>
                </div>

                {/* Main Centered Showcase Card */}
                <article
                  class={`card ${DAY_POPS[(current.day - 1) % DAY_POPS.length]} relative overflow-hidden p-5 sm:p-7 space-y-5`}
                >
                  <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* 1:1 Square Artwork Container */}
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
                                GAME_IMAGES[current.slug] ?? "/images/games/open-source-tinder.jpeg"
                              }
                              alt="Classified preview"
                              class="absolute inset-0 h-full w-full object-cover blur-xl opacity-40 grayscale"
                            />
                            <div class="relative z-10 space-y-2">
                              <SpriteIcon name={teaser.icon} size={48} animate="wobble" />
                              <p
                                class="text-xl font-extrabold uppercase tracking-widest"
                                style={{ "font-family": "var(--font-stack-display)" }}
                              >
                                ? ? ? ?
                              </p>
                              <span class="sticker" style={{ "--pop": "var(--pop-red)" }}>
                                🔒 Classified
                              </span>
                            </div>
                          </div>
                        }
                      >
                        <img
                          src={GAME_IMAGES[current.slug] ?? "/images/games/open-source-tinder.jpeg"}
                          alt={current.title}
                          loading="lazy"
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
                            style={{ "font-family": "var(--font-stack-display)" }}
                          >
                            Day {current.day}
                          </span>
                        </div>
                        <span class="sticker" style={{ "--pop": sticker.pop }}>
                          {sticker.label}
                        </span>
                      </div>

                      <h3 class="text-2xl sm:text-3xl">
                        <Show when={!locked} fallback={<span>Day {current.day}: ????????</span>}>
                          <a href={playHref} class="underline decoration-2 underline-offset-4">
                            {current.title}
                          </a>
                        </Show>
                      </h3>

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
                          {current.maxAttempts > 1 ? `${current.maxAttempts} runs` : "one shot"}
                        </span>
                        <span class="badge">
                          {current.metric === "score"
                            ? "highest wins"
                            : isDay7
                              ? "community vote"
                              : "fastest wins"}
                        </span>
                      </div>

                      {/* Main Action Area */}
                      <div class="pt-3 space-y-2">
                        <Show when={locked && current.releaseAt}>
                          <div class="card card-plain space-y-1 text-center">
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

                        <Show when={current.status === "live" || current.status === "tester"}>
                          <a
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
                          </a>
                        </Show>

                        <Show when={current.status === "closed"}>
                          <a
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
                          </a>
                        </Show>
                      </div>
                    </div>
                  </div>
                </article>

                {/* 7-Day Mini Selector Strip */}
                <div class="space-y-2">
                  <p
                    class="text-xs font-extrabold uppercase tracking-widest text-center"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    Select Day to Preview
                  </p>
                  <div class="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-7 gap-2.5">
                    <For each={fullSchedule()}>
                      {(item) => {
                        const isSelected = item.day === selectedDay();
                        const isLock = item.status === "upcoming";
                        const st = statusSticker[item.status] ?? statusSticker.upcoming;

                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedDay(item.day)}
                            class={`card p-2 text-center flex flex-col items-center justify-between gap-1.5 transition-all cursor-pointer ${
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
                              style={{ "font-family": "var(--font-stack-display)" }}
                            >
                              Day {item.day}
                            </span>

                            {/* Actual 1:1 Event Image Thumbnail */}
                            <div
                              class="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded aspect-square overflow-hidden bg-[var(--paper-3)] shrink-0 relative flex items-center justify-center"
                              style={{ border: "var(--ink-w) solid var(--ink)" }}
                            >
                              <Show
                                when={!isLock}
                                fallback={
                                  <div class="relative w-full h-full flex items-center justify-center">
                                    <img
                                      src={
                                        GAME_IMAGES[item.slug] ??
                                        "/images/games/open-source-tinder.jpeg"
                                      }
                                      alt="Locked preview"
                                      class="absolute inset-0 w-full h-full object-cover blur-sm opacity-40 grayscale"
                                    />
                                    <span class="relative z-10 text-xs font-black">🔒</span>
                                  </div>
                                }
                              >
                                <img
                                  src={
                                    GAME_IMAGES[item.slug] ??
                                    "/images/games/open-source-tinder.jpeg"
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
              </div>
            );
          })()}
        </Show>
      </Section>

      {/* ---------------------------------------------------------- prizes */}
      <Section title="Prizes & Rewards">
        <div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <For each={EVENT.prizes}>
            {(prize, index) => {
              const prizeIcons = [
                "tux-king",
                "pookalam-flower",
                "gopher-king",
                "nilavilakku",
                "burst-yellow",
              ] as const;
              const pIcon = prizeIcons[index() % prizeIcons.length];
              return (
                <div class={`card ${DAY_POPS[index() % DAY_POPS.length]} flex items-start gap-3`}>
                  <SpriteIcon name={pIcon} size={36} animate="wobble" interactive class="mt-0.5" />
                  <div>
                    <p class="font-extrabold text-base">{prize.rank}</p>
                    <p class="text-sm font-semibold pt-0.5" style={{ color: "var(--ink-soft)" }}>
                      {prize.detail}
                    </p>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Section>

      {/* ---------------------------------------------------- how it works (8 items) */}
      <Section title="How it works" id="how-it-works">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <For each={EVENT.howItWorks}>
            {(step, index) => (
              <div class="card card-plain flex flex-col gap-2.5 justify-between">
                <div class="flex items-start gap-3">
                  <div class="relative h-10 w-10 shrink-0">
                    <Burst color="var(--pop-yellow)" seed={`how-${index()}`} spikes={10} />
                    <span
                      class="absolute inset-0 grid place-items-center text-base font-extrabold"
                      style={{ "font-family": "var(--font-stack-display)" }}
                    >
                      {index() + 1}
                    </span>
                  </div>
                  <div>
                    <p class="font-extrabold text-base">{step.title}</p>
                    <p
                      class="text-xs sm:text-sm font-semibold pt-1"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* --------------------------------------------------------- scoring */}
      <Section title={EVENT.scoring.title} id="scoring">
        <Bubble color="var(--pop-teal)">
          <p class="font-semibold">{EVENT.scoring.body}</p>
        </Bubble>
        <p class="comment">{EVENT.scoring.aside}</p>
      </Section>

      {/* ----------------------------------------------------------- rules */}
      <Section title="Fair play">
        <ul class="card card-plain space-y-2">
          <For each={EVENT.rules}>
            {(rule) => (
              <li class="flex gap-2 font-semibold">
                <span style={{ color: "var(--pop-red)" }}>▸</span>
                <span>{rule}</span>
              </li>
            )}
          </For>
        </ul>
      </Section>

      {/* ------------------------------------------------------------- faq */}
      <Section title="Questions">
        <div class="space-y-3">
          <For each={EVENT.faq}>
            {(item) => (
              <details class="card card-plain">
                <summary
                  class="cursor-pointer text-lg font-extrabold"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  {item.q}
                </summary>
                <p class="pt-2 font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {item.a}
                </p>
              </details>
            )}
          </For>
        </div>
      </Section>

      {/* -------------------------------------------------------- last CTA */}
      <Show when={!me()}>
        <section
          class="relative overflow-hidden rounded-lg p-8 text-center"
          style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-yellow)" }}
        >
          <Confetti seed="cta" count={6} />
          <SpriteScatter
            seed="cta-spr"
            count={5}
            pool={["linus-torvalds", "gnu-garland", "bird-mascot", "foss-mec-badge", "sadya-leaf"]}
            minSize={36}
            maxSize={52}
            opacity={0.88}
            animate
          />
          <div class="art-over space-y-3">
            <div class="flex justify-center">
              <SpriteIcon name="foss-mec-badge" size={60} animate="float" interactive />
            </div>
            <h2 class="text-3xl">Still reading?</h2>
            <p class="font-semibold">The leaderboard isn't going to lose to you on its own.</p>
            <a href="/auth/signin" class="btn-ghost">
              Sign in with Google
            </a>
          </div>
        </section>
      </Show>
    </main>
  );
}
