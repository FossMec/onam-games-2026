import { MessageSquarePlus } from "lucide-solid";
import { Show, createSignal, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { pookalamState } from "~/lib/queries";
import { FeedbackModal } from "./FeedbackModal";

export function FloatingFeedbackButton() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isDay7OrLater, setIsDay7OrLater] = createSignal(false);

  onMount(async () => {
    try {
      const state = await pookalamState();
      // Day 7 onwards: voting phase open or already started, or results public
      const votingOpensAt = state.phases.voting.opensAt
        ? new Date(state.phases.voting.opensAt).getTime()
        : null;
      if (
        state.phases.voting.open ||
        state.phases.results.open ||
        (votingOpensAt !== null && votingOpensAt <= Date.now())
      ) {
        setIsDay7OrLater(true);
      }
    } catch {
      // ignore
    }
  });

  return (
    <Show when={isDay7OrLater()}>
      <div class="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[calc(100vw-2rem)] pointer-events-none">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          class="pointer-events-auto group inline-flex items-center justify-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-full font-black text-xs sm:text-sm bg-[var(--pop-yellow)] hover:bg-[var(--pop-teal)] text-[var(--ink)] cursor-pointer transition-all duration-150 active:scale-95 select-none whitespace-nowrap shadow-sm"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            transform: "rotate(-1.5deg)",
            "transform-origin": "center",
          }}
          aria-label="Open feedback form"
        >
          <SpriteIcon name="terminal-star" size={18} animate="wobble" interactive />
          <span
            class="tracking-wide uppercase text-[11px] sm:text-xs shrink-0"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Feedback
          </span>
          <MessageSquarePlus size={15} strokeWidth={2.5} class="opacity-85 shrink-0" />
        </button>
      </div>

      <Show when={isOpen()}>
        <FeedbackModal isOpen={isOpen()} onClose={() => setIsOpen(false)} />
      </Show>
    </Show>
  );
}
