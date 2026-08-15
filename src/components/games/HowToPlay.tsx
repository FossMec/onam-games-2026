import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";

/**
 * How to play — the rules, and a toy board that plays itself.
 *
 * Written text alone does not survive a countdown. Somebody about to start a
 * ranked, one-shot, timed puzzle reads the first line and clicks Start, and
 * then loses forty seconds working out that the boats only slide along their
 * own axis. A four-second loop showing a boat sliding along its own axis costs
 * nothing and cannot be misread.
 *
 * The demo is always a *toy*: a 3x3 jigsaw, a 4x4 word grid, two boats. It has
 * to be obviously not the real puzzle, or it would be a spoiler — and none of
 * these boards are ever the instance the player is about to be dealt.
 *
 * Shown in two places: a modal on the way into a game (so it is read before
 * the clock starts, not during), and a panel on the page (so it can be checked
 * afterwards without starting anything).
 */

const INK = "var(--ink)";
const PAPER = "var(--paper-2)";

/* ------------------------------------------------------------------ demos */

/** A demo frame: fixed height, inked, quietly confettied. */
function Stage(props: { children: JSX.Element; seed: string; pop?: string }) {
  return (
    <div
      class="relative w-full overflow-hidden rounded"
      style={{
        height: "180px",
        border: "var(--ink-w) solid var(--ink)",
        background: props.pop ?? "var(--paper-3)",
      }}
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <Confetti seed={props.seed} count={4} />
      </div>
      {props.children}
    </div>
  );
}

/**
 * Swipe right on the one whose source you can read.
 *
 * The framing here matters more than the animation. An earlier version labelled
 * the two cards "free, forever" and "$9.99 / month", which taught precisely the
 * wrong lesson — that open source means costs nothing. That is the single most
 * common misunderstanding this game exists to correct, and half the deck is
 * built on it: Obsidian costs nothing and is proprietary; Chrome costs nothing
 * and is proprietary. The test is whether you can read, change and share the
 * code, so the demo says that and nothing about money.
 *
 * The two products are invented — every real name is a card somebody is about
 * to be dealt, and showing one here with its answer stamped on it would be
 * handing over a free point. A matched pair in one category also teaches the
 * mechanic better than two unrelated products: the difference between them is
 * the only thing being asked about.
 */
function TinderDemo() {
  return (
    <Stage seed="demo-tinder">
      <div class="absolute inset-0 grid place-items-center pb-6">
        <div class="relative" style={{ width: "112px", height: "126px" }}>
          {/* The rest of the deck, hinted at. */}
          <div
            class="absolute inset-0 rounded"
            style={{
              background: "var(--paper-3)",
              border: "var(--ink-w) solid var(--ink)",
              transform: "translateY(16px) scale(0.9)",
            }}
          />

          {/* Second card: rises as the first leaves, then swipes left. */}
          <div
            class="absolute inset-0"
            style={{ "z-index": 2, animation: "demo-card-paid 6s ease-in-out infinite" }}
          >
            <DemoCard name="Notes Pro" sub="source: sealed" pop="var(--pop-red)" locked />
            <span
              class="sticker absolute left-1.5 top-1.5 text-[0.6rem]"
              style={{
                "--pop": "var(--pop-red)",
                animation: "demo-stamp-paid 6s ease-in-out infinite",
              }}
            >
              NOPE
            </span>
          </div>

          {/* Top card: swipes right straight away. It must be on top — that is
              the whole point of a deck, and the first version had it behind. */}
          <div
            class="absolute inset-0"
            style={{ "z-index": 3, animation: "demo-card-free 6s ease-in-out infinite" }}
          >
            <DemoCard name="Libre Notes" sub="source: readable" pop="var(--pop-teal)" />
            <span
              class="sticker absolute right-1.5 top-1.5 text-[0.6rem]"
              style={{
                "--pop": "var(--pop-teal)",
                animation: "demo-stamp-free 6s ease-in-out infinite",
              }}
            >
              FREE!
            </span>
          </div>
        </div>
      </div>

      <div class="absolute inset-x-0 bottom-1.5 flex items-center justify-between px-3 text-[0.65rem] font-extrabold uppercase tracking-wider">
        <span style={{ color: "var(--pop-red)" }}>← closed source</span>
        <span style={{ color: "var(--pop-teal-deep)" }}>open source →</span>
      </div>
    </Stage>
  );
}

