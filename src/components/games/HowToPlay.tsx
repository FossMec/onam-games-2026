import { BookOpen, Gamepad2 } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { edgesForPiece, pieceOutline, type JigsawTab } from "~/lib/jigsaw-shape";

/**
 * How to play - the rules, and a toy board that plays itself.
 *
 * Written text alone does not survive a countdown. Somebody about to start a
 * ranked, one-shot, timed puzzle reads the first line and clicks Start, and
 * then loses forty seconds working out that the boats only slide along their
 * own axis. A four-second loop showing a boat sliding along its own axis costs
 * nothing and cannot be misread.
 *
 * The demo is always a *toy*: a 3x3 jigsaw, a 4x4 word grid, two boats. It has
 * to be obviously not the real puzzle, or it would be a spoiler - and none of
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
function Stage(props: { children: JSX.Element; seed: string; pop?: string; noConfetti?: boolean }) {
  return (
    <div
      class="relative w-full overflow-hidden rounded flex flex-col justify-center items-center"
      style={{
        height: "180px",
        border: "var(--ink-w) solid var(--ink)",
        background: props.pop ?? "var(--paper-3)",
      }}
    >
      <Show when={!props.noConfetti}>
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed={props.seed} count={4} />
        </div>
      </Show>
      {props.children}
    </div>
  );
}

/**
 * Swipe right on the one whose source you can read.
 *
 * The framing here matters more than the animation. An earlier version labelled
 * the two cards "free, forever" and "$9.99 / month", which taught precisely the
 * wrong lesson - that open source means costs nothing. That is the single most
 * common misunderstanding this game exists to correct, and half the deck is
 * built on it: Obsidian costs nothing and is proprietary; Chrome costs nothing
 * and is proprietary. The test is whether you can read, change and share the
 * code, so the demo says that and nothing about money.
 *
 * The two products are invented - every real name is a card somebody is about
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
            <DemoCard name="Notes Pro" sub="source: sealed" pop="var(--pop-red)" />
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

          {/* Top card: swipes right straight away. */}
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
    </Stage>
  );
}

function DemoCard(props: { name: string; sub: string; pop: string; locked?: boolean }) {
  return (
    <div
      class="card relative h-full w-full select-none p-2.5 text-center"
      style={{
        background: props.pop,
        border: "var(--ink-w) solid var(--ink)",
        "box-shadow": "var(--shadow-hard)",
      }}
    >
      <div class="space-y-0.5 pt-3">
        <p
          class="text-xs font-black tracking-tight text-ink truncate"
          style={{ "font-family": "var(--font-stack-display)" }}
        >
          {props.name}
        </p>
        <p class="text-[0.65rem] font-bold text-ink/75 truncate">{props.sub}</p>
      </div>
    </div>
  );
}

/**
 * Four pieces drifting together into one lump.
 *
 * Drawn with the real `pieceOutline`, on fixed tabs - so what a player watches
 * here is exactly the geometry they are about to drag around, tab for socket.
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
  // 4x4 Grid containing ONAM, FOSS, LINUX, TUX
  const letters = ["O", "N", "A", "L", "K", "E", "M", "I", "F", "O", "S", "N", "T", "U", "X", "U"];
  // Indices for ONAM: 0 (O), 1 (N), 2 (A), 6 (M)
  const activeIndices = new Set([0, 1, 2, 6]);

  return (
    <Stage seed="demo-wend">
      <div class="absolute inset-0 grid place-items-center pb-6">
        <svg viewBox="0 0 140 130" width="100%" height="100%" aria-hidden="true">
          <For each={letters}>
            {(letter, i) => {
              const col = () => i() % 4;
              const row = () => Math.floor(i() / 4);
              const isActive = activeIndices.has(i());
              return (
                <g>
                  <rect
                    x={23 + col() * 24}
                    y={8 + row() * 24}
                    width="22"
                    height="22"
                    rx="4"
                    fill={isActive ? "#d8f3dc" : PAPER}
                    stroke={isActive ? "var(--pop-teal)" : INK}
                    stroke-width={isActive ? "2.5" : "2"}
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
                </g>
              );
            }}
          </For>

          {/* O (34,19) -> N (58,19) -> A (82,19) -> M (82,43) */}
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
              animation: "demo-trace 3.5s ease-in-out infinite",
            }}
          />

          {/* Target Word Chip */}
          <g transform="translate(48, 108)">
            <rect
              width="44"
              height="16"
              rx="4"
              fill="var(--pop-teal)"
              stroke={INK}
              stroke-width="1.5"
            />
            <text
              x="22"
              y="11"
              text-anchor="middle"
              fill={INK}
              font-size="9"
              font-weight="900"
              font-family="var(--font-stack-mono)"
            >
              ONAM ✓
            </text>
          </g>
        </svg>
      </div>
      <p class="absolute inset-x-0 bottom-1.5 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        drag across letters · words can bend
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
              href={vallamSprite("boat-canoe.webp")}
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
          <g style={{ "--slide": "120px", animation: "demo-slide-out 4s ease-in-out infinite" }}>
            <g transform="translate(30, 52)">
              <image
                href={vallamSprite("hero-vallam.webp")}
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

