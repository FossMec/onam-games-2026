import { For, createSignal, onCleanup, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import type { SpriteName } from "~/lib/sprites";

const LOOP_SPRITES: { name: SpriteName; label: string; pop: string }[] = [
  { name: "maveli-laptop", label: "Maveli", pop: "var(--pop-yellow)" },
  { name: "tux-king", label: "Tux", pop: "var(--pop-teal)" },
  { name: "ferris-crab", label: "Ferris", pop: "var(--pop-red)" },
  { name: "gopher-king", label: "Gopher", pop: "var(--pop-blue)" },
  { name: "octocat-garland", label: "Octocat", pop: "var(--pop-purple)" },
  { name: "pookalam-flower", label: "Pookalam", pop: "var(--pop-yellow)" },
];

const FUN_PHRASES = [
  "Inking comic panels…",
  "Rolling out banana leaves…",
  "Checking Maveli's git commits…",
  "Compiling festival shaders…",
  "Placing pookalam petals…",
  "Warming up daily challenges…",
];

export function LoadingScreen(props: { message?: string; compact?: boolean; class?: string }) {
  const [index, setIndex] = createSignal(0);
  const [phraseIndex, setPhraseIndex] = createSignal(0);

  onMount(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % LOOP_SPRITES.length);
    }, 450);

    const phraseTimer = setInterval(() => {
      setPhraseIndex((p) => (p + 1) % FUN_PHRASES.length);
    }, 1800);

    onCleanup(() => {
      clearInterval(timer);
      clearInterval(phraseTimer);
    });
  });

  const current = () => LOOP_SPRITES[index()];

  return (
    <div
      class={`flex flex-col items-center justify-center p-6 text-center select-none ${
        props.compact ? "py-8" : "min-h-[50vh] py-16"
      } ${props.class ?? ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      <div class="relative flex items-center justify-center mb-3">
        {/* Animated Halftone Comic Bubble */}
        <div
          class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-3 border-[var(--ink)]  flex items-center justify-center transition-colors duration-300 relative overflow-hidden"
          style={{ background: current().pop }}
        >
          {/* Halftone dot pattern overlay */}
          <div
            class="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              "background-image": "radial-gradient(var(--ink) 1.5px, transparent 1.5px)",
              "background-size": "8px 8px",
            }}
          />

          <SpriteIcon
            name={current().name}
            size={props.compact ? 44 : 54}
            animate="wobble"
            class="drop-shadow-sm"
          />
        </div>

        {/* Floating Mini Pips / Dots */}
        <div class="absolute -bottom-2 flex gap-1 bg-[var(--paper-2)] px-2 py-0.5 rounded-full border-2 border-[var(--ink)] shadow-sm">
          <For each={LOOP_SPRITES}>
            {(_, i) => (
              <span
                class={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i() === index() ? "bg-[var(--ink)] scale-125" : "bg-[var(--ink)]/25 scale-75"
                }`}
              />
            )}
          </For>
        </div>
      </div>

      <div class="space-y-1 mt-2">
        <p class="font-display font-extrabold text-sm sm:text-base text-[var(--ink)] tracking-wide">
          {props.message ?? FUN_PHRASES[phraseIndex()]}
        </p>
        <span class="inline-block text-[10px] font-mono font-bold text-[var(--ink-soft)] uppercase tracking-wider">
          FOSS × Onam
        </span>
      </div>
    </div>
  );
}
