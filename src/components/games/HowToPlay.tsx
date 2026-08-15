import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { edgesForPiece, pieceOutline, type JigsawTab } from "~/lib/jigsaw-shape";

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

/**
 * Four pieces drifting together into one lump.
 *
 * Drawn with the real `pieceOutline`, on fixed tabs — so what a player watches
 * here is exactly the geometry they are about to drag around, tab for socket.
 * The earlier version showed a 3x3 of dashed slots with squares dropping into
 * them, which described a completely different game: this jigsaw has no slots,
 * the pieces join to *each other*, and that is the one thing the demo has to
 * get across.
 */
const DEMO_CELL = 44;

/** One tab spec per shared edge of the 2x2. Fixed, so the demo is stable. */
const DEMO_H: JigsawTab[][] = [
  [
    { dir: 1, offset: 0.5, neck: 0.12, head: 0.2, skew: 0 },
    { dir: -1, offset: 0.46, neck: 0.12, head: 0.2, skew: 0 },
  ],
];
const DEMO_V: JigsawTab[][] = [
  [{ dir: -1, offset: 0.52, neck: 0.12, head: 0.2, skew: 0 }],
  [{ dir: 1, offset: 0.48, neck: 0.12, head: 0.2, skew: 0 }],
];

const DEMO_PIECES = [
  { id: 0, col: 0, row: 0, from: "-26px, -20px", pop: "var(--pop-red)" },
  { id: 1, col: 1, row: 0, from: "30px, -22px", pop: "var(--pop-yellow)" },
  { id: 2, col: 0, row: 1, from: "-30px, 22px", pop: "var(--pop-teal)" },
  { id: 3, col: 1, row: 1, from: "26px, 24px", pop: "var(--pop-pink)" },
];

function JigsawDemo() {
  return (
    <Stage seed="demo-jigsaw">
      <div class="absolute inset-0 grid place-items-center pb-5">
        <svg
          viewBox="-30 -28 148 144"
          width="150"
          height="146"
          aria-hidden="true"
          style={{ overflow: "visible" }}
        >
          <For each={DEMO_PIECES}>
            {(piece, i) => (
              <g
                style={{
                  "--from-x": piece.from.split(",")[0],
                  "--from-y": piece.from.split(",")[1].trim(),
                  animation: "demo-join 5s ease-in-out infinite",
                  "animation-delay": `${i() * 0.09}s`,
                }}
              >
                <g transform={`translate(${piece.col * DEMO_CELL} ${piece.row * DEMO_CELL})`}>
                  <path
                    d={pieceOutline(DEMO_CELL, edgesForPiece(piece.id, 2, 2, DEMO_H, DEMO_V))}
                    fill={piece.pop}
                    stroke={INK}
                    stroke-width="2.5"
                    stroke-linejoin="round"
                  />
                </g>
              </g>
            )}
          </For>
        </svg>
      </div>
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        pieces join to each other · close enough + correct = snap
      </p>
    </Stage>
  );
}

/** A finger drags across letters and the path locks in. */
function WendDemo() {
  const letters = ["O", "N", "A", "M", "K", "E", "R", "A", "L", "A", "S", "T", "V", "I", "P", "U"];
  return (
    <Stage seed="demo-wend">
      <div class="absolute inset-0 grid place-items-center pb-6">
        <svg viewBox="0 0 140 130" width="100%" height="100%" aria-hidden="true">
          <For each={letters}>
            {(letter, i) => {
              const col = () => i() % 4;
              const row = () => Math.floor(i() / 4);
              return (
                <>
                  <rect
                    x={23 + col() * 24}
                    y={8 + row() * 24}
                    width="22"
                    height="22"
                    rx="4"
                    fill={PAPER}
                    stroke={INK}
                    stroke-width="2"
                  />
                  <text
                    x={34 + col() * 24}
                    y={19 + row() * 24}
                    text-anchor="middle"
                    dominant-baseline="central"
                    fill={INK}
                    style={{ font: "800 11px var(--font-stack-display)" }}
                  >
                    {letter}
                  </text>
                </>
              );
            }}
          </For>

          {/* O-N-A-M, bending down at the end to show paths are not straight. */}
          <path
            d="M34 19 H58 H82 V43"
            fill="none"
            stroke="var(--pop-teal)"
            stroke-width="8"
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
      <p class="absolute inset-x-0 bottom-1.5 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        paths bend. every tile belongs to one word.
      </p>
    </Stage>
  );
}