function DemoCard(props: { name: string; sub: string; pop: string; locked?: boolean }) {
  return (
    <div
      class="flex h-full w-full flex-col overflow-hidden rounded"
      style={{ background: PAPER, border: "var(--ink-w) solid var(--ink)" }}
    >
      <div class="relative grid flex-1 place-items-center" style={{ background: props.pop }}>
        <div class="halftone absolute inset-0" aria-hidden="true" />
        {/* An open padlock or a shut one. The whole joke in one glyph. */}
        <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
          <rect
            x="7"
            y="14"
            width="18"
            height="14"
            rx="3"
            fill={PAPER}
            stroke={INK}
            stroke-width="2.5"
          />
          <path
            d={props.locked ? "M11 14v-4a5 5 0 0 1 10 0v4" : "M11 14v-4a5 5 0 0 1 10 0"}
            fill="none"
            stroke={INK}
            stroke-width="2.5"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <div
        class="px-1.5 py-1 text-center"
        style={{ "border-top": "var(--ink-w) solid var(--ink)" }}
      >
        <p
          class="truncate text-[0.7rem] leading-tight"
          style={{ "font-family": "var(--font-stack-display)", "font-weight": 800 }}
        >
          {props.name}
        </p>
        <p class="truncate text-[0.6rem] font-bold text-muted">{props.sub}</p>
      </div>
    </div>
  );
}

/** Pieces drop into the board and lock. */
function JigsawDemo() {
  return (
    <Stage seed="demo-jigsaw">
      <div class="absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 200 120" width="100%" height="100%" aria-hidden="true">
          {/* The board: a 3x3 of empty slots. */}
          <For each={[0, 1, 2]}>
            {(row) => (
              <For each={[0, 1, 2]}>
                {(col) => (
                  <rect
                    x={104 + col * 26}
                    y={20 + row * 26}
                    width="24"
                    height="24"
                    fill={PAPER}
                    stroke={INK}
                    stroke-width="2"
                    stroke-dasharray="4 3"
                  />
                )}
              </For>
            )}
          </For>

          {/* Two pieces travelling from the tray into their slots. */}
          <g
            style={{
              "--to-x": "82px",
              "--to-y": "-14px",
              animation: "demo-slot 4s ease-in-out infinite",
            }}
          >
            <rect
              x="24"
              y="48"
              width="24"
              height="24"
              fill="var(--pop-yellow)"
              stroke={INK}
              stroke-width="2.5"
            />
            <circle cx="36" cy="60" r="5" fill="var(--pop-red)" stroke={INK} stroke-width="2" />
          </g>
          <g
            style={{
              "--to-x": "56px",
              "--to-y": "12px",
              animation: "demo-slot 4s ease-in-out infinite",
              "animation-delay": "0.6s",
            }}
          >
            <rect
              x="48"
              y="26"
              width="24"
              height="24"
              fill="var(--pop-teal)"
              stroke={INK}
              stroke-width="2.5"
            />
            <path d="M52 46 68 30" stroke={INK} stroke-width="2.5" />
          </g>
        </svg>
      </div>
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        close enough + correct = snap
      </p>
    </Stage>
  );
}

/** A finger drags across letters and the path locks in. */
function WendDemo() {
  const letters = ["O", "N", "A", "M", "K", "E", "R", "A", "L", "A", "S", "T", "V", "I", "P", "U"];
  return (
    <Stage seed="demo-wend">
      <div class="absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 140 120" width="100%" height="100%" aria-hidden="true">
          <For each={letters}>
            {(letter, i) => {
              const col = () => i() % 4;
              const row = () => Math.floor(i() / 4);
              return (
                <>
                  <rect
                    x={20 + col() * 26}
                    y={12 + row() * 26}
                    width="24"
                    height="24"
                    rx="4"
                    fill={PAPER}
                    stroke={INK}
                    stroke-width="2"
                  />
                  <text
                    x={32 + col() * 26}
                    y={24 + row() * 26}
                    text-anchor="middle"
                    dominant-baseline="central"
                    fill={INK}
                    style={{ font: "800 12px var(--font-stack-display)" }}
                  >
                    {letter}
                  </text>
                </>
              );
            }}
          </For>

          {/* O-N-A-M, bending down at the end to show paths are not straight. */}
          <path
            d="M32 24 H58 H84 V50"
            fill="none"
            stroke="var(--pop-teal)"
            stroke-width="9"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.55"
            style={{
              "--len": "80",
              "stroke-dasharray": "80",
              animation: "demo-trace 4s ease-in-out infinite",
            }}
          />
        </svg>
      </div>
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        paths bend. every tile belongs to one word.
      </p>
    </Stage>
  );
}

