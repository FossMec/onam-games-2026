import { For, Show, createMemo } from "solid-js";
import { ProjectMark } from "./ProjectMark";
import type { TinderCardView } from "./TinderGame";

/**
 * The deck, after the fact.
 *
 * A finished Tinder run used to collapse into a single number, which threw away
 * the only part of it worth keeping: the twenty things you now know the licence
 * of. This is the payoff screen - every card, what it actually was, why, and
 * whether you called it right the first time.
 *
 * The answers come from the server (`getMyRecap`), which only hands them over
 * once the attempt is submitted. If that call has not landed - or the player is
 * looking at a board restored from localStorage on a fresh device - this still
 * renders from what the browser has, showing their own swipes without the
 * verdicts. Degraded, never empty.
 */

interface Decision {
  id: string;
  open: boolean;
}

export interface TinderRevealCard {
  id: string;
  name: string;
  category: string;
  open: boolean;
  why: string;
  fact: string;
}

export interface TinderRecapProps {
  /** The deck as it was dealt. Always present - it is the finished board. */
  cards: TinderCardView[];
  /** Every pass the player made, in order. */
  passes: Decision[][];
  /** Server-revealed answers. Absent until `getMyRecap` resolves. */
  reveal?: TinderRevealCard[] | null;
}

/** Mirrors the server's `WRONG_SWIPE_PENALTY_MS`. Display only. */
const PENALTY_MS = 3_000;

export function TinderRecap(props: TinderRecapProps) {
  const answers = createMemo(() => new Map((props.reveal ?? []).map((c) => [c.id, c])));

  /** The first call the player made on each card. */
  const firstCall = createMemo(() => {
    const calls = new Map<string, boolean>();
    for (const pass of props.passes) {
      for (const decision of pass) {
        if (!calls.has(decision.id)) calls.set(decision.id, decision.open);
      }
    }
    return calls;
  });

  /**
   * How many times each card was called wrong. Derived from the transcript
   * rather than trusted from anywhere: any card appearing in a later pass was
   * missed in the one before it.
   */
  const misses = createMemo(() => {
    const counts = new Map<string, number>();
    props.passes.forEach((pass, index) => {
      if (index === 0) return;
      for (const decision of pass) counts.set(decision.id, (counts.get(decision.id) ?? 0) + 1);
    });
    // A card in pass N was missed once in each of passes 1..N-1 that held it.
    return counts;
  });

  const totalWrong = () => [...misses().values()].reduce((sum, n) => sum + n, 0);
  const cleanCount = () => props.cards.length - misses().size;

  /** Undefined when the reveal has not arrived - not the same as "wrong". */
  const wasRight = (id: string): boolean | undefined => {
    const answer = answers().get(id);
    const call = firstCall().get(id);
    if (!answer || call === undefined) return undefined;
    return answer.open === call;
  };

  return (
    <div class="space-y-4">
      {/* ------------------------------------------------------- the score */}
      <div class="flex flex-wrap items-center gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
          {cleanCount()}/{props.cards.length} first try
        </span>
        <Show when={totalWrong() > 0}>
          <span class="badge" style={{ "--pop": "var(--pop-red)" }}>
            {totalWrong()} wrong · +{(totalWrong() * PENALTY_MS) / 1000}s
          </span>
        </Show>
        <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
          {props.passes.length} pass{props.passes.length === 1 ? "" : "es"}
        </span>
      </div>

      {/* --------------------------------------------------------- the deck */}
      <ul class="space-y-2">
        <For each={props.cards}>
          {(card) => {
            const answer = () => answers().get(card.id);
            const right = () => wasRight(card.id);
            return (
              <li
                class="flex items-start gap-3 rounded p-2.5"
                style={{
                  border: "var(--ink-w) solid var(--ink)",
                  background: right() === false ? "var(--paper-3)" : "var(--paper-2)",
                }}
              >
                <div
                  class="grid h-11 w-11 shrink-0 place-items-center rounded"
                  style={{ border: "2px solid var(--ink)", background: "var(--paper)" }}
                >
                  <ProjectMark id={card.id} name={card.name} size={34} />
                </div>

                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="font-extrabold leading-tight">{card.name}</span>
                    <Show when={answer()}>
                      <span
                        class="badge"
                        style={{
                          "--pop": answer()!.open ? "var(--pop-teal)" : "var(--pop-red)",
                        }}
                      >
                        {answer()!.open ? "Open source" : "Proprietary"}
                      </span>
                    </Show>
                  </div>
                  <Show
                    when={answer()}
                    fallback={
                      <p class="text-sm text-muted">
                        You called it {firstCall().get(card.id) ? "open source" : "proprietary"}.
                      </p>
                    }
                  >
                    <p class="text-sm font-semibold">{answer()!.why}</p>
                    <p class="text-sm leading-snug text-muted">{answer()!.fact}</p>
                  </Show>
                </div>

                {/* First-call verdict. Silent rather than wrong when unknown. */}
                <Show when={right() !== undefined}>
                  <span
                    class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
                    style={{
                      background: right() ? "var(--pop-teal)" : "var(--pop-red)",
                      border: "2px solid var(--ink)",
                      "font-family": "var(--font-stack-display)",
                      "font-weight": 800,
                    }}
                    aria-label={right() ? "Correct first time" : "Missed first time"}
                  >
                    {right() ? "✓" : "✕"}
                  </span>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}
