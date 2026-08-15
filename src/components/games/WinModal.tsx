import { Show, onCleanup, onMount, type JSX } from "solid-js";
import { ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";

/**
 * The moment a run lands.
 *
 * A celebration is an event, not a piece of furniture. The shout used to live
 * in a card that sat on the page forever — loud on the first render, then just
 * a large yellow box repeating a number you had already read, pushing the thing
 * you actually made below the fold. It belongs here: front and centre for as
 * long as the player wants it, then gone, leaving the board and the time behind
 * on a page that has calmed down.
 *
 * Only ever shown for a *fresh* result. Coming back tomorrow to look at your
 * pookalam should not set off fireworks again.
 */

export interface WinModalProps {
  /** The onomatopoeia. Already chosen and keyed by the caller. */
  shout: string;
  shoutColor: string;
  /** Stable per attempt, so the burst does not reshuffle on re-render. */
  seed: string;
  valid: boolean;
  /** Why it was rejected, when it was. */
  reason?: string;
  /** The headline figures — time, score, penalty — as the caller renders them. */
  figures: JSX.Element;
  /**
   * The share card, drawn and ready to post.
   *
   * Shown *inside* the celebration rather than behind a button: this is the one
   * moment a player is proud of a number, and a card they can already see gets
   * shared far more often than one they have to go looking for.
   */
  share?: JSX.Element;
  afterDeadline: boolean;
  isPersonalBest: boolean;
  /** Shown when a retry game has runs left. */
  runsLeft?: number;
  onGoAgain?: () => void;
  onClose: () => void;
}

export function WinModal(props: WinModalProps) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") props.onClose();
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
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
      style={{ background: "rgb(34 32 43 / 0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Run complete"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class={`card anim-sheet-in my-auto w-full max-w-sm space-y-4 text-center ${
          props.valid ? "pop-yellow" : "pop-red"
        }`}
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Show when={props.valid}>
            <Confetti seed={props.seed} count={10} animate />
          </Show>
        </div>

        <div class="relative space-y-3">
          <ShoutBurst text={props.shout} color={props.shoutColor} seed={props.seed} />

          {props.figures}

          <Show when={!props.valid && props.reason}>
            <p class="font-semibold" style={{ color: "var(--pop-red)" }}>
              {props.reason}
            </p>
          </Show>

          <Show when={props.isPersonalBest}>
            <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
              Personal best
            </span>
          </Show>
          <Show when={props.afterDeadline}>
            <p class="comment">just for fun · this day’s leaderboard is closed. you got there!</p>
          </Show>
          <Show when={(props.runsLeft ?? 0) > 0}>
            <p class="text-sm font-semibold text-muted">
              {`${props.runsLeft} run${props.runsLeft === 1 ? "" : "s"} left today`}
            </p>
          </Show>

          {/*
            The card, with no heading over it. A label saying "share this" above
            a picture of the thing and a button marked Share is three ways of
            saying one thing, and on a phone every one of them costs a row that
            pushes "Go again" under the fold.
          */}
          <Show when={props.share}>
            <div
              class="rounded p-2"
              style={{
                background: "var(--paper-3)",
                border: "var(--ink-w) solid var(--ink)",
              }}
            >
              {props.share}
            </div>
          </Show>

          <div class="flex flex-col gap-2 pt-1">
            <Show when={props.onGoAgain}>
              <button type="button" class="btn-brand text-lg" onClick={props.onGoAgain}>
                Go again
              </button>
            </Show>
            {/* Two ways onward, on one row. Short labels — at half width these
                buttons are ~150px and anything longer wraps to two lines. */}
            <div class="grid grid-cols-2 gap-2">
              <a href="/leaderboard" class="btn-accent">
                Leaderboard
              </a>
              <button type="button" class="btn-ghost" onClick={props.onClose}>
                {props.valid ? "My board" : "Close"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