/** The blocker moves aside, the snake boat leaves. */
function VallamDemo() {
  return (
    <Stage seed="demo-vallam">
      <div class="absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 180 120" width="100%" height="100%" aria-hidden="true">
          <rect
            x="20"
            y="14"
            width="120"
            height="92"
            fill={PAPER}
            stroke={INK}
            stroke-width="2.5"
          />
          {/* The exit. */}
          <path
            d="M140 50 h18 M140 74 h18"
            stroke={INK}
            stroke-width="2.5"
            stroke-dasharray="4 3"
          />

          {/* The blocker, moving up its own column to clear the lane. */}
          <rect
            x="104"
            y="26"
            width="22"
            height="44"
            rx="8"
            fill="var(--pop-blue)"
            stroke={INK}
            stroke-width="2.5"
            style={{ animation: "demo-blocker-up 4s ease-in-out infinite" }}
          />

          {/* The chundan vallam, out through the right edge. */}
          <g style={{ "--slide": "94px", animation: "demo-slide-out 4s ease-in-out infinite" }}>
            <rect
              x="30"
              y="52"
              width="66"
              height="22"
              rx="10"
              fill="var(--pop-red)"
              stroke={INK}
              stroke-width="2.5"
            />
            <circle cx="44" cy="63" r="4" fill={PAPER} stroke={INK} stroke-width="2" />
          </g>
        </svg>
      </div>
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        boats only slide along their own axis
      </p>
    </Stage>
  );
}

/** Maveli climbs. Hold a side to steer. */
function JumpDemo() {
  return (
    <Stage seed="demo-jump">
      <div class="absolute inset-0 grid place-items-center">
        <div class="relative" style={{ width: "150px", height: "140px" }}>
          <For
            each={[
              { x: 4, y: 108, pop: "var(--paper-2)" },
              { x: 48, y: 78, pop: "var(--pop-yellow)" },
              { x: 92, y: 48, pop: "var(--pop-blue)" },
              { x: 40, y: 20, pop: "var(--pop-pink)" },
            ]}
          >
            {(p) => (
              <div
                class="absolute rounded"
                style={{
                  left: `${p.x}px`,
                  top: `${p.y}px`,
                  width: "44px",
                  height: "9px",
                  background: p.pop,
                  border: "var(--ink-w) solid var(--ink)",
                }}
              />
            )}
          </For>
          <div
            class="absolute"
            style={{
              left: "12px",
              top: "76px",
              animation: "demo-hop 2.6s ease-in-out infinite",
            }}
          >
            <SpriteIcon name="maveli-laptop" size={30} alt="" />
          </div>
        </div>
      </div>
      <div class="absolute inset-x-0 bottom-1.5 flex items-center justify-between px-3 text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        <span>hold left</span>
        <span style={{ color: "var(--pop-yellow-deep)" }}>yellow breaks · pink launches</span>
        <span>hold right</span>
      </div>
    </Stage>
  );
}

/** Clues out there, one token back here. */
function HuntDemo() {
  return (
    <Stage seed="demo-hunt">
      <div class="absolute inset-0 grid place-items-center gap-2 px-4">
        <div class="flex items-center gap-2">
          <SpriteIcon name="terminal-star" size={34} animate="pulse" alt="" />
          <span class="text-2xl" style={{ color: "var(--ink-soft)" }}>
            →
          </span>
          <SpriteIcon name="footprints" size={34} animate="float" alt="" />
          <span class="text-2xl" style={{ color: "var(--ink-soft)" }}>
            →
          </span>
          <div
            class="rounded px-2 py-1 tabular-nums text-xs font-bold"
            style={{ background: PAPER, border: "var(--ink-w) solid var(--ink)" }}
          >
            ONAM-••••
          </div>
        </div>
      </div>
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        first correct token wins. there is no second prize.
      </p>
    </Stage>
  );
}

