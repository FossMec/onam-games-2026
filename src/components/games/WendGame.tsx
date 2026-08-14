import { For, Show, createMemo, createSignal } from "solid-js";

/**
 * Wend board — trace each word tile by tile.
 *
 * Tap a tile to start a path, then tap orthogonally adjacent tiles to extend
 * it. The path bends freely; it just cannot jump, cut a corner, cross a wall,
 * or reuse a tile another word already took. When the traced letters spell one
 * of the words, the path locks itself in.
 *
 * Tapping is not a fallback for dragging here — it is better. A drag across a
 * 6x6 grid on a phone fights the page scroll, and this puzzle needs you to
 * change your mind constantly, which a drag gesture handles badly.
 *
 * Everything is checked again on the server against a board rebuilt from the
 * player's own seed, so this component is free to be permissive and helpful.
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
  words: string[];
  openCells: number;
}

export interface WendGameProps {
  view: WendViewData;
  onFinish: (submission: { found: { word: string; cells: Cell[] }[] }) => void;
  disabled?: boolean;
  /** Restored mid-attempt progress, if the player is resuming. */
  initialFound?: { word: string; cells: Cell[] }[];
  /** Called whenever progress changes, so it can be persisted. */
  onProgress?: (found: { word: string; cells: Cell[] }[]) => void;
}

/** One colour per word, so a locked path reads as a unit. */
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
  const [found, setFound] = createSignal<{ word: string; cells: Cell[] }[]>(
    props.initialFound ?? [],
  );
  const [path, setPath] = createSignal<Cell[]>([]);
  const [flash, setFlash] = createSignal("");

  const letterAt = (cell: Cell) => props.view.grid[cell.r][cell.c];
  const isWall = (r: number, c: number) => props.view.grid[r][c] === "";

  const foundWords = createMemo(() => new Set(found().map((f) => f.word)));

  /** Cell -> index of the word that locked it. Drives colour and blocking. */
  const lockedCells = createMemo(() => {
    const map = new Map<string, number>();
    found().forEach((entry, i) => {
      for (const cell of entry.cells) map.set(key(cell), i);
    });
    return map;
  });

  const inPath = createMemo(() => new Set(path().map(key)));

  const covered = () => lockedCells().size + path().length;
  const traced = () => path().map(letterAt).join("");

  const commit = (next: { word: string; cells: Cell[] }[]) => {
    setFound(next);
    props.onProgress?.(next);
    // Done only when every word is found *and* every tile is covered — the
    // second half is the actual puzzle, so the UI must not celebrate early.
    const cells = next.reduce((n, entry) => n + entry.cells.length, 0);
    if (next.length === props.view.words.length && cells === props.view.openCells) {
      props.onFinish({ found: next });
    }
  };

  const tap = (r: number, c: number) => {
    if (props.disabled || isWall(r, c)) return;
    const cell = { r, c };
    const k = key(cell);
    setFlash("");

    // Tapping a locked word releases it, so a wrong-but-readable path is one
    // tap to undo rather than a reset.
    const owner = lockedCells().get(k);
    if (owner !== undefined) {
      commit(found().filter((_, i) => i !== owner));
      setPath([]);
      return;
    }

    const current = path();

    // Tapping the head of the trace steps back one tile.
    if (current.length > 0 && key(current[current.length - 1]) === k) {
      setPath(current.slice(0, -1));
      return;
    }
    if (inPath().has(k)) return;

    if (current.length === 0) {
      setPath([cell]);
      return;
    }
    if (!adjacent(current[current.length - 1], cell)) {
      setFlash("Words move up, down, left and right — one tile at a time.");
      return;
    }

    const next = [...current, cell];
    const word = next.map(letterAt).join("");
    const match = props.view.words.find((w) => !foundWords().has(w) && w === word);
    if (match) {
      commit([...found(), { word: match, cells: next }]);
      setPath([]);
      return;
    }

    // Stop the trace growing past the longest word still unfound.
    const longest = Math.max(
      ...props.view.words.filter((w) => !foundWords().has(w)).map((w) => w.length),
    );
    if (next.length > longest) {
      setFlash("That's longer than any word left.");
      return;
    }
    setPath(next);
  };

  const reset = () => {
    if (props.disabled) return;
    setPath([]);
    commit([]);
  };

  const clearTrace = () => setPath([]);

  const fillFor = (r: number, c: number): string => {
    if (isWall(r, c)) return "var(--ink)";
    const owner = lockedCells().get(key({ r, c }));
    if (owner !== undefined) return PATH_POPS[owner % PATH_POPS.length];
    if (inPath().has(key({ r, c }))) return "var(--paper-3)";
    return "var(--paper-2)";
  };

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {covered()}/{props.view.openCells} tiles
        </span>
        <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
          {found().length}/{props.view.words.length} words
        </span>
        <Show when={traced()}>
          <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
            {traced()}
          </span>
        </Show>
      </div>

      <div
        class="mx-auto grid w-full"
        style={{
          "max-width": "min(100%, 26rem)",
          "grid-template-columns": `repeat(${props.view.size}, 1fr)`,
          "aspect-ratio": "1 / 1",
          gap: "2px",
          background: "var(--ink)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-radius": "var(--radius)",
        }}
      >
        <For each={props.view.grid}>
          {(row, r) => (
            <For each={row}>
              {(letter, c) => {
                const wall = () => isWall(r(), c());
                const head = () => {
                  const p = path();
                  return p.length > 0 && key(p[p.length - 1]) === key({ r: r(), c: c() });
                };
                return (
                  <button
                    type="button"
                    onClick={() => tap(r(), c())}
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
                      // Scales with the board, not the viewport, so it stays
                      // right inside the 26rem cap on a big screen too.
                      "font-size": "clamp(0.9rem, 5vw, 1.5rem)",
                      color: "var(--ink)",
                      background: fillFor(r(), c()),
                      border: head() ? "3px solid var(--ink)" : "none",
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

      <div class="flex flex-wrap justify-center gap-2">
        <For each={props.view.words}>
          {(word) => (
            <span
              class="badge"
              style={{
                "--pop": foundWords().has(word)
                  ? PATH_POPS[found().findIndex((f) => f.word === word) % PATH_POPS.length]
                  : "var(--paper-2)",
                "text-decoration": foundWords().has(word) ? "line-through" : "none",
              }}
            >
              {word}
            </span>
          )}
        </For>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="comment">every tile belongs to exactly one word. no leftovers.</p>
        <div class="flex gap-2">
          <Show when={path().length > 0}>
            <button type="button" class="btn-ghost" onClick={clearTrace}>
              Clear trace
            </button>
          </Show>
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