/** Maveli climbs. Calm, beautifully paced and properly proportioned demonstration. */
function JumpDemo() {
  const [anim, setAnim] = createSignal({
    px: 42,
    py: 110,
    moveX: 110,
    sprite: jumpSprite("maveli-jump.webp"),
    balloonVisible: true,
    showUmbrellaBurst: false,
    flip: false,
  });

  onMount(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame = (frame + 1) % 240; // 4 seconds cycle at 60fps
      const t = frame / 240; // 0 to 1

      // Moving platform smooth glide
      const moveX = 105 + Math.sin(t * Math.PI * 2) * 22;

      let px = 42;
      let py = 110;
      let sprite = jumpSprite("maveli-jump.webp");
      let balloonVisible = true;
      let showUmbrellaBurst = false;
      let flip = false;

      if (t < 0.32) {
        // 1. Hop: Bottom Mint (x: 42, y: 110) -> Middle Moving Cyan Platform
        const p = t / 0.32;
        px = 42 + p * (moveX + 10 - 42);
        py = 110 - Math.sin(p * Math.PI) * 44;
        sprite = p > 0.55 ? jumpSprite("maveli-fall.webp") : jumpSprite("maveli-jump.webp");
      } else if (t < 0.65) {
        // 2. Hop: Middle Cyan -> Grab Balloon (x: 135, y: 55)
        const p = (t - 0.32) / 0.33;
        px = moveX + 10 + p * (135 - (moveX + 10));
        py = 72 - Math.sin(p * Math.PI) * 36;
        if (p > 0.45) {
          balloonVisible = false;
          sprite = jumpSprite("maveli-balloon.webp");
        } else {
          sprite = jumpSprite("maveli-jump.webp");
        }
      } else if (t < 0.82) {
        // 3. Float down gently onto Top Coral Spring Platform (x: 172, y: 36)
        const p = (t - 0.65) / 0.17;
        balloonVisible = false;
        px = 135 + p * (172 - 135);
        py = 46 + p * (36 - 46);
        sprite = jumpSprite("maveli-balloon.webp");
      } else {
        // 4. BOING! Super-Launch off Spring Platform with Olakuda Umbrella!
        const p = (t - 0.82) / 0.18;
        balloonVisible = false;
        showUmbrellaBurst = true;
        flip = true;
        px = 172 - p * 130;
        py = 36 - Math.sin(p * Math.PI) * 65;
        sprite = jumpSprite("maveli-umbrella.webp");
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
    <Stage seed="demo-jump" pop="#141026" noConfetti>
      {/* Background Cavern Atmosphere */}
      <div
        class="absolute inset-0 opacity-35 bg-cover bg-center pointer-events-none"
        style={{ "background-image": "url('/images/games/paathalam-bg-a.webp')" }}
      />

      <div class="absolute inset-0 grid place-items-center pb-5 relative z-10">
        <svg
          viewBox="0 0 240 145"
          class="w-full h-full max-w-[260px] max-h-[145px] overflow-visible select-none"
          aria-hidden="true"
        >
          {/* Subtle Height Marker Guide Line */}
          <line
            x1="12"
            y1="34"
            x2="228"
            y2="34"
            stroke="rgba(255, 255, 255, 0.28)"
            stroke-width="1.5"
            stroke-dasharray="4 4"
          />
          <g transform="translate(14, 24)">
            <rect
              width="40"
              height="14"
              rx="3"
              fill="#221c38"
              stroke="#ffd166"
              stroke-width="1.2"
            />
            <text
              x="20"
              y="10"
              text-anchor="middle"
              fill="#ffd166"
              font-size="8.5"
              font-weight="800"
              font-family="var(--font-stack-mono)"
            >
              100 m
            </text>
          </g>

          {/* Platform 1 (Bottom): Neon Mint Normal */}
          <g transform="translate(24, 126)">
            <rect x="0" y="3" width="52" height="11" rx="4" fill="rgba(0,0,0,0.75)" />
            <rect width="52" height="11" rx="4" fill="#00f090" />
            <rect x="2" y="6" width="48" height="4.5" rx="2" fill="#00c878" />
            <line x1="18" y1="2" x2="18" y2="9" stroke="rgba(0,0,0,0.3)" stroke-width="1.5" />
            <line x1="34" y1="2" x2="34" y2="9" stroke="rgba(0,0,0,0.3)" stroke-width="1.5" />
            <rect width="52" height="11" rx="4" fill="none" stroke="#080a1a" stroke-width="2" />
            <rect x="2" y="1" width="48" height="2.5" rx="1.2" fill="rgba(255,255,255,0.85)" />
          </g>

          {/* Platform 2 (Middle): Electric Cyan Moving with Arrows */}
          <g transform={`translate(${anim().moveX}, 88)`}>
            <rect x="0" y="3" width="52" height="11" rx="4" fill="rgba(0,0,0,0.75)" />
            <rect width="52" height="11" rx="4" fill="#00d2ff" />
            <rect x="2" y="6" width="48" height="4.5" rx="2" fill="#00a3cc" />
            <path d="M 15 3.5 L 9 5.5 L 15 7.5 Z" fill="#ffffff" />
            <path d="M 37 3.5 L 43 5.5 L 37 7.5 Z" fill="#ffffff" />
            <line x1="13" y1="5.5" x2="39" y2="5.5" stroke="#ffffff" stroke-width="1.5" />
            <rect width="52" height="11" rx="4" fill="none" stroke="#080a1a" stroke-width="2" />
            <rect x="2" y="1" width="48" height="2.5" rx="1.2" fill="rgba(255,255,255,0.85)" />
          </g>

          {/* Platform 3 (Top): Radiant Coral Olakuda Spring Platform */}
          <g transform="translate(162, 52)">
            <rect x="0" y="3" width="52" height="11" rx="4" fill="rgba(0,0,0,0.75)" />
            <rect width="52" height="11" rx="4" fill="#ff2e63" />
            <rect x="2" y="6" width="48" height="4.5" rx="2" fill="#d61c4e" />
            <path
              d="M 21 8 L 26 3.5 L 31 8"
              fill="none"
              stroke="#ffffff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect width="52" height="11" rx="4" fill="none" stroke="#080a1a" stroke-width="2" />
            <rect x="2" y="1" width="48" height="2.5" rx="1.2" fill="rgba(255,255,255,0.85)" />
          </g>

          {/* Floating Collectible Balloon */}
          <Show when={anim().balloonVisible}>
            <g transform="translate(135, 48)">
              <image href={jumpSprite("item-balloon.webp")} width="16" height="16" />
            </g>
          </Show>

          {/* Umbrella Super-Launch Burst Effect */}
          <Show when={anim().showUmbrellaBurst}>
            <g transform="translate(188, 46)">
              <circle r="7" fill="#ffd166" opacity="0.8" />
              <line x1="0" y1="-3" x2="0" y2="-12" stroke="#ff2e63" stroke-width="2" />
              <line x1="-6" y1="-2" x2="-10" y2="-8" stroke="#ff2e63" stroke-width="2" />
              <line x1="6" y1="-2" x2="10" y2="-8" stroke="#ff2e63" stroke-width="2" />
            </g>
          </Show>

          {/* Animated Maveli Hopping & Sprite Switching */}
          <g
            transform={`translate(${anim().px}, ${anim().py}) ${anim().flip ? "scale(-1, 1)" : ""}`}
            style={{ transition: "none" }}
          >
            <image
              href={anim().sprite}
              x={anim().flip ? -28 : 0}
              y={anim().sprite.includes("umbrella") || anim().sprite.includes("balloon") ? -12 : 0}
              width={
                anim().sprite.includes("umbrella") || anim().sprite.includes("balloon") ? 36 : 26
              }
              height={
                anim().sprite.includes("umbrella") || anim().sprite.includes("balloon") ? 38 : 28
              }
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
            />
          </g>
        </svg>
      </div>

      <p class="absolute inset-x-0 bottom-1.5 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-[#ffd166] relative z-10">
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

import { InteractiveTrial } from "./PracticeTrial";
import { jumpSprite, vallamSprite } from "~/lib/img";

export function hasTrial(gameType: string): boolean {
  return ["tinder", "jigsaw", "wend", "unblock"].includes(gameType);
}

/* ------------------------------------------------------------------ panel */

/** The always-there version, collapsed by default so it never eats the page. */
export function HowToPlayPanel(props: { gameType: string; steps: string[]; title?: string }) {
  const [open, setOpen] = createSignal(false);
  const [tab, setTab] = createSignal<"rules" | "trial">("rules");

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
        <div class="space-y-3">
          {/* Tab Switcher: Only shown if the game has an interactive trial */}
          <Show when={hasTrial(props.gameType)}>
            <div class="flex gap-1.5 p-1 rounded-lg border-2 border-ink bg-paper-3">
              <button
                type="button"
                class={`flex-1 py-1.5 px-3 rounded text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  tab() === "rules"
                    ? "bg-pop-yellow text-ink border border-ink shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
                onClick={() => setTab("rules")}
              >
                <BookOpen size={14} strokeWidth={2.5} />
                <span>Rules & Demo</span>
              </button>
              <button
                type="button"
                class={`flex-1 py-1.5 px-3 rounded text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  tab() === "trial"
                    ? "bg-pop-teal text-ink border border-ink shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
                onClick={() => setTab("trial")}
              >
                <Gamepad2 size={14} strokeWidth={2.5} />
                <span>Play Trial</span>
              </button>
            </div>
          </Show>

          <Show when={!hasTrial(props.gameType) || tab() === "rules"}>
            <div class="space-y-4">
              <GameDemo gameType={props.gameType} />
              <Steps steps={props.steps} />
            </div>
          </Show>

          <Show when={hasTrial(props.gameType) && tab() === "trial"}>
            <InteractiveTrial gameType={props.gameType} />
          </Show>
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
  startLabel?: string;
  busy?: boolean;
  onStart?: () => void;
  onClose: () => void;
}

export function HowToPlayModal(props: HowToPlayModalProps) {
  const [tab, setTab] = createSignal<"rules" | "trial">("rules");

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
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
      <div class="card pop-yellow anim-sheet-in my-auto w-full max-w-md space-y-3.5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold uppercase tracking-widest text-muted">How to play</p>
            <h2 class="text-2xl leading-tight font-black">{props.title}</h2>
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

        {/* Tab Switcher: Only shown if game has a trial */}
        <Show when={hasTrial(props.gameType)}>
          <div class="flex gap-1.5 p-1 rounded-lg border-2 border-ink bg-paper-3">
            <button
              type="button"
              class={`flex-1 py-1.5 px-3 rounded text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                tab() === "rules"
                  ? "bg-pop-yellow text-ink border border-ink shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
              onClick={() => setTab("rules")}
            >
              <BookOpen size={14} strokeWidth={2.5} />
              <span>Rules & Demo</span>
            </button>
            <button
              type="button"
              class={`flex-1 py-1.5 px-3 rounded text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                tab() === "trial"
                  ? "bg-pop-teal text-ink border border-ink shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
              onClick={() => setTab("trial")}
            >
              <Gamepad2 size={14} strokeWidth={2.5} />
              <span>Play Trial</span>
            </button>
          </div>
        </Show>

        <Show when={!hasTrial(props.gameType) || tab() === "rules"}>
          <div class="space-y-3.5">
            <GameDemo gameType={props.gameType} />
            <Steps steps={props.steps} />
          </div>
        </Show>

        <Show when={hasTrial(props.gameType) && tab() === "trial"}>
          <InteractiveTrial gameType={props.gameType} />
        </Show>

        <Show
          when={props.onStart}
          fallback={<p class="comment">your clock is still running, by the way.</p>}
        >
          <Show
            when={props.gameType === "hunt"}
            fallback={
              <Show
                when={props.gameType === "jump"}
                fallback={
                  <p class="comment">read it now. the clock starts when you press the button.</p>
                }
              >
                <p class="comment">
                  unlimited climbs. climb as high as you can to set your best score.
                </p>
              </Show>
            }
          >
            <p class="comment">
              take your time to read the briefing. the hunt is a race across the realm.
            </p>
          </Show>
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
              class="btn-brand flex-1 text-lg font-black"
              disabled={props.busy}
              onClick={props.onStart}
            >
              {props.busy
                ? "Starting…"
                : props.startLabel ||
                  (props.gameType === "hunt"
                    ? "ENTER THE HUNT"
                    : props.gameType === "jump"
                      ? "START CLIMB"
                      : "START THE CLOCK")}
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
