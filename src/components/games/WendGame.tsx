import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";

/**
 * Wend board — drag a finger across the letters to trace a word.
 *
 * You do not get the words. The board tells you how many there are and how long
 * each one is; working out which route through the letters spells which word is
 * the entire puzzle. So the browser genuinely cannot tell whether a path is a
 * word — it asks the server when you let go.
 *
 * Dragging is the primary input, unlike every other board in this project.
 * Elsewhere tapping wins because a drag fights the page scroll; here the
 * gesture *is* the mechanic — you are drawing a line through a maze — and
 * `touch-action: none` on the grid takes scrolling out of the fight. Tapping
 * still works for anyone who prefers it, or who cannot drag accurately.
 */

export interface Cell {
  r: number;
  c: number;
}

export interface WendViewData {
  kind: "wend";
  size: number;
  /** Letters; an empty string is a wall. */
  grid: string[][];
  /** How long each hidden word is. Never the words themselves. */
  wordLengths: number[];
  openCells: number;
}

export interface WendFound {
  word: string;
  cells: Cell[];
  isTarget?: boolean;
}

export interface WendGameProps {
  view: WendViewData;
  /** Asks the server whether a traced path spells a word. Null when it does not. */
  onTrace?: (cells: Cell[]) => Promise<string | null>;
  onFinish: (submission: { found: WendFound[] }) => void;
  disabled?: boolean;
  initialFound?: WendFound[];
  onProgress?: (found: WendFound[]) => void;
}

/** One colour per found word, so a locked path reads as a single object. */
const PATH_POPS = [
  "var(--pop-teal)",
  "var(--pop-blue)",
  "var(--pop-pink)",
  "var(--pop-purple)",
  "var(--pop-yellow)",
  "var(--pop-red)",
];

const key = (cell: Cell) => `${cell.r},${cell.c}`;
const adjacent = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

