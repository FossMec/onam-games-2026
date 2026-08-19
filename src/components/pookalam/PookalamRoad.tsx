import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-solid";
import { A, createAsync, useSearchParams } from "@solidjs/router";
import { For, type JSX, Show, createMemo, createSignal, lazy, onCleanup, onMount } from "solid-js";

import { Burst, Halftone } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { PookalamShowcase } from "~/components/pookalam/PookalamShowcase";
import { PreviousPookalamCarousel } from "~/components/pookalam/PreviousPookalamCarousel";
import { POOKALAM } from "~/lib/event-content";
import {
  ROAD_STOPS,
  type RoadStop,
  clearRoadProgress,
  readEntryChecks,
  readRoadNotes,
  readRoadProgress,
  readRoadRatings,
  scrollToAnchor,
  writeEntryChecks,
  writeRoadNotes,
  writeRoadRatings,
  writeRoadProgress,
} from "~/lib/pookalam-road";
import type { SpriteName } from "~/lib/sprites";
import { shell } from "~/lib/queries";
import { memeImage } from "~/lib/img";

const PookalamSandbox = lazy(() =>
  import("~/components/pookalam/PookalamSandbox").then((module) => ({
    default: module.PookalamSandbox,
  })),
);
const PookalamTutorials = lazy(() =>
  import("~/components/pookalam/PookalamTutorials").then((module) => ({
    default: module.PookalamTutorials,
  })),
);

/**
 * The road: nine stops from "what is this" to a submitted entry, drawn as one
 * curve running down the page.
 *
 * The curve is not decoration. A page of parallel cards makes the reader decide
 * where to start; a road only goes one way, and every stop is small enough that
 * the next one always looks doable. Ticking a stop fills its leg of the road
 * with colour, so the progress bar and the illustration are the same object.
 *
 * Nothing here is gated. Every stop is open from the first visit - locking
 * steps would punish exactly the people this page exists for - and every stop
 * carries a "knew that already" line so the people who did not need it can skim
 * without feeling talked down to.
 */

/** What happens to your entry after you hand it over. */
const AFTER_YOU_SUBMIT = [
  {
    when: "Days 1 – 6",
    title: "You submit",
    body: "Repo link plus a square render, any language, any medium. Edit as often as you like until Day 6 midnight.",
    sprite: "git-nodes" as SpriteName,
  },
  {
    when: "Day 6 night",
    title: "The jury shortlists",
    body: "Humans read the code and look at the renders. The standouts go through to the arena.",
    sprite: "sadya-leaf" as SpriteName,
  },
  {
    when: "Day 7 all day",
    title: "Everyone votes",
    body: "Shortlisted pookalams go head to head, anonymously, and an Elo ladder settles it.",
    sprite: "docker-pookalam" as SpriteName,
  },
];

/**
 * Which side of the page a stop sits on.
 *
 * These percentages are shared by the curve's endpoints and by the wrapper that
 * centres a stop's milestone node - a node inside a `2x`-wide box pinned to
 * that side lands exactly on `x`. Change one without the other and the number
 * floats off the road.
 */
const X_DESKTOP = { left: 24, right: 76, center: 50 };
const X_MOBILE = { left: 38, right: 62, center: 50 };

type Side = keyof typeof X_DESKTOP;

const sideOf = (index: number): Side => (index % 2 === 0 ? "left" : "right");

/** Where the curve stops and the milestone sits, as a share of the leg's height. */
const END_Y = 78;

/**
 * The curve's midpoint height, for anything planted on the road.
 *
 * `M f 0 C f 40, t 52, t 78` at t = 0.5 gives y = (3·40 + 3·52 + 78) / 8, and x
 * exactly halfway between the sides. Derived rather than eyeballed so it stays
 * right if the control points move.
 */
const DETOUR_Y = (3 * 40 + 3 * 52 + END_Y) / 8;

