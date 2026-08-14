import { For, Show, createMemo, createSignal } from "solid-js";

/**
 * Open Source Tinder — the swipe deck.
 *
 * Right = open source, left = proprietary. The browser holds no answer key:
 * a full pass is played blind, posted to `/check`, and only the ids that were
 * wrong come back. Those are re-dealt as the next pass. The run ends when a
 * pass comes back clean.
 *
 * That "grade at the end of a pass" loop is also the nicer game: you find out
 * you were wrong about Chrome after committing, not while hovering.
 */

export interface TinderCardView {
  id: string;
  name: string;
}

interface Decision {
  id: string;
  open: boolean;
}

export interface TinderGameProps {
  slug: string;
  attemptToken: string;
  cards: TinderCardView[];
  /** Called with the full transcript once the deck is cleared. */
  onFinish: (submission: { passes: Decision[][] }) => void;
  disabled?: boolean;
  /** Deck state from a previous visit. */
  initialProgress?: TinderProgress | null;
  onProgress?: (progress: TinderProgress) => void;
}

/** Everything needed to put a half-swiped deck back exactly as it was. */
export interface TinderProgress {
  queue: string[];
  passIds: string[];
  decisions: Decision[];
  transcript: Decision[][];
  passNumber: number;
}

const SWIPE_THRESHOLD = 80;

