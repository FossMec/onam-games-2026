import { RefreshCw, ZoomIn, ZoomOut } from "lucide-solid";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { FLOWERS, type Flower, drawFlower, flowerById } from "~/lib/pookalam-flowers";
import { CELL_COUNT, fromBase64, readCell, writeCell } from "~/lib/pookalam-grid";
import { SLOTS, slotAt } from "~/lib/pookalam-layout";
import { getCollabPookalam, placeCollabStroke } from "~/server/pookalam/collab-actions";

/**
 * The pookalam the whole room draws together.
 *
 * A 50x50 grid, one flower per square, first come first served. Nobody is going
 * to fill 2500 squares alone — that is the design, not a shortfall. What one
 * person leaves is an arc or a ring or a rude word in marigold, and the picture
 * is whatever the day's arrivals make of each other's leftovers.
 *
 * WHY IT STACKS
 *
 * Each day gets its own grid and the previous ones are painted underneath,
 * older layers fainter and smaller. Today's flowers cover yesterday's where
 * they overlap and leave them showing where they do not, so by day three you
 * are looking at three pookalams sandwiched — which is exactly what happens on
 * a doorstep, where the new one goes down over the remains of the old.
 *
 * WHY THE DAILY LIMIT IS A LIE THE BROWSER TELLS
 *
 * The allowance is counted in `localStorage`. Enforcing it server-side would
 * mean a row per placement — thousands a day — to defend against someone
 * clearing their storage in order to place *more flowers on a communal
 * drawing*. The server guards the things that actually matter: the square is
 * free, the flower exists, and you are signed in.
 */

/**
 * Ceiling at 1x. Past this the flowers get large without getting clearer.
 *
 * Kept well under what a desktop could give it. On a wide screen the limit is
 * never the width — it is that the canvas plus its heading, palette and how-to
 * have to land inside one viewport together, and a 660px square pushed the
 * palette off the bottom of a 1080p display.
 */
const MAX_CANVAS_PX = 540;

/**
 * Roughly what the heading, palette, how-to and section title need around it.
 *
 * Subtracted from the viewport rather than taking a fixed fraction of it: the
 * chrome is a roughly constant number of pixels, so a fraction over-allocates
 * on a tall screen and under-allocates on a short one.
 */
const CHROME_PX = 400;

/** Never shrink below this, or a 50-wide grid stops being tappable at all. */
const MIN_CANVAS_PX = 280;

/** Fit, then two useful magnifications. Beyond 3x the grid is bigger than help. */
const ZOOM_STEPS = [1, 1.6, 2.4, 3.2];

/**
 * The ground the flowers are laid on.
 *
 * Not the cream the rest of the site uses. Two of the ten flowers are white —
 * thumba and mulla — and on cream they simply disappeared, while the yellows
 * washed out beside them. A dark floor is the only background that every one of
 * the ten reads against: whites and yellows blaze, reds and purples hold their
 * edge, green stays green.
 *
 * It is also just true. A pookalam goes down on swept, watered ground, not on
 * paper — so the one surface with the contrast we need is also the one the
 * flowers actually sit on.
 */
const GROUND = "#2b2733";

const STORAGE_PREFIX = "collab-pookalam:";

interface DayLayer {
  dayKey: string;
  cells: Uint8Array;
}