/** Backtick spans become inline code pills, preserved as unbroken pills on mobile. */
function Inline(props: { text: string }) {
  const parts = () => props.text.split(/`([^`]+)`/g);
  return (
    <For each={parts()}>
      {(part, i) =>
        i() % 2 === 1 ? (
          <code
            class="inline-block whitespace-nowrap rounded px-1.5 py-0.2 font-mono text-[0.88em] leading-tight align-baseline"
            style={{
              background: "var(--paper-3)",
              border: "1.5px solid var(--ink)",
              color: "var(--ink)",
            }}
          >
            {part}
          </code>
        ) : (
          <span>{part}</span>
        )
      }
    </For>
  );
}

/** One leg of the road, with the next stop's number sitting on its far end. */
function RoadLeg(props: {
  from: Side;
  to: Side;
  pop: string;
  walked: boolean;
  label?: number;
  done?: boolean;
  detour?: JSX.Element;
}) {
  const path = (x: Record<Side, number>) =>
    props.label !== undefined
      ? `M ${x[props.from]} -5 C ${x[props.from]} 40, ${x[props.to]} 52, ${x[props.to]} ${END_Y}`
      : `M ${x[props.from]} -5 C ${x[props.from]} 40, ${x[props.to]} 60, ${x[props.to]} 100`;

  const Curve = (curveProps: { x: Record<Side, number> }) => (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      class="block h-full w-full overflow-hidden"
      aria-hidden="true"
    >
      <path
        d={path(curveProps.x)}
        fill="none"
        stroke="var(--ink)"
        stroke-width="18"
        stroke-linecap="butt"
        vector-effect="non-scaling-stroke"
      />
      <path
        d={path(curveProps.x)}
        fill="none"
        stroke={props.walked ? `var(--${props.pop})` : "var(--paper-3)"}
        stroke-width="12"
        stroke-linecap="butt"
        vector-effect="non-scaling-stroke"
      />
      <path
        d={path(curveProps.x)}
        fill="none"
        stroke="var(--ink)"
        stroke-width="2"
        stroke-dasharray="7 10"
        opacity="0.35"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );

  return (
    <div
      class={`relative h-20 sm:h-28 -mt-4 sm:-mt-4 ${props.label === undefined ? "-mb-4 sm:-mb-5" : ""}`}
      aria-hidden={props.label === undefined ? "true" : undefined}
    >
      <div class="absolute inset-0 sm:hidden">
        <Curve x={X_MOBILE} />
      </div>
      <div class="absolute inset-0 hidden sm:block">
        <Curve x={X_DESKTOP} />
      </div>

      {/* Planted on the tarmac, not floating near it. At the curve's midpoint
          (t = 0.5) the x lands exactly halfway between the two sides - so
          horizontally centred is correct - and the y works out at 44% of the
          box for these control points, not 50%. */}
      <Show when={props.detour}>
        <div
          class="absolute inset-x-0 flex justify-center"
          style={{ top: `${DETOUR_Y}%`, transform: "translateY(-50%)" }}
        >
          {props.detour}
        </div>
      </Show>

      <Show when={props.label !== undefined}>
        <div
          class={`absolute inset-x-0 flex ${props.to === "left" ? "justify-start" : "justify-end"}`}
          style={{ top: `${END_Y}%`, transform: "translateY(-50%)" }}
        >
          <div class="flex w-[76%] justify-center sm:w-[48%]">
            <div
              class="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-lg font-black"
              style={{
                border: "var(--ink-w-bold) solid var(--ink)",
                background: props.done ? `var(--${props.pop})` : "var(--paper-2)",
              }}
            >
              <Show when={props.done} fallback={props.label}>
                <Check size={22} strokeWidth={3.5} />
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

/* ----------------------------------------------------------------- step forms
 * Nine identical cards is a form to fill in, not a story. Things to look at
 * swipe past, things to do stack up as rows you can tick off in your head, and
 * things you type appear in a terminal, because that is where you will type
 * them.
 */

function StepsSwipe(props: { steps: string[]; pop: string }) {
  let rail: HTMLDivElement | undefined;
  const [canPrev, setCanPrev] = createSignal(false);
  const [canNext, setCanNext] = createSignal(true);

  const updateEdges = () => {
    if (!rail) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setCanPrev(rail.scrollLeft > 2);
    setCanNext(rail.scrollLeft < maxScroll - 2);
  };

  const move = (direction: -1 | 1) => {
    rail?.scrollBy({
      left: direction * Math.max(rail.clientWidth * 0.78, 220),
      behavior: "smooth",
    });
    requestAnimationFrame(updateEdges);
  };

  onMount(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    onCleanup(() => window.removeEventListener("resize", updateEdges));
  });

  return (
    <div class="relative">
      <div ref={(el) => (rail = el)} class="swipe-rail" onScroll={updateEdges}>
        <For each={props.steps}>
          {(step, i) => (
            <div class="card card-plain relative bg-surface p-3">
              <div class="pointer-events-none absolute -left-1 -top-1 h-12 w-12 opacity-60">
                <Burst color={`var(--${props.pop})`} seed={`${step}-${i()}`} spikes={9} />
              </div>
              <p class="relative m-0 font-display text-2xl font-black leading-none">{i() + 1}</p>
              <p class="relative m-0 pt-1.5 text-sm font-semibold leading-relaxed">
                <Inline text={step} />
              </p>
            </div>
          )}
        </For>
      </div>

      <div class="mt-2 flex justify-end gap-1.5 sm:hidden">
        <Show when={canPrev()}>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-md bg-[var(--paper-2)] text-[var(--ink)] shadow-sm transition-transform active:translate-y-px"
            style={{ border: "var(--ink-w) solid var(--ink)" }}
            onClick={() => move(-1)}
            aria-label="Previous step"
            title="Previous step"
          >
            <ChevronLeft size={17} strokeWidth={2.5} />
          </button>
        </Show>
        <Show when={canNext()}>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-md bg-[var(--paper-2)] text-[var(--ink)] shadow-sm transition-transform active:translate-y-px"
            style={{ border: "var(--ink-w) solid var(--ink)" }}
            onClick={() => move(1)}
            aria-label="Next step"
            title="Next step"
          >
            <ChevronRight size={17} strokeWidth={2.5} />
          </button>
        </Show>
      </div>
    </div>
  );
}

function StepsChecklist(props: { steps: string[]; pop: string }) {
  return (
    <ol class="m-0 list-none space-y-2.5 p-0">
      <For each={props.steps}>
        {(step, i) => (
          <li class="flex items-start gap-2.5">
            <span
              class="anim-pop grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-full font-display text-xs sm:text-sm font-black"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: `var(--${props.pop})`,
                "animation-delay": `${i() * 60}ms`,
              }}
            >
              {i() + 1}
            </span>
            <span class="pt-0.5 text-xs sm:text-sm font-semibold leading-relaxed">
              <Inline text={step} />
            </span>
          </li>
        )}
      </For>
    </ol>
  );
}

/** A stop's steps in whichever shape that stop asked for. */
function Steps(props: { stop: RoadStop }) {
  return (
    <>
      <Show when={props.stop.form === "swipe"}>
        <StepsSwipe steps={props.stop.steps} pop={props.stop.pop} />
      </Show>
      <Show when={props.stop.form === "checklist"}>
        <StepsChecklist steps={props.stop.steps} pop={props.stop.pop} />
      </Show>
      <Show when={props.stop.form === "terminal"}>
        <StepsTerminal steps={props.stop.steps} />
      </Show>
    </>
  );
}

function StepsTerminal(props: { steps: string[] }) {
  return (
    <div class="inked overflow-hidden rounded bg-[#181511]">
      <div
        class="flex items-center gap-1.5 px-3 py-1.5"
        style={{
          "border-bottom": "var(--ink-w) solid var(--ink)",
          background: "#22202b",
        }}
      >
        <span class="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pop-red)" }} />
        <span class="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pop-yellow)" }} />
        <span class="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pop-teal)" }} />
        <span class="pl-1 font-mono text-[11px] font-bold text-[#8d8898]">your terminal</span>
      </div>
      <ol class="m-0 list-none space-y-1.5 p-3">
        <For each={props.steps}>
          {(step) => (
            <li class="flex items-start gap-2 font-mono text-xs sm:text-[13px] leading-relaxed text-[#fbf3e4]">
              <span class="shrink-0 font-black text-[var(--pop-teal)]">❯</span>
              <span>
                <Inline text={step} />
              </span>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------- visuals */

/** The petal count, cycling, because the number is the whole lesson. */
function PetalDial() {
  const counts = [6, 12, 24, 60];
  const [step, setStep] = createSignal(1);

  onMount(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % counts.length), 2200);
    onCleanup(() => clearInterval(timer));
  });

  const dots = () => {
    const n = counts[step()];
    return Array.from({ length: n }, (_, i) => {
      const angle = (i * 2 * Math.PI) / n;
      return { x: 50 + 34 * Math.cos(angle), y: 50 + 34 * Math.sin(angle), i };
    });
  };

  return (
    <div class="flex items-center gap-3">
      <svg viewBox="0 0 100 100" class="h-20 w-20 sm:h-24 sm:w-24 shrink-0" aria-hidden="true">
        <For each={dots()}>
          {(d) => (
            <circle
              cx={d.x}
              cy={d.y}
              r={Math.max(2.5, 26 / counts[step()] + 2)}
              fill={d.i % 2 === 0 ? "var(--pop-red)" : "var(--pop-yellow)"}
              stroke="var(--ink)"
              stroke-width="1.5"
            />
          )}
        </For>
      </svg>
      <p class="m-0 font-mono text-xs sm:text-sm font-bold">
        petals = <span class="font-black text-[var(--pop-teal-deep)]">{counts[step()]}</span>
        <br />
        <span class="text-[11px] text-muted">one number. that is the difference.</span>
      </p>
    </div>
  );
}

/** Four colours, because "steal a palette" is a thing to see, not to read. */
function PaletteVisual() {
  const swatches = [
    { hex: "#F47C48", name: "chethi" },
    { hex: "#F5C443", name: "marigold" },
    { hex: "#5FBFA8", name: "leaf" },
    { hex: "#9C82D4", name: "shankhu" },
  ];
  return (
    <div class="flex flex-wrap gap-2">
      <For each={swatches}>
        {(s, i) => (
          <div
            class={`sticker ${i() % 2 === 1 ? "sticker-alt" : ""} flex items-center gap-1.5 text-[10px]`}
            style={{ "--pop": s.hex }}
          >
            <span class="font-mono">{s.hex}</span>
            <span class="opacity-70">{s.name}</span>
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * The "ask an AI" block, on every stop.
 */
const AI_TABS = [
  { label: "ChatGPT", href: "https://chatgpt.com/" },
  { label: "Gemini", href: "https://gemini.google.com/app" },
  { label: "Claude", href: "https://claude.ai/new" },
];

function AskAi(props: { prompt: string; index?: number }) {
  const [copied, setCopied] = createSignal(false);
  const isCompact = () => (props.index ?? 0) > 0;

  const copy = () => {
    void navigator.clipboard.writeText(props.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details class="group">
      <summary
        class={`btn-ghost inline-flex cursor-pointer list-none items-center gap-1.5 ${
          isCompact() ? "text-xs px-2.5 py-1" : "text-xs sm:text-sm px-3 py-1.5"
        }`}
      >
        <Sparkles size={isCompact() ? 13 : 14} class="shrink-0 text-[var(--pop-yellow-deep)]" />
        <span>{isCompact() ? "Ask AI about this stop" : "Ask an AI to explain this stop"}</span>
        <ChevronDown size={13} class="shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div class="space-y-2 pt-2.5">
        <p class="m-0 text-xs sm:text-sm font-semibold leading-relaxed">
          Open a chatbot in a new tab, paste this prompt, and ask follow-up questions until it makes
          sense. Using AI to <span class="font-black">understand</span> concepts is encouraged!
        </p>

        <div
          class="rounded p-2.5 font-mono text-xs leading-relaxed"
          style={{
            border: "var(--ink-w) dashed var(--ink)",
            background: "var(--paper-3)",
          }}
        >
          {props.prompt}
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            class="btn-accent min-h-0 gap-1.5 px-3 py-1.5 text-xs"
          >
            <Show
              when={copied()}
              fallback={
                <>
                  <Copy size={12} />
                  <span>Copy prompt</span>
                </>
              }
            >
              <span>Copied - now paste it</span>
            </Show>
          </button>
          <For each={AI_TABS}>
            {(tab) => (
              <a
                href={tab.href}
                target="_blank"
                rel="noreferrer noopener"
                class="badge inline-flex items-center gap-1 text-[10px] no-underline"
              >
                <ExternalLink size={11} class="shrink-0" />
                <span>{tab.label}</span>
              </a>
            )}
          </For>
        </div>
      </div>
    </details>
  );
}

function StickyNote(props: { stopId: string; index: number }) {
  const [text, setText] = createSignal("");
  const [saved, setSaved] = createSignal(false);
  const [isFocused, setIsFocused] = createSignal(false);
  let textareaEl: HTMLTextAreaElement | undefined;

  const adjustHeight = () => {
    if (!textareaEl) return;
    textareaEl.style.height = "auto";
    textareaEl.style.height = `${Math.max(textareaEl.scrollHeight + 6, 56)}px`;
  };

  onMount(() => {
    const savedText = readRoadNotes()[props.stopId] ?? "";
    setText(savedText);
    adjustHeight();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const onInput = (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => {
    const value = e.currentTarget.value;
    setText(value);
    adjustHeight();
    const notes = readRoadNotes();
    notes[props.stopId] = value;
    writeRoadNotes(notes);
    if (timer) clearTimeout(timer);
    setSaved(true);
    timer = setTimeout(() => setSaved(false), 1400);
  };
  onCleanup(() => timer && clearTimeout(timer));

  return (
    <div
      onClick={(e) => {
        setIsFocused(true);
        if (e.target !== textareaEl) {
          textareaEl?.focus();
        }
      }}
      class="sticky-note relative w-full sm:w-auto sm:min-w-[280px] sm:max-w-[440px] md:min-w-[340px] flex-1 px-3 pt-4 pb-2.5 cursor-text"
      style={{
        background: "var(--pop-yellow)",
        border: "var(--ink-w) solid var(--ink)",
        "border-radius": "0.25rem",
        transform: props.index % 2 === 0 ? "rotate(-0.75deg)" : "rotate(0.75deg)",
      }}
    >
      <span
        class="absolute -top-2 left-1/2 h-3.5 w-12 -translate-x-1/2 pointer-events-none"
        style={{
          background: "var(--paper-3)",
          border: "1.5px solid var(--ink)",
          transform: "translateX(-50%) rotate(-2deg)",
        }}
        aria-hidden="true"
      />
      <textarea
        ref={(el) => (textareaEl = el)}
        class="block w-full resize-none bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-0 focus:border-0 shadow-none placeholder:text-[var(--ink)]/45 cursor-text p-0 m-0"
        style={{
          "font-family": "var(--font-stack-hand)",
          "font-size": "1.25rem",
          "font-weight": "500",
          "line-height": "1.45",
          color: "var(--ink, #161616)",
          "caret-color": "#161616",
          "min-height": "3.5rem",
          "field-sizing": "content",
          overflow: "hidden",
          "scrollbar-width": "none",
          "-ms-overflow-style": "none",
          outline: "none",
          border: "none",
          "box-shadow": "none",
          cursor: "text",
        }}
        placeholder={
          isFocused() ? "" : "note to self… (where you got to, what broke, what to try next)"
        }
        value={text()}
        onInput={onInput}
        onFocus={() => {
          setIsFocused(true);
          adjustHeight();
        }}
        onBlur={() => setIsFocused(false)}
        aria-label="Your note for this stop"
        rows={2}
      />
      <p class="m-0 text-right font-mono text-[9px] font-bold opacity-70 select-none pt-0.5">
        {saved() ? "saved ✓" : "saves as you type"}
      </p>
    </div>
  );
}

const RATING_WORDS = ["brutal", "hard", "fine", "easy", "too easy"];

function SelfRating(props: { stopId: string }) {
  const [score, setScore] = createSignal(0);

  onMount(() => setScore(readRoadRatings()[props.stopId] ?? 0));

  const rate = (value: number) => {
    const next = score() === value ? 0 : value;
    setScore(next);
    const all = readRoadRatings();
    if (next === 0) delete all[props.stopId];
    else all[props.stopId] = next;
    writeRoadRatings(all);
  };

  return (
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-black uppercase tracking-wider text-muted">how did that go?</span>
      <div class="flex gap-1">
        <For each={RATING_WORDS}>
          {(word, i) => (
            <button
              type="button"
              onClick={() => rate(i() + 1)}
              aria-label={word}
              aria-pressed={score() === i() + 1}
              title={word}
              class="grid h-8 w-8 place-items-center rounded-full font-display text-xs font-black cursor-pointer"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: score() >= i() + 1 ? "var(--pop-pink)" : "var(--paper-2)",
              }}
            >
              {i() + 1}
            </button>
          )}
        </For>
      </div>
      <Show when={score() > 0}>
        <span class="comment text-xs">{RATING_WORDS[score() - 1]}</span>
      </Show>
    </div>
  );
}

function PrizeCard(props: { name?: string }) {
  const prizes = [
    {
      place: "1st",
      amount: "₹1,500",
      sprite: "tux-king" as SpriteName,
      pop: "pop-yellow",
    },
    {
      place: "2nd",
      amount: "₹1,000",
      sprite: "ferris-crab" as SpriteName,
      pop: "pop-teal",
    },
    {
      place: "3rd",
      amount: "₹500",
      sprite: "gopher-king" as SpriteName,
      pop: "pop-pink",
    },
  ];

  return (
    <div class="card card-plain space-y-2.5 bg-surface p-3">
      <p class="m-0 font-display text-base font-black">
        {props.name ? `${props.name}, this is what you're playing for` : "What you're playing for"}
      </p>

      <div class="grid gap-2 sm:grid-cols-3">
        <For each={prizes}>
          {(prize) => (
            <div
              class="flex items-center gap-2.5 rounded p-2.5"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: `var(--${prize.pop})`,
              }}
            >
              <SpriteIcon name={prize.sprite} size={30} animate="float" interactive />
              <div>
                <p class="m-0 text-[10px] font-black uppercase tracking-wide">{prize.place}</p>
                <p class="m-0 font-display text-lg font-black leading-none">{prize.amount}</p>
              </div>
            </div>
          )}
        </For>
      </div>

      <p class="comment m-0 text-xs sm:text-sm">
        Podium winners take cash prizes via UPI. Voting screen never reveals names — only the
        artwork.
      </p>
    </div>
  );
}

