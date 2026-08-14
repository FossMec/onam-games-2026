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
      const at = pool.indexOf(entry.word.length);
      if (at !== -1) pool.splice(at, 1);
    }
    return pool;
  });

  const commit = (next: WendFound[]) => {
    setFound(next);
    props.onProgress?.(next);
    const cells = next.reduce((n, entry) => n + entry.cells.length, 0);
    // Both conditions, always: every word found AND every tile covered. The
    // second one is the actual puzzle.
    if (next.length === props.view.wordLengths.length && cells === props.view.openCells) {
      props.onFinish({ found: next });
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
    // Dragging back over the previous tile retraces — the natural undo for a
    // gesture, and the reason this does not need a separate undo while drawing.
    if (current.length > 1 && key(current[current.length - 2]) === k) {
      setPath(current.slice(0, -1));
      return;
    }
    if (inPath().has(k)) return;
    if (!adjacent(current[current.length - 1], cell)) return;

    const longest = Math.max(...remainingLengths());
    if (current.length + 1 > longest) return;
    setPath([...current, cell]);
  };

  /** Lets go of the trace and asks the server whether it spelled anything. */
  const release = async () => {
    setDrawing(false);
    const cells = path();
    if (cells.length < 3) {
      setPath([]);
      return;
    }
    if (!props.onTrace) {
      setPath([]);
      return;
    }

    setChecking(true);
    try {
      const word = await props.onTrace(cells);
      if (word && !found().some((f) => f.word === word)) {
        commit([...found(), { word, cells }]);
        setFlash("");
      } else {
        setFlash(word ? "Already found that one." : "Not a word.");
      }
    } catch {
      setFlash("Could not check that. Try again.");
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

  const fillFor = (r: number, c: number): string => {
    if (isWall(r, c)) return "var(--ink)";
    const owner = lockedCells().get(key({ r, c }));
    if (owner !== undefined) return PATH_POPS[owner % PATH_POPS.length];
    if (inPath().has(key({ r, c }))) return "var(--pop-yellow)";
    return "var(--paper-2)";
  };

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {covered()}/{props.view.openCells} tiles
        </span>
        <Show
          when={path().length > 0}
          fallback={
            <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
              {checking() ? "checking…" : "drag to trace a word"}
            </span>
          }
        >
          <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
            {path().map(letterAt).join("")}
          </span>
        </Show>
      </div>

      <div
        class="mx-auto grid w-full select-none"
        style={{
          "max-width": "min(100%, 26rem)",
          "grid-template-columns": `repeat(${props.view.size}, 1fr)`,
          "aspect-ratio": "1 / 1",
          gap: "2px",
          background: "var(--ink)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-radius": "var(--radius)",
          // Without this the browser claims the gesture for scrolling and the
          // drag never reaches us — which is exactly how this game gets ruined.
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
                      // Only handle real taps; a drag already resolved itself.
                      if (!drawing() && path().length <= 1) tapCell(r(), c());
                    }}
                    disabled={props.disabled || wall()}
                    aria-label={
                      wall() ? "Wall" : `Row ${r() + 1} column ${c() + 1}, letter ${letter}`
                    }
                    style={{
                      "aspect-ratio": "1 / 1",
                      display: "grid",
                      "place-items": "center",
                      "font-family": "var(--font-stack-display)",
                      "font-weight": 800,
                      "font-size": "clamp(0.9rem, 5vw, 1.5rem)",
                      color: "var(--ink)",
                      background: fillFor(r(), c()),
                      border: "none",
                      "border-radius": "4px",
                      padding: 0,
                      cursor: props.disabled || wall() ? "default" : "pointer",
                    }}
                  >
                    {letter}
                  </button>
                );
              }}
            </For>
          )}
        </For>
      </div>

      {/*
        Lengths, not words. This is the only clue the player gets, and giving
        any more of it away would be giving away the puzzle.
      */}
      <div class="flex flex-wrap items-center justify-center gap-2">
        <For each={found()}>
          {(entry, i) => (
            <span class="badge" style={{ "--pop": PATH_POPS[i() % PATH_POPS.length] }}>
              {entry.word}
            </span>
          )}
        </For>
        <For each={remainingLengths()}>
          {(length) => (
            <span class="badge" style={{ "--pop": "var(--paper-2)" }}>
              {"?".repeat(length)}
            </span>
          )}
        </For>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="comment">every tile belongs to exactly one word. no leftovers.</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-ghost"
            onClick={undo}
            disabled={props.disabled || (path().length === 0 && found().length === 0)}
          >
            Undo
          </button>
          <button type="button" class="btn-ghost" onClick={reset} disabled={props.disabled}>
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
