import { Confetti } from "./art/Confetti";
import { SpriteIcon } from "./art/SpriteIcon";
import { SpriteScatter } from "./art/SpriteScatter";

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
      <Confetti seed="footer" count={5} class="opacity-30" />
      <SpriteScatter
        seed="footer-spr"
        count={5}
        pool={[
          "coconut-palm",
          "tux-king",
          "nilavilakku",
          "muthukuda",
          "kite-pattern",
          "gnu-garland",
        ]}
        opacity={0.65}
        animate
        minSize={28}
        maxSize={42}
      />

      <div class="container art-over space-y-4 py-8 text-center max-w-2xl mx-auto">
        <div class="flex items-center justify-center gap-3">
          <SpriteIcon name="tux-king" size={34} animate="wobble" interactive />
          <p class="wordmark text-2xl sm:text-3xl" data-text="FOSS ONAM">
            FOSS ONAM
          </p>
          <SpriteIcon name="maveli-laptop" size={34} animate="wobble" interactive />
        </div>

        <div class="flex justify-center items-center gap-3">
          <a
            href="https://foss.mec.ac.in"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2.5 rounded-full px-5 py-2 transition-transform active:translate-y-0.5 hover:scale-105"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <img
              src="/foss-logo-original.png"
              alt="FOSS MEC Official Logo"
              class="h-7 w-auto object-contain"
            />
            <span
              class="text-xs font-extrabold tracking-wider uppercase text-[#fffcf5]"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              foss.mec.ac.in
            </span>
          </a>
        </div>

        <p class="text-sm sm:text-base font-extrabold leading-relaxed text-[var(--ink)]">
          Seven days of games. One week of Onam. Designed and engineered at fossmec by{" "}
          <span class="text-[var(--ink)]">Dijith Dinesh</span> ·{" "}
          <a
            href="/design"
            class="underline decoration-2 underline-offset-4 hover:text-[var(--pop-teal-deep)] transition-colors"
          >
            Design System
          </a>
        </p>

        <p class="comment text-base">
          free as in freedom, free as in payasam. licensed under GPLv3 — fork the repo, not Maveli's
          moustache.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <SpriteIcon name="octocat-garland" size={28} animate="float" delay={0.2} interactive />
          <SpriteIcon name="docker-pookalam" size={28} animate="float" delay={0.8} interactive />
          <SpriteIcon name="arch-crown" size={28} animate="float" delay={1.4} interactive />
          <SpriteIcon name="ferris-crab" size={28} animate="float" delay={2.0} interactive />
          <SpriteIcon name="gopher-king" size={28} animate="float" delay={2.6} interactive />
          <SpriteIcon name="linus-torvalds" size={28} animate="float" delay={3.2} interactive />
        </div>
      </div>
    </footer>
  );
}