function StopPayload(props: { stop: RoadStop; name?: string; interactiveReady: boolean }) {
  const [tutorialOpen, setTutorialOpen] = createSignal(false);

  return (
    <>
      <Show when={props.stop.payload === "past-work"}>
        <PreviousPookalamCarousel />
      </Show>

      <Show when={props.stop.payload === "tutorials"}>
        <details class="group" onToggle={(event) => setTutorialOpen(event.currentTarget.open)}>
          <summary class="btn-ghost inline-flex cursor-pointer list-none items-center gap-1.5 text-xs sm:text-sm font-bold">
            <SpriteIcon name="terminal-star" size={18} interactive class="shrink-0" />
            <span>View six starter examples with code</span>
          </summary>
          <Show
            when={props.interactiveReady && tutorialOpen()}
            fallback={
              <p class="comment m-0 pt-2 text-xs">
                Six starter examples load when you open this panel.
              </p>
            }
          >
            <div class="pt-2.5">
              <PookalamTutorials compact />
            </div>
          </Show>
        </details>
      </Show>

      <Show when={props.stop.payload === "studio"}>
        <a
          href="#studio"
          class="btn-ghost inline-flex items-center gap-2 text-xs sm:text-sm"
          onClick={(e) => {
            e.preventDefault();
            scrollToAnchor("studio");
          }}
        >
          <SpriteIcon name="concentric-pookalam" size={18} />
          <span>Open the studio up top and test colors</span>
        </a>
      </Show>

      <Show when={props.stop.payload === "rules"}>
        <RulesPayload />
      </Show>

      <Show when={props.stop.payload === "submit"}>
        <div class="space-y-3">
          <PrizeCard name={props.name} />
          <A href="/code-a-pookalam/submit" class="btn-brand inline-flex items-center gap-2">
            <Send size={18} />
            <span>Submit your pookalam</span>
          </A>
        </div>
      </Show>
    </>
  );
}

