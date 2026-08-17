import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FastForward,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-solid";
import { A, createAsync } from "@solidjs/router";
import { For, type JSX, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

import { Burst, Halftone } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { PookalamSandbox } from "~/components/pookalam/PookalamSandbox";
import { PookalamShowcase } from "~/components/pookalam/PookalamShowcase";
import { PookalamTutorials } from "~/components/pookalam/PookalamTutorials";
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

/** Backtick spans become inline code, the way they read in the source copy. */
function Inline(props: { text: string }) {
  const parts = () => props.text.split(/`([^`]+)`/g);
  return (
    <For each={parts()}>
      {(part, i) =>
        i() % 2 === 1 ? (
          <code
            class="rounded px-1 py-0.5 font-mono text-[0.9em]"
            style={{
              background: "var(--paper-3)",
              border: "1px solid var(--ink)",
              // Pinned, not inherited: these chips also sit inside the dark
              // terminal card, where inheriting its cream text made cream on
              // cream.
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
  /** A signpost planted on the tarmac, halfway along. */
  detour?: JSX.Element;
}) {
  const path = (x: Record<Side, number>) =>
    `M ${x[props.from]} 0 C ${x[props.from]} 40, ${x[props.to]} 52, ${x[props.to]} ${END_Y}`;

  const Curve = (curveProps: { x: Record<Side, number> }) => (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      class="block h-full w-full"
      aria-hidden="true"
    >
      {/* casing, tarmac, centre line - a road in three strokes */}
      <path
        d={path(curveProps.x)}
        fill="none"
        stroke="var(--ink)"
        stroke-width="18"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      <path
        d={path(curveProps.x)}
        fill="none"
        stroke={props.walked ? `var(--${props.pop})` : "var(--paper-3)"}
        stroke-width="12"
        stroke-linecap="round"
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
    <div class="relative h-24 sm:h-32" aria-hidden={props.label === undefined ? "true" : undefined}>
      {/* The two breakpoints want different curves: a full swing across the
          page reads as a road on a laptop and as a zigzag on a phone. */}
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
  return (
    <div class="swipe-rail">
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
  );
}

function StepsChecklist(props: { steps: string[]; pop: string }) {
  return (
    <ol class="m-0 list-none space-y-2 p-0">
      <For each={props.steps}>
        {(step, i) => (
          <li class="flex items-start gap-2.5">
            <span
              class="anim-pop grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm font-black"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: `var(--${props.pop})`,
                "animation-delay": `${i() * 60}ms`,
              }}
            >
              {i() + 1}
            </span>
            <span class="pt-0.5 text-sm font-semibold leading-relaxed sm:text-base">
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
    <div class="inked overflow-hidden rounded" style={{ background: "#181511" }}>
      <div
        class="flex items-center gap-1.5 px-3 py-1.5"
        style={{ "border-bottom": "var(--ink-w) solid var(--ink)", background: "#22202b" }}
      >
        <span class="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pop-red)" }} />
        <span class="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pop-yellow)" }} />
        <span class="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pop-teal)" }} />
        <span class="pl-1 font-mono text-[11px] font-bold text-[#8d8898]">your terminal</span>
      </div>
      <ol class="m-0 list-none space-y-1.5 p-3">
        <For each={props.steps}>
          {(step) => (
            <li class="flex items-start gap-2 font-mono text-[13px] leading-relaxed text-[#fbf3e4]">
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
      <svg viewBox="0 0 100 100" class="h-24 w-24 shrink-0" aria-hidden="true">
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
      <p class="m-0 font-mono text-sm font-bold">
        petals = <span class="font-black text-[var(--pop-teal-deep)]">{counts[step()]}</span>
        <br />
        <span class="text-xs text-muted">one number. that is the difference.</span>
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
 *
 * AI is explicitly allowed in this contest, and a first-year with a chatbot
 * open is not cheating - they are doing what every working developer does. What
 * they usually lack is the question. So each stop ships the prompt that gets a
 * useful answer for *that* stop, and says plainly what to use it for: explaining
 * the thing you just read, not generating an entry you did not write.
 */
const AI_TABS = [
  { label: "ChatGPT", href: "https://chatgpt.com/" },
  { label: "Gemini", href: "https://gemini.google.com/app" },
  { label: "Claude", href: "https://claude.ai/new" },
];

function AskAi(props: { prompt: string }) {
  const [copied, setCopied] = createSignal(false);

  const copy = () => {
    void navigator.clipboard.writeText(props.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details class="group">
      <summary class="btn-ghost inline-flex cursor-pointer list-none items-center gap-1.5 text-sm">
        <Sparkles size={14} class="shrink-0" />
        <span>Ask an AI to explain this stop</span>
        <ChevronDown size={14} class="shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div class="space-y-2 pt-2.5">
        <p class="m-0 text-sm font-semibold leading-relaxed">
          Open a chatbot in a new tab, paste this, and ask follow-up questions until it makes sense.
          Using AI to <span class="font-black">understand</span> things is the whole point; using it
          to generate an entry you did not write scores nothing, because originality is judged.
        </p>

        <div
          class="rounded p-2.5 font-mono text-xs leading-relaxed"
          style={{ border: "var(--ink-w) dashed var(--ink)", background: "var(--paper-3)" }}
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

/**
 * The sticky note pinned to every stop.
 *
 * The road tracks whether you finished a stop; it cannot track "my radius is
 * 140 and the teal ring looked wrong" or "ask Aravind about git tomorrow".
 * Those are the things people actually lose between sessions, so each stop gets
 * somewhere to write them - saved to this browser, seen by nobody.
 */
function StickyNote(props: { stopId: string; index: number }) {
  const [text, setText] = createSignal("");
  const [saved, setSaved] = createSignal(false);

  onMount(() => setText(readRoadNotes()[props.stopId] ?? ""));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const onInput = (value: string) => {
    setText(value);
    // Written straight through, but the "saved" flash is debounced so it does
    // not strobe on every keystroke.
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
      class="relative w-full max-w-xs shrink-0 p-2.5 pt-4"
      style={{
        background: "var(--pop-yellow)",
        border: "var(--ink-w) solid var(--ink)",
        "border-radius": "0.25rem",
        transform: props.index % 2 === 0 ? "rotate(-1.5deg)" : "rotate(1.5deg)",
      }}
    >
      {/* the tape */}
      <span
        class="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2"
        style={{
          background: "var(--paper-3)",
          border: "2px solid var(--ink)",
          transform: "translateX(-50%) rotate(-3deg)",
        }}
        aria-hidden="true"
      />
      <textarea
        class="block w-full resize-none bg-transparent leading-snug outline-none"
        style={{
          "font-family": "var(--font-stack-hand)",
          "font-size": "1.05rem",
          "font-weight": "700",
          color: "var(--ink)",
          "min-height": "4.5rem",
        }}
        placeholder="note to self… (where you got to, what broke, what to try next)"
        value={text()}
        onInput={(e) => onInput(e.currentTarget.value)}
        aria-label="Your note for this stop"
      />
      <p class="m-0 text-right font-mono text-[10px] font-bold opacity-70">
        {saved() ? "saved to this browser" : "saves as you type"}
      </p>
    </div>
  );
}

const RATING_WORDS = ["brutal", "hard", "fine", "easy", "too easy"];

/** How that stop went, for you alone. A tiny bit of fun, saved locally. */
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
              class="grid h-8 w-8 place-items-center rounded-full font-display text-xs font-black"
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
        <span class="comment text-sm">{RATING_WORDS[score() - 1]}</span>
      </Show>
    </div>
  );
}

/* ------------------------------------------------------------------ payloads */

/**
 * The prize money, said to a person rather than printed on a poster.
 *
 * By this stop somebody has drawn a pookalam and is one form away from
 * entering, which is the only moment the money is motivating rather than
 * intimidating - at the top of the page it reads as "professionals only".
 */
function PrizeCard(props: { name?: string }) {
  const prizes = [
    { place: "1st", amount: "₹1,500", sprite: "tux-king" as SpriteName, pop: "pop-yellow" },
    { place: "2nd", amount: "₹1,000", sprite: "ferris-crab" as SpriteName, pop: "pop-teal" },
    { place: "3rd", amount: "₹500", sprite: "gopher-king" as SpriteName, pop: "pop-pink" },
  ];

  return (
    <div class="card card-plain space-y-2.5 bg-surface">
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

      <p class="comment m-0 text-sm">
        somebody wins that for a picture they made with code. no reason it can't be a first-year who
        started this week - the voting screen never shows a name, only the pookalam.
      </p>
    </div>
  );
}

/** The extras that hang off a stop, reusing what the page already had. */
function StopPayload(props: { stop: RoadStop; name?: string }) {
  return (
    <>
      <Show when={props.stop.payload === "past-work"}>
        <PreviousPookalamCarousel />
      </Show>

      {/* Six tutorial tracks unfolded inside a stop is six code samples nobody
          asked for yet. The stop's question is "which one", and the answer
          lives one tap away. */}
      <Show when={props.stop.payload === "tutorials"}>
        <details class="group">
          <summary class="btn-ghost inline-flex cursor-pointer list-none items-center gap-1.5 text-sm">
            <ChevronDown size={15} class="shrink-0 transition-transform group-open:rotate-180" />
            <span>Six examples with starter code (any language counts)</span>
          </summary>
          <div class="pt-2.5">
            <PookalamTutorials compact />
          </div>
        </details>
      </Show>

      <Show when={props.stop.payload === "studio"}>
        <a
          href="#studio"
          class="btn-ghost inline-flex items-center gap-2 text-sm"
          onClick={(e) => {
            e.preventDefault();
            scrollToAnchor("studio");
          }}
        >
          <SpriteIcon name="concentric-pookalam" size={18} />
          <span>Open the studio up top and steal a palette</span>
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

/**
 * Plain-English gloss for each judging pillar.
 *
 * The pillars in `event-content.ts` are written for someone who already knows
 * what "procedural" means. They stay as they are - the jury uses that wording -
 * and get one honest sentence in front of them here.
 */
const PILLAR_PLAIN: Record<string, string> = {
  "Visual Quality & Polish": "Does it look good? Colours that sit together, edges that are clean.",
  "Technical Complexity & Craft":
    "Did the code do the work - loops and maths - or did you place every shape by hand?",
  "Originality & Concept":
    "Did you try something of your own instead of the first idea everybody has?",
  "Closeness to Real Pookalam": "Would someone at home look at it and call it a pookalam?",
  "Open-Source & Reproducibility": "Can we clone your repo, run it, and get your picture back?",
};

/** The four things that get an entry thrown out, as a thing you tap. */
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
  { id: "public", label: "My repo is public", hint: "a 404 is not a submission" },
  {
    id: "license",
    label: "It has a LICENSE file",
    hint: "MIT, Apache 2.0, GPLv3, BSD or Unlicense",
  },
];

/**
 * The rules, as a checklist you tap rather than a page you read.
 *
 * Same four facts either way - but a list of paragraphs gets skimmed and
 * remembered as "some rules about images", while four things you have to
 * actively tick get read once each. The tick is deliberately not saved: it is a
 * question about the entry in front of you today, not a setting.
 */
function EntryChecker() {
  const [ticked, setTicked] = createSignal<string[]>([]);

  // Hydrated on mount, like the rest of the road's state: this is the one part
  // of the page somebody will tick, walk away from, and come back to at 11pm on
  // Day 6 wanting to know what they had already sorted out.
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
              class="flex items-start gap-2.5 rounded p-2.5 text-left"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: isOn(check.id) ? "var(--pop-teal)" : "var(--paper-2)",
              }}
            >
              <span
                class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded"
                style={{ border: "2px solid var(--ink)", background: "var(--paper-2)" }}
              >
                <Show when={isOn(check.id)}>
                  <Check size={14} strokeWidth={4} />
                </Show>
              </span>
              <span>
                <span class="block text-sm font-black leading-tight">{check.label}</span>
                <span class="block text-xs font-semibold text-muted">{check.hint}</span>
              </span>
            </button>
          )}
        </For>
      </div>

      <p class="comment m-0 text-sm">
        <Show
          when={allSet()}
          fallback={`${ticked().length} of 4 - the other ${ENTRY_CHECKS.length - ticked().length} get entries pulled every year.`}
        >
          all four. nothing can disqualify you now. go and win it.
        </Show>
      </p>
    </div>
  );
}

/** Five pillars, as chips that open. Nobody reads five paragraphs in a row. */
function JudgingPillars() {
  const [open, setOpen] = createSignal<string | null>(POOKALAM.judging[0].name);
  const pops = ["pop-yellow", "pop-teal", "pop-blue", "pop-purple", "pop-pink"];

  return (
    <div class="space-y-2">
      <div class="flex flex-wrap gap-1.5">
        <For each={POOKALAM.judging}>
          {(criterion, i) => (
            <button
              type="button"
              onClick={() => setOpen(open() === criterion.name ? null : criterion.name)}
              class="badge cursor-pointer text-[10px]"
              style={{
                "--pop":
                  open() === criterion.name
                    ? `var(--${pops[i() % pops.length]})`
                    : "var(--paper-2)",
              }}
              aria-pressed={open() === criterion.name}
            >
              {criterion.name}
            </button>
          )}
        </For>
      </div>

      <Show when={POOKALAM.judging.find((c) => c.name === open())}>
        {(criterion) => (
          <div class="anim-pop card card-plain bg-surface p-3">
            <p class="m-0 text-sm font-black">{PILLAR_PLAIN[criterion().name]}</p>
            <p class="m-0 pt-1 text-xs font-semibold text-muted">{criterion().body}</p>
          </div>
        )}
      </Show>

      <p class="comment m-0 text-sm">nobody wins all five. pick the two you care about.</p>
    </div>
  );
}

function RulesPayload() {
  return (
    <div class="space-y-3">
      <EntryChecker />
      <JudgingPillars />
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm font-black">
          <ChevronDown size={15} class="shrink-0 transition-transform group-open:rotate-180" />
          <span>The full rulebook, word for word</span>
        </summary>
        <ul class="m-0 list-none space-y-2 p-0 pt-2">
          <For each={POOKALAM.rules}>
            {(rule) => (
              <li class="flex items-start gap-2 text-sm font-semibold leading-relaxed">
                <span class="shrink-0 font-black text-[var(--pop-pink)]">▸</span>
                <span>{rule}</span>
              </li>
            )}
          </For>
        </ul>
      </details>
    </div>
  );
}

/* ---------------------------------------------------------------- a stop card */

function StopCard(props: {
  stop: RoadStop;
  index: number;
  side: Side;
  done: boolean;
  /** First name, when we know it. The road talks to a person, not a visitor. */
  name?: string;
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
      {/* Clipping is load-bearing on a phone: the sticker and the pop-label are
          both rotated, and their corners would otherwise push the whole page
          sideways at 360px. It has to be `overflow-clip` rather than `hidden` -
          `hidden` makes this card a scroll container, and a scroll container
          silently disables `position: sticky` for everything inside it, which
          is what stranded the sandbox canvas above the fold. */}
      <div
        class={`card ${props.stop.pop} relative space-y-4 overflow-clip ${props.done ? "opacity-90" : ""}`}
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

        <div class="art-over space-y-2">
          <h3
            class="pop-label m-0 max-w-full"
            style={{
              "--pop": `var(--${props.stop.pop})`,
              "--tilt": props.index % 2 === 0 ? "-2deg" : "1.5deg",
              // The class default bottoms out near 16px on a phone, smaller than
              // the body text under it. Titles are how you scan a road.
              "font-size": "clamp(1.45rem, 6vw, 2.1rem)",
            }}
          >
            {props.index + 1}. {props.stop.title}
          </h3>
          <p class="comment text-sm sm:text-base">
            {props.name ? props.stop.hookNamed.replace("{name}", props.name) : props.stop.hook}
          </p>
        </div>

        {/* On a sandbox stop the steps ride inside the playground's left column,
            so the canvas sits beside them at the top of the card instead of
            below everything - that empty top-right corner was the first thing
            anyone noticed. Everywhere else the steps stand alone. */}
        <Show when={props.stop.code?.sandbox} fallback={<Steps stop={props.stop} />}>
          <div class="art-over space-y-1.5">
            <PookalamSandbox
              snippet={props.stop.code!.snippet}
              intro={<Steps stop={props.stop} />}
            />
          </div>
        </Show>

        <Show when={props.stop.code && !props.stop.code.sandbox}>
          <div class="art-over space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-black uppercase tracking-wider text-muted">
                {props.stop.code!.label}
              </span>
              <button
                type="button"
                onClick={() => copy(props.stop.code!.snippet)}
                class="btn-ghost min-h-0 px-2.5 py-1 text-xs"
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
            <pre class="inked select-text overflow-x-auto rounded bg-[#181511] p-3 font-mono text-[13px] text-[#fbf3e4]">
              <code>{props.stop.code!.snippet}</code>
            </pre>
          </div>
        </Show>

        <Show when={props.stop.visual === "petal-dial"}>
          <div class="art-over">
            <PetalDial />
          </div>
        </Show>
        <Show when={props.stop.visual === "palette"}>
          <div class="art-over">
            <PaletteVisual />
          </div>
        </Show>

        <div class="art-over">
          <AskAi prompt={props.stop.aiPrompt} />
        </div>

        {/* Chips, not cards: this is a hand-off to somebody else's site, and it
            should never outweigh the stop it sits in. */}
        <Show when={props.stop.links}>
          <div class="art-over flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-black uppercase tracking-wider text-muted">learn more:</span>
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

        <div class="art-over">
          <StopPayload stop={props.stop} name={props.name} />
        </div>

        {/* The prose, folded away. Nobody reads three paragraphs on a
            competition page, and the people who do want them are exactly the
            people who will open a summary to find them. */}
        <Show when={props.stop.more}>
          <details class="art-over group">
            <summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm font-black">
              <ChevronDown size={15} class="shrink-0 transition-transform group-open:rotate-180" />
              <span>Why this works</span>
            </summary>
            <div class="space-y-2 pt-2">
              <For each={props.stop.more}>
                {(para) => (
                  <p class="m-0 text-sm font-semibold leading-relaxed">
                    <Inline text={para} />
                  </p>
                )}
              </For>
            </div>
          </details>
        </Show>

        {/* The off-ramp for people who did not need any of that. Every stop has
            one: a third-year who scrolls past nine cards of things they already
            know decides the page is not for them, and they are the ones most
            likely to actually submit. */}
        <Show when={props.stop.levelUp}>
          <div
            class="art-over flex items-start gap-2 rounded p-2.5"
            style={{ border: "var(--ink-w) dashed var(--ink)", background: "var(--paper-3)" }}
          >
            <SpriteIcon name="arch-crown" size={20} interactive class="mt-0.5 shrink-0" />
            <p class="m-0 text-sm font-semibold leading-relaxed">
              <span class="font-black uppercase tracking-wide">Knew that already? </span>
              <Inline text={props.stop.levelUp!} />
            </p>
          </div>
        </Show>

        {/* What you just earned, in plain words, once, with your name on it.
            Nobody tells a first-year that drawing a circle with code is the same
            skill professionals use, so this does. */}
        <Show when={props.done}>
          <div
            class="art-over anim-pop flex items-start gap-2.5 rounded p-3"
            style={{
              border: "var(--ink-w) solid var(--ink)",
              background: `var(--${props.stop.pop})`,
            }}
          >
            <SpriteIcon name="burst-heart" size={22} animate="pulse" class="mt-0.5 shrink-0" />
            <p class="m-0 text-sm font-bold leading-relaxed">
              <span class="font-black">
                {props.name ? `Nice one, ${props.name}. ` : "Nice one. "}
              </span>
              {props.stop.praise}
            </p>
          </div>
        </Show>

        {/* Your own two columns: what you thought of the stop, and whatever you
            need to remember about it tomorrow. The rating only appears once the
            stop is done - asking how it went before you have done it is noise. */}
        <div class="art-over flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
          <Show when={props.done} fallback={<span />}>
            <SelfRating stopId={props.stop.id} />
          </Show>
          <StickyNote stopId={props.stop.id} index={props.index} />
        </div>

        <div class="art-over relative flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={props.onToggle}
            class="btn-ghost relative z-10 min-h-0 gap-2 px-3 py-2 text-sm"
            style={props.done ? { background: `var(--${props.stop.pop})` } : undefined}
            aria-pressed={props.done}
          >
            <Show when={props.done} fallback={<span>Mark this done</span>}>
              <Check size={15} strokeWidth={3} />
              <span>Done</span>
            </Show>
          </button>

          <Show when={ROAD_STOPS[props.index + 1]}>
            {(next) => (
              <a
                href={`#${next().id}`}
                class="text-sm font-black text-muted underline decoration-dashed underline-offset-4"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToAnchor(next().id);
                }}
              >
                next stop →
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
  /**
   * The viewer's first name, when they are signed in.
   *
   * Read here rather than passed down so the road can be dropped on any page.
   * A road that says "Nice one, Aravind" after a stop is a different experience
   * from one that says "Nice one" - and signed-out visitors simply get the
   * shorter sentence, never a placeholder.
   */
  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me ?? undefined;
  const firstName = () => me()?.name?.trim().split(/\s+/)[0] || undefined;

  // Empty on the server and on first paint, filled in on mount: reading
  // localStorage during render would make the markup disagree with the HTML
  // that was sent, and Solid hydrates against that HTML.
  const [done, setDone] = createSignal<string[]>([]);

  onMount(() => setDone(readRoadProgress()));

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

  /** The first stop not yet ticked - where "continue" sends you. */
  const nextStop = createMemo(() => ROAD_STOPS.find((s) => !isDone(s.id)) ?? null);

  const allDone = createMemo(() => doneCount() === ROAD_STOPS.length);

  /**
   * A leg is walked once the stop it leaves from is ticked. The lead-in leg
   * from the header is always walked: you are standing on it.
   */
  const walked = (index: number) => index === 0 || isDone(ROAD_STOPS[index - 1].id);

  return (
    <section id="road" class="relative scroll-mt-28">
      <div class="card pop-teal relative space-y-3.5 overflow-hidden">
        <Confetti seed="road-head" count={6} animate opacity={0.35} />

        <div class="art-over space-y-3.5">
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div class="min-w-0 space-y-1">
              <span class="sticker text-[10px]" style={{ "--pop": "var(--pop-yellow)" }}>
                nine stops · one week · zero experience required
              </span>
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

            <div class="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Show when={nextStop()}>
                {(stop) => (
                  <a
                    href={`#${stop().id}`}
                    class="btn-brand min-h-0 justify-center px-3 py-2 text-center text-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToAnchor(stop().id);
                    }}
                  >
                    {doneCount() === 0 ? "Start walking" : "Back to where I stopped"}
                  </a>
                )}
              </Show>

              {/* The express lane. Somebody who has shipped code before should
                  not have to scroll past "draw one circle" to find the deadline
                  rules, and saying so outright is what stops the page reading
                  as a school lesson. */}
              <a
                href="#judging"
                class="btn-ghost min-h-0 justify-center gap-1.5 px-3 py-2 text-center text-sm"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToAnchor("judging");
                }}
              >
                <FastForward size={14} class="shrink-0" />
                <span>I know this, just the rules</span>
              </a>

              <Show when={doneCount() > 0}>
                <button
                  type="button"
                  onClick={reset}
                  class="btn-ghost min-h-0 justify-center gap-1.5 px-2.5 py-2 text-sm"
                  title="Clear my progress"
                >
                  <RotateCcw size={13} />
                  <span>Start over</span>
                </button>
              </Show>
            </div>
          </div>

          <div class="flex gap-1">
            <For each={ROAD_STOPS}>
              {(stop) => (
                <div
                  class="h-3 flex-1 rounded-full"
                  style={{
                    border: "var(--ink-w) solid var(--ink)",
                    background: isDone(stop.id) ? `var(--${stop.pop})` : "var(--paper-3)",
                  }}
                  aria-hidden="true"
                />
              )}
            </For>
          </div>

          <p class="comment text-sm">
            days are a suggestion, not a rule. some walk this whole road in one evening, some take
            the week, and every stop has a shortcut for people who already know that bit.
          </p>
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
              // A detour, not a stop: after four rings of ellipses the obvious
              // question is "is this as far as it goes", and it is better
              // answered on the way to git than left hanging until somebody
              // sees a winning entry on Day 7.
              detour={
                ROAD_STOPS[index() - 1]?.id === "rings-and-colour" ? (
                  <PookalamShowcase />
                ) : undefined
              }
            />
            <StopCard
              stop={stop}
              index={index()}
              side={sideOf(index())}
              done={isDone(stop.id)}
              name={firstName()}
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

      {/* ------------------------------------------------------- FINISH LINE
       * Also where the old "how the competition works" timeline ended up. It
       * only becomes a real question once you have something to submit, and at
       * the top of the page it was answering it two scrolls too early.
       */}
      <div class="card pop-yellow relative space-y-4 overflow-hidden">
        <Confetti seed="road-finish" count={allDone() ? 20 : 9} animate opacity={0.45} />

        {/* Nine of nine. Said properly, once - this is the moment somebody
            decides whether they are "a person who codes". */}
        <Show when={allDone()}>
          <div
            class="art-over anim-pop flex items-start gap-3 rounded p-3.5"
            style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
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

              {/* The clock again, where the decision to submit is actually
                  made. Nobody scrolls back up to check how long is left. */}
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
