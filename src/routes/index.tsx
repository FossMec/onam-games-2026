import { Title } from "@solidjs/meta";
import { A, createAsync, useNavigate, useSearchParams } from "@solidjs/router";
import type { RouteDefinition } from "@solidjs/router";
import { BookOpen, Clock, Lock, Zap } from "lucide-solid";
import { For, Show, createEffect, createSignal } from "solid-js";

import { Countdown } from "~/components/Countdown";
import { LoadingScreen } from "~/components/LoadingScreen";
import { MaveliLetter } from "~/components/MaveliLetter";
import { CollabPookalam } from "~/components/pookalam/CollabPookalam";
import { Bubble, Burst, Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { EVENT, POOKALAM } from "~/lib/event-content";

import { type SpriteName } from "~/lib/sprites";
import { gamesList, pookalamState, shell } from "~/lib/queries";
import { comicImage, gameImage, memeImage } from "~/lib/img";
import gameHypeCard from "~/assets/images/game-hype-card.webp";

/** Underline colours for the hero stat chips, in order. */
const STAT_POP = ["var(--pop-red)", "var(--pop-teal)", "var(--pop-yellow)", "var(--pop-purple)"];

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
  "open-source-tinder": gameImage("open-source-tinder.webp"),
  "pookalam-jigsaw": gameImage("pookalam-jigsaw.webp"),
  wend: gameImage("wend.webp"),
  "escape-the-vallam": gameImage("escape-the-vallam.webp"),
  "maveli-jump": gameImage("maveli-jump.webp"),
  "treasure-hunt": gameImage("treasure-hunt.webp"),
  "code-a-pookalam-vote": gameImage("code-a-pookalam.webp"),
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

const DAY_MS = 24 * 60 * 60 * 1000;

interface VotingPhase {
  open: boolean;
  reason: string;
  opensAt: string | null;
  closesAt: string | null;
}

/**
 * Status and release instant for the Day 7 arena card.
 *
 * Day 7 has no `games` row, so `resolveSchedule` never sees it and the card
 * used to be pushed onto the list with `status: "upcoming"` and
 * `releaseAt: null` hardcoded. Those are literals, not a state - nothing ever
 * recomputed them, so the card read "Locked" for the entire event no matter
 * what the admin configured. That is the bug this function exists to kill.
 *
 * The voting window is the authority, because it is the thing that actually
 * decides whether a tap on that card can do anything. When it has not been
 * configured yet, the release falls back to "the day after the last scheduled
 * game", which keeps a real countdown on screen instead of a dead lock - and
 * the card still refuses to claim it is live, because it would be lying.
 */
function day7Schedule(
  scheduled: { day: number; releaseAt: string | null }[],
  voting: VotingPhase | undefined,
): { status: string; releaseAt: string | null } {
  const opensAt = voting?.opensAt ?? derivedDay7Release(scheduled);

  if (voting?.open) return { status: "live", releaseAt: opensAt };
  // Voting has been and gone: the results are the point now, not a countdown.
  if (voting?.reason === "over") return { status: "closed", releaseAt: opensAt };
  if (!opensAt) return { status: "upcoming", releaseAt: null };

  /*
   * Inside the last day before it opens the card stops being a mystery and
   * starts showing what it is, matching the reveal every other day gets.
   */
  const untilOpen = new Date(opensAt).getTime() - Date.now();
  return {
    status: untilOpen <= DAY_MS ? "preview" : "upcoming",
    releaseAt: opensAt,
  };
}

/** Day 7 sits one day after the last day that does have a release instant. */
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

/**
 * A paragraph that is short on a phone and whole on a desktop.
 *
 * The blurbs are three or four lines of prose each, which on a wide screen is
 * a comfortable read and on a 390px one is most of the viewport before the
 * reader reaches anything they can press. Clamping without an escape hatch
 * would just hide the copy, so the clamp comes with a control - and both
 * disappear above `sm`, where there was never a problem.
 */
function ReadMore(props: { text: string; class?: string; lines?: 3 | 4 }) {
  const [open, setOpen] = createSignal(false);
  return (
    <div class="space-y-1">
      <p
        class={props.class}
        classList={{
          "sm:line-clamp-none": true,
          "line-clamp-3": !open() && (props.lines ?? 4) === 3,
          "line-clamp-4": !open() && (props.lines ?? 4) === 4,
        }}
      >
        {props.text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        class="sm:hidden cursor-pointer text-[11px] font-black uppercase tracking-wider underline decoration-2 underline-offset-2 opacity-70"
      >
        {open() ? "show less" : "read more"}
      </button>
    </div>
  );
}

function Section(props: {
  title: string;
  children: unknown;
  id?: string;
  confettiSeed?: string;
  confettiCount?: number;
}) {
  return (
    <section id={props.id} class="relative space-y-3.5 sm:space-y-5 scroll-mt-28">
      <Show when={props.confettiSeed}>
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti
            seed={props.confettiSeed!}
            count={props.confettiCount ?? 6}
            opacity={0.3}
            animate
          />
        </div>
      </Show>
      <h2 class="rule">{props.title}</h2>
      {props.children as never}
    </section>
  );
}

/**
 * What the arena shows when the schedule cannot be read.
 *
 * The rest of the page - what the festival is, how it works, the prizes, the
 * Pookalam contest, the comics - is static and still perfectly true, so this
 * stays a hole in one section rather than an error page. It says which part is
 * missing, offers the one thing that might fix it, and points at the parts of
 * the site that do not need the schedule.
 */
function ScheduleUnavailable() {
  return (
    <div class="card pop-yellow relative mx-auto max-w-2xl space-y-3 text-center">
      <div class="flex justify-center">
        <SpriteIcon name="tux-king" size={52} animate="wobble" alt="" />
      </div>
      <h3 class="text-xl sm:text-2xl font-extrabold">The schedule is taking a break</h3>
      <p class="font-semibold leading-relaxed">
        We could not reach the games server just now, so the seven-day lineup is missing from this
        page. Nothing is cancelled - everything else here is still on.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
        <button type="button" class="btn-brand cursor-pointer" onClick={() => location.reload()}>
          Try again
        </button>
        <A href="/code-a-pookalam" class="btn-accent">
          Code-a-Pookalam
        </A>
        <A href="/comics" class="btn-ghost">
          Read the comics
        </A>
      </div>
      <p class="comment">it is not you, it is our database. give it a moment.</p>
    </div>
  );
}

/**
 * Start the page's reads the moment the router knows we are heading here,
 * rather than after this chunk has downloaded and mounted. `query` dedupes
 * against the `createAsync` below, so this costs nothing when it is early and
 * saves a full round trip when it is not.
 */
export const route = {
  preload() {
    void shell();
    void gamesList();
    void pookalamState();
  },
} satisfies RouteDefinition;

export default function Home() {
  const navigate = useNavigate();
  // Keep navigation and static landing content usable while these personalized
  // reads resolve. A resource without an initial value suspends the whole route
  // during client navigation and looks like a second page reload.
  const games = createAsync(() => gamesList(), { initialValue: null });
  const shellData = createAsync(() => shell(), { initialValue: null });
  const me = () => shellData()?.me ?? undefined;
  /*
   * Day 7 is Code-a-Pookalam, which is not a row in `games` - so its status
   * cannot come from the schedule resolver like every other day. The arena's
   * own phase window is the authority on whether it is open.
   */
  const pookalam = createAsync(() => pookalamState(), { initialValue: null });

  /*
   * Three states, not two. `createAsync` is `undefined` until the schedule
   * resolves, and `getGames` degrades to an empty list when the database is
   * unreachable - so "still loading" and "could not load" are different
   * pictures, and neither of them is allowed to take the rest of the page
   * (which is all static copy) down with it.
   */
  const scheduleLoading = () => games() == null;
  const scheduleMissing = () => games()?.length === 0;

  const [searchParams] = useSearchParams();

  const parseQueryDay = () => {
    const rawDay = Array.isArray(searchParams.day) ? searchParams.day[0] : searchParams.day;
    if (rawDay) {
      const n = parseInt(rawDay, 10);
      if (n >= 1 && n <= 7) return n;
    }
    const rawGame = Array.isArray(searchParams.game) ? searchParams.game[0] : searchParams.game;
    if (rawGame) {
      const n = parseInt(rawGame, 10);
      if (n >= 1 && n <= 7) return n;
      const list = games();
      if (list) {
        const found = list.find((g) => g.slug === rawGame);
        if (found) return found.day;
      }
    }
    return null;
  };

  const [selectedDay, setSelectedDay] = createSignal<number>(parseQueryDay() ?? 1);

  const currentActiveDay = () => {
    const list = games();
    if (!list || list.length === 0) return 1;

    // 1. Currently live or tester game
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

  const liveGame = () =>
    games()?.find((g) => g.day === currentActiveDay()) ??
    games()?.find((g) => g.status === "live" || g.status === "tester");

  // Auto-focus on active day or URL parameter
  createEffect(() => {
    const q = parseQueryDay();
    if (q) {
      setSelectedDay(q);
    } else {
      const day = currentActiveDay();
      setSelectedDay(day);
    }
  });

  // Assemble full 7-day schedule
  const fullSchedule = () => {
    const rawGames = games() ?? [];
    /*
     * No schedule at all is not the same as a schedule with one entry: padding
     * a lone Day 7 onto nothing would render a festival week that does not
     * exist. Leave it empty and let the section say so.
     */
    if (rawGames.length === 0) return [];
    const list = [...rawGames];

    // Check if Day 7 is in the DB games list, otherwise append Day 7 ELO Voting
    if (!list.some((g) => g.day === 7)) {
      const arena = day7Schedule(list, pookalam()?.phases.voting);
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
        status: arena.status,
        releaseAt: arena.releaseAt,
        statusLabel: statusSticker[arena.status]?.label ?? "Locked",
      } as never);
    }

    return list.sort((a, b) => a.day - b.day);
  };

  const activeGame = () => {
    const sched = fullSchedule();
    return sched.find((g) => g.day === selectedDay()) ?? sched[0];
  };

  /*
   * Null when the schedule has not arrived. The old fallback - "six days from
   * whenever you loaded the page" - was a countdown to a date nobody had set,
   * and it differed between the server render and the browser. Better to admit
   * the deadline is unknown than to invent one that ticks wrong.
   */
  const pookalamDeadline = (): Date | null => {
    const list = games();
    if (!list || list.length === 0) return null;
    const day6 = list.find((g) => g.day === 6);
    if (day6?.endAt) return new Date(day6.endAt);
    const day1 = list.find((g) => g.day === 1);
    if (day1?.releaseAt) {
      return new Date(new Date(day1.releaseAt).getTime() + 6 * 24 * 3600 * 1000);
    }
    return null;
  };

  return (
    <main class="container space-y-9 py-4 sm:space-y-14 sm:py-6">
      <Title>{EVENT.name}</Title>

      {/* ------------------------------------------------------------- hero */}
      <section
        class="relative overflow-hidden rounded-lg px-4 py-8 text-center sm:px-6 sm:py-12"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <Confetti seed="hero" count={10} opacity={0.45} animate />
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
        <div class="art-over space-y-4 sm:space-y-5 max-w-3xl mx-auto">
          {/*
            Flex, not a 3-column grid.

            The grid gave the wordmark a column that could be squeezed below
            its own width, and a squeezed `.wordmark` breaks in a specific ugly
            way: the black text wraps while the yellow `::before` shadow layer
            stays on one line, so the two read as different words. Sizing it
            off the viewport with `clamp` means it simply cannot get there, and
            the sprites shrink with it rather than stealing its room.
          */}
          <div class="flex items-center justify-center gap-2 sm:gap-5">
            {/*
              One sprite each side, one size.

              Do NOT try to swap sizes with `hidden` / `sm:inline-flex` here.
              SpriteIcon's own wrapper already sets `inline-flex`, and which of
              the two display utilities wins depends on their order in the
              generated stylesheet rather than in this attribute - so both
              copies render, four sprites crowd the row, and the wordmark gets
              squeezed until it wraps.
            */}
            <SpriteIcon name="maveli-laptop" size={40} animate="float" interactive />
            <div class="inline-flex flex-col items-end">
              <h1
                class="wordmark tracking-wider"
                data-text="FOSS ONAM"
                style={{ "font-size": "clamp(1.6rem, 8vw, 3.75rem)" }}
              >
                FOSS ONAM
              </h1>
              <span
                class="text-[0.6rem] sm:text-xs font-black tracking-widest uppercase text-muted pr-1 -mt-1 sm:-mt-2 select-none"
                style={{
                  "font-family": "var(--font-stack-display)",
                  opacity: "0.85",
                }}
              >
                by fossmec
              </span>
            </div>
            <SpriteIcon name="tux-king" size={40} animate="float" delay={1.2} interactive />
          </div>
          {/*
            The four numbers, as chips.

            This replaces the old tagline sentence and the search-engine
            paragraph that used to sit under it. Between them they said the
            same thing twice in small bold type, which on a phone was most of a
            screen of grey before anyone reached a button. Numerals are read at
            a glance; the sentence was not being read at all.
          */}
          {/* All four on one row at every width - two rows of two ate a third
              of a phone screen for four short words. */}
          <ul class="grid grid-cols-4 gap-1.5 sm:gap-3 list-none p-0 m-0 max-w-lg mx-auto">
            <For each={EVENT.stats}>
              {(stat, i) => (
                <li
                  class="rounded px-1 py-1.5 sm:px-3 sm:py-2 leading-none"
                  style={{
                    border: "var(--ink-w) solid var(--ink)",
                    background: "var(--paper)",
                    "border-bottom": `5px solid ${STAT_POP[i() % STAT_POP.length]}`,
                  }}
                >
                  <span
                    class="block text-xl sm:text-3xl font-black tabular-nums"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    {stat.value}
                  </span>
                  <span
                    class="block text-[0.53rem] sm:text-[0.68rem] font-extrabold uppercase tracking-wide pt-1"
                    style={{ opacity: 0.75 }}
                  >
                    {stat.label}
                  </span>
                </li>
              )}
            </For>
          </ul>

          {/* Extra top padding: the chips have a heavy 5px underline, and butted
              straight against the paragraph it read as one block. */}
          <p class="mx-auto max-w-xl pt-1 text-sm sm:pt-2 sm:text-base font-semibold leading-relaxed text-pretty">
            {EVENT.blurb}
          </p>

          {/*
            Linus, closing the argument.

            "Talk is cheap" is the pivot out of the copy and into the buttons,
            so it sits immediately above them. Tapping it scrolls to the games,
            which is the joke taken literally.
          */}
          {/*
            Panel · meme · panel on a wide screen, filling the space either
            side of Linus. On a phone the meme takes the full width and the two
            panels sit under it as a pair, because at 360px a three-up row
            would leave each panel too narrow for its own animation.
          */}
          <div class="grid grid-cols-2 items-center gap-2.5 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
            <div class="order-1 col-span-2 flex justify-center sm:order-2 sm:col-span-1">
              <A href="/games" class="cursor-pointer inline-block" title="Explore Daily Games">
                <img
                  src={memeImage("talk-is-cheap-sadya.webp")}
                  alt="Talk is cheap. Give me Sadya."
                  width={512}
                  height={503}
                  loading="eager"
                  class="w-32 xs:w-36 sm:w-44 h-auto object-contain select-none"
                />
              </A>
            </div>

            {/*
              The two things you can actually do, leaning away from each other
              so the pair frames the meme rather than competing with it.
            */}
            {/*
              Desktop only. These exist to fill the space either side of the
              meme, and a phone has no such space - stacked under it they were
              just two more lines of text repeating the buttons a few pixels
              further down. Same two pops as those buttons, so the pair reads
              as labels for them rather than a third colour scheme.
            */}
            <A href="/games" class="order-2 hidden justify-center no-underline sm:order-1 sm:flex">
              <span class="pop-label" style={{ "--pop": "var(--pop-teal)", "--tilt": "-5deg" }}>
                Play games
              </span>
            </A>

            <A href="/code-a-pookalam" class="order-3 hidden justify-center no-underline sm:flex">
              <span class="pop-label" style={{ "--pop": "var(--pop-yellow)", "--tilt": "5deg" }}>
                Code a Pookalam
              </span>
            </A>
          </div>

          <div class="flex flex-col items-center gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <A
              href={
                liveGame()
                  ? liveGame()!.day === 7
                    ? "/code-a-pookalam/vote"
                    : `/games/${liveGame()!.slug}`
                  : "/games"
              }
              class="btn-brand inline-flex items-center gap-1.5 w-full sm:w-auto justify-center whitespace-nowrap"
            >
              <Show when={liveGame()} fallback={<span>Explore Daily Games →</span>}>
                <span>
                  Play Day {liveGame()!.day} (
                  {liveGame()!.status === "live" ? "Live Now" : "Early Access"}) →
                </span>
              </Show>
            </A>
            <div class="flex items-center justify-center gap-2 w-full sm:w-auto">
              <A href="/code-a-pookalam" class="btn-accent whitespace-nowrap">
                Code-a-Pookalam
              </A>
              <A href="/leaderboard" class="btn-ghost whitespace-nowrap">
                Leaderboard
              </A>
            </div>
          </div>

          <Show when={!me()}>
            <p class="comment">{EVENT.registerNote}</p>
          </Show>
        </div>
      </section>

      {/* signed-in bar removed - streak/best now lives in Nav dropdown */}

      {/* -------------------------------------------------------- code-a-pookalam */}
      <Section title="Code-a-Pookalam" id="pookalam" confettiSeed="pookalam-sec" confettiCount={5}>
        <div
          class="relative overflow-hidden rounded-lg p-4 sm:p-6"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            background: "var(--pop-pink)",
          }}
        >
          <Confetti seed="pookalam-box" count={6} opacity={0.4} animate />
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
                src={gameImage("code-a-pookalam.webp")}
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
              <ReadMore
                text={POOKALAM.blurb}
                lines={3}
                class="text-xs sm:text-sm font-semibold leading-relaxed text-[var(--ink)]"
              />

              {/* Inline badges row */}
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                <span class="badge text-[11px]" style={{ "--pop": "var(--pop-teal)" }}>
                  ₹3,000 Prize Pool
                </span>
                <span class="badge text-[11px]" style={{ "--pop": "var(--paper-2)" }}>
                  Canvas · SVG · CSS · Shader
                </span>
              </div>

              {/* Countdown and Action Button row */}
              <div class="space-y-1.5 pt-1">
                <div
                  class="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-black uppercase tracking-wider"
                  style={{ color: "var(--ink)" }}
                >
                  <Clock size={13} strokeWidth={2.5} />
                  <span>Submissions Close In:</span>
                </div>

                <div class="flex flex-wrap items-start justify-center sm:justify-start gap-3.5">
                  <Show
                    when={pookalamDeadline()}
                    fallback={
                      <span class="sticker" style={{ "--pop": "var(--paper-3)" }}>
                        Open all week
                      </span>
                    }
                  >
                    {(deadline) => <Countdown target={deadline()} doneLabel="Submissions Closed" />}
                  </Show>
                  <div class="pookalam-cta-wrap">
                    <div class="pookalam-cta-burst" aria-hidden="true">
                      <Burst color="var(--pop-yellow)" seed="pookalam-cta" spikes={11} double />
                    </div>
                    <a
                      href="/code-a-pookalam"
                      class="pookalam-cta-button btn-brand relative z-10 text-xs sm:text-sm px-4 h-[35px] sm:h-[37px] inline-flex items-center gap-1.5 shrink-0"
                    >
                      <span>Explore Code-a-Pookalam</span>
                      <span>→</span>
                    </a>
                  </div>
                </div>
              </div>

              <p class="comment text-sm sm:text-base font-bold pt-1">{POOKALAM.aside}</p>
            </div>

            {/* Tux Kasavu Meme Sticker visible on mobile & desktop */}
            <img
              src={memeImage("sudo-mkdir-pookalam.webp")}
              alt="Sudo mkdir pookalam meme"
              class="w-28 xs:w-32 sm:w-36 md:w-40 h-auto object-contain select-none shrink-0 self-center block"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </Section>
      <Section
        title="Daily Mini-Games Arena"
        id="games-arena"
        confettiSeed="games-sec"
        confettiCount={5}
      >
        <Show when={scheduleLoading()}>
          <LoadingScreen compact message="Inking festival games schedule…" />
        </Show>

        <Show when={scheduleMissing()}>
          <ScheduleUnavailable />
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
            const canPlay = current.status === "live" || current.status === "tester";

            return (
              <div class="game-hype-card card pop-teal relative mx-auto grid w-full max-w-6xl overflow-hidden p-3 sm:p-5 md:grid-cols-[0.78fr_1.22fr] md:gap-5 md:p-6">
                <Halftone opacity={0.08} />
                <Confetti seed="games-banner" count={12} opacity={0.45} animate />
                <SpriteIcon
                  name="muthukuda"
                  size={48}
                  animate="float"
                  class="pointer-events-none absolute right-3 top-3 hidden rotate-12 sm:block"
                  aria-hidden="true"
                />
                <article
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(canPlay ? playHref : "/games")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(canPlay ? playHref : "/games");
                    }
                  }}
                  class={`game-hype-current ${DAY_POPS[(current.day - 1) % DAY_POPS.length]} relative overflow-hidden rounded-lg border-1 border-[var(--ink)] p-3 pb-4 space-y-3 sm:p-4 sm:pb-5 sm:space-y-4`}
                  aria-label={canPlay ? `Play ${current.title}` : "Explore all daily games"}
                >
                  <Halftone opacity={0.1} />
                  <div
                    class="pointer-events-none absolute -right-8 -top-8 hidden h-28 w-28 rotate-12 sm:block"
                    aria-hidden="true"
                  >
                    <Burst color="var(--pop-yellow)" seed="games-feature-burst" spikes={13} />
                  </div>
                  <div class="relative z-10 flex flex-col gap-4 sm:gap-5">
                    {/* Artwork */}
                    <div
                      class="game-hype-current-art relative aspect-[1.12] w-full shrink-0 overflow-hidden rounded-lg bg-[var(--paper-3)] flex items-center justify-center"
                      style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
                    >
                      <Show
                        when={!locked}
                        fallback={
                          <div class="relative h-full w-full overflow-hidden flex flex-col items-center justify-center text-center p-4 bg-[var(--paper-3)]">
                            <img
                              src={
                                GAME_IMAGES[current.slug] ?? gameImage("open-source-tinder.webp")
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
                          src={GAME_IMAGES[current.slug] ?? gameImage("open-source-tinder.webp")}
                          alt={current.title}
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      </Show>
                    </div>

                    {/* Game Info */}
                    <div class="game-hype-current-info flex-1 w-full space-y-3 text-center">
                      <div class="flex items-center justify-center gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                          <SpriteIcon name={teaser.icon} size={28} animate="wobble" />
                          <span
                            class="text-xs font-extrabold uppercase tracking-widest"
                            style={{
                              "font-family": "var(--font-stack-display)",
                            }}
                          >
                            Day {current.day} · Daily Challenge
                          </span>
                        </div>
                        <span class="sticker" style={{ "--pop": sticker.pop }}>
                          {sticker.label}
                        </span>
                      </div>

                      <h3 class="text-2xl sm:text-3xl m-0">
                        <Show when={!locked} fallback={<span>Day {current.day}: ????????</span>}>
                          <span class="underline decoration-2 underline-offset-4">
                            {current.title}
                          </span>
                        </Show>
                      </h3>

                      <div class="pt-3">
                        <A
                          href="/games"
                          class="btn-brand px-4 py-2 text-sm"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Open now <span aria-hidden="true">→</span>
                        </A>
                      </div>

                      <Show
                        when={!locked}
                        fallback={
                          <p class="comment text-base font-semibold leading-relaxed">
                            "{teaser.hint}"
                          </p>
                        }
                      >
                        <p class="game-hype-current-tagline text-sm sm:text-base font-semibold leading-relaxed text-[var(--ink-soft)]">
                          {current.tagline}
                        </p>
                      </Show>

                      <div class="game-hype-current-badges flex flex-wrap items-center justify-center gap-2 pt-1">
                        <span class="badge">{current.difficulty}</span>
                        <span class="badge">
                          {current.maxAttempts > 100
                            ? "unlimited tries"
                            : current.maxAttempts > 1
                              ? `${current.maxAttempts} runs`
                              : "one shot"}
                        </span>
                        <span class="badge">
                          {current.metric === "score" ? "highest score wins" : "fastest wins"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="game-hype-current-pops" aria-hidden="true">
                    <For
                      each={fullSchedule()
                        .filter((item) => item.day !== current.day)
                        .slice(0, 2)}
                    >
                      {(item) => (
                        <div class="game-hype-current-pop">
                          <img
                            src={GAME_IMAGES[item.slug] ?? gameImage("open-source-tinder.webp")}
                            alt=""
                            loading="lazy"
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </article>

                <div class="game-hype-stage relative z-10 mt-3 md:mt-0">
                  <div class="game-hype-copy relative z-20  font-[var(--font-stack-hand)]">
                    <h3>
                      The FOSS you love was made by people like you.
                      <br />
                      Come make a little noise with us.
                    </h3>
                  </div>
                  <div class="game-hype-artframe relative">
                    <Halftone opacity={0.07} />
                    <img
                      src={gameHypeCard}
                      alt="Onam game stickers: a vallam, pookalams, penguin, and playful FOSS characters"
                      class="game-hype-stickers pointer-events-none absolute z-10 select-none"
                      loading="lazy"
                      decoding="async"
                    />
                    <div class="game-hype-game-tokens" aria-label="More daily game artwork">
                      <For
                        each={fullSchedule()
                          .filter((item) => item.day !== current.day)
                          .slice(0, 3)}
                      >
                        {(item) => (
                          <div class="game-hype-game-token">
                            <img
                              src={GAME_IMAGES[item.slug] ?? gameImage("open-source-tinder.webp")}
                              alt={`${item.title} game artwork`}
                              loading="lazy"
                            />
                          </div>
                        )}
                      </For>
                    </div>
                    <div class="game-hype-squiggle game-hype-squiggle-one" aria-hidden="true">
                      〰
                    </div>
                    <div class="game-hype-squiggle game-hype-squiggle-two" aria-hidden="true">
                      〰
                    </div>
                    <A
                      href={canPlay ? playHref : "/games"}
                      class="game-hype-play"
                      aria-label={canPlay ? `Play ${current.title}` : "Explore all daily games"}
                    >
                      <span>
                        PLAY
                        <br />
                        NOW!
                      </span>
                    </A>
                    <span class="game-hype-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </div>
                  <div class="game-hype-rail hidden relative z-20 mt-auto space-y-1.5">
                    <div class="flex items-center justify-between gap-2 px-1">
                      <p class="m-0 text-xs font-black uppercase tracking-[0.16em] text-muted">
                        More mischief inside
                      </p>
                      <span class="hidden text-xs font-black sm:inline">Pick one. Then play.</span>
                    </div>
                    <div class="scrollbar-none -mx-1 flex h-[15rem] gap-2 overflow-x-auto px-1 pb-1 lg:relative lg:mx-0 lg:block lg:h-full lg:min-h-[20rem] lg:overflow-visible">
                      <For each={fullSchedule()}>
                        {(item) => {
                          const isLock = item.status === "upcoming";
                          const tilt = [-1.5, 1, -1, 1.5, -1, 1.5, -1][(item.day - 1) % 7];
                          return (
                            <div
                              class={`relative flex w-28 shrink-0 flex-col items-center gap-1 rounded-lg bg-[var(--paper-2)] p-1.5 lg:absolute lg:w-32 ${DAY_POPS[(item.day - 1) % 7]}`}
                              style={{
                                border: "var(--ink-w-bold) solid var(--ink)",
                                transform: `rotate(${tilt}deg)`,
                                left: `${[2, 18, 35, 52, 68, 82, 42][(item.day - 1) % 7]}%`,
                                top: `${[38, 2, 43, 0, 40, 4, 74][(item.day - 1) % 7]}%`,
                              }}
                            >
                              <div
                                class="relative aspect-square w-10 overflow-hidden rounded bg-[var(--paper-2)] sm:w-12 lg:w-full"
                                style={{ border: "var(--ink-w) solid var(--ink)" }}
                              >
                                <img
                                  src={
                                    GAME_IMAGES[item.slug] ?? gameImage("open-source-tinder.webp")
                                  }
                                  alt=""
                                  loading="lazy"
                                  class={`h-full w-full object-cover ${isLock ? "blur-sm grayscale opacity-45" : ""}`}
                                />
                                <Show when={isLock}>
                                  <span class="absolute inset-0 grid place-items-center">
                                    <span
                                      class="grid h-5 w-5 place-items-center rounded-full bg-[var(--paper-2)]"
                                      style={{ border: "var(--ink-w) solid var(--ink)" }}
                                    >
                                      <Lock size={10} strokeWidth={2.5} />
                                    </span>
                                  </span>
                                </Show>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Show>
      </Section>

      {/* ------------------------------------------------- collaborative pookalam */}
      <Section
        title="The shared pookalam"
        id="shared-pookalam"
        confettiSeed="collab-sec"
        confettiCount={4}
      >
        {/*
          Same treatment as the Code-a-Pookalam card above it — a flat pop
          fill, thick ink, halftone, confetti. Blue rather than pink so the two
          pookalam sections read as siblings without reading as duplicates.
        */}
        <div
          class="relative overflow-hidden rounded-lg p-2 sm:p-3 md:p-3.5"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            background: "var(--pop-blue)",
          }}
        >
          {/*
            Halftone only, no confetti.

            Every other card here gets both, but this one is mostly a canvas
            somebody is trying to aim at. Scattered shapes drifting around the
            edge of a drawing surface read as marks on the drawing.
          */}
          <Halftone opacity={0.12} />

          {/*
            The gutters either side of the canvas are the only place decoration
            can go without landing on somebody's drawing, so the confetti and
            the sprites live there and nowhere else. Hidden below `lg`, where
            there are no gutters to fill.
          */}
          <div
            class="pointer-events-none absolute inset-y-0 left-0 hidden w-28 overflow-hidden lg:block"
            aria-hidden="true"
          >
            <Confetti seed="collab-left" count={7} opacity={0.55} animate />
            <SpriteIcon
              name="nilavilakku"
              size={40}
              animate="float"
              class="absolute left-5 top-[18%]"
            />
            <SpriteIcon
              name="sadya-leaf"
              size={38}
              animate="float"
              delay={1.4}
              class="absolute left-8 bottom-[22%]"
            />
          </div>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 hidden w-28 overflow-hidden lg:block"
            aria-hidden="true"
          >
            <Confetti seed="collab-right" count={7} opacity={0.55} animate />
            <SpriteIcon
              name="muthukuda"
              size={42}
              animate="float"
              delay={0.7}
              class="absolute right-5 top-[26%]"
            />
            <SpriteIcon
              name="pookalam-flower"
              size={38}
              animate="float"
              delay={2.1}
              class="absolute right-8 bottom-[18%]"
            />
          </div>

          <div class="art-over space-y-3">
            {/*
              The pitch, not a description.

              "One grid, everyone's flowers" was accurate and completely inert —
              it told you the mechanic and gave you no reason to care. What
              makes this worth a tap is that it is the one thing on the site
              nobody owns: your flowers sit next to a stranger's forever, and
              the picture is only good if enough people show up. That is worth
              saying out loud, in the voice the rest of the site uses.
            */}
            <div class="text-center space-y-1 pb-1 max-w-4xl mx-auto">
              <h2
                class="m-0 font-black leading-[0.95] text-2xl sm:text-3xl md:text-4xl"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Open source is all about collaboration.
                <br />
                <span style={{ color: "var(--paper)" }}>Build the pookalam together.</span>
              </h2>
              <p class="m-0 font-bold text-xs sm:text-sm text-[var(--ink)]">
                Celebrate with FOSS MEC by creating a communal flower carpet — contribute petals,
                build around each other, and create art together.
              </p>
            </div>
            <CollabPookalam />
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- Explore Daily Games Card */}

      {/* ---------------------------------------------------------- prizes */}
      <Section title="Prizes & Rewards" confettiSeed="prizes-sec" confettiCount={6}>
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)]">
          <div class="space-y-1 text-center sm:text-left">
            <p
              class="font-extrabold text-lg sm:text-xl"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Celebrate this Onam with fossmec and earn big
            </p>
            <p class="text-xs sm:text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              Daily mini-game cash winners · ₹3,000 Code-a-Pookalam podium · Lucky voter bounties!
            </p>
          </div>
          <img
            src={memeImage("meme-celebrate.webp")}
            alt="Celebrate Onam with FOSS MEC Meme"
            class="w-28 sm:w-36 h-auto object-contain select-none shrink-0"
            loading="lazy"
            decoding="async"
          />
        </div>

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

      {/* ---------------------------------------------------- royal letter from maveli */}
      <Section
        title="A Letter from the King to the Prajakal"
        id="maveli-letter"
        confettiSeed="maveli-sec"
        confettiCount={4}
      >
        <MaveliLetter />
      </Section>

      {/* ---------------------------------------------------- About FOSS ONAM & Purpose */}
      <Section title={EVENT.about.title} id="about" confettiSeed="about-sec" confettiCount={5}>
        <div class="space-y-4">
          {/* Main Overview Banner */}
          <div class="card card-plain p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 bg-[var(--paper-2)]">
            <SpriteIcon
              name="foss-mec-badge"
              size={56}
              animate="wobble"
              interactive
              class="shrink-0"
            />
            <div class="space-y-1 text-center sm:text-left">
              <h3
                class="text-lg sm:text-xl font-black text-[var(--ink)] m-0"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                {EVENT.about.headline}
              </h3>
              <p class="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] leading-relaxed m-0">
                {EVENT.about.description}
              </p>
            </div>
          </div>

          {/* 4 Feature Panels Grid */}
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <For each={EVENT.about.features}>
              {(feat) => (
                <div class={`card ${feat.pop} flex flex-col justify-between gap-2 p-3.5`}>
                  <div class="flex items-center gap-2.5">
                    <SpriteIcon
                      name={feat.icon}
                      size={32}
                      animate="float"
                      interactive
                      class="shrink-0"
                    />
                    <h4
                      class="text-sm font-black text-[var(--ink)] m-0 leading-tight"
                      style={{ "font-family": "var(--font-stack-display)" }}
                    >
                      {feat.title}
                    </h4>
                  </div>
                  <p class="text-xs font-semibold text-[var(--ink-soft)] leading-snug m-0">
                    {feat.body}
                  </p>
                </div>
              )}
            </For>
          </div>

          {/* Authentication & Privacy Note */}
          <div
            class="card card-plain p-3.5 sm:p-4 rounded-lg flex items-start gap-3"
            style={{
              background: "var(--paper)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="w-8 h-8 rounded-full bg-[var(--pop-teal)] border-2 border-[var(--ink)] grid place-items-center text-xs font-black shrink-0 mt-0.5">
              ✓
            </div>
            <div class="space-y-0.5">
              <p class="font-extrabold text-xs sm:text-sm text-[var(--ink)] m-0">
                {EVENT.about.auth.title}
              </p>
              <p class="text-xs font-medium text-[var(--ink-soft)] leading-relaxed m-0">
                {EVENT.about.auth.body}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------- how it works (8 items) */}
      <Section title="How it works" id="how-it-works" confettiSeed="how-sec" confettiCount={5}>
        {/* Swipeable row on a phone, grid from `sm` - see `.swipe-rail`. */}
        <div class="swipe-rail">
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
      <Section
        title={EVENT.scoring.title}
        id="scoring"
        confettiSeed="scoring-sec"
        confettiCount={4}
      >
        <Bubble color="var(--pop-teal)">
          <p class="font-semibold">{EVENT.scoring.body}</p>
        </Bubble>
        <p class="comment">{EVENT.scoring.aside}</p>
      </Section>

      {/* ----------------------------------------------------------- rules */}
      <Section title="Fair play" confettiSeed="fairplay-sec" confettiCount={4}>
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
      <Section title="Questions" confettiSeed="faq-sec" confettiCount={4}>
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

      {/* -------------------------------------------------------- Comics Teaser Section */}
      <section
        class="card pop-teal p-6 sm:p-8 relative overflow-hidden text-center sm:text-left shadow-sm"
        style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
      >
        <Confetti seed="comics-teaser" count={8} opacity={0.4} animate />
        <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="space-y-2.5 max-w-xl">
            <div class="flex items-center justify-center sm:justify-start gap-2">
              <span
                class="badge text-xs font-black uppercase px-2.5 py-0.5"
                style={{ background: "var(--pop-yellow)", color: "var(--ink)" }}
              >
                <Zap size={12} class="inline mr-1" />
                Special Edition
              </span>
              <span class="badge text-xs font-black uppercase px-2 py-0.5 bg-[var(--paper)] text-[var(--ink)]">
                5 Full Comics
              </span>
            </div>

            <h2
              class="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--ink)] m-0 leading-tight"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Tired of reading all these? Want to read some comics?
            </h2>

            <p class="text-xs sm:text-sm font-semibold text-[var(--ink)]/85 leading-relaxed">
              Step into the hilarious comic multiverse of Maveli in Paathalam, Tux with Onam Sadya,
              and Arch-user boat racers. 100% open-source festival laughs!
            </p>

            <div class="pt-1 flex justify-center sm:justify-start">
              <A
                href="/comics"
                class="btn-brand text-sm sm:text-base px-5 py-2.5 inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <BookOpen size={18} strokeWidth={2.5} />
                <span>Read The Comics →</span>
              </A>
            </div>
          </div>

          {/* Comic Preview Stack */}
          <div class="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
            <A href="/comics" class="relative block cursor-pointer" title="Read Comics Vault">
              <div
                class="w-28 sm:w-36 aspect-square rounded-lg overflow-hidden shadow-xs"
                style={{
                  border: "2.5px solid var(--ink)",
                  background: "var(--paper)",
                }}
              >
                <img
                  src={comicImage("comic-1.webp")}
                  alt="Comic Issue 1"
                  class="w-full h-full object-cover select-none"
                  loading="lazy"
                />
              </div>
            </A>

            <A
              href="/comics"
              class="relative  cursor-pointer hidden xs:block"
              title="Read Comics Vault"
            >
              <div
                class="w-28 sm:w-36 aspect-square rounded-lg overflow-hidden shadow-xs"
                style={{
                  border: "2.5px solid var(--ink)",
                  background: "var(--paper)",
                }}
              >
                <img
                  src={comicImage("comic-2.webp")}
                  alt="Comic Issue 2"
                  class="w-full h-full object-cover select-none"
                  loading="lazy"
                />
              </div>
            </A>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- last CTA */}
      <Show when={!me()}>
        <section
          class="relative overflow-hidden rounded-lg p-8 text-center"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            background: "var(--pop-yellow)",
          }}
        >
          <Confetti seed="cta" count={6} opacity={0.45} />
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
            <A href="/auth/signin" class="btn-ghost">
              Sign in with Google
            </A>
          </div>
        </section>
      </Show>
    </main>
  );
}
