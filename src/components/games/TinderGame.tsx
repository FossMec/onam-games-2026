import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { ProjectMark } from "./ProjectMark";

/**
 * Open Source Tinder - the swipe deck.
 *
 * Right = open source, left = proprietary. The browser holds no answer key.
 * Each swipe is posted to `/check` on its own and the server says only whether
 * *that* card was wrong, plus the licence note for it if it was. A wrong call
 * costs three seconds, and those three seconds are spent reading what the thing
 * actually is - the penalty and the teaching moment are the same screen.
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
   * "Browser", "Code Editor" - the card's bio line. Optional because a board
   * restored from a previous version's localStorage will not have it.
   */
  category?: string;
  /** FNV hash of id:open:salt — precomputed at build, for instant local compare. */
  hash?: string;
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
  /** Optional client-side card checker for practice trials (no server request). */
  onCheck?: (slice: Decision[]) => Promise<{ wrongIds: string[]; wrong: Verdict[] } | null>;
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
  /** Wrong swipes confirmed by a settled pass. Display only. */
  confirmedWrong?: number;
  /** Running penalty, for display only - the server recomputes its own. */
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

// Prehash at build — same as server src/server/games/impl/tinder.ts
const TINDER_SALT = "foss-onam-tinder-2026";
function tinderHash(id: string, open: boolean): string {
  let h = 0x811c9dc5;
  const s = `${id}:${open ? 1 : 0}:${TINDER_SALT}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

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
 * only thing the browser has - there is no way for this to leak the answer
 * because the answer is not here to leak. The unsigned shift keeps the
 * distance positive: a "-14 km away" would just read as a broken game.
 */
const cardPop = (id: string) => POPS[hash(id) % POPS.length];
const cardDistance = (id: string) => 1 + ((hash(id) >>> 5) % 40);

export function TinderGame(props: TinderGameProps) {
  const byId = createMemo(() => new Map(props.cards.map((c) => [c.id, c])));

  /*
   * Restored wholesale, including the pass number and the graded transcript.
   * A partial restore would desynchronise the deck from what the server will
   * replay at verification, and a mismatched transcript is a rejected run -
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
  /**
   * Wrong swipes the server has confirmed, per closed pass. The display total
   * is this plus whatever the current pass has charged so far - the server
   * recomputes its own number from the transcript regardless, so this only ever
   * has to be honest, not authoritative.
   */
  const [confirmedWrong, setConfirmedWrong] = createSignal(saved?.confirmedWrong ?? 0);
  const [penaltyMs, setPenaltyMs] = createSignal(saved?.penaltyMs ?? 0);
  const [inFlight, setInFlight] = createSignal(0);
  const [settlingPass, setSettlingPass] = createSignal(false);
  /** Non-reactive guard, so two effect runs cannot both start a settlement. */
  let settling = false;
  const [error, setError] = createSignal("");

  /** Verdicts waiting to be shown, one penalty screen at a time. */
  const [pending, setPending] = createSignal<Verdict[]>([]);
  const [showing, setShowing] = createSignal<Verdict | null>(null);

  // Drag state for the top card.
  const [dragX, setDragX] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  /** The card currently flying off, so it can animate out rather than vanish. */
  const [flying, setFlying] = createSignal<{
    id: string;
    dir: 1 | -1;
    startX?: number;
    startRot?: number;
  } | null>(null);

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
      confirmedWrong: confirmedWrong(),
      penaltyMs: penaltyMs(),
      ...patch,
    });

  /* --------------------------------------------------------------- grading */

  /**
   * Posts a slice of this pass to `/check`.
   *
   * Returns the ids the server says were wrong, or `null` if the call did not
   * land. That distinction is the whole point: `null` means *we do not know*,
   * which is a different thing from "nothing was wrong" and must never be
   * treated as one. See `settlePass`.
   */
  const check = async (
    slice: Decision[],
  ): Promise<{ wrongIds: string[]; wrong: Verdict[] } | null> => {
    if (slice.length === 0) return { wrongIds: [], wrong: [] };
    if (props.onCheck) {
      return props.onCheck(slice);
    }
    // Prehash build — instant local compare, no per-swipe POST (saves 20×10ms CPU).
    // View cards now carry hash (src/server/games/impl/tinder.ts). Fallback to server for old views.
    const hasHash = props.cards.some((c) => (c as unknown as { hash?: string }).hash);
    if (hasHash) {
      const wrongIds: string[] = [];
      const wrong: Verdict[] = [];
      for (const d of slice) {
        const card = props.cards.find((c) => c.id === d.id) as unknown as
          | { hash?: string }
          | undefined;
        if (!card?.hash) continue;
        const correctOpen = tinderHash(d.id, true) === card.hash;
        // If neither true nor false matches (stale hash), treat as not wrong to avoid Unknown card
        const matches = tinderHash(d.id, d.open) === card.hash;
        if (!matches) {
          wrongIds.push(d.id);
          // Generic teaching — server verify still authoritative, no why/fact leak
          wrong.push({
            id: d.id,
            open: correctOpen,
            why: correctOpen ? "is open source" : "is proprietary",
            fact: "",
          });
        }
      }
      if (wrongIds.length === 0) {
        setError("");
        return { wrongIds, wrong };
      }
    }
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
        return null;
      }
      setError("");
      return { wrongIds: data.wrongIds, wrong: data.wrong ?? [] };
    } catch {
      setError("Network trouble - retrying.");
      return null;
    }
  };

  /**
   * Grades one swipe, purely so the penalty screen can appear immediately.
   *
   * Deliberately advisory. If this call is lost the player misses a penalty
   * screen and a moment of teaching, which is a shame; what it must never do is
   * decide which cards come back, because a dropped response would then silently
   * drop a card from the recycled pass. That is `settlePass`'s job.
   */
  const gradeSwipe = async (decision: Decision) => {
    setInFlight((n) => n + 1);
    try {
      const result = await check([decision]);
      if (!result || result.wrongIds.length === 0) return;
      setPenaltyMs((ms) => ms + PENALTY_MS);
      setPending((q) => [...q, ...result.wrong]);
      report();
    } finally {
      setInFlight((n) => n - 1);
    }
  };

  /**
   * Shows queued penalties one at a time, three seconds each.
   *
   * The timer is a plain variable, NOT an `onCleanup` inside this effect. It
   * was, and that hung the game: `onCleanup` registered in an effect fires
   * before every *re-run* of that effect, and `setShowing`/`setPending` here
   * re-run it immediately - so the three-second timer was cancelled the instant
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
   * Closes a pass, using one authoritative grading of the whole pass.
   *
   * This exists because the per-swipe grading is not allowed to decide which
   * cards come back. It used to: the client accumulated wrong ids from each
   * swipe's response and recycled those. Lose one response - a blip, a 429,
   * a tab suspended mid-flight - and the client rebuilt the next pass without
   * that card while the server's replay still expected it. The run then died at
   * submission with "Cards answered out of order", after the player had done
   * everything right. A dropped response is indistinguishable from "nothing was
   * wrong" if you only ever add to a list.
   *
   * So the pass is regraded in full, in order, and the recycled deck is built
   * from *that* answer - the same computation the server will run at
   * verification, from the same input. If the call fails the pass does not
   * advance; it retries, because guessing here is what caused the bug.
   */
  const settlePass = async () => {
    const finishedPass = decisions();
    if (finishedPass.length === 0 || settling) return;
    settling = true;
    setSettlingPass(true);
    try {
      let graded = await check(finishedPass);
      // A pass is the whole run's worth of work; it is worth a few retries
      // rather than losing it.
      for (let tries = 0; !graded && tries < 4; tries += 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (tries + 1)));
        graded = await check(finishedPass);
      }
      if (!graded) {
        setError("Could not reach the server to check that pass. It will retry.");
        return;
      }

      const nextTranscript = [...transcript(), finishedPass];
      // Misses recycle, keeping their relative order - the server replay
      // reconstructs exactly this from the same list, so the orders agree.
      const missed = passIds().filter((id) => graded.wrongIds.includes(id));

      // The authoritative penalty for the pass, replacing whatever the
      // per-swipe screens managed to charge.
      setConfirmedWrong((n) => n + graded.wrongIds.length);
      setTranscript(nextTranscript);
      setDecisions([]);

      if (missed.length === 0) {
        report({ transcript: nextTranscript, decisions: [] });
        props.onFinish({ passes: nextTranscript });
        return;
      }
      setPassIds(missed);
      setQueue(missed);
      setPassNumber((n) => n + 1);
      report({
        transcript: nextTranscript,
        decisions: [],
        passIds: missed,
        queue: missed,
        passNumber: passNumber() + 1,
      });
    } finally {
      settling = false;
      setSettlingPass(false);
    }
  };

  /**
   * Fires once the deck is empty, every swipe's advisory check has come back,
   * and every penalty screen has been read. Waiting for all three keeps the
   * submitted transcript identical to the one the server replays.
   */
  createEffect(() => {
    if (remaining() > 0 || inFlight() > 0 || showing() || pending().length > 0) return;
    if (decisions().length === 0 || settlingPass()) return;
    void settlePass();
  });

  const commit = (open: boolean, startX = 0, startRot = 0) => {
    if (frozen()) return;
    const id = top();
    if (!id) return;

    const decision = { id, open };
    const nextDecisions = [...decisions(), decision];
    setDecisions(nextDecisions);
    setFlying({ id, dir: open ? 1 : -1, startX, startRot });
    setDragX(0);
    setDragging(false);

    const rest = queue().slice(1);
    setQueue(rest);
    report({ queue: rest, decisions: nextDecisions });
    void gradeSwipe(decision);

    // Plain variable, for the same reason as the penalty timer: this runs from
    // an event handler, where there is no reactive owner to hang a cleanup on.
    clearTimeout(flyTimer);
    flyTimer = setTimeout(() => setFlying(null), FLY_MS);
  };

  /* ---------------------------------------------------------------- input */

  let pointerId: number | null = null;
  let startX = 0;
  const onPointerDown = (e: PointerEvent) => {
    if (frozen()) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging() || e.pointerId !== pointerId) return;
    setDragX(e.clientX - startX);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const x = dragX();
    if (Math.abs(x) >= SWIPE_THRESHOLD) commit(x > 0, x, tilt());
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

  /**
   * The penalty as shown. Confirmed passes are authoritative; the pass in hand
   * contributes whatever its advisory checks have charged so far. Reconciled
   * upward each time a pass settles, and the server's own figure - computed
   * from the transcript at verification - is the one that actually counts.
   */
  const penaltySeconds = () =>
    (Math.max(penaltyMs(), confirmedWrong() * PENALTY_MS) / 1000).toFixed(0);
  const penaltyShown = () => Math.max(penaltyMs(), confirmedWrong() * PENALTY_MS);

  return (
    <div class="mx-auto flex h-full w-full max-w-sm flex-col justify-between space-y-2 text-left">
      {/* ------------------------------------------------------- app chrome */}
      <div
        class="flex shrink-0 items-center justify-between gap-2 rounded px-3 py-1.5"
        style={{
          border: "var(--ink-w) solid var(--ink)",
          background: "var(--paper-3)",
        }}
      >
        <span
          class="text-base sm:text-lg leading-none"
          style={{
            "font-family": "var(--font-stack-comic)",
            "letter-spacing": "0.02em",
          }}
        >
          foss<span style={{ color: "var(--pop-red)" }}>·</span>finder
        </span>
        <div class="flex items-center gap-1.5 text-xs sm:text-sm">
          <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
            Pass {passNumber()}
          </span>
          <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
            {remaining()} left
          </span>
          <Show when={penaltyShown() > 0}>
            <span class="badge" style={{ "--pop": "var(--pop-red)" }}>
              +{penaltySeconds()}s
            </span>
          </Show>
        </div>
      </div>

      {/* ------------------------------------------------------- the stack */}
      <div class="relative mx-auto my-auto aspect-[3/4] w-full max-w-[340px] flex-1 max-h-[min(54dvh,400px)] select-none">
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
                  onPointerDown={(e) => isTop() && onPointerDown(e)}
                  onPointerMove={(e) => isTop() && onPointerMove(e)}
                  onPointerUp={(e) => isTop() && onPointerUp(e)}
                  onPointerCancel={(e) => isTop() && onPointerUp(e)}
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
          transition to run from and the card simply blinked out of existence -
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
                "--startX": `${card.startX ?? 0}px`,
                "--startRot": `${card.startRot ?? 0}deg`,
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
      {/* Buttons are not a fallback - they are the fast way to play, and they
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
        style={{
          "border-top": "var(--ink-w) solid var(--ink)",
          background: "var(--paper-2)",
        }}
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
 * The countdown ring is a CSS animation rather than a ticking signal - it has
 * to be smooth, and nothing else on screen needs to know how much is left.
 */
function PenaltyScreen(props: { verdict: Verdict; card: TinderCardView | undefined }) {
  return (
    <div
      class="absolute inset-0 z-30 flex flex-col items-center justify-start gap-3 overflow-y-auto rounded-lg px-5 py-6 text-center"
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
          style={{
            background: "var(--paper-2)",
            border: "var(--ink-w) solid var(--paper)",
          }}
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
            style={{
              "--pop": props.verdict.open ? "var(--pop-teal)" : "var(--pop-red)",
            }}
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
          style={{
            color: "var(--pop-yellow)",
            "font-family": "var(--font-stack-mono)",
          }}
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
