import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { ProjectMark } from "./ProjectMark";

/**
 * Open Source Tinder — the swipe deck.
 *
 * Right = open source, left = proprietary. The browser holds no answer key.
 * Each swipe is posted to `/check` on its own and the server says only whether
 * *that* card was wrong, plus the licence note for it if it was. A wrong call
 * costs three seconds, and those three seconds are spent reading what the thing
 * actually is — the penalty and the teaching moment are the same screen.
 *
 * Wrong cards still recycle to the end of the deck, and the run ends when a
 * pass comes back clean.
 *
 * The grading round trip is deliberately *not* awaited before the next card
 * appears. On a phone on venue wifi that wait is the difference between a game
 * and a form: the deck advances instantly, the verdict lands a moment later,
 * and only then does the penalty interrupt. At most a swipe or two is ever in
 * flight, because the penalty screen blocks input while it is up.
 */

export interface TinderCardView {
  id: string;
  name: string;
  /**
   * "Browser", "Code Editor" — the card's bio line. Optional because a board
   * restored from a previous version's localStorage will not have it.
   */
  category?: string;
}

interface Decision {
  id: string;
  open: boolean;
}

/** What the server sends back about a card the player just got wrong. */
interface Verdict {
  id: string;
  open: boolean;
  /** The one-line licence verdict. */
  why: string;
  /** One or two lines on what the project actually is. */
  fact: string;
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
  /** Ids this pass that the server has already graded as wrong. */
  wrongIds?: string[];
  /** Ids this pass that have come back from the server at all. */
  gradedIds?: string[];
  /** Running penalty, for display only — the server recomputes its own. */
  penaltyMs?: number;
}

const SWIPE_THRESHOLD = 80;
/** Mirrors `WRONG_SWIPE_PENALTY_MS` on the server. Display only. */
const PENALTY_MS = 3_000;
/** How long a swiped card takes to leave. Must match the CSS animation. */
const FLY_MS = 300;

const POPS = [
  "var(--pop-red)",
  "var(--pop-yellow)",
  "var(--pop-teal)",
  "var(--pop-blue)",
  "var(--pop-pink)",
  "var(--pop-purple)",
];

/** FNV-1a, so a card looks the same on every render and on the server. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The card's colour and its joke distance. Hashed from the id, which is the
 * only thing the browser has — there is no way for this to leak the answer
 * because the answer is not here to leak.
 */
