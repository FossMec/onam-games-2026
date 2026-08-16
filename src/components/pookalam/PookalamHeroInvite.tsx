import { ArrowDown } from "lucide-solid";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { SpriteIcon } from "~/components/art/SpriteIcon";
import { scrollToAnchor } from "~/lib/pookalam-road";

/**
 * The handoff from the studio to the road.
 *
 * Someone has just spent a minute pushing the sliders on the pookalam above.
 * That is the exact moment to ask the only question this page needs to ask -
 * and the moment a beginner is most likely to answer "yes, but I could never
 * write that". Hence the code peek: the first code anyone sees on this page is
 * three lines they could have written themselves. The intricate thing at the
 * top and the four-line loop are the same idea at different volumes.
 */

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

export function PookalamHeroInvite() {
  const [index, setIndex] = createSignal(0);

  onMount(() => {
    // Under reduced motion the peek stays on the first snippet. It is a joke,
    // not information, so freezing it costs the reader nothing.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % PEEKS.length), 4200);
    onCleanup(() => clearInterval(timer));
  });

  return (
    // One wide row rather than two tall columns: the old version stacked a
    // paragraph over a button and burned half a screen saying one thing.
    <div class="card card-plain flex flex-col gap-3 text-left md:flex-row md:items-center">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-center gap-2">
          <SpriteIcon name="pookalam-flower" size={24} animate="wobble" interactive />
          <p class="m-0 font-display text-base font-black sm:text-lg">
            Enjoyed that? You can build one.
          </p>
        </div>

        <p class="m-0 text-sm font-semibold leading-relaxed">
          A few dozen lines of code, that's all it is. Never coded before? The road below starts at
          one circle.
        </p>

        <div class="flex flex-wrap gap-2">
          <a
            href="#road"
            class="btn-brand inline-flex items-center gap-2 text-sm"
            onClick={(e) => {
              e.preventDefault();
              scrollToAnchor("road");
            }}
          >
            <span>Teach me</span>
            <ArrowDown size={15} strokeWidth={3} />
          </a>

          {/* The escape hatch, worded the way the people who need it think. If
              you already code, being made to scroll a tutorial is insulting;
              being handed a shortcut that admits the tutorial is long is not. */}
          <a
            href="#judging"
            class="btn-ghost inline-flex items-center gap-2 text-sm"
            onClick={(e) => {
              e.preventDefault();
              scrollToAnchor("judging");
            }}
          >
            <span>Stop yapping, just the rules</span>
          </a>
        </div>
      </div>

      {/* the peek */}
      <div class="w-full min-w-0 md:max-w-[19rem]">
        <Show when={PEEKS[index()]} keyed>
          {(peek) => (
            <div class="anim-pop space-y-1.5">
              <pre class="inked select-text overflow-x-auto rounded bg-[#181511] p-2.5 font-mono text-xs leading-relaxed text-[#fbf3e4]">
                <code>{peek.code.join("\n")}</code>
              </pre>
              <p class="comment m-0 text-xs">{peek.note}</p>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
