import { X } from "lucide-solid";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { ROAD_STOPS, readRoadNotes, readRoadProgress, readRoadRatings } from "~/lib/pookalam-road";

/**
 * The week, handed back to whoever just submitted.
 *
 * Somebody who walked the road spent an Onam holiday learning loops, git and
 * GitHub, and the only trace of it is nine ticks in their own localStorage.
 * This is the moment to show them the whole thing at once - stops cleared,
 * what they wrote on the sticky notes, what they thought of each one - because
 * a submission is the one instant they are certain to be paying attention and
 * feeling something about it.
 *
 * It appears only for people who actually used the road (`MIN_STOPS`). Handing
 * a "look at your journey" card to somebody who ticked nothing is worse than
 * showing nothing at all.
 */

const MIN_STOPS = 4;

const RATING_WORDS = ["brutal", "hard", "fine", "easy", "too easy"];

/** Enough of the road used that a recap is a memory rather than an empty form. */
export function shouldShowRecap(): boolean {
  return readRoadProgress().length >= MIN_STOPS;
}

export function RoadRecap(props: { name?: string; onClose: () => void }) {
  const [done, setDone] = createSignal<string[]>([]);
  const [notes, setNotes] = createSignal<Record<string, string>>({});
  const [ratings, setRatings] = createSignal<Record<string, number>>({});

  onMount(() => {
    setDone(readRoadProgress());
    setNotes(readRoadNotes());
    setRatings(readRoadRatings());

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

  const isDone = (id: string) => done().includes(id);
  const doneStops = createMemo(() => ROAD_STOPS.filter((s) => isDone(s.id)));
  const written = createMemo(() => Object.values(notes()).filter((n) => n.trim()).length);

  /** The one they rated hardest - the bit they will tell people about. */
  const hardest = createMemo(() => {
    const rated = ROAD_STOPS.map((s) => ({ stop: s, score: ratings()[s.id] ?? 0 })).filter(
      (r) => r.score > 0,
    );
    if (rated.length === 0) return null;
    return rated.reduce((worst, r) => (r.score < worst.score ? r : worst));
  });

  return (
    <div
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
      style={{ background: "rgb(34 32 43 / 0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Your pookalam road"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="card pop-yellow relative my-auto w-full max-w-2xl space-y-4 overflow-hidden">
        <Confetti seed="road-recap" count={14} animate opacity={0.4} />

        <button
          type="button"
          class="absolute right-3 top-3 z-20 grid h-8 w-8 cursor-pointer place-items-center rounded-full"
          style={{ background: "var(--paper-2)", border: "var(--ink-w) solid var(--ink)" }}
          onClick={props.onClose}
          aria-label="Close"
        >
          <X size={16} strokeWidth={3} />
        </button>

        <div class="art-over space-y-4">
          {/* the headline */}
          <div class="space-y-1 pr-10">
            <span class="sticker text-[10px]" style={{ "--pop": "var(--pop-teal)" }}>
              entry received
            </span>
            <h2 class="m-0 font-display text-xl font-black sm:text-2xl">
              {props.name ? `${props.name}, here's your week` : "Here's your week"}
            </h2>
            <p class="m-0 text-sm font-semibold">
              You didn't just submit a picture. This is what you did to get here.
            </p>
          </div>

          {/* the numbers */}
          <div class="grid grid-cols-3 gap-2">
            <Stat value={`${doneStops().length}/${ROAD_STOPS.length}`} label="stops walked" />
            <Stat value={String(written())} label="notes to self" />
            <Stat
              value={hardest() ? RATING_WORDS[hardest()!.score - 1] : "—"}
              label="hardest bit"
            />
          </div>

          {/* the road, small */}
          <div class="flex flex-wrap gap-1.5">
            <For each={ROAD_STOPS}>
              {(stop, i) => (
                <span
                  class="grid h-8 w-8 place-items-center rounded-full font-display text-xs font-black"
                  title={stop.title}
                  style={{
                    border: "var(--ink-w) solid var(--ink)",
                    background: isDone(stop.id) ? `var(--${stop.pop})` : "var(--paper-3)",
                    opacity: isDone(stop.id) ? 1 : 0.5,
                  }}
                >
                  {i() + 1}
                </span>
              )}
            </For>
          </div>

          {/* what they wrote */}
          <Show when={written() > 0}>
            <div class="space-y-2">
              <h3 class="rule m-0">In your own words</h3>
              <div class="grid gap-2 sm:grid-cols-2">
                <For each={ROAD_STOPS.filter((s) => (notes()[s.id] ?? "").trim())}>
                  {(stop, i) => (
                    <div
                      class="space-y-1 p-2.5"
                      style={{
                        background: "var(--pop-yellow)",
                        border: "var(--ink-w) solid var(--ink)",
                        "border-radius": "0.25rem",
                        transform: i() % 2 === 0 ? "rotate(-1deg)" : "rotate(1deg)",
                      }}
                    >
                      <p class="m-0 text-[10px] font-black uppercase tracking-wide">{stop.title}</p>
                      <p
                        class="m-0 leading-snug"
                        style={{ "font-family": "var(--font-stack-hand)", "font-size": "1rem" }}
                      >
                        {notes()[stop.id]}
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* the point of the whole thing */}
          <div
            class="flex items-start gap-3 rounded p-3"
            style={{ background: "var(--paper-2)", border: "var(--ink-w) solid var(--ink)" }}
          >
            <SpriteIcon name="maveli-laptop" size={30} animate="float" class="mt-0.5 shrink-0" />
            <p class="m-0 text-sm font-semibold leading-relaxed">
              {props.name ? `${props.name}, a ` : "A "}
              week ago this was a poster about a competition. You turned it into code that runs, a
              repository with your name on it, and an entry a stranger will judge on Day 7. Whatever
              you build next, this is where it started.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-brand" onClick={props.onClose}>
              Nice
            </button>
            <a href="/code-a-pookalam#road" class="btn-ghost">
              Back to the road
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat(props: { value: string; label: string }) {
  return (
    <div
      class="p-2.5 text-center"
      style={{
        background: "var(--paper-2)",
        border: "var(--ink-w) solid var(--ink)",
        "border-radius": "var(--radius)",
      }}
    >
      <p class="m-0 font-display text-lg font-black leading-none">{props.value}</p>
      <p class="m-0 pt-1 text-[10px] font-black uppercase tracking-wide text-muted">
        {props.label}
      </p>
    </div>
  );
}