export function TinderGame(props: TinderGameProps) {
  const byId = createMemo(() => new Map(props.cards.map((c) => [c.id, c])));

  /*
   * Restored wholesale, including the pass number and the graded transcript.
   * A partial restore would desynchronise the deck from what the server will
   * replay at verification, and a mismatched transcript is a rejected run —
   * so it is all of it or none of it.
   */
  const saved = props.initialProgress;
  const [queue, setQueue] = createSignal<string[]>(saved?.queue ?? props.cards.map((c) => c.id));
  const [passIds, setPassIds] = createSignal<string[]>(
    saved?.passIds ?? props.cards.map((c) => c.id),
  );
  const [decisions, setDecisions] = createSignal<Decision[]>(saved?.decisions ?? []);
  const [transcript, setTranscript] = createSignal<Decision[][]>(saved?.transcript ?? []);
  const [passNumber, setPassNumber] = createSignal(saved?.passNumber ?? 1);
  const [grading, setGrading] = createSignal(false);
  const [error, setError] = createSignal("");

  // Drag state for the top card.
  const [dragX, setDragX] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);

  const top = () => queue()[0];
  const remaining = () => queue().length;

  /** Snapshots the whole deck so a reload puts it back exactly. */
  const report = (patch: Partial<TinderProgress> = {}) =>
    props.onProgress?.({
      queue: queue(),
      passIds: passIds(),
      decisions: decisions(),
      transcript: transcript(),
      passNumber: passNumber(),
      ...patch,
    });

  const gradePass = async (finalDecisions: Decision[]) => {
    setGrading(true);
    setError("");
    try {
      const res = await fetch(`/api/game/${props.slug}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptToken: props.attemptToken,
          expectedIds: passIds(),
          decisions: finalDecisions,
        }),
      });
      const data = (await res.json()) as { wrongIds?: string[]; error?: string };
      if (!res.ok || !data.wrongIds) {
        setError(data.error ?? "Could not check that pass");
        return;
      }

      const nextTranscript = [...transcript(), finalDecisions];
      setTranscript(nextTranscript);
      setDecisions([]);
      report({ transcript: nextTranscript, decisions: [] });

      if (data.wrongIds.length === 0) {
        props.onFinish({ passes: nextTranscript });
        return;
      }
      // Misses recycle, keeping their relative order — the server replay
      // reconstructs exactly this, so the orders must agree.
      const next = passIds().filter((id) => data.wrongIds!.includes(id));
      setPassIds(next);
      setQueue(next);
      setPassNumber((n) => n + 1);
    } catch {
      setError("Network error");
    } finally {
      setGrading(false);
    }
  };

  const commit = (open: boolean) => {
    if (props.disabled || grading()) return;
    const id = top();
    if (!id) return;

    const nextDecisions = [...decisions(), { id, open }];
    setDecisions(nextDecisions);
    setDragX(0);
    setDragging(false);

    const rest = queue().slice(1);
    setQueue(rest);
    report({ queue: rest, decisions: nextDecisions });
    if (rest.length === 0) void gradePass(nextDecisions);
  };

  let pointerId: number | null = null;
  const onPointerDown = (e: PointerEvent) => {
    if (props.disabled || grading()) return;
    pointerId = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging() || e.pointerId !== pointerId) return;
    setDragX((x) => x + e.movementX);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const x = dragX();
    if (Math.abs(x) >= SWIPE_THRESHOLD) commit(x > 0);
    else {
      setDragX(0);
      setDragging(false);
    }
  };

  const tilt = () => dragX() / 14;
  const verdict = () => (dragX() > 30 ? "open" : dragX() < -30 ? "closed" : null);

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          Pass {passNumber()}
        </span>
        <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
          {remaining()} left
        </span>
      </div>

      {/* The stack. Fixed height so nothing reflows as cards leave. */}
      <div class="relative mx-auto h-72 w-full max-w-xs select-none">
        <Show
          when={remaining() > 0}
          fallback={
            <div class="grid h-full place-items-center">
              <p class="text-lg font-extrabold">
                {grading() ? "Checking your answers…" : "Pass complete."}
              </p>
            </div>
          }
        >
          {/* Render at most three cards; deeper ones are never visible. */}
          <For each={queue().slice(0, 3).reverse()}>
            {(id, revIndex) => {
              // reverse() means the last item drawn is the top card.
              const depth = () => Math.min(3, queue().length) - 1 - revIndex();
              const isTop = () => depth() === 0;
              const card = () => byId().get(id);
              return (
                <div
                  class="absolute inset-0 rounded-lg p-5"
                  style={{
                    background: "var(--paper-2)",
                    border: "var(--ink-w-bold) solid var(--ink)",
                    transform: isTop()
                      ? `translateX(${dragX()}px) rotate(${tilt()}deg)`
                      : `translateY(${depth() * 10}px) scale(${1 - depth() * 0.04})`,
                    transition: dragging() && isTop() ? "none" : "transform 160ms ease-out",
                    "touch-action": "none",
                    "z-index": 10 - depth(),
                  }}
                  onPointerDown={isTop() ? onPointerDown : undefined}
                  onPointerMove={isTop() ? onPointerMove : undefined}
                  onPointerUp={isTop() ? onPointerUp : undefined}
                  onPointerCancel={isTop() ? onPointerUp : undefined}
                >
                  <div class="grid h-full place-items-center text-center">
                    <p
                      class="text-3xl"
                      style={{ "font-family": "var(--font-stack-display)", "font-weight": 800 }}
                    >
                      {card()?.name}
                    </p>
                  </div>

                  {/* Swipe verdict stamps, comic-style. */}
                  <Show when={isTop() && verdict()}>
                    <span
                      class="sticker absolute top-4 text-lg"
                      style={{
                        "--pop": verdict() === "open" ? "var(--pop-teal)" : "var(--pop-red)",
                        left: verdict() === "open" ? "1rem" : undefined,
                        right: verdict() === "closed" ? "1rem" : undefined,
                        transform: `rotate(${verdict() === "open" ? -12 : 12}deg)`,
                      }}
                    >
                      {verdict() === "open" ? "FREE!" : "NOPE"}
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Buttons are not a fallback — they are the fast way to play, and they
          keep the game usable without a pointer. */}
      <div class="flex justify-center gap-4">
        <button
          type="button"
          class="btn-danger"
          disabled={props.disabled || grading() || remaining() === 0}
          onClick={() => commit(false)}
        >
          ✕ Proprietary
        </button>
        <button
          type="button"
          class="btn-brand"
          disabled={props.disabled || grading() || remaining() === 0}
          onClick={() => commit(true)}
        >
          ♥ Open source
        </button>
      </div>

      <p class="comment">swipe or tap. wrong ones come back. they always come back.</p>

      <Show when={error()}>
        <p class="font-semibold" style={{ color: "var(--pop-red)" }}>
          {error()}
        </p>
      </Show>
    </div>
  );
}
