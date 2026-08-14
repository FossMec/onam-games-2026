import { Confetti } from "./art/Confetti";

/**
 * Closes the page and carries the club credit.
 *
 * It used to end on a line boasting that timers are server-side and that we
 * would notice. Removed: naming what we check is a hint sheet for anyone
 * planning to get around it, and players who are not cheating gain nothing
 * from reading it.
 */
export function Footer() {
  return (
    <footer
      class="relative mt-16 overflow-hidden"
      style={{
        background: "var(--paper-3)",
        "border-top": "var(--ink-w-bold) solid var(--ink)",
      }}
    >
      <Confetti seed="footer" count={7} class="opacity-40" />

      <div class="container art-over space-y-3 py-8 text-center">
        <p class="wordmark text-2xl" data-text="FOSS ONAM">
          FOSS ONAM
        </p>
        <p class="text-sm font-semibold">
          Seven days of games. One week of Onam. Built by the FOSS club at MEC.
        </p>
        <p class="comment">
          every font here is free software. so is the site. so is your soul, probably.
        </p>
      </div>
    </footer>
  );
}