/** The blocker moves aside, the snake boat leaves. */
function VallamDemo() {
  return (
    <Stage seed="demo-vallam">
      <div class="absolute inset-0 grid place-items-center pb-6">
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
          <g style={{ animation: "demo-blocker-up 4s ease-in-out infinite" }}>
            <image
              href="/sprites/vallam/boat-canoe.webp"
              x="93"
              y="37"
              width="44"
              height="22"
              transform="rotate(90 115 48)"
              style={{
                filter: "hue-rotate(40deg) saturate(1.2) drop-shadow(0 2px 3px rgba(34,32,43,0.3))",
              }}
            />
          </g>

          {/* The chundan vallam, out through the right edge. */}
          <g style={{ "--slide": "94px", animation: "demo-slide-out 4s ease-in-out infinite" }}>
            <g transform="translate(30, 52)">
              <image
                href="/sprites/vallam/hero-vallam.webp"
                x="-68"
                y="0"
                width="68"
                height="22"
                transform="scale(-1, 1)"
                style={{ filter: "drop-shadow(0 2px 3px rgba(34,32,43,0.3))" }}
              />
            </g>
          </g>
        </svg>
      </div>
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        boats only slide along their own axis
      </p>
    </Stage>
  );
}

/** Maveli climbs. Hold a side or tilt to steer. */
function JumpDemo() {
  const [anim, setAnim] = createSignal({
    px: 30,
    py: 78,
    moveX: 86,
    sprite: "/sprites/jump/maveli-jump.webp",
    balloonVisible: true,
    showUmbrellaBurst: false,
    flip: false,
  });

  onMount(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame = (frame + 1) % 180; // 3 seconds cycle at 60fps
      const t = frame / 180; // 0 to 1

      // Moving platform position:
      const moveX = 86 + Math.sin(t * Math.PI * 4) * 16;

      let px = 30;
      let py = 78;
      let sprite = "/sprites/jump/maveli-jump.webp";
      let balloonVisible = true;
      let showUmbrellaBurst = false;
      let flip = false;

      if (t < 0.28) {
        // Hop 1: Bottom Mint (x: 30, y: 78) -> Moving Blue Platform
        const p = t / 0.28;
        px = 30 + p * (moveX + 10 - 30);
        py = 78 - Math.sin(p * Math.PI) * 36;
        sprite = p > 0.5 ? "/sprites/jump/maveli-fall.webp" : "/sprites/jump/maveli-jump.webp";
      } else if (t < 0.55) {
        // Hop 2: Blue Platform -> Balloon Grab (x: 102, y: 38)
        const p = (t - 0.28) / 0.27;
        px = moveX + 10 + p * (102 - (moveX + 10));
        py = 50 - Math.sin(p * Math.PI) * 32;
        if (p > 0.45) {
          balloonVisible = false;
          sprite = "/sprites/jump/maveli-balloon.webp";
        } else {
          sprite = "/sprites/jump/maveli-jump.webp";
        }
      } else if (t < 0.78) {
        // Hop 3: Float down onto Orange Umbrella Spring Platform (x: 165, y: 22)
        const p = (t - 0.55) / 0.23;
        balloonVisible = false;
        px = 102 + p * (165 - 102);
        py = 32 + p * (22 - 32) + Math.sin(p * Math.PI) * 4;
        sprite = "/sprites/jump/maveli-balloon.webp";
      } else {
        // Hop 4: BOING! Super Launch off Umbrella Platform with Olakuda!
        const p = (t - 0.78) / 0.22;
        balloonVisible = false;
        showUmbrellaBurst = true;
        flip = true;
        px = 165 - p * 135;
        py = 22 - Math.sin(p * Math.PI) * 58;
        sprite = "/sprites/jump/maveli-umbrella.webp";
      }

      setAnim({
        px,
        py,
        moveX,
        sprite,
        balloonVisible,
        showUmbrellaBurst,
        flip,
      });
    }, 1000 / 60);

    onCleanup(() => clearInterval(interval));
  });

  return (
    <Stage seed="demo-jump">
      <div class="absolute inset-0 grid place-items-center pb-5">
        <svg
          viewBox="0 0 220 130"
          class="w-full h-full max-w-[240px] max-h-[140px] overflow-visible select-none"
          aria-hidden="true"
        >
          {/* Subtle comic height guide line */}
          <line
            x1="10"
            y1="35"
            x2="210"
            y2="35"
            stroke="var(--ink)"
            stroke-width="1.5"
            stroke-dasharray="4 4"
            opacity="0.25"
          />
          <text
            x="15"
            y="30"
            fill="var(--ink)"
            opacity="0.5"
            font-size="8"
            font-weight="800"
            font-family="var(--font-stack-mono)"
          >
            100 m
          </text>

          {/* Platform 1: Mint Normal */}
          <g transform="translate(18, 98)">
            <rect
              width="46"
              height="10"
              rx="4"
              fill="#2ec4b6"
              stroke="var(--ink)"
              stroke-width="2"
            />
            <line
              x1="15"
              y1="0"
              x2="15"
              y2="10"
              stroke="var(--ink)"
              stroke-width="1.5"
              opacity="0.4"
            />
            <line
              x1="31"
              y1="0"
              x2="31"
              y2="10"
              stroke="var(--ink)"
              stroke-width="1.5"
              opacity="0.4"
            />
          </g>

          {/* Platform 2: Blue Moving */}
          <g transform={`translate(${anim().moveX}, 68)`}>
            <rect
              width="46"
              height="10"
              rx="4"
              fill="#3a86ff"
              stroke="var(--ink)"
              stroke-width="2"
            />
            <path d="M 8 5 L 14 2 L 14 8 Z" fill="#ffffff" />
            <path d="M 38 5 L 32 2 L 32 8 Z" fill="#ffffff" />
          </g>

          {/* Platform 3: Orange Umbrella Launch */}
          <g transform="translate(154, 40)">
            <rect
              width="46"
              height="10"
              rx="4"
              fill="#ff9f1c"
              stroke="var(--ink)"
              stroke-width="2"
            />
            <path
              d="M 23 0 A 7 7 0 0 1 30 -7 L 16 -7 A 7 7 0 0 1 23 0 Z"
              fill="#e71d36"
              stroke="var(--ink)"
              stroke-width="1.5"
            />
            <line x1="23" y1="-7" x2="23" y2="0" stroke="var(--ink)" stroke-width="1.5" />
          </g>

          {/* Tiny Floating Collectible Balloon */}
          <Show when={anim().balloonVisible}>
            <g transform="translate(102, 36)">
              <image href="/sprites/jump/item-balloon.webp" width="14" height="14" />
            </g>
          </Show>

          {/* Umbrella Super-Launch Burst Effect */}
          <Show when={anim().showUmbrellaBurst}>
            <g transform="translate(177, 36)">
              <circle r="6" fill="#ffbf69" opacity="0.6" />
              <line x1="0" y1="-3" x2="0" y2="-10" stroke="#e71d36" stroke-width="2" />
              <line x1="-5" y1="-2" x2="-9" y2="-7" stroke="#e71d36" stroke-width="2" />
              <line x1="5" y1="-2" x2="9" y2="-7" stroke="#e71d36" stroke-width="2" />
            </g>
          </Show>

          {/* Animated Maveli Hopping & Sprite Switching */}
          <g
            transform={`translate(${anim().px}, ${anim().py}) ${anim().flip ? "scale(-1, 1)" : ""}`}
            style={{ transition: "none" }}
          >
            <image
              href={anim().sprite}
              x={anim().flip ? -26 : 0}
              y={anim().sprite.includes("umbrella") || anim().sprite.includes("balloon") ? -10 : 0}
              width={
                anim().sprite.includes("umbrella") || anim().sprite.includes("balloon") ? 32 : 24
              }
              height={
                anim().sprite.includes("umbrella") || anim().sprite.includes("balloon") ? 34 : 26
              }
              style={{ filter: "drop-shadow(0 2px 3px rgba(34,32,43,0.35))" }}
            />
          </g>
        </svg>
      </div>

      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        hold sides or tilt phone to steer
      </p>
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
  /**
   * Label for the confirm button — "Start game", "Go again", "Resume".
   *
   * Omit it, along with `onStart`, to open the same screen purely as
   * reference. That is the mid-run case: a player who has already started and
   * wants to re-read the rules must not be shown a button that looks like it
   * might restart their attempt.
   */
  startLabel?: string;
  busy?: boolean;
  onStart?: () => void;
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

        <Show
          when={props.onStart}
          fallback={<p class="comment">your clock is still running, by the way.</p>}
        >
          <p class="comment">read it now. the clock starts when you press the button.</p>
        </Show>

        <Show
          when={props.onStart}
          fallback={
            <button type="button" class="btn-brand w-full text-lg" onClick={props.onClose}>
              Got it
            </button>
          }
        >
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
        </Show>
      </div>
    </div>
  );
}