const ENTRY_CHECKS = [
  {
    id: "square",
    label: "My image is square",
    hint: "equal width and height, or upload refuses it",
  },
  {
    id: "clean",
    label: "No name or watermark on it",
    hint: "voting is anonymous - any signature pulls the entry",
  },
  {
    id: "public",
    label: "My repo is public",
    hint: "a 404 is not a submission",
  },
  {
    id: "license",
    label: "It has a LICENSE file",
    hint: "MIT, Apache 2.0, GPLv3, BSD or Unlicense",
  },
];

function EntryChecker() {
  const [ticked, setTicked] = createSignal<string[]>([]);
  onMount(() => setTicked(readEntryChecks()));

  const isOn = (id: string) => ticked().includes(id);
  const flip = (id: string) => {
    const next = isOn(id) ? ticked().filter((x) => x !== id) : [...ticked(), id];
    setTicked(next);
    writeEntryChecks(next);
  };
  const allSet = () => ticked().length === ENTRY_CHECKS.length;

  return (
    <div class="space-y-2">
      <div class="grid gap-2 sm:grid-cols-2">
        <For each={ENTRY_CHECKS}>
          {(check) => (
            <button
              type="button"
              onClick={() => flip(check.id)}
              aria-pressed={isOn(check.id)}
              class="flex items-start gap-2.5 rounded p-2.5 text-left cursor-pointer"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: isOn(check.id) ? "var(--pop-teal)" : "var(--paper-2)",
              }}
            >
              <span
                class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded"
                style={{
                  border: "2px solid var(--ink)",
                  background: "var(--paper-2)",
                }}
              >
                <Show when={isOn(check.id)}>
                  <Check size={14} strokeWidth={4} />
                </Show>
              </span>
              <span>
                <span class="block text-xs sm:text-sm font-black leading-tight">{check.label}</span>
                <span class="block text-[11px] font-semibold text-muted leading-snug">
                  {check.hint}
                </span>
              </span>
            </button>
          )}
        </For>
      </div>

      <p class="comment m-0 text-xs">
        <Show when={allSet()} fallback={`${ticked().length} of 4 checks verified.`}>
          All 4 checks verified! Ready to submit.
        </Show>
      </p>
    </div>
  );
}

