import { createSignal, onMount } from "solid-js";

/**
 * True only once the browser has taken over.
 *
 * Purely decorative layers - confetti, sprite scatter - were being rendered
 * into the SSR HTML and then given hydration keys, and on the landing page
 * that came to 107 KB of the 212 KB document: half the page, for shapes that
 * are `aria-hidden`, `pointer-events: none`, absolutely positioned and
 * seeded from a constant. None of it is content, none of it can move layout,
 * and none of it needs to exist before the page is interactive.
 *
 * The signal starts `false` so the client's first pass matches the server's
 * empty render exactly - no hydration mismatch - and flips on mount. What the
 * visitor loses is decoration appearing a frame late behind the text; what
 * they gain is half the HTML, and on a 10 ms-CPU serverless runtime, the
 * string-building that went with it.
 *
 * Deliberately not `clientOnly()`: that would code-split each art component
 * into its own chunk and trade the bytes for extra requests. These components
 * are already in the entry bundle and tiny - it is only their *output* that
 * was expensive.
 */
export function useDeferredArt(): () => boolean {
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));
  return ready;
}