const cardPop = (id: string) => POPS[hash(id) % POPS.length];
const cardDistance = (id: string) => 1 + ((hash(id) >> 5) % 40);

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
  const [wrongIds, setWrongIds] = createSignal<string[]>(saved?.wrongIds ?? []);
  const [gradedIds, setGradedIds] = createSignal<string[]>(saved?.gradedIds ?? []);
  const [penaltyMs, setPenaltyMs] = createSignal(saved?.penaltyMs ?? 0);
  const [inFlight, setInFlight] = createSignal(0);
  const [error, setError] = createSignal("");

  /** Verdicts waiting to be shown, one penalty screen at a time. */
  const [pending, setPending] = createSignal<Verdict[]>([]);
  const [showing, setShowing] = createSignal<Verdict | null>(null);

  // Drag state for the top card.
  const [dragX, setDragX] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  /** The card currently flying off, so it can animate out rather than vanish. */
  const [flying, setFlying] = createSignal<{ id: string; dir: 1 | -1 } | null>(null);

  const top = () => queue()[0];
  const remaining = () => queue().length;
  /** Input is refused while a penalty screen is up or the pass is settling. */
  const frozen = () => !!showing() || props.disabled;

  /** Snapshots the whole deck so a reload puts it back exactly. */
  const report = (patch: Partial<TinderProgress> = {}) =>
    props.onProgress?.({
      queue: queue(),
      passIds: passIds(),
      decisions: decisions(),
      transcript: transcript(),
      passNumber: passNumber(),
      wrongIds: wrongIds(),
      gradedIds: gradedIds(),
      penaltyMs: penaltyMs(),
      ...patch,
    });

  /* --------------------------------------------------------------- grading */

  /**
   * Posts a slice of this pass for grading. Called with a single card during
   * normal play, and with a whole batch when a reload left swipes ungraded.
   */
  const grade = async (slice: Decision[], announce: boolean) => {
    if (slice.length === 0) return;
    setInFlight((n) => n + 1);
    try {
      const res = await fetch(`/api/game/${props.slug}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptToken: props.attemptToken,
          expectedIds: slice.map((d) => d.id),
          decisions: slice,
        }),
      });
      const data = (await res.json()) as {
        wrongIds?: string[];
        wrong?: Verdict[];
        error?: string;
      };
      if (!res.ok || !data.wrongIds) {
        setError(data.error ?? "Could not check that swipe");
        return;
      }
      setError("");

      const missed = data.wrongIds;
      setGradedIds((ids) => [...ids, ...slice.map((d) => d.id)]);
      if (missed.length > 0) {
        setWrongIds((ids) => [...ids, ...missed]);
        setPenaltyMs((ms) => ms + missed.length * PENALTY_MS);
        // A re-grade after a reload is silent: the player has already lived
        // through that swipe, and the time was charged the moment they made it.
        if (announce && data.wrong) setPending((q) => [...q, ...data.wrong!]);
      }
      report();
    } catch {
      setError("Network error — that swipe could not be checked.");
    } finally {
      setInFlight((n) => n - 1);
    }
  };

  /*
   * A reload can land between a swipe and its verdict. Anything in this pass
   * without a grade is re-posted on mount, in its original order, so the deck
   * knows what to recycle. Order matters: `checkPass` rejects a pass answered
   * out of sequence.
   */
  onMount(() => {
    const graded = new Set(gradedIds());
    const ungraded = decisions().filter((d) => !graded.has(d.id));
    if (ungraded.length > 0) void grade(ungraded, false);
  });

  /**
   * Shows queued penalties one at a time, three seconds each.
   *
   * The timer is a plain variable, NOT an `onCleanup` inside this effect. It
   * was, and that hung the game: `onCleanup` registered in an effect fires
   * before every *re-run* of that effect, and `setShowing`/`setPending` here
   * re-run it immediately — so the three-second timer was cancelled the instant
   * it was created and the penalty screen stayed up forever. Cleanup belongs to
   * the component's lifetime, which is the only thing that should cancel it.
   */
  let penaltyTimer: ReturnType<typeof setTimeout> | undefined;
  let flyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(penaltyTimer);
    clearTimeout(flyTimer);
  });

  createEffect(() => {
    if (showing() || pending().length === 0) return;
    const [next, ...rest] = pending();
    setPending(rest);
    setShowing(next);
    penaltyTimer = setTimeout(() => setShowing(null), PENALTY_MS);
  });

  /* ------------------------------------------------------------ pass logic */

  /**
   * Ends a pass once the deck is empty, every swipe has been graded and every
   * penalty has been read. Waiting for all three is what keeps the transcript
   * the client submits identical to the one the server replays.
   */
  createEffect(() => {
    if (remaining() > 0 || inFlight() > 0 || showing() || pending().length > 0) return;
    if (decisions().length === 0) return;

    const finishedPass = decisions();
    const nextTranscript = [...transcript(), finishedPass];
    const missed = passIds().filter((id) => wrongIds().includes(id));

    setTranscript(nextTranscript);
    setDecisions([]);
    setGradedIds([]);
    setWrongIds([]);

    if (missed.length === 0) {
      report({ transcript: nextTranscript, decisions: [], gradedIds: [], wrongIds: [] });
      props.onFinish({ passes: nextTranscript });
      return;
    }
    // Misses recycle, keeping their relative order — the server replay
    // reconstructs exactly this, so the orders must agree.
    setPassIds(missed);
    setQueue(missed);
    setPassNumber((n) => n + 1);
    report({
      transcript: nextTranscript,
      decisions: [],
      gradedIds: [],
      wrongIds: [],
      passIds: missed,
      queue: missed,
      passNumber: passNumber(),
    });
  });

  const commit = (open: boolean) => {
    if (frozen()) return;
    const id = top();
    if (!id) return;

    const decision = { id, open };
    const nextDecisions = [...decisions(), decision];
    setDecisions(nextDecisions);
    setFlying({ id, dir: open ? 1 : -1 });
    setDragX(0);
    setDragging(false);

    const rest = queue().slice(1);
    setQueue(rest);
    report({ queue: rest, decisions: nextDecisions });
    void grade([decision], true);

    // Plain variable, for the same reason as the penalty timer: this runs from
    // an event handler, where there is no reactive owner to hang a cleanup on.
    clearTimeout(flyTimer);
    flyTimer = setTimeout(() => setFlying(null), FLY_MS);
  };

  /* ---------------------------------------------------------------- input */

  let pointerId: number | null = null;
  const onPointerDown = (e: PointerEvent) => {
    if (frozen()) return;
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

  // Arrow keys are the fast way to play this on a laptop, and the only way to
  // play it at all without a pointer.
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      e.preventDefault();
      commit(e.key === "ArrowRight");
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  const tilt = () => dragX() / 14;
  const verdict = () => (dragX() > 20 ? "open" : dragX() < -20 ? "closed" : null);
  /**
   * How committed the drag is, 0..1. The stamp fades and grows into place with
   * the swipe rather than popping in at a threshold, so you can feel where the
   * commit point is before you let go.
   */
  const commitment = () =>
    Math.min(1, Math.max(0, (Math.abs(dragX()) - 20) / (SWIPE_THRESHOLD - 20)));

  const penaltySeconds = () => (penaltyMs() / 1000).toFixed(0);

  return (
    <div class="mx-auto w-full max-w-sm space-y-3 text-left">
      {/* ------------------------------------------------------- app chrome */}
      <div
        class="flex items-center justify-between gap-2 rounded px-3 py-2"
        style={{ border: "var(--ink-w) solid var(--ink)", background: "var(--paper-3)" }}
      >
        <span
          class="text-lg leading-none"
          style={{ "font-family": "var(--font-stack-comic)", "letter-spacing": "0.02em" }}
        >
          foss<span style={{ color: "var(--pop-red)" }}>·</span>tinder
        </span>
        <div class="flex items-center gap-1.5">
          <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
            Pass {passNumber()}
          </span>
          <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
            {remaining()} left
          </span>
          <Show when={penaltyMs() > 0}>
            <span class="badge" style={{ "--pop": "var(--pop-red)" }}>
              +{penaltySeconds()}s
            </span>
          </Show>
        </div>
      </div>

      {/* ------------------------------------------------------- the stack */}
      <div class="relative w-full select-none" style={{ "aspect-ratio": "3 / 4" }}>
        <Show
          when={remaining() > 0}
          fallback={
            <div
              class="grid h-full place-items-center rounded-lg px-6 text-center"
              style={{
                border: "var(--ink-w-bold) dashed var(--ink)",
                background: "var(--paper-3)",
              }}
            >
              <div class="space-y-2">
                <p class="text-2xl" style={{ "font-family": "var(--font-stack-comic)" }}>
                  {inFlight() > 0 ? "Checking…" : "Pass complete"}
                </p>
                <p class="comment">
                  {inFlight() > 0 ? "hang on." : "the ones you missed are coming back."}
                </p>
              </div>
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
                <article
                  class="absolute inset-0 overflow-hidden rounded-lg"
                  style={{
                    background: "var(--paper-2)",
                    border: "var(--ink-w-bold) solid var(--ink)",
                    transform: isTop()
                      ? `translateX(${dragX()}px) rotate(${tilt()}deg)`
                      : `translateY(${depth() * 10}px) scale(${1 - depth() * 0.035})`,
                    transition: dragging() && isTop() ? "none" : "transform 160ms ease-out",
                    "touch-action": "none",
                    "z-index": 10 - depth(),
                  }}
                  onPointerDown={isTop() ? onPointerDown : undefined}
                  onPointerMove={isTop() ? onPointerMove : undefined}
                  onPointerUp={isTop() ? onPointerUp : undefined}
                  onPointerCancel={isTop() ? onPointerUp : undefined}
                >
                  <CardFace card={card()} id={id} />

                  {/* Swipe verdict stamps, comic-style, growing with the drag. */}
                  <Show when={isTop() && verdict()}>
                    <span
                      class="sticker absolute top-5 text-xl"
                      style={{
                        "--pop": verdict() === "open" ? "var(--pop-teal)" : "var(--pop-red)",
                        left: verdict() === "open" ? "1rem" : undefined,
                        right: verdict() === "closed" ? "1rem" : undefined,
                        transform: `rotate(${verdict() === "open" ? -12 : 12}deg) scale(${0.7 + 0.3 * commitment()})`,
                        opacity: 0.35 + 0.65 * commitment(),
                        "border-width": "var(--ink-w-bold)",
                      }}
                    >
                      {verdict() === "open" ? "FREE!" : "NOPE"}
                    </span>
                  </Show>
                </article>
              );
            }}
          </For>
        </Show>

        {/*
          The card that was just swiped, sailing off in the chosen direction.

          A keyframe animation, not a transition. This element is *mounted*
          already carrying its end transform, so there is no start state for a
          transition to run from and the card simply blinked out of existence —
          the swipe had no follow-through at all. An animation always plays from
          its own 0%, whatever the element looked like when it appeared.
        */}
        <Show when={flying()} keyed>
          {(card) => (
            <article
              class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
              style={{
                background: "var(--paper-2)",
                border: "var(--ink-w-bold) solid var(--ink)",
                "--dir": card.dir,
                animation: `card-fly-out ${FLY_MS}ms cubic-bezier(0.4, 0, 0.9, 0.4) forwards`,
                "z-index": 20,
              }}
            >
              <CardFace card={byId().get(card.id)} id={card.id} />
              {/* The verdict rides out with the card. */}
              <span
                class="sticker absolute top-5 text-xl"
                style={{
                  "--pop": card.dir > 0 ? "var(--pop-teal)" : "var(--pop-red)",
                  left: card.dir > 0 ? "1rem" : undefined,
                  right: card.dir < 0 ? "1rem" : undefined,
                  transform: `rotate(${card.dir > 0 ? -12 : 12}deg)`,
                  "border-width": "var(--ink-w-bold)",
                }}
              >
                {card.dir > 0 ? "FREE!" : "NOPE"}
              </span>
            </article>
          )}
        </Show>

        {/* ------------------------------------------------ penalty screen */}
        <Show when={showing()}>
          <PenaltyScreen verdict={showing()!} card={byId().get(showing()!.id)} />
        </Show>
      </div>

      {/* --------------------------------------------------- action buttons */}
      {/* Buttons are not a fallback — they are the fast way to play, and they
          keep the game usable without a pointer. */}
      <div class="flex items-center justify-center gap-5 pt-1">
        <ActionButton
          label="Proprietary"
          hint="←"
          pop="var(--pop-red)"
          disabled={frozen() || remaining() === 0}
          onClick={() => commit(false)}
        >
          ✕
        </ActionButton>
        <ActionButton
          label="Open source"
          hint="→"
          pop="var(--pop-teal)"
          disabled={frozen() || remaining() === 0}
          onClick={() => commit(true)}
        >
          ♥
        </ActionButton>
      </div>

      <p class="comment block text-center">
        swipe, tap, or use the arrow keys. wrong ones cost you 3s. and come back.
      </p>

      <Show when={error()}>
        <p class="text-center font-semibold" style={{ color: "var(--pop-red)" }}>
          {error()}
        </p>
      </Show>
    </div>
  );
}

/* ------------------------------------------------------------- card face */

function CardFace(props: { card: TinderCardView | undefined; id: string }) {
  const pop = () => cardPop(props.id);
  return (
    <div class="flex h-full flex-col">
      {/* The "photo": a flat colour panel with the mark and comic shading. */}
      <div class="relative flex-1 overflow-hidden" style={{ background: pop() }}>
        <div class="halftone absolute inset-0" aria-hidden="true" />
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed={`tinder-${props.id}`} count={4} />
        </div>
        <div class="absolute inset-0 grid place-items-center p-4">
          <ProjectMark id={props.id} name={props.card?.name ?? ""} size={148} />
        </div>
      </div>

      {/* The bio bar. */}
      <div
        class="space-y-1 px-4 py-3"
        style={{ "border-top": "var(--ink-w) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <p
          class="leading-tight"
          style={{
            "font-family": "var(--font-stack-display)",
            "font-weight": 800,
            "font-size": "clamp(1.25rem, 6vw, 1.6rem)",
          }}
        >
          {props.card?.name}
        </p>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Show when={props.card?.category}>
            <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
              {props.card!.category}
            </span>
          </Show>
          <span class="tabular-nums">{cardDistance(props.id)} km away</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- penalty screen */

/**
 * Three seconds you cannot skip, spent on the thing you just got wrong.
 *
 * The countdown ring is a CSS animation rather than a ticking signal — it has
 * to be smooth, and nothing else on screen needs to know how much is left.
 */
function PenaltyScreen(props: { verdict: Verdict; card: TinderCardView | undefined }) {
  return (
    <div
      class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-lg px-5 py-6 text-center"
      style={{
        background: "var(--ink)",
        border: "var(--ink-w-bold) solid var(--ink)",
        animation: "pop-in 180ms ease-out",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Verdict, mark and name on one tight block. */}
      <div class="flex items-center gap-3">
        <div
          class="grid h-14 w-14 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--paper-2)", border: "var(--ink-w) solid var(--paper)" }}
        >
          <ProjectMark id={props.verdict.id} name={props.card?.name ?? ""} size={40} />
        </div>
        <div class="text-left">
          <p
            class="leading-tight"
            style={{
              "font-family": "var(--font-stack-display)",
              "font-weight": 800,
              "font-size": "1.25rem",
              color: "var(--paper)",
            }}
          >
            {props.card?.name}
          </p>
          <span
            class="sticker text-xs"
            style={{ "--pop": props.verdict.open ? "var(--pop-teal)" : "var(--pop-red)" }}
          >
            {props.verdict.open ? "is open source" : "is proprietary"}
          </span>
        </div>
      </div>

      <p class="text-base font-extrabold" style={{ color: "var(--pop-yellow)" }}>
        {props.verdict.why}
      </p>

      {/* The part actually worth three seconds. */}
      <p
        class="max-w-[30ch] text-sm font-semibold leading-snug"
        style={{ color: "var(--paper-3)" }}
      >
        {props.verdict.fact}
      </p>

      {/* The 3s you are paying for it. */}
      <div class="flex items-center gap-2 pt-1">
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--ink-soft)" stroke-width="4" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="var(--pop-yellow)"
            stroke-width="4"
            stroke-linecap="round"
            transform="rotate(-90 18 18)"
            style={{
              "stroke-dasharray": "94.2",
              animation: `penalty-drain ${PENALTY_MS}ms linear forwards`,
            }}
          />
        </svg>
        <span
          class="tabular-nums text-lg font-bold"
          style={{ color: "var(--pop-yellow)", "font-family": "var(--font-stack-mono)" }}
        >
          +3s
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- button */

function ActionButton(props: {
  label: string;
  hint: string;
  pop: string;
  disabled?: boolean;
  onClick: () => void;
  children: unknown;
}) {
  return (
    <button
      type="button"
      class="flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={props.disabled}
      onClick={props.onClick}
      aria-label={props.label}
    >
      <span
        class="grid h-16 w-16 place-items-center rounded-full text-2xl transition-transform duration-75 active:translate-y-0.5"
        style={{
          background: props.pop,
          border: "var(--ink-w-bold) solid var(--ink)",
          "font-family": "var(--font-stack-display)",
          "font-weight": 800,
        }}
      >
        {props.children as never}
      </span>
      <span class="text-[0.7rem] font-bold uppercase tracking-wider text-muted">
        {props.label} <span class="tabular-nums">{props.hint}</span>
      </span>
    </button>
  );
}
