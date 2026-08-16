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

      {/* Desktop / Large Screen: Floating Comic Meme Sticker in Side Area */}
      <div class="hidden lg:block absolute right-6 xl:right-16 top-1/2 -translate-y-1/2 w-44 xl:w-52 pointer-events-none select-none z-10">
        <img
          src="/images/memes/meme-footer.webp"
          alt="FOSS Onam Festival Meme"
          class="w-full h-auto object-contain rounded-xl border-2 border-[var(--ink)] block"
        />
      </div>

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
              src="/foss-logo-original.webp"
              alt="FOSS MEC Official Logo"
              // Intrinsic size so the row reserves the right width before the
              // image lands — `h-7 w-auto` alone leaves it zero until then.
              width={289}
              height={232}
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

        <div class="space-y-1">
          <p class="text-sm sm:text-base font-extrabold leading-relaxed text-[var(--ink)]">
            Seven days of games. One week of Onam. Designed at fossmec by Dijith Dinesh
          </p>
          <p class="text-xs sm:text-sm font-bold">
            <a
              href="/design"
              class="underline decoration-2 underline-offset-4 text-[var(--ink)] opacity-80 hover:opacity-100 hover:text-[var(--pop-teal-deep)] transition-colors"
            >
              Learn about the design language →
            </a>
          </p>
        </div>

        {/* Mobile: Centered Meme */}
        <div class="flex justify-center py-2 lg:hidden">
          <img
            src="/images/memes/meme-footer.webp"
            alt="FOSS Onam Festival Meme"
            class="max-w-xs sm:max-w-sm w-full h-auto object-contain select-none rounded-xl border-2 border-[var(--ink)] block"
          />
        </div>

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

        <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold">
          <a
            href="/privacy"
            class="underline decoration-2 underline-offset-4 text-[var(--ink)] opacity-80 hover:opacity-100 hover:text-[var(--pop-teal-deep)] transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            class="underline decoration-2 underline-offset-4 text-[var(--ink)] opacity-80 hover:opacity-100 hover:text-[var(--pop-teal-deep)] transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
