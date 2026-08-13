import { Confetti } from "./art/Confetti";

/**
 * There was no footer at all before this. It closes the page, carries the
 * club credit, and is the natural home for the two lines of small print that
 * are also jokes.
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
        <p class="text-xs" style={{ color: "var(--ink-soft)" }}>
          Timers are server-side. Yes, we checked. Yes, we will notice.
        </p>
      </div>
    </footer>
  );
}