export function GameDemo(props: { gameType: string }) {
  return (
    <>
      <Show when={props.gameType === "tinder"}>
        <TinderDemo />
      </Show>
      <Show when={props.gameType === "jigsaw"}>
        <JigsawDemo />
      </Show>
      <Show when={props.gameType === "wend"}>
        <WendDemo />
      </Show>
      <Show when={props.gameType === "unblock"}>
        <VallamDemo />
      </Show>
      <Show when={props.gameType === "jump"}>
        <JumpDemo />
      </Show>
      <Show when={props.gameType === "hunt"}>
        <HuntDemo />
      </Show>
    </>
  );
}

/* ------------------------------------------------------------------ steps */

function Steps(props: { steps: string[] }) {
  return (
    <ol class="space-y-2.5">
      <For each={props.steps}>
        {(step, i) => (
          <li class="flex gap-3">
            <span
              class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs tabular-nums"
              style={{
                background: "var(--pop-yellow)",
                border: "2px solid var(--ink)",
                "font-family": "var(--font-stack-display)",
                "font-weight": 800,
              }}
            >
              {i() + 1}
            </span>
            <span class="text-sm font-semibold leading-snug">{step}</span>
          </li>
        )}
      </For>
    </ol>
  );
}

/* ------------------------------------------------------------------ panel */

/** The always-there version, collapsed by default so it never eats the page. */
export function HowToPlayPanel(props: { gameType: string; steps: string[]; title?: string }) {
  const [open, setOpen] = createSignal(false);

  return (
    <section class="card card-plain space-y-3">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
      >
        <span class="rule flex-1">How to play</span>
        <span
          class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
          style={{
            background: "var(--paper-3)",
            border: "2px solid var(--ink)",
            "font-family": "var(--font-stack-display)",
            "font-weight": 800,
          }}
        >
          {open() ? "−" : "+"}
        </span>
      </button>

      <Show when={open()}>
        <div class="space-y-4">
          <GameDemo gameType={props.gameType} />
          <Steps steps={props.steps} />
        </div>
      </Show>
    </section>
  );
}

/* ------------------------------------------------------------------ modal */

export interface HowToPlayModalProps {
  gameType: string;
  title: string;
  steps: string[];
  /** Label for the confirm button — "Start game", "Go again", "Resume". */
  startLabel: string;
  busy?: boolean;
  onStart: () => void;
  onClose: () => void;
}

/**
 * The pre-flight modal.
 *
 * Deliberately *not* dismissible by accident on the way to Start: the backdrop
 * and Escape both close it, but the confirm button is the only thing that
 * begins an attempt. The clock starts on that click and not a moment earlier,
 * which is the whole reason this screen exists.
 */
export function HowToPlayModal(props: HowToPlayModalProps) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while this is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    });
  });

  return (
    <div
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
      style={{ background: "rgb(34 32 43 / 0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`How to play ${props.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="card pop-yellow anim-sheet-in my-auto w-full max-w-md space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold uppercase tracking-widest text-muted">How to play</p>
            <h2 class="text-2xl leading-tight">{props.title}</h2>
          </div>
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
            style={{
              background: "var(--paper-3)",
              border: "var(--ink-w) solid var(--ink)",
              "font-family": "var(--font-stack-display)",
              "font-weight": 800,
            }}
            onClick={props.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <GameDemo gameType={props.gameType} />
        <Steps steps={props.steps} />

        <p class="comment">read it now. the clock starts when you press the button.</p>

        <div class="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            class="btn-brand flex-1 text-lg"
            disabled={props.busy}
            onClick={props.onStart}
          >
            {props.busy ? "Starting…" : props.startLabel}
          </button>
          <button type="button" class="btn-ghost sm:flex-none" onClick={props.onClose}>
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