function RulesPayload() {
  return (
    <div class="space-y-3">
      <EntryChecker />
    </div>
  );
}

function CodePreview(props: { snippet: string }) {
  return (
    <pre
      class="inked m-0 overflow-x-auto whitespace-pre-wrap break-words rounded bg-[#181511] p-3 font-mono text-[13px] leading-relaxed text-[#fbf3e4]"
      style={{ "min-height": "10rem" }}
    >
      {props.snippet}
    </pre>
  );
}

function StopCard(props: {
  stop: RoadStop;
  index: number;
  side: Side;
  done: boolean;
  interactiveReady: boolean;
  name?: string;
  active?: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = createSignal(false);

  const copy = (snippet: string) => {
    void navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id={props.stop.id}
      class={`scroll-mt-28 ${props.side === "left" ? "sm:mr-auto" : "sm:ml-auto"} w-full sm:w-[92%]`}
    >
      <div
        class={`card ${props.stop.pop} relative space-y-3.5 sm:space-y-4 overflow-clip ${props.done ? "opacity-90" : ""}`}
        style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
      >
        <Halftone opacity={0.09} />

        <div class="art-over flex flex-wrap items-center gap-2">
          <SpriteIcon
            name={props.stop.sprite}
            size={32}
            animate="float"
            delay={props.index * 0.3}
            interactive
            class="shrink-0"
          />
          <span
            class={`sticker text-[10px] ${props.index % 2 === 0 ? "" : "sticker-alt"}`}
            style={{ "--pop": `var(--${props.stop.pop})` }}
          >
            {props.stop.day}
          </span>
          <span class="font-mono text-xs font-bold text-muted">{props.stop.minutes}</span>
        </div>

        <div class="art-over space-y-1.5">
          <h3
            class="pop-label m-0 max-w-full"
            style={{
              "--pop": `var(--${props.stop.pop})`,
              "--tilt": props.index % 2 === 0 ? "-2deg" : "1.5deg",
              "font-size": "clamp(1.35rem, 5.5vw, 2rem)",
            }}
          >
            {props.index + 1}. {props.stop.title}
          </h3>
          <p class="comment text-xs sm:text-sm m-0">
            {props.name ? props.stop.hookNamed.replace("{name}", props.name) : props.stop.hook}
          </p>
        </div>

        {/* Main Content Area (Full width, zero horizontal squeeze) */}
        <div class="art-over space-y-3.5 sm:space-y-4">
          <Show
            when={props.stop.code?.sandbox}
            fallback={
              <div>
                <Steps stop={props.stop} />
              </div>
            }
          >
            <div class="space-y-1.5">
              <Show
                when={props.interactiveReady}
                fallback={
                  <div class="space-y-3">
                    <Steps stop={props.stop} />
                    <CodePreview snippet={props.stop.code!.snippet} />
                    <p class="comment m-0 text-xs">
                      The editable runner loads after the page is interactive.
                    </p>
                  </div>
                }
              >
                <PookalamSandbox
                  snippet={props.stop.code!.snippet}
                  intro={<Steps stop={props.stop} />}
                  showAnimate={props.stop.day === "Day 4"}
                />
              </Show>
            </div>
          </Show>

          <Show when={props.stop.code && !props.stop.code.sandbox}>
            <div class="space-y-1.5 pt-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs font-black uppercase tracking-wider text-muted">
                  {props.stop.code!.label}
                </span>
                <button
                  type="button"
                  onClick={() => copy(props.stop.code!.snippet)}
                  class="btn-ghost min-h-0 px-2.5 py-1 text-xs cursor-pointer"
                >
                  <Show
                    when={copied()}
                    fallback={
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    }
                  >
                    <span>Copied!</span>
                  </Show>
                </button>
              </div>
              <pre class="inked select-text overflow-x-auto rounded bg-[#181511] p-3 font-mono text-xs sm:text-[13px] text-[#fbf3e4] m-0">
                <code>{props.stop.code!.snippet}</code>
              </pre>
            </div>
          </Show>

          <Show when={props.stop.visual === "petal-dial"}>
            <div class="pt-1">
              <PetalDial />
            </div>
          </Show>
          <Show when={props.stop.visual === "palette"}>
            <div class="pt-1">
              <PaletteVisual />
            </div>
          </Show>

          <div class="pt-2">
            <AskAi prompt={props.stop.aiPrompt} index={props.index} />
          </div>

          <Show when={props.stop.links}>
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-xs font-black uppercase tracking-wider text-muted">
                learn more:
              </span>
              <For each={props.stop.links}>
                {(link) => (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    class="badge inline-flex items-center gap-1 text-[10px] no-underline"
                    title={link.note}
                  >
                    <ExternalLink size={11} class="shrink-0" />
                    <span>{link.label}</span>
                  </a>
                )}
              </For>
            </div>
          </Show>

          <div class="pt-1">
            <StopPayload
              stop={props.stop}
              name={props.name}
              interactiveReady={props.interactiveReady}
            />
          </div>

          <Show when={props.stop.more || props.stop.levelUp}>
            <details class="group pt-1">
              <summary class="flex cursor-pointer list-none items-center gap-1.5 text-xs sm:text-sm font-black">
                <ChevronDown
                  size={14}
                  class="shrink-0 transition-transform group-open:rotate-180"
                />
                <span>Deep dive & Level-up tips</span>
              </summary>
              <div class="space-y-3 pt-2">
                <Show when={props.stop.more}>
                  <For each={props.stop.more}>
                    {(para) => (
                      <p class="m-0 text-xs sm:text-sm font-semibold leading-relaxed">
                        <Inline text={para} />
                      </p>
                    )}
                  </For>
                </Show>

                <Show when={props.stop.levelUp}>
                  <div
                    class="flex items-start gap-2 rounded p-2.5"
                    style={{
                      border: "var(--ink-w) dashed var(--ink)",
                      background: "var(--paper-3)",
                    }}
                  >
                    <SpriteIcon name="arch-crown" size={20} interactive class="mt-0.5 shrink-0" />
                    <p class="m-0 text-xs sm:text-sm font-semibold leading-relaxed">
                      <span class="font-black uppercase tracking-wide">Level Up Challenge: </span>
                      <Inline text={props.stop.levelUp!} />
                    </p>
                  </div>
                </Show>
              </div>
            </details>
          </Show>

          <Show when={props.done}>
            <div
              class="anim-pop flex items-start gap-2.5 rounded p-3"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: `var(--${props.stop.pop})`,
              }}
            >
              <SpriteIcon name="burst-heart" size={22} animate="pulse" class="mt-0.5 shrink-0" />
              <p class="m-0 text-xs sm:text-sm font-bold leading-relaxed">
                <span class="font-black">
                  {props.name ? `Nice work, ${props.name}! ` : "Nice work! "}
                </span>
                {props.stop.praise}
              </p>
            </div>
          </Show>

          {/* Compact Notes & Rating in Normal Flow (Zero overlap, compact footprint) */}
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2.5  ">
            <SelfRating stopId={props.stop.id} />
            <StickyNote stopId={props.stop.id} index={props.index} />
          </div>
        </div>

        <div class="art-over relative flex flex-wrap items-center justify-between gap-2 pt-2 ">
          <button
            type="button"
            onClick={props.onToggle}
            class="btn-brand relative z-10 min-h-0 gap-2 px-3.5 py-2 text-xs sm:text-sm font-black cursor-pointer"
            style={props.done ? { background: `var(--${props.stop.pop})` } : undefined}
            aria-pressed={props.done}
          >
            <Show
              when={props.done}
              fallback={
                <>
                  <span>Mark Step Completed</span>
                  <Check size={14} strokeWidth={3} />
                </>
              }
            >
              <Check size={15} strokeWidth={3.5} />
              <span>Completed!</span>
            </Show>
          </button>

          <Show when={ROAD_STOPS[props.index + 1]}>
            {(next) => (
              <a
                href={`?section=${next().id}`}
                class="btn-ghost min-h-0 px-3 py-2 text-xs sm:text-sm font-black inline-flex items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToAnchor(next().id);
                }}
              >
                <span>Next Stop</span>
                <ChevronRight size={15} strokeWidth={3} />
              </a>
            )}
          </Show>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- the road */

