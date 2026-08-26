import { clientOnly } from "@solidjs/start";
import { Link, Meta, Title } from "@solidjs/meta";
import {
  A,
  createAsync,
  useNavigate,
  useSearchParams,
  type RouteDefinition,
} from "@solidjs/router";
import { BookOpen, Clock, Lock, Zap } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";

import { Countdown } from "~/components/Countdown";
import { LoadingScreen } from "~/components/LoadingScreen";
import { MaveliLetter } from "~/components/MaveliLetter";
import { Burst, Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";

const CollabPookalam = clientOnly(() =>
  import("~/components/pookalam/CollabPookalam").then((m) => ({ default: m.CollabPookalam })),
);
import { CommunityGroupCard } from "~/components/CommunityGroupCard";
import { EVENT, POOKALAM } from "~/lib/event-content";
import { SITE_URL } from "~/lib/site";

import { gamesList, shell } from "~/lib/queries";
import { teaserIcon } from "~/lib/game-teasers";
import { comicImage, gameImage, gameImageForType, memeImage } from "~/lib/img";
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

const statusSticker: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-pink)" },
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

  const selectedDay = createMemo(() => parseQueryDay() ?? currentActiveDay());
  const [aboutTab, setAboutTab] = createSignal<"games" | "fossmec">("games");

  const liveGame = () =>
    games()?.find((g) => g.day === currentActiveDay()) ??
    games()?.find((g) => g.status === "live" || g.status === "tester");

  // The full seven days come straight from the API. Day 7 is the pookalam vote,
  // which the schedule builder appends server-side, so no local card is needed.
  const fullSchedule = () => games() ?? [];

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
      <Meta
        name="description"
        content="Onam Games by FOSSMEC: Seven days, 6 daily puzzle games with rewards, Code-a-Pookalam, and a community flower carpet."
      />
      <Meta property="og:title" content={EVENT.name} />
      <Meta
        property="og:description"
        content="Onam Games by FOSSMEC: Seven days, 6 daily puzzle games with rewards, Code-a-Pookalam, and a community flower carpet."
      />
      <Meta property="og:url" content={`${SITE_URL}/`} />
      <Meta property="og:image" content={`${SITE_URL}/images/og-image.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content={EVENT.name} />
      <Meta
        name="twitter:description"
        content="Onam Games by FOSSMEC: Seven days, 6 daily puzzle games with rewards, Code-a-Pookalam, and a community flower carpet."
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/og-image.webp`} />
      <Link rel="canonical" href={`${SITE_URL}/`} />

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
                data-text="ONAM GAMES"
                style={{ "font-size": "clamp(1.6rem, 8vw, 3.75rem)" }}
              >
                ONAM GAMES
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
                    : `/games?day=${liveGame()!.day}&game=${liveGame()!.slug}`
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
            const teaser = current.teaser ?? "A mystery game";
            const isDay7 = current.day === 7;
            const arenaHref = `/games?day=${current.day}&game=${current.slug}`;
            const targetHref = isDay7 ? "/code-a-pookalam/vote" : arenaHref;
            const playHref = me()
              ? targetHref
              : `/auth/signin?next=${encodeURIComponent(targetHref)}`;
            const openHref = me()
              ? arenaHref
              : `/auth/signin?next=${encodeURIComponent(arenaHref)}`;
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
                  onClick={() => navigate(arenaHref)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(arenaHref);
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
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      </Show>
                    </div>

                    {/* Game Info */}
                    <div class="game-hype-current-info flex-1 w-full space-y-3 text-center">
                      <div class="flex items-center justify-center gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                          <SpriteIcon name={teaserIcon(current)} size={28} animate="wobble" />
                          <span
                            class="text-xs font-extrabold uppercase tracking-widest"
                            style={{
                              "font-family": "var(--font-stack-display)",
                            }}
                          >
                            Day {current.day} · Mini Game
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
                        <Show
                          when={
                            current.endAt &&
                            (current.status === "live" || current.status === "tester")
                          }
                        >
                          <div class="game-hype-current-countdown flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider">
                            <Countdown
                              target={new Date(current.endAt!)}
                              doneLabel="Game closed"
                              compact
                            />
                          </div>
                        </Show>
                        <A
                          href={openHref}
                          class="btn-brand px-4 py-2 text-sm"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Go to Games
                        </A>
                      </div>

                      <Show
                        when={!locked}
                        fallback={
                          <p class="comment text-base font-semibold leading-relaxed">"{teaser}"</p>
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
                          {current.day === 7
                            ? "community vote"
                            : current.metric === "score"
                              ? "highest score wins"
                              : "fastest wins"}
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
                          <img src={gameImageForType(item.gameType)} alt="" loading="lazy" />
                        </div>
                      )}
                    </For>
                  </div>
                </article>

                <div class="game-hype-stage relative z-10 mt-3 md:mt-0">
                  <div class="game-hype-prize-card" aria-label="Daily prize">
                    <span class="game-hype-prize-kicker">Daily challenge prize</span>
                    <strong>Win ₹250</strong>
                    <span>
                      {current.gameType === "jump"
                        ? "most height reached wins"
                        : "fastest verified finish wins"}
                    </span>
                  </div>
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
                              src={gameImageForType(item.gameType)}
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
                                style={{
                                  border: "var(--ink-w) solid var(--ink)",
                                }}
                              >
                                <img
                                  src={gameImageForType(item.gameType)}
                                  alt=""
                                  loading="lazy"
                                  class={`h-full w-full object-cover ${isLock ? "blur-sm grayscale opacity-45" : ""}`}
                                />
                                <Show when={isLock}>
                                  <span class="absolute inset-0 grid place-items-center">
                                    <span
                                      class="grid h-5 w-5 place-items-center rounded-full bg-[var(--paper-2)]"
                                      style={{
                                        border: "var(--ink-w) solid var(--ink)",
                                      }}
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

        {/* Community Group Link Card */}
        <CommunityGroupCard class="mt-4" />
      </Section>

      {/* ------------------------------------------- 4. community pookalam */}
      <Section
        title="Community Pookalam"
        id="community-pookalam"
        confettiSeed="collab-sec"
        confettiCount={4}
      >
        <div
          class="relative overflow-hidden rounded-lg p-2 sm:p-3 md:p-3.5"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            background: "var(--pop-blue)",
          }}
        >
          <Halftone opacity={0.12} />

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

      {/* --------------------------------------------- 5. prizes & rewards */}
      <Section title="Prizes & Rewards" id="prizes" confettiSeed="prizes-sec" confettiCount={6}>
        {/* Comic Prize Hype Banner - Mobile Compact */}
        <div
          class="relative overflow-hidden rounded-xl p-3 sm:p-4"
          style={{
            border: "var(--ink-w) solid var(--ink)",
            background: "var(--paper-2)",
          }}
        >
          <Halftone opacity={0.09} />
          <div class="art-over flex flex-row items-center justify-between gap-2.5 sm:gap-4">
            {/* Left Copy Block */}
            <div class="space-y-1 sm:space-y-1.5 text-left flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span
                  class="sticker text-[9px] sm:text-xs font-black uppercase"
                  style={{ "--pop": "var(--pop-yellow)" }}
                >
                  Daily Cash
                </span>
                <span
                  class="badge text-[9px] sm:text-xs font-black uppercase"
                  style={{ "--pop": "var(--pop-teal)" }}
                >
                  Instant UPI
                </span>
                <span
                  class="badge text-[9px] sm:text-xs font-black uppercase"
                  style={{ "--pop": "var(--pop-pink)" }}
                >
                  ₹5,000 Pool
                </span>
              </div>

              <h3
                class="text-base sm:text-2xl md:text-3xl font-black text-[var(--ink)] m-0 leading-tight"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                ₹5,000 in festival bounties.
              </h3>

              <p
                class="text-xs sm:text-base font-bold leading-tight sm:leading-snug text-[var(--ink)] m-0"
                style={{ "font-family": "var(--font-stack-hand)" }}
              >
                "Solve puzzles, write shader math, top the leaderboard. Pure festival bounties paid
                straight to UPI."
              </p>

              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-[10px] sm:text-xs font-mono font-bold text-[var(--ink-soft)]">
                <span class="inline-flex items-center gap-1">
                  <span class="text-[var(--pop-red)]">▸</span> 7 daily sprints
                </span>
                <span class="inline-flex items-center gap-1">
                  <span class="text-[var(--pop-teal-deep)]">▸</span> ₹3K Pookalam podium
                </span>
              </div>
            </div>

            {/* Right Meme Graphic */}
            <div class="relative shrink-0 flex flex-col items-center">
              <div
                class="relative rounded p-1 sm:p-1.5 bg-[var(--paper-3)]"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <img
                  src={memeImage("meme-celebrate.webp")}
                  alt="Celebrate Onam with FOSS MEC Meme"
                  class="w-16 sm:w-28 md:w-32 h-auto object-contain select-none block"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Noticeable, Compact 2-per-row Cards on Mobile */}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <For each={EVENT.prizes}>
            {(prize) => (
              <div
                class={`card ${prize.pop} flex flex-col justify-between gap-1.5 sm:gap-2.5 p-2.5 sm:p-3.5`}
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <div class="space-y-1 sm:space-y-1.5">
                  <div class="flex items-center justify-between gap-1">
                    <span
                      class="sticker text-[8.5px] sm:text-[10px] font-black uppercase px-1 py-0.2"
                      style={{ "--pop": "var(--paper)" }}
                    >
                      {prize.badge}
                    </span>
                    <SpriteIcon name={prize.icon} size={20} class="shrink-0" />
                  </div>
                  <div>
                    <p
                      class="text-base sm:text-2xl font-black tabular-nums leading-none tracking-tight text-[var(--ink)] m-0"
                      style={{ "font-family": "var(--font-stack-display)" }}
                    >
                      {prize.amount}
                    </p>
                    <h3 class="text-xs sm:text-sm font-black text-[var(--ink)] pt-1 m-0 leading-tight">
                      {prize.rank}
                    </h3>
                  </div>
                </div>
                <p class="text-[10px] sm:text-xs font-semibold leading-tight text-[var(--ink-soft)] m-0 line-clamp-2">
                  {prize.detail}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* --------------------------- 6. about onam games and foss mec */}
      <Section title={EVENT.about.title} id="about" confettiSeed="about-sec" confettiCount={5}>
        {/* Mobile Segmented Tab Switcher */}
        <div
          class="flex rounded p-0.5 gap-1 mb-2 md:hidden"
          style={{ background: "var(--paper-3)", border: "var(--ink-w) solid var(--ink)" }}
        >
          <button
            type="button"
            onClick={() => setAboutTab("games")}
            class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-black transition-colors cursor-pointer text-center outline-none focus:outline-none"
            style={
              aboutTab() === "games"
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
            <SpriteIcon name="maveli-laptop" size={14} />
            <span>About Onam Games</span>
          </button>
          <button
            type="button"
            onClick={() => setAboutTab("fossmec")}
            class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-black transition-colors cursor-pointer text-center outline-none focus:outline-none"
            style={
              aboutTab() === "fossmec"
                ? {
                    background: "var(--pop-teal)",
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
            <SpriteIcon name="foss-mec-badge" size={14} />
            <span>About FOSS MEC</span>
          </button>
        </div>

        {/* 2-Column Desktop Grid / Tabbed Mobile View */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* Left: About Onam Games */}
          <div
            class={`card card-plain p-4 sm:p-5 flex flex-col justify-between space-y-3.5 bg-[var(--paper-2)] ${
              aboutTab() === "games" ? "block" : "hidden md:flex"
            }`}
            style={{ border: "var(--ink-w) solid var(--ink)" }}
          >
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <SpriteIcon
                  name="maveli-laptop"
                  size={42}
                  animate="wobble"
                  interactive
                  class="shrink-0"
                />
                <div>
                  <span
                    class="sticker text-[10px] uppercase font-black"
                    style={{ "--pop": "var(--pop-yellow)" }}
                  >
                    Festival Lore
                  </span>
                  <h3
                    class="text-lg sm:text-xl font-black text-[var(--ink)] m-0 leading-tight pt-0.5"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    {EVENT.about.games.title}
                  </h3>
                </div>
              </div>
              <p class="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] leading-relaxed m-0">
                {EVENT.about.games.description}
              </p>
            </div>
            <div class="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--ink)]/15">
              <A href="/games" class="btn-brand text-xs px-3 py-1.5">
                Explore Daily Games →
              </A>
              <A href="/code-a-pookalam" class="btn-ghost text-xs px-3 py-1.5">
                Code-a-Pookalam
              </A>
            </div>
          </div>

          {/* Right: About FOSS MEC */}
          <div
            class={`card card-plain p-4 sm:p-5 flex flex-col justify-between space-y-3.5 bg-[var(--paper-2)] ${
              aboutTab() === "fossmec" ? "block" : "hidden md:flex"
            }`}
            style={{ border: "var(--ink-w) solid var(--ink)" }}
          >
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <SpriteIcon
                  name="foss-mec-badge"
                  size={42}
                  animate="wobble"
                  interactive
                  class="shrink-0"
                />
                <div>
                  <span
                    class="sticker text-[10px] uppercase font-black"
                    style={{ "--pop": "var(--pop-teal)" }}
                  >
                    Organizers
                  </span>
                  <h3
                    class="text-lg sm:text-xl font-black text-[var(--ink)] m-0 leading-tight pt-0.5"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    {EVENT.about.fossMec.title}
                  </h3>
                </div>
              </div>
              <p class="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] leading-relaxed m-0">
                {EVENT.about.fossMec.description}
              </p>
            </div>

            <div class="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--ink)]/15">
              <a
                href={EVENT.about.fossMec.link}
                target="_blank"
                rel="noopener noreferrer"
                class="btn-brand text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
              >
                <span>Visit foss.mec.ac.in</span>
                <span>↗</span>
              </a>
              <A href="#faq" class="btn-ghost text-xs px-3 py-1.5">
                How to Join FOSS MEC
              </A>
            </div>
          </div>
        </div>

        {/* 4 Feature Badges Grid Below */}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-1">
          <For each={EVENT.about.games.features}>
            {(feat) => (
              <div
                class={`card ${feat.pop} p-2.5 sm:p-3 space-y-1`}
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <div class="flex items-center gap-1.5">
                  <SpriteIcon name={feat.icon} size={20} class="shrink-0" />
                  <h4
                    class="text-xs sm:text-sm font-black text-[var(--ink)] m-0 leading-tight"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    {feat.title}
                  </h4>
                </div>
                <p class="text-[11px] sm:text-xs font-semibold text-[var(--ink-soft)] leading-snug m-0">
                  {feat.body}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* ---------------------------------------------------- 7. fair play */}
      <Section title="Fair Play" id="fair-play" confettiSeed="fairplay-sec" confettiCount={4}>
        <div
          class="card card-plain p-4 sm:p-5 space-y-3 bg-[var(--paper-2)]"
          style={{ border: "var(--ink-w) solid var(--ink)" }}
        >
          <div class="flex items-center gap-2.5">
            <SpriteIcon name="tux-king" size={32} animate="wobble" interactive />
            <h3
              class="text-sm sm:text-base font-black text-[var(--ink)] m-0"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Play fair. Keep the festival fun for everyone.
            </h3>
          </div>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 list-none p-0 m-0">
            <For each={EVENT.rules}>
              {(rule) => (
                <li
                  class="flex items-start gap-2 text-xs sm:text-sm font-semibold p-2.5 rounded-lg bg-[var(--paper)]"
                  style={{ border: "var(--ink-w) solid var(--ink)" }}
                >
                  <span class="font-black text-[var(--pop-red)] leading-none text-base">▸</span>
                  <span class="leading-snug">{rule}</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------- 8. how it works */}
      <Section title="How It Works" id="how-it-works" confettiSeed="how-sec" confettiCount={5}>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <For each={EVENT.howItWorks}>
            {(step, index) => (
              <div
                class="card card-plain p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 bg-[var(--paper-2)]"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
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
                  <div class="space-y-0.5">
                    <p class="font-extrabold text-sm sm:text-base text-[var(--ink)] m-0">
                      {step.title}
                    </p>
                    <p class="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] leading-snug m-0">
                      {step.body}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* ---------------------------------------------------- 9. questions */}
      <Section title="Questions & FAQ" id="faq" confettiSeed="faq-sec" confettiCount={4}>
        <div class="space-y-1.5 sm:space-y-2">
          <For each={EVENT.faq}>
            {(item) => (
              <details
                class="rounded-lg bg-[var(--paper-2)] transition-colors open:bg-[var(--paper)] overflow-hidden"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <summary
                  class="cursor-pointer text-xs sm:text-sm font-extrabold px-3 py-2 sm:px-3.5 sm:py-2.5 select-none leading-snug"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  {item.q}
                </summary>
                <p class="px-3 pb-2.5 sm:px-3.5 sm:pb-3 pt-1 text-xs sm:text-sm font-semibold leading-relaxed text-[var(--ink-soft)] m-0 border-t border-[var(--ink)]/15">
                  {item.a}
                </p>
              </details>
            )}
          </For>
        </div>
      </Section>

      {/* -------------------------------------------- 10. letter from maveli */}
      <Section
        title="A Letter from the King to the Prajakal"
        id="maveli-letter"
        confettiSeed="maveli-sec"
        confettiCount={4}
      >
        <MaveliLetter />
      </Section>

      {/* ------------------------------------------------------- 11. comics */}
      <section
        id="comics"
        class="card pop-teal p-5 sm:p-7 relative overflow-hidden text-center sm:text-left shadow-sm scroll-mt-28"
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

            <p class="text-xs sm:text-sm font-semibold text-[var(--ink)]/85 leading-relaxed m-0">
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
              class="relative cursor-pointer hidden xs:block"
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

      {/* -------------------------------------------------------- subtle final CTA */}
      <Show when={!me()}>
        <section
          class="relative overflow-hidden rounded-lg p-6 sm:p-8 text-center"
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
          <div class="art-over space-y-2.5">
            <div class="flex justify-center">
              <SpriteIcon name="foss-mec-badge" size={54} animate="float" interactive />
            </div>
            <h2 class="text-2xl sm:text-3xl font-black m-0">Still reading?</h2>
            <p class="font-semibold text-xs sm:text-sm m-0">
              The leaderboard isn't going to lose to you on its own.
            </p>
            <div class="pt-1">
              <A href="/auth/signin" class="btn-ghost text-xs sm:text-sm">
                Sign in with Google
              </A>
            </div>
          </div>
        </section>
      </Show>
    </main>
  );
}