export function WendGame(props: WendGameProps) {
  const [found, setFound] = createSignal<WendFound[]>(props.initialFound ?? []);
  const [path, setPath] = createSignal<Cell[]>([]);
  const [drawing, setDrawing] = createSignal(false);
  const [checking, setChecking] = createSignal(false);
  const [flash, setFlash] = createSignal("");

  const letterAt = (cell: Cell) => props.view.grid[cell.r][cell.c];
  const isWall = (r: number, c: number) => props.view.grid[r][c] === "";

  const lockedCells = createMemo(() => {
    const map = new Map<string, number>();
    found().forEach((entry, i) => {
      for (const cell of entry.cells) map.set(key(cell), i);
    });
    return map;
  });

  const inPath = createMemo(() => new Set(path().map(key)));
  const covered = () => lockedCells().size;

  /** Word lengths still outstanding, so the pills below the board stay honest. */
  const remainingLengths = createMemo(() => {
    const pool = [...props.view.wordLengths];
    for (const entry of found()) {
      if (entry.isTarget !== false) {
        const at = pool.indexOf(entry.word.length);
        if (at !== -1) pool.splice(at, 1);
      }
    }
    return pool;
  });

  const commit = (next: WendFound[]) => {
    setFound(next);
    props.onProgress?.(next);
    const validTargets = next.filter((e) => e.isTarget !== false);
    const cells = next.reduce((n, entry) => n + entry.cells.length, 0);

    // Both conditions, always: every target word found AND every tile covered.
    if (
      validTargets.length === props.view.wordLengths.length &&
      cells === props.view.openCells &&
      next.every((e) => e.isTarget !== false)
    ) {
      props.onFinish({ found: validTargets });
    }
  };

  /** Extends the live trace to `cell` if that is a legal next step. */
  const extend = (r: number, c: number) => {
    if (props.disabled || checking() || isWall(r, c)) return;
    const cell = { r, c };
    const k = key(cell);
    if (lockedCells().has(k)) return;

    const current = path();
    if (current.length === 0) {
      setPath([cell]);
      return;
    }
    // Dragging back over the previous tile retraces — the natural undo for a gesture
    if (current.length > 1 && key(current[current.length - 2]) === k) {
      setPath(current.slice(0, -1));
      return;
    }
    if (inPath().has(k)) return;
    if (!adjacent(current[current.length - 1], cell)) return;

    const longest = Math.max(...props.view.wordLengths, 8);
    if (current.length + 1 > longest) return;
    setPath([...current, cell]);
  };

  /** Lets go of the trace: checks target status and places word without discarding */
  const release = async () => {
    setDrawing(false);
    const cells = path();
    if (cells.length < 3) {
      setPath([]);
      return;
    }

    const candidateWord = cells.map(letterAt).join("");

    if (!props.onTrace) {
      commit([...found(), { word: candidateWord, cells, isTarget: false }]);
      setPath([]);
      return;
    }

    setChecking(true);
    try {
      const verified = await props.onTrace(cells);
      if (verified && !found().some((f) => f.word === verified && f.isTarget !== false)) {
        commit([...found(), { word: verified, cells, isTarget: true }]);
      } else {
        // Keep candidate path on board without throwing away or erroring
        commit([...found(), { word: candidateWord, cells, isTarget: false }]);
      }
      setFlash("");
    } catch {
      commit([...found(), { word: candidateWord, cells, isTarget: false }]);
    } finally {
      setChecking(false);
      setPath([]);
    }
  };

  /** Releasing outside the grid must still end the trace. */
  const onWindowUp = () => {
    if (drawing()) void release();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
    onCleanup(() => {
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
    });
  }

  /**
   * A drag reports every move to the tile it *started* on, so the tile under
   * the finger has to be looked up by coordinate rather than by event target.
   */
  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y);
    const at = el?.closest<HTMLElement>("[data-cell]")?.dataset.cell;
    if (!at) return null;
    const [r, c] = at.split(",").map(Number);
    return { r, c };
  };

  const tapCell = (r: number, c: number) => {
    if (props.disabled || checking()) return;
    const k = key({ r, c });
    // Tapping a locked word releases it — one tap to undo a wrong-but-real word
    // that turned out to strand a tile.
    const owner = lockedCells().get(k);
    if (owner !== undefined) {
      commit(found().filter((_, i) => i !== owner));
      setPath([]);
      return;
    }
    extend(r, c);
  };

  const undo = () => {
    if (props.disabled) return;
    if (path().length > 0) {
      setPath(path().slice(0, -1));
      return;
    }
    commit(found().slice(0, -1));
  };

  const reset = () => {
    if (props.disabled) return;
    setPath([]);
    commit([]);
  };

  return (
    <div class="space-y-3.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="badge font-black text-xs" style={{ "--pop": "var(--pop-blue)" }}>
          {covered()}/{props.view.openCells} tiles covered
        </span>
        <Show
          when={path().length > 0}
          fallback={
            <span class="badge text-xs" style={{ "--pop": "var(--paper-3)" }}>
              {checking() ? "checking…" : "drag across letters to trace"}
            </span>
          }
        >
          <span
            class="badge font-black text-xs tracking-wider"
            style={{ "--pop": "var(--pop-yellow)" }}
          >
            {path().map(letterAt).join("")}
          </span>
        </Show>
      </div>

      <div
        class="mx-auto w-full select-none relative overflow-hidden"
        style={{
          "max-width": "min(100%, 26rem)",
          "aspect-ratio": "1 / 1",
          background: "var(--paper)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-radius": "var(--radius)",
          "touch-action": "none",
        }}
        onPointerDown={(e) => {
          if (props.disabled) return;
          const at = cellFromPoint(e.clientX, e.clientY);
          if (!at || isWall(at.r, at.c)) return;
          e.preventDefault();
          if (lockedCells().has(key(at))) {
            tapCell(at.r, at.c);
            return;
          }
          setDrawing(true);
          setPath([at]);
          setFlash("");
        }}
        onPointerMove={(e) => {
          if (!drawing()) return;
          const at = cellFromPoint(e.clientX, e.clientY);
          if (at) extend(at.r, at.c);
        }}
      >
        {/* Underlay Grid Background Cells */}
        <div
          class="absolute inset-0 grid w-full h-full"
          style={{
            "grid-template-columns": `repeat(${props.view.size}, 1fr)`,
            gap: "1px",
            background: "rgba(34,32,43,0.15)",
          }}
        >
          <For each={props.view.grid}>
            {(row, r) => (
              <For each={row}>
                {(_, c) => {
                  const wall = () => isWall(r(), c());
                  return (
                    <div
                      style={{
                        background: wall() ? "var(--ink)" : "var(--paper-2)",
                      }}
                    />
                  );
                }}
              </For>
            )}
          </For>
        </div>

        {/* LinkedIn-Style Continuous Rounded Snake Paths SVG Layer */}
        <svg
          class="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${props.view.size * 100} ${props.view.size * 100}`}
          style={{ "z-index": 2 }}
        >
          {/* 1. Locked Found Words */}
          <For each={found()}>
            {(entry, i) => {
              const color = PATH_POPS[i() % PATH_POPS.length];
              const cells = entry.cells;
              const pathD =
                cells.length > 1
                  ? `M ${cells[0].c * 100 + 50} ${cells[0].r * 100 + 50} ` +
                    cells
                      .slice(1)
                      .map((c) => `L ${c.c * 100 + 50} ${c.r * 100 + 50}`)
                      .join(" ")
                  : "";

              return (
                <g>
                  {/* Thick Rounded Path Pipe */}
                  <Show
                    when={cells.length > 1}
                    fallback={
                      <circle
                        cx={cells[0].c * 100 + 50}
                        cy={cells[0].r * 100 + 50}
                        r="39"
                        fill={color}
                      />
                    }
                  >
                    <path
                      d={pathD}
                      fill="none"
                      stroke={color}
                      stroke-width="78"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </Show>

                  {/* Start Node Disc with Halo Outline */}
                  <circle
                    cx={cells[0].c * 100 + 50}
                    cy={cells[0].r * 100 + 50}
                    r="38"
                    fill={color}
                    stroke="#ffffff"
                    stroke-width="5"
                  />

                  {/* Checkmark Badge at top-right of Start Node ONLY for verified target words */}
                  <Show when={entry.isTarget !== false}>
                    <g transform={`translate(${cells[0].c * 100 + 74}, ${cells[0].r * 100 + 26})`}>
                      <circle r="12" fill="#ffffff" stroke="var(--ink)" stroke-width="2" />
                      <path
                        d="M -4 0 L -1 3.5 L 5 -3"
                        fill="none"
                        stroke="#06d6a0"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </g>
                  </Show>

                  {/* Directional Chevrons Along The Path */}
                  <For each={cells.slice(0, -1)}>
                    {(from, idx) => {
                      const to = cells[idx() + 1];
                      const midX = (from.c * 100 + 50 + to.c * 100 + 50) / 2;
                      const midY = (from.r * 100 + 50 + to.r * 100 + 50) / 2;
                      const rot =
                        to.r > from.r ? 90 : to.r < from.r ? -90 : to.c > from.c ? 0 : 180;

                      return (
                        <path
                          d="M -5 -7 L 4 0 L -5 7"
                          fill="none"
                          stroke="var(--ink)"
                          stroke-width="3.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          transform={`translate(${midX}, ${midY}) rotate(${rot})`}
                        />
                      );
                    }}
                  </For>
                </g>
              );
            }}
          </For>

          {/* 2. Live Active Drawing Path */}
          <Show when={path().length > 0}>
            {(() => {
              const cells = path();
              const color = "var(--pop-yellow)";
              const pathD =
                cells.length > 1
                  ? `M ${cells[0].c * 100 + 50} ${cells[0].r * 100 + 50} ` +
                    cells
                      .slice(1)
                      .map((c) => `L ${c.c * 100 + 50} ${c.r * 100 + 50}`)
                      .join(" ")
                  : "";

              return (
                <g>
                  <Show
                    when={cells.length > 1}
                    fallback={
                      <circle
                        cx={cells[0].c * 100 + 50}
                        cy={cells[0].r * 100 + 50}
                        r="39"
                        fill={color}
                      />
                    }
                  >
                    <path
                      d={pathD}
                      fill="none"
                      stroke={color}
                      stroke-width="78"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </Show>

                  {/* Start Node Disc */}
                  <circle
                    cx={cells[0].c * 100 + 50}
                    cy={cells[0].r * 100 + 50}
                    r="38"
                    fill={color}
                    stroke="#ffffff"
                    stroke-width="5"
                  />

                  {/* Live Directional Chevrons */}
                  <For each={cells.slice(0, -1)}>
                    {(from, idx) => {
                      const to = cells[idx() + 1];
                      const midX = (from.c * 100 + 50 + to.c * 100 + 50) / 2;
                      const midY = (from.r * 100 + 50 + to.r * 100 + 50) / 2;
                      const rot =
                        to.r > from.r ? 90 : to.r < from.r ? -90 : to.c > from.c ? 0 : 180;

                      return (
                        <path
                          d="M -5 -7 L 4 0 L -5 7"
                          fill="none"
                          stroke="var(--ink)"
                          stroke-width="3.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          transform={`translate(${midX}, ${midY}) rotate(${rot})`}
                        />
                      );
                    }}
                  </For>
                </g>
              );
            })()}
          </Show>
        </svg>

        {/* Interactive Buttons & Letters Layer */}
        <div
          class="absolute inset-0 grid w-full h-full select-none"
          style={{
            "grid-template-columns": `repeat(${props.view.size}, 1fr)`,
            "z-index": 5,
          }}
        >
          <For each={props.view.grid}>
            {(row, r) => (
              <For each={row}>
                {(letter, c) => {
                  const wall = () => isWall(r(), c());

                  return (
                    <button
                      type="button"
                      data-cell={`${r()},${c()}`}
                      onClick={() => {
                        if (!drawing() && path().length <= 1) tapCell(r(), c());
                      }}
                      disabled={props.disabled || wall()}
                      aria-label={
                        wall() ? "Wall" : `Row ${r() + 1} column ${c() + 1}, letter ${letter}`
                      }
                      class="relative transition-transform select-none"
                      style={{
                        "aspect-ratio": "1 / 1",
                        display: "grid",
                        "place-items": "center",
                        "font-family": "var(--font-stack-display)",
                        "font-weight": 800,
                        "font-size": "clamp(1.1rem, 5.5vw, 1.65rem)",
                        color: "var(--ink)",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: props.disabled || wall() ? "default" : "pointer",
                      }}
                    >
                      <span class="relative select-none">{letter}</span>
                    </button>
                  );
                }}
              </For>
            )}
          </For>
        </div>
      </div>

      {/* Target Word Bank & Found Words Display */}
      <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
        <For each={found().filter((e) => e.isTarget !== false)}>
          {(entry, i) => (
            <span
              class="badge text-xs font-black px-3 py-1 inline-flex items-center gap-1.5 shadow-xs"
              style={{
                background: PATH_POPS[i() % PATH_POPS.length],
                border: "2px solid var(--ink)",
                color: "var(--ink)",
              }}
            >
              <span
                class="w-3.5 h-3.5 rounded-full bg-white/95 text-[9px] font-black grid place-items-center"
                style={{ border: "1px solid var(--ink)" }}
              >
                ✓
              </span>
              <span class="tracking-wider">{entry.word}</span>
            </span>
          )}
        </For>
        <For each={remainingLengths()}>
          {(length) => (
            <span
              class="badge text-xs font-extrabold px-3 py-1 inline-flex items-center gap-1.5 opacity-80"
              style={{
                background: "var(--paper-2)",
                border: "2px dashed var(--ink)",
                color: "var(--ink)",
              }}
            >
              <span class="tracking-widest font-mono">{"• ".repeat(length).trim()}</span>
              <span class="text-[10px] opacity-75">({length}L)</span>
            </span>
          )}
        </For>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p class="comment">every tile belongs to exactly one word. tap a word to release.</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-ghost text-xs px-3 py-1"
            onClick={undo}
            disabled={props.disabled || (path().length === 0 && found().length === 0)}
          >
            Undo
          </button>
          <button
            type="button"
            class="btn-ghost text-xs px-3 py-1"
            onClick={reset}
            disabled={props.disabled || (path().length === 0 && found().length === 0)}
          >
            Reset
          </button>
        </div>
      </div>

      <Show when={flash()}>
        <p class="comment">{flash()}</p>
      </Show>
    </div>
  );
}