export function PookalamRoad(props: { hasEntry?: boolean; closesAt?: string | null }) {
  const [interactiveReady, setInteractiveReady] = createSignal(false);
  const [isStuck, setIsStuck] = createSignal(false);
  let sentinelEl: HTMLDivElement | undefined;

  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me ?? undefined;
  const firstName = () => me()?.name?.trim().split(/\s+/)[0] || undefined;

  const [done, setDone] = createSignal<string[]>([]);
  const [roadCursor, setRoadCursor] = createSignal(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [navOffset, setNavOffset] = createSignal(64);

  onMount(() => {
    const updateNavOffset = () => {
      const header = document.querySelector("header");
      if (header) {
        setNavOffset(header.getBoundingClientRect().height);
      }
    };
    updateNavOffset();
    window.addEventListener("resize", updateNavOffset);
    onCleanup(() => window.removeEventListener("resize", updateNavOffset));

    const progress = readRoadProgress();
    setDone(progress);
    const firstOpen = ROAD_STOPS.findIndex((stop) => !progress.includes(stop.id));
    setRoadCursor(firstOpen >= 0 ? firstOpen : ROAD_STOPS.length - 1);
    setInteractiveReady(true);

    const requested = Array.isArray(searchParams.section)
      ? searchParams.section[0]
      : searchParams.section;
    if (requested && ROAD_STOPS.some((stop) => stop.id === requested)) {
      setRoadCursor(ROAD_STOPS.findIndex((stop) => stop.id === requested));
    }

    if (sentinelEl) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsStuck(!entry.isIntersecting);
        },
        { rootMargin: `-${navOffset() + 8}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(sentinelEl);
      onCleanup(() => observer.disconnect());
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = visible?.target.id;
        if (id) {
          const index = ROAD_STOPS.findIndex((stop) => stop.id === id);
          if (index >= 0 && index !== roadCursor()) {
            setRoadCursor(index);
            setSearchParams({ section: id }, { replace: true, scroll: false });
          }
        }
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: 0 },
    );

    for (const stop of ROAD_STOPS) {
      const element = document.getElementById(stop.id);
      if (element) observer.observe(element);
    }
    onCleanup(() => observer.disconnect());
  });

  const isDone = (id: string) => done().includes(id);

  const toggle = (id: string) => {
    const next = isDone(id) ? done().filter((x) => x !== id) : [...done(), id];
    setDone(next);
    writeRoadProgress(next);
  };

  const reset = () => {
    setDone([]);
    clearRoadProgress();
  };

  const doneCount = createMemo(() => ROAD_STOPS.filter((s) => isDone(s.id)).length);

  const setActiveStop = (id: string) => {
    const index = ROAD_STOPS.findIndex((stop) => stop.id === id);
    if (index < 0) return;
    setRoadCursor(index);
    setSearchParams({ section: id }, { replace: true, scroll: false });
  };

  const nextStop = createMemo(() => ROAD_STOPS.find((s) => !isDone(s.id)) ?? null);
  const allDone = createMemo(() => doneCount() === ROAD_STOPS.length);

  const moveRoadCursor = (direction: -1 | 1) => {
    const nextIndex = roadCursor() + direction;
    if (nextIndex < 0 || nextIndex >= ROAD_STOPS.length) return;
    const stop = ROAD_STOPS[nextIndex];
    if (!stop) return;
    setRoadCursor(nextIndex);
    setSearchParams({ section: stop.id }, { replace: true, scroll: false });
    scrollToAnchor(stop.id);
  };

  const walked = (index: number) => index === 0 || isDone(ROAD_STOPS[index - 1].id);

  return (
    <section id="road" class="relative scroll-mt-28 space-y-4">
      {/* Sentinel for sticky intersection */}
      <div
        ref={(el) => (sentinelEl = el)}
        class="pointer-events-none -mt-4 h-1 w-full opacity-0"
        aria-hidden="true"
      />

      {/* Single Unified Sticky Road Card (Animates expansion & shrinking) */}
      <div
        class={`sticky z-30 card overflow-hidden transition-all duration-300 ease-in-out ${
          isStuck()
            ? "card-plain bg-[var(--paper-2)] px-2.5 py-1 sm:px-3 sm:py-1.5 mb-1 shadow-none"
            : "pop-teal p-4 sm:p-5 space-y-3"
        }`}
        style={{
          top: `${navOffset() + 6}px`,
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        {/* Decorative Halftone & Confetti (Only when expanded) */}
        <div
          class={`pointer-events-none transition-opacity duration-300 ${
            isStuck() ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
          }`}
        >
          <Halftone opacity={0.06} />
          <Confetti seed="road-head" count={6} animate opacity={0.35} />
        </div>

        <div class={`art-over ${isStuck() ? "space-y-0.5" : "space-y-1.5 sm:space-y-2"}`}>
          {/* Top Bar Row (Morphs from simple banner header to compact active-stop HUD) */}
          <div class="flex items-center justify-between gap-1.5">
            {/* Left: Sticker & Compact Stop Title */}
            <div class="min-w-0 flex items-center gap-1.5">
              <span
                class="shrink-0 rounded px-1 py-0.2 font-mono text-[9px] font-black uppercase text-[var(--ink)] transition-colors duration-300"
                style={{
                  background: isStuck()
                    ? `var(--${ROAD_STOPS[roadCursor()].pop})`
                    : "var(--pop-yellow)",
                  border: "1px solid var(--ink)",
                }}
              >
                {isStuck()
                  ? `${ROAD_STOPS[roadCursor()].day} · ${roadCursor() + 1}/9`
                  : "9 Interactive Stops · Zero Experience Required"}
              </span>

              {/* Compact Stop Title (Smoothly reveals when stuck) */}
              <p
                class={`m-0 truncate font-black text-[var(--ink)] transition-all duration-300 ${
                  isStuck()
                    ? "text-xs max-w-xs opacity-100 translate-x-0"
                    : "max-w-0 opacity-0 -translate-x-2 overflow-hidden pointer-events-none"
                }`}
              >
                {ROAD_STOPS[roadCursor()].title}
              </p>
            </div>

            {/* Right: Stuck Compact Chevrons & Done Counter */}
            <div
              class={`flex shrink-0 items-center gap-1 transition-all duration-300 ${
                isStuck()
                  ? "max-w-xs opacity-100 scale-100"
                  : "max-w-0 opacity-0 overflow-hidden pointer-events-none scale-90"
              }`}
            >
              <span class="hidden font-mono text-[9.5px] font-extrabold text-muted sm:inline whitespace-nowrap mr-0.5">
                {doneCount()}/{ROAD_STOPS.length} done
              </span>
              <button
                type="button"
                class="grid h-4.5 w-4.5 place-items-center rounded bg-[var(--paper)] text-[var(--ink)] disabled:opacity-30 cursor-pointer hover:bg-[var(--paper-3)]"
                style={{ border: "1px solid var(--ink)" }}
                disabled={roadCursor() === 0}
                onClick={() => moveRoadCursor(-1)}
                aria-label="Previous stop"
                title="Previous stop"
              >
                <ChevronLeft size={10} strokeWidth={3} />
              </button>
              <button
                type="button"
                class="grid h-4.5 w-4.5 place-items-center rounded bg-[var(--paper)] text-[var(--ink)] disabled:opacity-30 cursor-pointer hover:bg-[var(--paper-3)]"
                style={{ border: "1px solid var(--ink)" }}
                disabled={roadCursor() === ROAD_STOPS.length - 1}
                onClick={() => moveRoadCursor(1)}
                aria-label="Next stop"
                title="Next stop"
              >
                <ChevronRight size={10} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Expanded Big Wordmark & Actions (Smooth CSS Grid Collapse) */}
          <div
            class={`grid transition-all duration-300 ease-in-out ${
              isStuck()
                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div class="overflow-hidden">
              <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between pt-1 pb-1">
                <div class="min-w-0 space-y-0.5">
                  <h2
                    class="wordmark m-0 leading-tight"
                    data-text="THE POOKALAM ROAD"
                    style={{ "font-size": "clamp(1.3rem, 5vw, 2.2rem)" }}
                  >
                    THE POOKALAM ROAD
                  </h2>
                  <p class="m-0 font-mono text-sm font-bold text-muted">
                    {firstName() ? `${firstName()} · ` : ""}
                    {doneCount()} of {ROAD_STOPS.length} stops cleared
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <Show when={nextStop()}>
                    {(stop) => (
                      <a
                        href={`?section=${stop().id}`}
                        class="btn-brand min-h-0 justify-center px-3.5 py-1.5 text-center text-sm font-black whitespace-nowrap"
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToAnchor(stop().id);
                        }}
                      >
                        {doneCount() === 0 ? "Start Walking" : "Resume Step"}
                      </a>
                    )}
                  </Show>

                  <Show when={doneCount() > 0}>
                    <button
                      type="button"
                      onClick={reset}
                      class="btn-ghost min-h-0 justify-center gap-1.5 px-2.5 py-1.5 text-sm font-black whitespace-nowrap"
                      title="Clear my progress"
                    >
                      <RotateCcw size={13} />
                      <span>Start Over</span>
                    </button>
                  </Show>
                </div>
              </div>
            </div>
          </div>

          {/* Continuous Progress Bar (Morphs between h-3 and h-1) */}
          <div
            class="flex gap-0.5 sm:gap-1 transition-all duration-300"
            role="progressbar"
            aria-label={`${doneCount()} of ${ROAD_STOPS.length} stops cleared`}
          >
            <For each={ROAD_STOPS}>
              {(stop, i) => (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStop(stop.id);
                    scrollToAnchor(stop.id);
                  }}
                  class={`min-w-0 flex-1 rounded-full transition-all duration-300 cursor-pointer ${
                    isStuck()
                      ? `h-1 ${i() === roadCursor() ? "ring-1 ring-[var(--ink)]" : ""}`
                      : "h-3 hover:opacity-80"
                  }`}
                  style={{
                    border: isStuck() ? "none" : "var(--ink-w) solid var(--ink)",
                    background: isDone(stop.id) ? `var(--${stop.pop})` : "var(--paper-3)",
                  }}
                  aria-label={`Stop ${i() + 1}: ${stop.title}`}
                  title={`Stop ${i() + 1}: ${stop.title}`}
                />
              )}
            </For>
          </div>

          {/* Comment text (Smooth CSS Grid Collapse) */}
          <div
            class={`grid transition-all duration-300 ease-in-out ${
              isStuck()
                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div class="overflow-hidden">
              <p class="comment text-xs sm:text-sm m-0 pt-0.5">
                Work at your own pace! Follow the steps below or use the navigation controls to jump
                between stops.
              </p>
            </div>
          </div>
        </div>
      </div>

      <For each={ROAD_STOPS}>
        {(stop, index) => (
          <>
            <RoadLeg
              from={index() === 0 ? "center" : sideOf(index() - 1)}
              to={sideOf(index())}
              pop={stop.pop}
              walked={walked(index())}
              label={index() + 1}
              done={isDone(stop.id)}
              detour={
                ROAD_STOPS[index() - 1]?.id === "rings-and-colour" ? (
                  <PookalamShowcase />
                ) : undefined
              }
            />

            <Show when={index() === 2}>
              <div
                class="card card-plain p-3 sm:p-4 my-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left"
                style={{
                  border: "var(--ink-w) dashed var(--ink)",
                  background: "var(--paper-2)",
                }}
              >
                <div class="space-y-0.5">
                  <div class="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted">
                    <Code2 size={14} class="text-[var(--pop-teal-deep)]" />
                    <span>Interactive Canvas Track</span>
                  </div>
                  <p class="m-0 text-xs sm:text-sm font-semibold text-[var(--ink)]">
                    From now on, we use <span class="font-bold">HTML5 Canvas & JavaScript</span> to
                    build our pookalam step by step. Follow along if you'd like to learn, or skip
                    ahead if you are building in Python, GLSL, or another stack.
                  </p>
                </div>

                <a
                  href="#git-setup"
                  class="btn-ghost min-h-0 text-xs font-black inline-flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToAnchor("git-setup");
                  }}
                >
                  <span>Skip to Git & Submit (Stop 6)</span>
                  <ChevronRight size={13} />
                </a>
              </div>
            </Show>

            <StopCard
              stop={stop}
              index={index()}
              side={sideOf(index())}
              done={isDone(stop.id)}
              interactiveReady={interactiveReady()}
              name={firstName()}
              active={roadCursor() === index()}
              onToggle={() => toggle(stop.id)}
            />
          </>
        )}
      </For>

      <RoadLeg
        from={sideOf(ROAD_STOPS.length - 1)}
        to="center"
        pop="pop-yellow"
        walked={isDone(ROAD_STOPS[ROAD_STOPS.length - 1].id)}
      />

      {/* ------------------------------------------------------- FINISH LINE */}
      <div class="card pop-yellow relative space-y-4 overflow-hidden">
        <Confetti seed="road-finish" count={allDone() ? 20 : 9} animate opacity={0.45} />

        <Show when={allDone()}>
          <div
            class="art-over anim-pop flex items-start gap-3 rounded p-3.5"
            style={{
              border: "var(--ink-w-bold) solid var(--ink)",
              background: "var(--paper-2)",
            }}
          >
            <SpriteIcon name="tux-king" size={34} animate="pulse" class="mt-0.5 shrink-0" />
            <div class="space-y-1">
              <p class="m-0 font-display text-base font-black">
                {firstName()
                  ? `Nine of nine, ${firstName()}. Look at that.`
                  : "Nine of nine. Look at that."}
              </p>
              <p class="m-0 text-sm font-semibold leading-relaxed">
                In one Onam week you drew with code, wrote a loop with maths in it, learnt git, and
                published an open-source repository. Those four things are most of what a first year
                of computer science is trying to teach you - you did them because you wanted a
                flower carpet on a screen. Whatever you build next, this is the week it started.
              </p>
            </div>
          </div>
        </Show>

        <div class="art-over flex flex-col items-center gap-4 md:flex-row">
          <img
            src={memeImage("meme-deploy.webp")}
            alt="Deploy Flower Carpet Meme"
            class="block w-36 shrink-0 select-none rounded-xl border-2 border-[var(--ink)] object-contain sm:w-40"
            loading="lazy"
            decoding="async"
          />

          <div class="flex-1 space-y-2.5 text-center md:text-left">
            <span class="sticker text-[10px]" style={{ "--pop": "var(--pop-teal)" }}>
              finish line
            </span>
            <h3 class="m-0 font-display text-xl font-black sm:text-2xl">
              {props.hasEntry
                ? "You're in. Now the community argues about it."
                : "That's the whole road. Ready to deploy your flower carpet?"}
            </h3>
            <p class="m-0 text-sm font-semibold leading-relaxed">{POOKALAM.votingBlurb}</p>
            <div class="flex flex-wrap items-center justify-center gap-3 pt-1 md:justify-start">
              <A href="/code-a-pookalam/submit" class="btn-brand inline-flex items-center gap-2">
                <Send size={18} />
                <span>{props.hasEntry ? "Edit my entry" : "Submit my pookalam"}</span>
              </A>

              <Show when={props.closesAt}>
                {(closesAt) => (
                  <Countdown target={new Date(closesAt())} doneLabel="Submissions closed" />
                )}
              </Show>
            </div>
            <p class="comment m-0 text-sm">
              {props.hasEntry
                ? "keep editing until Day 6 midnight. nobody sees your name while voting is open."
                : "submit early, improve later. edits stay open until Day 6 midnight."}
            </p>
          </div>
        </div>

        <div class="art-over grid gap-2 sm:grid-cols-3">
          <For each={AFTER_YOU_SUBMIT}>
            {(phase) => (
              <div class="card card-plain space-y-1.5 bg-surface p-3">
                <div class="flex items-center justify-between gap-2">
                  <SpriteIcon name={phase.sprite} size={22} interactive />
                  <span class="badge text-[10px]">{phase.when}</span>
                </div>
                <p class="m-0 text-sm font-black">{phase.title}</p>
                <p class="m-0 text-sm font-semibold leading-relaxed text-muted">{phase.body}</p>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
