import { ArrowDown, Zap } from "lucide-solid";
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { scrollToAnchor } from "~/lib/pookalam-road";
import type { ViewMode } from "./WhatIsCodeAPookalam";

const PEEKS = [
  {
    code: ["while onam:", "    draw_petal()", "    turn(30)"],
    note: "12 petals. that is the whole trick.",
  },
  {
    code: ["for ring in range(4):", "    petals = 6 * ring", "    draw_ring(petals)"],
    note: "four rings and it already looks like a pookalam.",
  },
  {
    code: [
      "colours = ['orange', 'yellow']",
      "for i, petal in enumerate(ring):",
      "    paint(i % 2)",
    ],
    note: "one line of maths, free pattern.",
  },
];

export function PookalamHeroInvite(props: { onSelectMode?: (mode: ViewMode) => void }) {
  const [index, setIndex] = createSignal(0);

  onMount(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % PEEKS.length), 4200);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div
      class="card card-plain p-3 sm:p-4 flex flex-col gap-3 text-left md:flex-row md:items-center"
      style={{
        border: "var(--ink-w) solid var(--ink)",
        background: "var(--paper-2)",
      }}
    >
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-center gap-2">
          <SpriteIcon name="pookalam-flower" size={22} animate="wobble" interactive />
          <p class="m-0 font-display text-sm sm:text-base font-black">
            Enjoyed that? You can build one.
          </p>
        </div>

        <p class="m-0 text-xs sm:text-sm font-semibold leading-relaxed text-muted">
          A few dozen lines of code, that's all it is. Never coded before? The beginner road starts
          at one circle. Already know your stack? Jump straight to the rules.
        </p>

        <div class="flex flex-wrap items-center gap-2 pt-0.5">
          <a
            href="#about-code-a-pookalam"
            class="btn-brand inline-flex items-center gap-1.5 text-xs sm:text-sm font-black cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              props.onSelectMode?.("road");
              scrollToAnchor("about-code-a-pookalam");
            }}
          >
            <span>Teach me</span>
            <ArrowDown size={14} strokeWidth={3} />
          </a>

          <a
            href="#about-code-a-pookalam"
            class="btn-ghost inline-flex items-center gap-1.5 text-xs sm:text-sm font-black cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              props.onSelectMode?.("nofluff");
              scrollToAnchor("about-code-a-pookalam");
            }}
          >
            <Zap size={13} strokeWidth={2.5} class="text-[var(--pop-yellow-deep)]" />
            <span>Stop yapping, just the rules</span>
          </a>
        </div>
      </div>

      {/* Code peek snippet */}
      <div class="w-full min-w-0 md:max-w-[17rem]">
        <Show when={PEEKS[index()]} keyed>
          {(peek) => (
            <div class="anim-pop space-y-1">
              <pre class="inked select-text overflow-x-auto rounded bg-[#181511] p-2.5 font-mono text-[11px] sm:text-xs leading-relaxed text-[#fbf3e4] m-0">
                <code>{peek.code.join("\n")}</code>
              </pre>
              <p class="comment m-0 text-[11px] leading-tight">↳ {peek.note}</p>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
