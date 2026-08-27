import { onCleanup, onMount } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { FeedbackForm } from "./FeedbackForm";

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export function FeedbackModal(props: FeedbackModalProps) {
  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.isOpen) {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
  });

  return (
    <div
      class={`fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 transition-all duration-200 ${
        props.isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{
        background: "rgba(34, 32, 43, 0.8)",
        "backdrop-filter": "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={props.title || "Onam Games Feedback"}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="card my-8 mx-auto w-full max-w-2xl p-4 sm:p-7 relative overflow-hidden anim-sheet-in"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed="feedback-modal" count={6} opacity={0.25} />
        </div>

        {/* Modal Header */}
        <div class="flex items-start justify-between gap-3 pb-4 border-b-2 border-[var(--ink)] mb-5 relative z-10">
          <div class="flex items-center gap-2.5">
            <SpriteIcon name="foss-mec-badge" size={32} animate="wobble" />
            <div>
              <h2
                class="text-xl sm:text-2xl font-black text-[var(--ink)] m-0 leading-tight"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                {props.title || "Onam Games & FOSS MEC Feedback"}
              </h2>
              <p class="text-xs sm:text-sm font-bold text-[var(--ink-soft)] m-0">
                {props.subtitle || "Share your thoughts, suggestions, and workshop ideas"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={props.onClose}
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base cursor-pointer hover:bg-[var(--paper-3)]"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
              "font-family": "var(--font-stack-display)",
              "font-weight": 800,
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Feedback Form Content */}
        <div class="relative z-10">
          <FeedbackForm isModal={true} onSaved={props.onClose} onDismiss={props.onClose} />
        </div>
      </div>
    </div>
  );
}
