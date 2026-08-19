import { Show, createEffect, createSignal, onCleanup } from "solid-js";

/**
 * Segmented countdown.
 *
 * The old version rendered one unclassed `<span>` with unpadded values
 * ("0d 5h 3m 9s") and never stopped at zero. Digits now live in their own
 * inked boxes with zero-padding, so the width is stable and the number never
 * jitters as it ticks - important when it sits next to a release time people
 * are staring at.
 */

interface CountdownProps {
  target: Date;
  /** Shown once the target passes. */
  doneLabel?: string;
  /** Drop the days box when a release is hours away. */
  compact?: boolean;
  /** Called once when the countdown reaches zero. */
  onDone?: () => void;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function Segment(props: { value: string; unit: string }) {
  return (
    <span class="inline-flex flex-col items-center gap-0.5">
      <span
        class="rounded px-2 py-0.5 text-base sm:text-lg tabular-nums text-center"
        style={{
          background: "var(--paper-2)",
          border: "2px solid var(--ink)",
          "font-weight": 800,
          "min-width": "2.25rem",
        }}
      >
        {props.value}
      </span>
      <span
        class="text-[0.62rem] uppercase tracking-wider font-extrabold"
        style={{ "font-family": "var(--font-stack-display)", opacity: 0.75 }}
      >
        {props.unit}
      </span>
    </span>
  );
}

export function Countdown(props: CountdownProps) {
  const [now, setNow] = createSignal(Date.now());

  createEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  // Fire onDone exactly once when countdown hits zero (mobile-friendly, no hover needed).
  createEffect((prevDone?: boolean) => {
    const done = props.target.getTime() - now() <= 0;
    if (done && !prevDone) props.onDone?.();
    return done;
  });

  const diff = () => Math.max(0, props.target.getTime() - now());
  const days = () => Math.floor(diff() / 86400000);
  const hours = () => Math.floor(diff() / 3600000) % 24;
  const minutes = () => Math.floor(diff() / 60000) % 60;
  const seconds = () => Math.floor(diff() / 1000) % 60;

  return (
    <Show
      when={diff() > 0}
      fallback={
        <span class="sticker" style={{ "--pop": "var(--pop-teal)" }}>
          {props.doneLabel ?? "It's live!"}
        </span>
      }
    >
      <span class="inline-flex items-center justify-center gap-2 sm:gap-2.5 px-2 py-0.5">
        <Show when={!props.compact || days() > 0}>
          <Segment value={pad(days())} unit="days" />
        </Show>
        <Segment value={pad(hours())} unit="hrs" />
        <Segment value={pad(minutes())} unit="min" />
        <Segment value={pad(seconds())} unit="sec" />
      </span>
    </Show>
  );
}
