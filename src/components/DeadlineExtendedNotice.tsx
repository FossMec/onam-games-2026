import { X } from "lucide-solid";
import { createAsync } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { ShoutBurst } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { SHOUT_COLOR } from "~/lib/shouts";
import { getMultiStoreSync, setMultiStoreSync } from "~/lib/multi-store";
import { pookalamState } from "~/lib/queries";

/**
 * Large first-open card: Code-a-Pookalam deadline extended to tomorrow 12 PM.
 *
 * Design: washed cream newsprint, thick ink, no shadows. Overlay is light
 * (not dark 0.78) so it stays on-brand. Halftone/confetti are restrained —
 * low opacity or omitted — per design.md “controlled print character, not noisy”.
 * Only 12 PM is mentioned. Real server deadline drives the countdown.
 * In dev, always shows (ignores the 2-view cap) for easy QA.
 */

const COUNT_KEY = "onam:deadline-extended-2026-count";
const MAX_SHOWS = 2;

function readCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = getMultiStoreSync(COUNT_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function bumpCount(): void {
  try {
    const next = readCount() + 1;
    setMultiStoreSync(COUNT_KEY, String(next));
  } catch {
    // best-effort
  }
}

export function DeadlineExtendedNotice() {
  const [visible, setVisible] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);

  // Real server deadline — same source the home page uses (src/routes/index.tsx:248)
  // Server has been updated to tomorrow 12 PM (pookalam.submissions_close_at).
  // No fallback “fake” date — if the server value is not yet loaded, the countdown
  // simply waits instead of guessing.
  const pookalam = createAsync(() => pookalamState(), { initialValue: null });

  const deadline = (): Date | null => {
    const raw = pookalam()?.phases.submissions.closesAt as unknown as string | null | undefined;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const isExpired = () => {
    const d = deadline();
    return d ? Date.now() > d.getTime() : false;
  };
  const isDev = () => import.meta.env.DEV;

  onMount(() => {
    if (!isDev() && readCount() >= MAX_SHOWS) return;
    setVisible(true);
  });

  const show = () => visible() && !dismissed() && deadline() !== null && !isExpired();

  // ESC closes
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && show()) close();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Lock scroll only while dialog is on screen
  createEffect(() => {
    if (!show()) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = previous;
    });
  });

  const close = () => {
    if (dismissed()) return;
    setDismissed(true);
    if (!isDev()) bumpCount();
    setTimeout(() => setVisible(false), 120);
  };

  return (
    <Show when={show()}>
      <div
        class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
        style={{
          background: "rgb(251 243 228 / 0.72)",
          "backdrop-filter": "blur(4px)",
          "-webkit-backdrop-filter": "blur(4px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Deadline extended — tomorrow 12 PM"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {/* Large card — cream paper, ink border, yellow strip — no drop shadow, no dark veil */}
        <div
          class="card pop-yellow my-auto w-full max-w-xl sm:max-w-2xl relative overflow-hidden text-center p-6 sm:p-8 space-y-4"
          style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
        >
          {/* Close */}
          <button
            type="button"
            class="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[var(--paper-2)] cursor-pointer z-20"
            style={{ border: "var(--ink-w) solid var(--ink)" }}
            onClick={close}
            aria-label="Close deadline notice"
          >
            <X size={16} strokeWidth={3} />
          </button>

          <div class="art-over space-y-4">
            {/* Sticker — single, restrained tilt */}
            <div class="flex justify-center">
              <span class="sticker" style={{ "--pop": "var(--pop-yellow)" } as never}>
                deadline extended
              </span>
            </div>

            {/* Shout burst — YAYYY! — triumph yellow, double ink layer */}
            <div class="flex justify-center -my-2">
              <div class="w-[18rem] sm:w-[22rem] max-w-full">
                <ShoutBurst text="YAYYY!" color={SHOUT_COLOR.triumph} seed="deadline-extended" />
              </div>
            </div>

            {/* Heading + body — exact text requested */}
            <h2
              class="m-0 text-xl sm:text-2xl font-black leading-tight text-[var(--ink)]"
              style={{ "font-family": "var(--font-stack-display)" } as never}
            >
              Your requests have been heard
            </h2>

            <p
              class="m-0 mx-auto max-w-[38rem] text-sm sm:text-[15px] font-semibold leading-relaxed text-[var(--ink)]"
              style={{ "font-family": "var(--font-stack-body)" } as never}
            >
              and the king has made his decision: the{" "}
              <strong class="font-black underline decoration-2 underline-offset-2 decoration-[var(--pop-teal)]">
                Code-a-Pookalam
              </strong>{" "}
              submission deadline has been extended to{" "}
              <strong class="font-black">tomorrow 12 PM</strong>.
            </p>

            {/* Real server countdown to submission close — no fake fallback */}
            <Show
              when={deadline()}
              fallback={
                <span class="badge text-xs" style={{ "--pop": "var(--paper-2)" } as never}>
                  Tomorrow · 12 PM
                </span>
              }
            >
              {(d) => (
                <div class="flex flex-col items-center gap-1.5 pt-1">
                  <span
                    class="text-[11px] font-black uppercase tracking-widest"
                    style={{ "font-family": "var(--font-stack-display)", opacity: 0.7 } as never}
                  >
                    Submissions close in
                  </span>
                  <Countdown target={d()} doneLabel="Submissions closed" />
                </div>
              )}
            </Show>

            {/* Badges — only 12 PM, no other times */}
            <div class="flex flex-wrap items-center justify-center gap-2">
              <span class="badge text-xs" style={{ "--pop": "var(--pop-yellow)" } as never}>
                Tomorrow · 12 PM
              </span>
              <span class="badge text-xs" style={{ "--pop": "var(--paper-2)" } as never}>
                Code-a-Pookalam
              </span>
            </div>

            {/* CTAs — inked, no shadow */}
            <div class="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
              <a href="/code-a-pookalam" class="btn-brand w-full sm:w-auto px-6" onClick={close}>
                Continue your pookalam →
              </a>
              <button type="button" class="btn-ghost w-full sm:w-auto px-6" onClick={close}>
                Got it
              </button>
            </div>

            <p class="comment text-xs sm:text-sm m-0">
              ↳ someone will still push at 11:59. we respect that.
            </p>
          </div>
        </div>
      </div>
    </Show>
  );
}