export function CollabPookalam() {
  let canvas: HTMLCanvasElement | undefined;
  let shell: HTMLDivElement | undefined;

  const [today, setToday] = createSignal<Uint8Array | null>(null);
  const [history, setHistory] = createSignal<DayLayer[]>([]);
  const [dayKey, setDayKey] = createSignal("");
  const [placed, setPlaced] = createSignal(0);
  const [open, setOpen] = createSignal(true);
  const [canPlace, setCanPlace] = createSignal(false);
  const [allowance, setAllowance] = createSignal(30);
  const [used, setUsed] = createSignal(0);
  const [picked, setPicked] = createSignal<Flower>(FLOWERS[0]);
  const [zoom, setZoom] = createSignal(1);
  const [fit, setFit] = createSignal(MAX_CANVAS_PX);
  const [busy, setBusy] = createSignal(false);
  const [note, setNote] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [drawing, setDrawing] = createSignal(false);

  const left = () => Math.max(0, allowance() - used());

  const stepZoom = (direction: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom());
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + direction))];
    setZoom(next ?? 1);
  };

  const readUsed = (key: string) => {
    try {
      return Number(localStorage.getItem(STORAGE_PREFIX + key)) || 0;
    } catch {
      // Private mode, storage disabled, quota — none of which should cost
      // someone the feature. They get the full allowance every reload.
      return 0;
    }
  };

  const bumpUsed = (key: string) => {
    const next = readUsed(key) + 1;
    setUsed(next);
    try {
      localStorage.setItem(STORAGE_PREFIX + key, String(next));
    } catch {
      /* see readUsed */
    }
  };

  const load = async () => {
    setBusy(true);
    try {
      const state = await getCollabPookalam();
      setToday(fromBase64(state.today.cells));
      setHistory(
        state.history.map((day) => ({ dayKey: day.dayKey, cells: fromBase64(day.cells) })),
      );
      setDayKey(state.today.dayKey);
      setPlaced(state.today.placed);
      setOpen(state.open);
      setCanPlace(state.canPlace);
      setAllowance(state.dailyFlowers);
      setUsed(readUsed(state.today.dayKey));
    } catch {
      setNote("Could not reach the pookalam. Try refresh.");
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  /*
   * The square is the smaller of "as wide as the column" and "as tall as the
   * screen can spare" — so it fits on a 360px phone and on a 27" monitor
   * without either scrolling or ballooning, and a rotation re-runs it.
   */
  const measure = () => {
    const available = shell?.clientWidth ?? MAX_CANVAS_PX;
    const vertical = window.innerHeight - CHROME_PX;
    setFit(
      Math.max(MIN_CANVAS_PX, Math.min(MAX_CANVAS_PX, Math.floor(available), Math.floor(vertical))),
    );
  };

  onMount(() => {
    void load();
    measure();
    const observer = new ResizeObserver(measure);
    if (shell) observer.observe(shell);
    // A phone rotating changes the height without changing the element's width,
    // which a ResizeObserver on the shell never sees.
    window.addEventListener("resize", measure);
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      // A debounce still pending when the page navigates away would otherwise
      // drop flowers the player has already seen land.
      void flush();
    });
  });

  /** Repaints everything: history underneath, oldest first, today on top. */
  const paint = () => {
    const grid = today();
    if (!canvas || !grid) return;
    const css = fit() * zoom();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(css * dpr);
    canvas.height = Math.floor(css * dpr);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    /*
     * The floor is a disc, not the square the canvas element is.
     *
     * Everything below draws in rings, so a square ground would put four dark
     * corners around a round drawing. Filling the circle instead means the
     * panel's own colour is what surrounds it.
     */
    ctx.beginPath();
    ctx.arc(css / 2, css / 2, css / 2, 0, Math.PI * 2);
    ctx.fillStyle = GROUND;
    ctx.fill();

    const layers = history();
    layers.forEach((layer, i) => {
      /*
       * Older days are fainter and smaller. Drawing them at full strength made
       * the stack unreadable by day three — and shrinking them is what lets a
       * buried flower peek out from behind a newer one rather than being
       * perfectly eclipsed by it.
       */
      const depth = layers.length - i;
      ctx.globalAlpha = Math.max(0.18, 0.62 - depth * 0.08);
      paintLayer(ctx, layer.cells, css, 0.94 - depth * 0.04);
    });

    ctx.globalAlpha = 1;
    paintLayer(ctx, grid, css, 1);
  };

  createEffect(paint);

  /** Which ring slot a pointer is over. Null outside the disc. */
  const cellFromEvent = (event: PointerEvent): number | null => {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return slotAt(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  };

  /*
   * A drag goes to the server in batches, not per cell and not all at the end.
   *
   * Per cell would trip the rate limiter halfway across the canvas and leave a
   * line stopping in mid-air. Holding the whole drag until release is worse the
   * other way: a long sweep is a hundred unsent flowers riding on the tab not
   * being closed, and nobody else sees any of it until you let go.
   *
   * So the canvas is painted locally the instant you touch it and the server
   * hears about it on a debounce — a quiet moment after you stop moving, rather
   * than on any particular gesture boundary. A drag, a scribble and forty
   * separate taps all collapse into the same handful of requests, and nothing
   * has to know when a "stroke" began or ended.
   *
   * `MAX_WAIT` is the safety valve: a debounce alone would never fire during a
   * genuinely continuous drag, leaving a minute of work sitting unsent.
   */
  const DEBOUNCE_MS = 350;
  const MAX_WAIT_MS = 1500;

  /** Painted but not yet sent. */
  let stroke: number[] = [];
  /** Sent and awaiting a reply — kept so a flush cannot overtake itself. */
  let inFlight: Promise<void> = Promise.resolve();
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let maxWait: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (debounce) clearTimeout(debounce);
    if (maxWait) clearTimeout(maxWait);
    debounce = undefined;
    maxWait = undefined;
  };

  const scheduleFlush = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void flush(), DEBOUNCE_MS);
    // Started once per batch, not restarted per cell — that is what makes it a
    // ceiling on how long anything can sit unsent rather than a second debounce.
    if (!maxWait) maxWait = setTimeout(() => void flush(), MAX_WAIT_MS);
  };

  const paintCell = (index: number): boolean => {
    const grid = today();
    if (!grid) return false;
    const full = placed() >= CELL_COUNT;
    // Once every square is taken the canvas becomes a fresh surface and
    // painting over is the point; until then a taken square is somebody else's.
    if (!full && readCell(grid, index) !== 0) return false;
    if (stroke.length >= allowanceLeftInStroke()) return false;

    setToday(writeCell(new Uint8Array(grid), index, picked().id));
    stroke.push(index);
    scheduleFlush();
    return true;
  };

  /**
   * Ships whatever has been painted but not sent.
   *
   * Chained on `inFlight` so two flushes never race — the second would report a
   * stale `placed` and could roll back cells the first had already confirmed.
   */
  const flush = (): Promise<void> => {
    clearTimers();
    const cells = stroke;
    stroke = [];
    if (cells.length === 0) return inFlight;

    const flowerId = picked().id;
    inFlight = inFlight.then(async () => {
      const result = await placeCollabStroke(cells.map((index) => ({ index, flowerId })));

      /*
       * Adopt the server's grid wholesale.
       *
       * The reply is the truth, so there is nothing to reconcile by hand: cells
       * somebody else claimed revert on their own, their flowers appear on the
       * same tick, and any drift in the optimistic copy is corrected for free.
       * Reverting only the rejected cells — the earlier approach — kept the
       * local guess authoritative for everything it had not been told about.
       */
      setToday(fromBase64(result.cells));
      setPlaced(result.placed);

      const kept = result.written.length;
      if (kept < cells.length) {
        if (result.reason) setNote(result.reason);
        else if (kept === 0) setNote("Someone got there first.");
      }
      for (let i = 0; i < kept; i++) bumpUsed(dayKey());
    });
    return inFlight;
  };

  const allowanceLeftInStroke = () => left();

  const beginStroke = (event: PointerEvent) => {
    if (!canPlace() || busy()) return;
    if (left() <= 0) {
      setNote("That's your flowers for today. Come back tomorrow.");
      return;
    }
    const index = cellFromEvent(event);
    if (index === null) return;
    setNote("");
    stroke = [];
    setDrawing(true);
    // Capture keeps the stroke alive when the finger leaves the canvas mid-drag,
    // so a line that runs off the edge still ends cleanly instead of hanging.
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    paintCell(index);
  };

  const extendStroke = (event: PointerEvent) => {
    if (!drawing()) return;
    const index = cellFromEvent(event);
    if (index === null) return;
    // The pointer reports many events inside one square; only the first counts.
    if (stroke[stroke.length - 1] === index) return;
    paintCell(index);
  };

  /*
   * Lifting the finger is not a send.
   *
   * The debounce already fires shortly after any pause, and a pause is exactly
   * what lifting a finger produces — so tying a request to `pointerup` would
   * just mean somebody tapping forty squares one at a time sends forty
   * requests. All this has to do is stop tracking the drag.
   */
  const endStroke = () => {
    if (!drawing()) return;
    setDrawing(false);
  };

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-end gap-2">
        {/* − · Fit · + — a step each way, and one press back to the whole thing. */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="btn-ghost text-xs px-2.5"
            disabled={zoom() <= ZOOM_STEPS[0]}
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => stepZoom(-1)}
          >
            <ZoomOut size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            class="btn-ghost text-xs px-2.5"
            disabled={zoom() === 1}
            title="Fit the whole pookalam"
            onClick={() => setZoom(1)}
          >
            Fit
          </button>
          <button
            type="button"
            class="btn-ghost text-xs px-2.5"
            disabled={zoom() >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => stepZoom(1)}
          >
            <ZoomIn size={14} strokeWidth={2.5} />
          </button>
        </div>
        <button
          type="button"
          class="btn-ghost text-xs inline-flex items-center gap-1.5"
          disabled={busy()}
          onClick={() => void load()}
        >
          <RefreshCw size={13} strokeWidth={2.5} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ------------------------------------------------------- the canvas */}
      {/*
        At 1x the square already fits, so the container never scrolls and a
        swipe scrolls the page as normal. At 2x it becomes a pannable window —
        `touch-action` has to say so explicitly or the browser keeps the
        gesture for the page and the canvas cannot be dragged.
      */}
      <div
        ref={(el) => (shell = el)}
        class="w-full scrollbar-none"
        classList={{ "overflow-auto": zoom() > 1 }}
        style={{
          "max-height": zoom() > 1 ? `${fit()}px` : undefined,
          "touch-action": zoom() > 1 ? "pan-x pan-y" : "auto",
        }}
      >
        <canvas
          ref={(el) => (canvas = el)}
          onPointerDown={beginStroke}
          onPointerMove={extendStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          class="block mx-auto rounded"
          style={{
            border: "var(--ink-w) solid var(--ink)",
            background: GROUND,
            cursor: canPlace() ? "crosshair" : "default",
          }}
        />
      </div>

      <Show when={loaded() && !open()}>
        <p class="font-extrabold text-sm" style={{ color: "var(--pop-red)" }}>
          The shared pookalam is closed right now.
        </p>
      </Show>
      <Show when={loaded() && open() && !canPlace()}>
        <p class="font-semibold text-sm">
          <a href="/auth/signin" class="underline decoration-2 underline-offset-4">
            Sign in
          </a>{" "}
          to add your flowers.
        </p>
      </Show>
      <Show when={note()}>
        <p class="font-extrabold text-sm m-0" style={{ color: "var(--pop-red)" }}>
          {note()}
        </p>
      </Show>

      <HowToDraw />

      {/* ------------------------------------------------------- the palette */}
      <Show when={canPlace()}>
        <div class="card card-plain space-y-2">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-black text-sm m-0">Pick your poov</p>
            <p class="text-xs font-extrabold m-0" style={{ color: "var(--ink-soft)" }}>
              {left()} left today · {placed()} of {CELL_COUNT} squares filled
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <For each={FLOWERS}>
              {(flower) => (
                <button
                  type="button"
                  title={`${flower.name} — ${flower.english}`}
                  onClick={() => setPicked(flower)}
                  class="rounded p-1 leading-none transition-transform"
                  style={{
                    border: "var(--ink-w) solid var(--ink)",
                    background: picked().id === flower.id ? "var(--pop-yellow)" : "var(--paper)",
                    transform: picked().id === flower.id ? "translateY(-2px)" : undefined,
                  }}
                >
                  <FlowerSwatch flower={flower} />
                  <span class="block text-[9px] font-extrabold uppercase tracking-wide pt-0.5">
                    {flower.name}
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

const HOW_TO: string[] = [
  "Pick a poov from the row under the canvas — ten real ones, the same flowers people actually carry to a pookalam.",
  "Tap a bare square to place it, or press and drag to lay a whole line of them at once.",
  "You can't paint over somebody else's flower. Work around it — that's the game.",
  "You get a set number a day. Spend them on one dense patch or scatter them; both are legitimate.",
  "At midnight it's kept and tomorrow's flowers land on top, so today's work shows through the gaps forever.",
];

/**
 * The how-to, in the shape every mini-game here uses.
 *
 * Collapsed by default so it never pushes the canvas off screen, and the demo
 * above the steps is a real loop rather than a diagram — the one thing that is
 * genuinely hard to convey in a sentence is that you can *drag*, and a picture
 * of flowers appearing one after another along an arc says it instantly.
 */
function HowToDraw() {
  const [open, setOpen] = createSignal(false);
  return (
    <section class="card card-plain space-y-3">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
      >
        <span class="rule flex-1">How to draw</span>
        <span
          class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
          style={{
            background: "var(--paper-3)",
            border: "2px solid var(--ink)",
            "font-family": "var(--font-stack-display)",
            "font-weight": 800,
          }}
        >
          {open() ? "−" : "+"}
        </span>
      </button>

      <Show when={open()}>
        <div class="space-y-3">
          <StrokeDemo />
          <ol class="space-y-2.5">
            <For each={HOW_TO}>
              {(step, i) => (
                <li class="flex gap-3">
                  <span
                    class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs tabular-nums"
                    style={{
                      background: "var(--pop-yellow)",
                      border: "2px solid var(--ink)",
                      "font-family": "var(--font-stack-display)",
                      "font-weight": 800,
                    }}
                  >
                    {i() + 1}
                  </span>
                  <span class="text-sm font-semibold leading-snug">{step}</span>
                </li>
              )}
            </For>
          </ol>
        </div>
      </Show>
    </section>
  );
}

/**
 * A hand laying an arc of flowers, on a loop.
 *
 * Drawn with the same `drawFlower` the real canvas uses, so the demo can never
 * end up showing a flower that does not exist or a style that has drifted.
 */
function StrokeDemo() {
  let el: HTMLCanvasElement | undefined;
  const [step, setStep] = createSignal(0);
  const TOTAL = 14;

  onMount(() => {
    const timer = setInterval(() => setStep((n) => (n + 1) % (TOTAL + 4)), 190);
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    const drawn = Math.min(step(), TOTAL);
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = el.clientWidth || 280;
    const h = 120;
    el.width = Math.floor(w * dpr);
    el.height = Math.floor(h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const r = 11;
    for (let i = 0; i < drawn; i++) {
      const t = i / (TOTAL - 1);
      // A shallow arc, so it reads as a swept finger rather than a straight rule.
      const x = w * 0.12 + t * w * 0.76;
      const y = h * 0.58 - Math.sin(t * Math.PI) * h * 0.24;
      drawFlower(ctx, x, y, r, FLOWERS[i % FLOWERS.length]);
    }
  });

  return (
    <div
      class="relative w-full overflow-hidden rounded"
      style={{
        height: "120px",
        border: "var(--ink-w) solid var(--ink)",
        background: "var(--paper-3)",
      }}
    >
      <canvas ref={(node) => (el = node)} class="block w-full" style={{ height: "120px" }} />
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
        press and drag to lay a line
      </p>
    </div>
  );
}

/*
 * No guide rings under the flowers.
 *
 * A chalked-out ground — concentric rings and sixteen spokes, the way a
 * pookalam is actually laid — was tried here and looked like a dartboard
 * somebody had dropped flowers on. Bare paper is the better floor: it reads as
 * a surface waiting to be used rather than a diagram to be filled in, and it
 * puts nothing behind the artwork to argue with it.
 */

/**
 * Paints one day's flowers onto the disc.
 *
 * Position, size and facing all come from the slot, so the arrangement is the
 * pookalam's and not the storage array's. Each flower is turned to face out
 * along its own radius — which is what a real one does and what stops a filled
 * ring reading as a row of identical stamps bent round a curve.
 *
 * The jitter and size wobble are hashed from the cell index: deterministic, so
 * every person looking at this pookalam sees exactly the same one, and every
 * reload redraws it identically.
 */
function paintLayer(
  ctx: CanvasRenderingContext2D,
  cells: Uint8Array,
  css: number,
  scale: number,
): void {
  for (let i = 0; i < CELL_COUNT; i++) {
    const id = readCell(cells, i);
    if (id === 0) continue;
    const flower = flowerById(id);
    if (!flower) continue;

    const slot = SLOTS[i];
    const jitter = ((((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.38;
    const wobble = 0.94 + (((i * 40503) >>> 0) % 100) / 800;

    drawFlower(
      ctx,
      slot.x * css,
      slot.y * css,
      slot.cellRadius * css * wobble * scale,
      flower,
      slot.angle + jitter,
    );
  }
}

/** One flower on its own tiny canvas, so the palette and the grid never drift. */
function FlowerSwatch(props: { flower: Flower }) {
  let el: HTMLCanvasElement | undefined;
  const paint = () => {
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 26;
    el.width = size * dpr;
    el.height = size * dpr;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawFlower(ctx, size / 2, size / 2, size / 2 - 1, props.flower);
  };
  onMount(paint);
  return <canvas ref={(node) => (el = node)} style={{ width: "26px", height: "26px" }} />;
}
