import { ArrowRight, Sparkles } from "lucide-solid";
import { onCleanup, onMount } from "solid-js";
import { A } from "@solidjs/router";

import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";

export interface PookalamNudgeModalProps {
  gameTitle: string;
  onContinue: () => void;
  onClose: () => void;
}

export function PookalamNudgeModal(props: PookalamNudgeModalProps) {
  onMount(() => {
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

  return (
    <div
      class="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4 select-none"
      style={{ background: "rgb(34 32 43 / 0.82)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Try Code-a-Pookalam"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="card pop-yellow anim-sheet-in my-auto w-full max-w-lg space-y-4 p-5 sm:p-6 relative overflow-hidden"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper)",
        }}
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed="pookalam-nudge" count={6} opacity={0.28} />
        </div>

        {/* Header */}
        <div class="flex items-start justify-between gap-3 relative z-10">
          <div class="flex items-center gap-2.5">
            <SpriteIcon name="concentric-pookalam" size={36} animate="wobble" interactive />
            <div>
              <span
                class="badge text-[10px] uppercase font-black"
                style={{ "--pop": "var(--pop-teal)" }}
              >
                psst — quick heads up
              </span>
              <h2
                class="text-xl sm:text-2xl leading-tight font-black m-0 text-[var(--ink)]"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Hey, before you dive in…
              </h2>
            </div>
          </div>

          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base cursor-pointer hover:bg-[var(--paper-3)]"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
              "font-family": "var(--font-stack-display)",
              "font-weight": 800,
            }}
            onClick={props.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Prize highlight — the hero */}
        <div
          class="relative z-10 flex items-center gap-3 rounded-lg p-3 sm:p-3.5"
          style={{
            background: "var(--pop-yellow)",
            border: "var(--ink-w-bold) solid var(--ink)",
            "box-shadow": "var(--shadow-hard)",
          }}
        >
          <div class="hidden sm:grid place-items-center h-11 w-11 rounded-full shrink-0 bg-white border-2 border-[var(--ink)]">
            <span class="text-lg">🏆</span>
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-[11px] font-black uppercase tracking-widest m-0"
              style={{ color: "var(--ink-soft)" }}
            >
              Code-a-Pookalam · open all week till Day 6 midnight
            </p>
            <p
              class="m-0 font-black leading-none flex flex-wrap items-baseline gap-1.5"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              <span class="text-2xl sm:text-[1.7rem]">₹3,000</span>
              <span class="text-sm sm:text-base font-extrabold">prize pool</span>
              <span
                class="sticker text-[9px] sm:text-[10px]"
                style={{ "--pop": "var(--pop-teal)", transform: "rotate(-1deg)" }}
              >
                1st ₹1,500 · 2nd ₹1,000 · 3rd ₹500
              </span>
            </p>
          </div>
        </div>

        {/* Human copy */}
        <div class="space-y-2.5 relative z-10">
          <p class="text-sm sm:text-[15px] font-bold leading-relaxed m-0 text-[var(--ink)]">
            <span class="font-black">Code-a-Pookalam is still running</span> — and you don't need to
            be an artist to try it.
          </p>
          <p class="text-xs sm:text-sm font-semibold leading-relaxed m-0 text-[var(--ink-soft)]">
            A few lines of code (Canvas, SVG, CSS, Python, even shaders) turn into a real pookalam.
            AI is 100% allowed, you get a live preview, and the community votes on Day 7. It's open
            till <strong class="text-[var(--ink)]">Day 6 midnight</strong> — way more time than a
            2-minute puzzle.
          </p>
          <div
            class="flex items-start gap-2 rounded p-2.5 text-xs font-semibold leading-snug"
            style={{ background: "var(--paper-2)", border: "1.5px solid var(--ink)" }}
          >
            <Sparkles size={16} class="shrink-0 mt-0.5 text-[var(--ink)]" strokeWidth={2.5} />
            <span class="text-[var(--ink-soft)]">
              Someone will submit a fractal. Someone always does.{" "}
              <span class="text-[var(--ink)] font-extrabold">
                Yours could be the one on the podium.
              </span>
            </span>
          </div>
        </div>

        {/* Actions — continue is primary, pookalam is subtle to avoid misclicks */}
        <div class="flex flex-col gap-2.5 pt-1 relative z-10">
          <button
            type="button"
            autofocus
            class="btn-brand w-full text-base sm:text-lg py-3 px-4 font-black cursor-pointer inline-flex items-center justify-center gap-2"
            onClick={props.onContinue}
          >
            <span>No, let me play {props.gameTitle} →</span>
          </button>
          <A
            href="/code-a-pookalam"
            class="w-full text-center text-xs sm:text-sm font-bold py-2.5 px-4 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 no-underline"
            style={{
              background: "var(--paper-2)",
              border: "1.5px solid var(--ink)",
              color: "var(--ink-soft)",
            }}
          >
            <SpriteIcon name="pookalam-flower" size={16} />
            <span>Maybe later — explore Code-a-Pookalam</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </A>
        </div>

        <p class="comment text-[11px] text-center relative z-10 m-0">
          PS: Code-a-Pookalam stays open till Day 6 midnight — you can come back anytime
        </p>
      </div>
    </div>
  );
}
