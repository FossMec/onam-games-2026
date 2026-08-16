import { CheckCircle2, HelpCircle, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-solid";
import { For, Show, batch, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { EMPTY_BRUSH, FLOWERS, type Flower, drawFlower, flowerById } from "~/lib/pookalam-flowers";
import { CELL_COUNT, fromBase64, readCell, writeCell } from "~/lib/pookalam-grid";
import { PADDING_SCALE, SLOTS, slotAt } from "~/lib/pookalam-layout";

/**
 * The pookalam the whole room draws together.
 *
 * A 50x50 grid, one flower per square, continuous collaboration throughout Onam.
 */

const MAX_CANVAS_PX_DESKTOP = 540;
const MAX_CANVAS_PX_MOBILE = 420;
const MIN_CANVAS_PX = 260;
const ZOOM_STEPS = [1, 1.6, 2.4, 3.2];
const GROUND = "#2b2733";
const STORAGE_PREFIX = "collab-pookalam:";

// Client-side 20% limit per flower species across the whole pookalam
const MAX_FLOWER_PERCENT = 0.2;
const MAX_FLOWER_CELLS = Math.floor(CELL_COUNT * MAX_FLOWER_PERCENT); // 500 cells

interface DayLayer {
  dayKey: string;
  cells: Uint8Array;
}

export function CollabPookalam() {
  let canvas: HTMLCanvasElement | undefined;
  let shell: HTMLDivElement | undefined;
  let rootRef: HTMLDivElement | undefined;

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
  const [fit, setFit] = createSignal(480);
  const [busy, setBusy] = createSignal(false);
  const [note, setNote] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [drawing, setDrawing] = createSignal(false);
  const [showHowTo, setShowHowTo] = createSignal(false);

  const left = () => Math.max(0, allowance() - used());

  // Count occurrences of each flower on today's pookalam
  const flowerCounts = () => {
    const grid = today();
    const counts: Record<number, number> = {};
    for (const f of FLOWERS) counts[f.id] = 0;
    if (!grid) return counts;
    for (let i = 0; i < CELL_COUNT; i++) {
      const fid = readCell(grid, i);
      if (fid !== 0) counts[fid] = (counts[fid] || 0) + 1;
    }
    return counts;
  };

  const isFlowerCapped = (flowerId: number) => {
    return (flowerCounts()[flowerId] || 0) >= MAX_FLOWER_CELLS;
  };

  const stepZoom = (direction: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom());
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + direction))];
    setZoom(next ?? 1);
  };

  const readUsed = (key: string) => {
    try {
      return Number(localStorage.getItem(STORAGE_PREFIX + key)) || 0;
    } catch {
      return 0;
    }
  };

  const bumpUsed = (key: string) => {
    const next = readUsed(key) + 1;
    setUsed(next);
    try {
      localStorage.setItem(STORAGE_PREFIX + key, String(next));
    } catch {
      /* storage disabled fallback */
    }
  };

  const load = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/pookalam/state");
      const state = await res.json();
      setToday(fromBase64(state.today.cells));
      setHistory(
        state.history.map((day: any) => ({ dayKey: day.dayKey, cells: fromBase64(day.cells) })),
      );
      setDayKey(state.today.dayKey);
      setPlaced(state.today.placed);
      setOpen(state.open);
      setCanPlace(state.canPlace);
      setAllowance(state.dailyFlowers);
      setUsed(readUsed(state.today.dayKey));

      // If default picked flower is already capped, select first available
      if (isFlowerCapped(picked().id)) {
        const next = FLOWERS.find((f) => !isFlowerCapped(f.id));
        if (next) setPicked(next);
      }
    } catch {
      setNote("Could not reach the pookalam. Try refresh.");
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  const measure = () => {
    if (typeof window === "undefined") return;
    const isDesktop = window.innerWidth >= 1024;
    const containerW =
      rootRef?.clientWidth ?? (isDesktop ? window.innerWidth - 64 : window.innerWidth - 24);
    const sideOverheadW = isDesktop ? 390 : 16;
    const availableW = Math.max(MIN_CANVAS_PX, containerW - sideOverheadW);
    const verticalOverhead = isDesktop ? 165 : 220;
    const availableH = window.innerHeight - verticalOverhead;
    const maxPx = isDesktop ? MAX_CANVAS_PX_DESKTOP : MAX_CANVAS_PX_MOBILE;
    const size = Math.min(maxPx, Math.max(MIN_CANVAS_PX, Math.min(availableW, availableH)));
    setFit(Math.floor(size));
  };

  onMount(() => {
    void load();
    measure();
    const observer = new ResizeObserver(measure);
    if (rootRef) observer.observe(rootRef);
    window.addEventListener("resize", measure);
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      void flush();
    });
  });

  /** Repaints canvas with crisp DPR */
  const paint = () => {
    const grid = today();
    if (!canvas || !grid) return;
    const css = fit() * zoom();
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(css * dpr);
    canvas.height = Math.floor(css * dpr);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    // 1. Ground circular disc
    ctx.beginPath();
    ctx.arc(css / 2, css / 2, (css / 2) * PADDING_SCALE, 0, Math.PI * 2);
    ctx.fillStyle = GROUND;
    ctx.fill();

    // 2. Very subtle guideline outline with safe padding
    ctx.beginPath();
    ctx.arc(css / 2, css / 2, (css / 2) * PADDING_SCALE - 1, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(251, 243, 228, 0.08)";
    ctx.stroke();

    const layers = history();
    layers.forEach((layer, i) => {
      const depth = layers.length - i;
      ctx.globalAlpha = Math.max(0.18, 0.62 - depth * 0.08);
      paintLayer(ctx, layer.cells, css, 0.94 - depth * 0.04);
    });

    ctx.globalAlpha = 1;
    paintLayer(ctx, grid, css, 1);
  };

  createEffect(paint);

  // Auto-center scroll when zoom level changes
  createEffect(() => {
    const z = zoom();
    const f = fit();
    if (shell && z > 1) {
      setTimeout(() => {
        if (!shell) return;
        const targetScroll = (f * z - f) / 2;
        shell.scrollLeft = targetScroll;
        shell.scrollTop = targetScroll;
      }, 0);
    }
  });

  const DEBOUNCE_MS = 350;
  const MAX_WAIT_MS = 1500;

  let stroke: number[] = [];
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
    if (!maxWait) maxWait = setTimeout(() => void flush(), MAX_WAIT_MS);
  };

  const allowanceLeftInStroke = () => left();

  /** Direct instant paint for 0ms latency during drawing */
  const drawCellDirect = (index: number, flower: Flower) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = fit() * zoom();
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const slot = SLOTS[index];
    const jitter = ((((index * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.12;
    const wobble = 0.98 + (((index * 40503) >>> 0) % 100) / 2500;
    drawFlower(
      ctx,
      slot.x * css,
      slot.y * css,
      slot.cellRadius * css * wobble,
      flower,
      slot.angle + jitter,
    );
    ctx.restore();
  };

  const paintCell = (index: number): boolean => {
    const grid = today();
    if (!grid) return false;
    if (stroke.length >= allowanceLeftInStroke()) return false;

    const flower = picked();
    if (isFlowerCapped(flower.id)) {
      setNote(`${flower.name} reached the 20% limit. Pick another flower!`);
      const next = FLOWERS.find((f) => !isFlowerCapped(f.id));
      if (next) setPicked(next);
      return false;
    }

    // 1. Instant optimistic direct canvas draw (0ms lag!)
    drawCellDirect(index, flower);

    // 2. Update state in memory
    writeCell(grid, index, flower.id);
    stroke.push(index);
    scheduleFlush();
    return true;
  };

  const flush = (): Promise<void> => {
    clearTimers();
    const cells = stroke;
    stroke = [];
    if (cells.length === 0) return inFlight;

    const flowerId = picked().id;
    inFlight = inFlight.then(async () => {
      try {
        const res = await fetch("/api/pookalam/stroke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cells: cells.map((index) => ({ index, flowerId })),
          }),
        });
        const result = (await res.json()) as {
          written: number[];
          placed: number;
          cells: string;
          reason?: string;
        };
        if (result && typeof result.placed === "number") {
          setPlaced(result.placed);
        }

        const kept = result?.written?.length ?? 0;
        if (kept < cells.length) {
          if (result?.reason) setNote(result.reason);
        }
        for (let i = 0; i < kept; i++) bumpUsed(dayKey());
      } catch {
        /* network error fallback */
      }
    });
    return inFlight;
  };

  // Multi-touch pinch-to-zoom and stroke tracking
  const activePointers = new Map<number, { x: number; y: number }>();
  let initialPinchDist: number | null = null;
  let initialPinchZoom = 1;
  let lastPointerPos: { x: number; y: number } | null = null;
  let lastPlacedIndex: number | null = null;

  const handlePointerDown = (event: PointerEvent) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size >= 2) {
      if (drawing()) endStroke();
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      if (p1 && p2) {
        initialPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        initialPinchZoom = zoom();
      }
      return;
    }

    if (!canPlace() || busy() || !canvas) return;
    if (left() <= 0) {
      setNote("You've placed all your flowers today! Come back tomorrow to lay more petals.");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const index = slotAt(nx, ny);
    if (index === null) return;

    setNote("");
    stroke = [];
    setDrawing(true);
    lastPointerPos = { x: nx, y: ny };
    lastPlacedIndex = index;

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    paintCell(index);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // 2-finger pinch zoom
    if (activePointers.size >= 2 && initialPinchDist) {
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      if (p1 && p2) {
        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const factor = currentDist / initialPinchDist;
        const nextZoom = Math.min(
          3.5,
          Math.max(1, Math.round(initialPinchZoom * factor * 10) / 10),
        );
        setZoom(nextZoom);
      }
      return;
    }

    // 1-finger / mouse drawing with optimistic line interpolation
    if (!drawing() || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawEvents = (event as any).getCoalescedEvents
      ? ((event as any).getCoalescedEvents() as PointerEvent[])
      : [event];

    batch(() => {
      for (const ev of rawEvents) {
        const nx = (ev.clientX - rect.left) / rect.width;
        const ny = (ev.clientY - rect.top) / rect.height;

        if (lastPointerPos) {
          const dx = nx - lastPointerPos.x;
          const dy = ny - lastPointerPos.y;
          const dist = Math.hypot(dx, dy);
          const steps = Math.max(1, Math.ceil(dist / 0.0035));

          for (let s = 1; s <= steps; s++) {
            const px = lastPointerPos.x + dx * (s / steps);
            const py = lastPointerPos.y + dy * (s / steps);
            const cellIndex = slotAt(px, py);
            if (cellIndex !== null && cellIndex !== lastPlacedIndex) {
              const painted = paintCell(cellIndex);
              if (painted) {
                lastPlacedIndex = cellIndex;
              }
            }
          }
        } else {
          const cellIndex = slotAt(nx, ny);
          if (cellIndex !== null && cellIndex !== lastPlacedIndex) {
            const painted = paintCell(cellIndex);
            if (painted) lastPlacedIndex = cellIndex;
          }
        }
        lastPointerPos = { x: nx, y: ny };
      }
    });
  };

  const handlePointerUp = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) {
      initialPinchDist = null;
    }
    if (activePointers.size === 0) {
      endStroke();
    }
  };

  const endStroke = () => {
    if (!drawing()) return;
    setDrawing(false);
    lastPointerPos = null;
    lastPlacedIndex = null;
  };

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      setZoom((z) => Math.min(3.5, Math.max(1, Math.round((z + delta) * 10) / 10)));
    }
  };

  return (
    <div
      ref={(el) => (rootRef = el)}
      class="w-full flex flex-col items-center justify-center space-y-1.5"
    >
      {/* ---------------- Mobile Only Top Utility Bar (Single Compact Line) ---------------- */}
      <div class="lg:hidden w-full flex items-center justify-between gap-1 px-1">
        <Show when={canPlace()}>
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black shrink-0"
            style={{
              background: left() <= 0 ? "var(--paper-2)" : "var(--paper)",
              border: "var(--ink-w) solid var(--ink)",
              color: left() <= 0 ? "var(--ink-soft)" : "var(--ink)",
            }}
          >
            <span
              class="inline-block w-1.5 h-1.5 rounded-full"
              classList={{
                "bg-[var(--pop-teal)]": left() > 0,
                "bg-[var(--ink-soft)]": left() <= 0,
              }}
            />
            {left() > 0 ? `${left()} left` : "Done today"}
          </span>
        </Show>

        <div class="flex items-center gap-1 shrink-0 ml-auto">
          <button
            type="button"
            class="btn-ghost text-[10.5px] px-1.5 py-0.5 inline-flex items-center gap-1 font-extrabold cursor-pointer"
            onClick={() => setShowHowTo(true)}
            title="How to draw"
          >
            <HelpCircle size={12} strokeWidth={2.5} />
            <span class="hidden xs:inline">How to draw</span>
          </button>

          <div class="flex items-center gap-0.5">
            <button
              type="button"
              class="btn-ghost text-xs p-1 cursor-pointer"
              disabled={zoom() <= ZOOM_STEPS[0]}
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => stepZoom(-1)}
            >
              <ZoomOut size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              class="btn-ghost text-[10.5px] px-1.5 py-0.5 cursor-pointer font-bold"
              disabled={zoom() === 1}
              title="Fit"
              onClick={() => setZoom(1)}
            >
              Fit
            </button>
            <button
              type="button"
              class="btn-ghost text-xs p-1 cursor-pointer"
              disabled={zoom() >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => stepZoom(1)}
            >
              <ZoomIn size={12} strokeWidth={2.5} />
            </button>
          </div>

          <button
            type="button"
            class="btn-ghost text-xs p-1 inline-flex items-center justify-center cursor-pointer"
            disabled={busy()}
            onClick={() => void load()}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ---------------- Main Drawing Arena: 3-Column Best-Effort Layout ---------------- */}
      <div class="flex items-center justify-center gap-3 lg:gap-4 w-full max-w-full">
        {/* Left Flank: Desktop Vertical Poov Brushes */}
        <Show when={canPlace()}>
          <div
            class="hidden lg:flex flex-col card card-plain p-1.5 space-y-1 shrink-0 w-44 self-center transition-opacity"
            style={{
              border: "var(--ink-w) solid var(--ink)",
              background: "var(--paper)",
            }}
          >
            <div class="flex items-center justify-between px-0.5">
              <p class="font-black text-[10px] uppercase tracking-wider m-0 text-[var(--ink)]">
                Pick Poov
              </p>
              <Show when={left() <= 0}>
                <span class="text-[8.5px] font-black px-1 rounded bg-[var(--paper-3)] text-[var(--ink-soft)]">
                  Limit reached
                </span>
              </Show>
            </div>

            <div
              class="flex flex-col gap-0.5 w-full transition-all"
              classList={{ "opacity-40 grayscale pointer-events-none": left() <= 0 }}
            >
              <For each={FLOWERS}>
                {(flower) => {
                  const capped = () => isFlowerCapped(flower.id);
                  return (
                    <button
                      type="button"
                      disabled={capped()}
                      title={
                        capped()
                          ? `${flower.name} (Max 20% reached)`
                          : `${flower.name} (${flower.english})`
                      }
                      onClick={() => setPicked(flower)}
                      class="flex items-center justify-between gap-1.5 px-2 py-1 rounded transition-all text-left w-full"
                      classList={{
                        "opacity-35 grayscale cursor-not-allowed": capped(),
                        "cursor-pointer": !capped(),
                      }}
                      style={{
                        border: "1.5px solid var(--ink)",
                        background:
                          picked().id === flower.id && !capped()
                            ? "var(--pop-yellow)"
                            : "var(--paper-2)",
                        transform:
                          picked().id === flower.id && !capped() ? "translateX(2px)" : undefined,
                      }}
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <div class="w-5 h-5 shrink-0 flex items-center justify-center">
                          <FlowerSwatch flower={flower} size={20} />
                        </div>
                        <span class="text-[9px] font-black uppercase tracking-tight text-[var(--ink)] leading-tight whitespace-nowrap truncate">
                          {flower.name}
                        </span>
                      </div>
                      <Show when={capped()}>
                        <span class="text-[7px] font-black px-1 py-0.2 rounded bg-[var(--paper-3)] text-[var(--pop-red)] shrink-0">
                          20%
                        </span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>

            {/* Eraser Tool */}
            <button
              type="button"
              title="Eraser (Remove flower / clear square)"
              onClick={() => setPicked(EMPTY_BRUSH)}
              class="flex items-center gap-2 px-2 py-1 rounded transition-all cursor-pointer text-left w-full mt-0.5"
              style={{
                border: "1.5px dashed var(--ink)",
                background: picked().id === EMPTY_BRUSH.id ? "var(--pop-yellow)" : "var(--paper-2)",
                transform: picked().id === EMPTY_BRUSH.id ? "translateX(2px)" : undefined,
              }}
            >
              <div class="w-5 h-5 shrink-0 flex items-center justify-center rounded bg-[#2B2733] border border-[var(--ink)] text-[var(--pop-red)] font-black text-xs">
                ✕
              </div>
              <span class="text-[9px] font-black uppercase tracking-tight text-[var(--ink)] leading-tight whitespace-nowrap">
                Eraser (Empty)
              </span>
            </button>

            <Show when={left() <= 0}>
              <p class="text-[9px] font-bold text-center text-[var(--ink-soft)] pt-1 m-0 border-t border-[var(--ink)]/15">
                Come back and lay more flowers tomorrow!
              </p>
            </Show>
          </div>
        </Show>

        {/* Center: Large Centered Canvas */}
        <div class="flex flex-col items-center justify-center shrink-0 max-w-full">
          {/* Center Canvas Viewport (Fixed dimensions, never overflows surrounding layout) */}
          <div
            ref={(el) => (shell = el)}
            class="scrollbar-none relative rounded"
            classList={{
              "overflow-auto": zoom() > 1,
              "overflow-hidden flex items-center justify-center": zoom() <= 1,
            }}
            style={{
              width: `${fit()}px`,
              height: `${fit()}px`,
              "max-width": "100%",
              "max-height": `${fit()}px`,
              border: "var(--ink-w-bold) solid var(--ink)",
              background: GROUND,
              "touch-action": zoom() > 1 ? "pan-x pan-y" : "none",
            }}
          >
            <canvas
              ref={(el) => (canvas = el)}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              class="block select-none"
              style={{
                "touch-action": "none",
                cursor: canPlace()
                  ? 'url("/cursors/muthukuda-point.png") 6 2, crosshair'
                  : 'url("/cursors/muthukuda.png") 6 2, default',
              }}
            />
          </div>

          <Show when={loaded() && !open()}>
            <p class="font-extrabold text-xs mt-1 text-center" style={{ color: "var(--pop-red)" }}>
              The shared pookalam is closed right now.
            </p>
          </Show>
          <Show when={loaded() && open() && !canPlace()}>
            <p class="font-semibold text-xs mt-1 text-center">
              <a
                href="/auth/signin"
                class="underline decoration-2 underline-offset-4 font-extrabold"
              >
                Sign in
              </a>{" "}
              to add your flowers.
            </p>
          </Show>
          <Show when={note()}>
            <p
              class="font-extrabold text-xs mt-1 text-center m-0"
              style={{ color: "var(--pop-red)" }}
            >
              {note()}
            </p>
          </Show>
        </div>

        {/* Right Flank: Desktop Action & Status Controls */}
        <div class="hidden lg:flex flex-col space-y-1.5 shrink-0 w-40 self-center">
          {/* Status Card */}
          <Show when={canPlace()}>
            <div
              class="card card-plain p-2 space-y-0.5 text-center"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--paper)",
              }}
            >
              <span class="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-[var(--ink)]">
                <span
                  class="inline-block w-2 h-2 rounded-full"
                  classList={{
                    "bg-[var(--pop-teal)]": left() > 0,
                    "bg-[var(--ink-soft)]": left() <= 0,
                  }}
                />
                {left() > 0 ? `${left()} left today` : "Done for today"}
              </span>
              <p class="text-[9.5px] font-extrabold m-0" style={{ color: "var(--ink-soft)" }}>
                {placed()} / {CELL_COUNT} filled
              </p>
            </div>
          </Show>

          {/* Action Tools Card */}
          <div
            class="card card-plain p-1.5 space-y-1"
            style={{
              border: "var(--ink-w) solid var(--ink)",
              background: "var(--paper)",
            }}
          >
            <button
              type="button"
              class="btn-ghost text-[11px] px-2 py-1 w-full inline-flex items-center justify-center gap-1 font-black cursor-pointer"
              onClick={() => setShowHowTo(true)}
              title="How to draw"
            >
              <HelpCircle size={13} strokeWidth={2.5} />
              <span>How to draw</span>
            </button>

            <div class="flex items-center justify-between gap-1 pt-1 border-t border-[var(--ink)]/20">
              <button
                type="button"
                class="btn-ghost text-xs p-1 flex-1 inline-flex items-center justify-center cursor-pointer"
                disabled={zoom() <= ZOOM_STEPS[0]}
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => stepZoom(-1)}
              >
                <ZoomOut size={13} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                class="btn-ghost text-[11px] px-1.5 py-1 flex-1 inline-flex items-center justify-center font-bold cursor-pointer"
                disabled={zoom() === 1}
                title="Fit whole pookalam"
                onClick={() => setZoom(1)}
              >
                Fit
              </button>
              <button
                type="button"
                class="btn-ghost text-xs p-1 flex-1 inline-flex items-center justify-center cursor-pointer"
                disabled={zoom() >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => stepZoom(1)}
              >
                <ZoomIn size={13} strokeWidth={2.5} />
              </button>
            </div>

            <button
              type="button"
              class="btn-ghost text-[11px] px-2 py-1 w-full inline-flex items-center justify-center gap-1 font-extrabold cursor-pointer"
              disabled={busy()}
              onClick={() => void load()}
            >
              <RefreshCw size={12} strokeWidth={2.5} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Poov Palette (< 1024px) - Clean 2-row layout */}
      <Show when={canPlace()}>
        <div
          class="lg:hidden card card-plain space-y-1 p-1.5 sm:p-2 w-full max-w-md mx-auto"
          style={{
            border: "var(--ink-w) solid var(--ink)",
            background: "var(--paper)",
          }}
        >
          <div class="space-y-0.5">
            <div
              class="grid grid-cols-5 gap-1 sm:gap-1.5 transition-all"
              classList={{ "opacity-40 grayscale pointer-events-none": left() <= 0 }}
            >
              <For each={FLOWERS.slice(0, 5)}>
                {(flower) => {
                  const capped = () => isFlowerCapped(flower.id);
                  return (
                    <button
                      type="button"
                      disabled={capped()}
                      title={
                        capped()
                          ? `${flower.name} (Max 20% reached)`
                          : `${flower.name} (${flower.english})`
                      }
                      onClick={() => setPicked(flower)}
                      class="flex flex-col items-center justify-center p-0.5 rounded transition-all min-w-0 relative"
                      classList={{
                        "opacity-35 grayscale cursor-not-allowed": capped(),
                        "cursor-pointer": !capped(),
                      }}
                      style={{
                        border: "var(--ink-w) solid var(--ink)",
                        background:
                          picked().id === flower.id && !capped()
                            ? "var(--pop-yellow)"
                            : "var(--paper-2)",
                        transform:
                          picked().id === flower.id && !capped() ? "translateY(-1px)" : undefined,
                      }}
                    >
                      <FlowerSwatch flower={flower} size={18} />
                      <span class="block text-[7px] sm:text-[8px] font-black uppercase tracking-tight text-center pt-0.5 text-[var(--ink)] leading-none truncate w-full">
                        {flower.name}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
            <div
              class="grid grid-cols-5 gap-1 sm:gap-1.5 transition-all"
              classList={{ "opacity-40 grayscale pointer-events-none": left() <= 0 }}
            >
              <For each={[...FLOWERS.slice(5), EMPTY_BRUSH]}>
                {(flower) => {
                  const isEraser = flower.id === 0;
                  const capped = () => !isEraser && isFlowerCapped(flower.id);
                  return (
                    <button
                      type="button"
                      disabled={capped()}
                      title={
                        capped()
                          ? `${flower.name} (Max 20% reached)`
                          : isEraser
                            ? "Eraser (Clear square)"
                            : `${flower.name} (${flower.english})`
                      }
                      onClick={() => setPicked(flower)}
                      class="flex flex-col items-center justify-center p-0.5 rounded transition-all min-w-0 relative"
                      classList={{
                        "opacity-35 grayscale cursor-not-allowed": capped(),
                        "cursor-pointer": !capped(),
                      }}
                      style={{
                        border: isEraser
                          ? "1.5px dashed var(--ink)"
                          : "var(--ink-w) solid var(--ink)",
                        background:
                          picked().id === flower.id && !capped()
                            ? isEraser
                              ? "var(--paper-3)"
                              : "var(--pop-yellow)"
                            : "var(--paper-2)",
                        transform:
                          picked().id === flower.id && !capped() ? "translateY(-1px)" : undefined,
                      }}
                    >
                      <Show
                        when={!isEraser}
                        fallback={
                          <div class="w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded bg-[#2B2733] border border-[var(--ink)] text-[var(--pop-red)] font-black text-[9px] leading-none">
                            ✕
                          </div>
                        }
                      >
                        <FlowerSwatch flower={flower} size={18} />
                      </Show>
                      <span class="block text-[7px] sm:text-[8px] font-black uppercase tracking-tight text-center pt-0.5 text-[var(--ink)] leading-none truncate w-full">
                        {isEraser ? "Eraser" : flower.name}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>

            <Show when={left() <= 0}>
              <p class="text-[9px] font-bold text-center text-[var(--ink-soft)] pt-1 m-0 border-t border-[var(--ink)]/15 flex items-center justify-center gap-1">
                <CheckCircle2 size={11} class="text-[var(--pop-teal)]" />
                <span>Come back and lay more flowers tomorrow!</span>
              </p>
            </Show>
          </div>
        </div>
      </Show>

      {/* ---------------- How To Draw Dialog Popup Modal */}
      <Show when={showHowTo()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHowTo(false);
          }}
        >
          <div
            class="card card-plain max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-150"
            style={{
              background: "var(--paper)",
              border: "var(--ink-w-bold) solid var(--ink)",
            }}
          >
            <div class="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
              <h3
                class="text-xl font-black m-0"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                How to draw
              </h3>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--paper-3)] font-black text-sm hover:bg-[var(--pop-red)] hover:text-white transition-colors cursor-pointer"
                onClick={() => setShowHowTo(false)}
                title="Close"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <StrokeDemo />

            <ol class="space-y-2.5 m-0 p-0 list-none">
              <For each={HOW_TO}>
                {(step, i) => (
                  <li class="flex items-start gap-3">
                    <span
                      class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black tabular-nums"
                      style={{
                        background: "var(--pop-yellow)",
                        border: "2px solid var(--ink)",
                        "font-family": "var(--font-stack-display)",
                      }}
                    >
                      {i() + 1}
                    </span>
                    <span class="text-xs sm:text-sm font-semibold leading-snug text-[var(--ink)]">
                      {step}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </div>
        </div>
      </Show>
    </div>
  );
}

const HOW_TO: string[] = [
  "Pick a poov from the catalogue — nine authentic Kerala flowers under their real Malayalam names.",
  "Tap a square to place it, or press and drag to lay a smooth line of petals at once.",
  "Build around each other and layer flowers across the canvas to create art together.",
  "Each flower species can occupy up to 20% of the pookalam to ensure a colorful, diverse carpet.",
  "Your flower limit resets daily at midnight — come back every day of the festival to add more!",
];

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
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const w = el.clientWidth || 280;
    const h = 110;
    el.width = Math.floor(w * dpr);
    el.height = Math.floor(h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const r = 10;
    for (let i = 0; i < drawn; i++) {
      const t = i / (TOTAL - 1);
      const x = w * 0.12 + t * w * 0.76;
      const y = h * 0.58 - Math.sin(t * Math.PI) * h * 0.24;
      drawFlower(ctx, x, y, r, FLOWERS[i % FLOWERS.length]);
    }
  });

  return (
    <div
      class="relative w-full overflow-hidden rounded"
      style={{
        height: "110px",
        border: "var(--ink-w) solid var(--ink)",
        background: "var(--paper-3)",
      }}
    >
      <canvas ref={(node) => (el = node)} class="block w-full" style={{ height: "110px" }} />
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted m-0">
        press and drag to lay a line
      </p>
    </div>
  );
}

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
    const jitter = ((((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.12;
    const wobble = 0.98 + (((i * 40503) >>> 0) % 100) / 2500;

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

/** One flower on its own tiny canvas, centered with crisp DPR. */
function FlowerSwatch(props: { flower: Flower; size?: number }) {
  let el: HTMLCanvasElement | undefined;
  const size = props.size || 26;
  const paint = () => {
    if (!el) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    el.width = Math.floor(size * dpr);
    el.height = Math.floor(size * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawFlower(ctx, size / 2, size / 2, size * 0.44, props.flower);
  };
  createEffect(paint);
  onMount(paint);
  return (
    <canvas
      ref={(node) => (el = node)}
      style={{ width: `${size}px`, height: `${size}px` }}
      class="block shrink-0"
    />
  );
}
