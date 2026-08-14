import { For, Show, createMemo, createSignal } from "solid-js";

/**
 * Wend board — tap the first letter, then the last.
 *
 * Same reasoning as the jigsaw: dragging a finger across an 8x8 grid of small
 * targets on a phone is imprecise and fights the page scroll. Two taps are
 * unambiguous and work one-handed.
 *
 * Matching is done locally because there is nothing to hide — the player can
 * already see the grid and the word list. The server still re-checks every
 * claimed run against its own transformed placement at finish, so a forged
 * submission gains nothing.
 */

export interface Cell {
  r: number;
  c: number;
}

export interface WendViewData {
  kind: "wend";
  size: number;
  grid: string[][];
  words: string[];
}

export interface WendGameProps {
  view: WendViewData;
  onFinish: (submission: { found: { word: string; cells: Cell[] }[] }) => void;
  disabled?: boolean;
}

/** The straight run between two cells, or null if they do not line up. */
function runBetween(a: Cell, b: Cell): Cell[] | null {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  if (len === 0) return null;
  // Must be horizontal, vertical, or a true 45-degree diagonal.
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;

  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  return Array.from({ length: len + 1 }, (_, i) => ({
    r: a.r + stepR * i,
    c: a.c + stepC * i,
  }));
}

export function WendGame(props: WendGameProps) {
  const [anchor, setAnchor] = createSignal<Cell | null>(null);
  const [found, setFound] = createSignal<{ word: string; cells: Cell[] }[]>([]);
  const [flash, setFlash] = createSignal<"hit" | "miss" | null>(null);

  const foundWords = createMemo(() => new Set(found().map((f) => f.word)));
  const foundCells = createMemo(() => {
    const set = new Set<string>();
    for (const entry of found()) for (const cell of entry.cells) set.add(`${cell.r},${cell.c}`);
    return set;
  });

  const letters = (cells: Cell[]) => cells.map((cell) => props.view.grid[cell.r][cell.c]).join("");

  const tap = (r: number, c: number) => {
    if (props.disabled) return;
    const start = anchor();
    if (!start) {
      setAnchor({ r, c });
      setFlash(null);
      return;
    }
    if (start.r === r && start.c === c) {
      setAnchor(null);
      return;
    }

    const cells = runBetween(start, { r, c });
    setAnchor(null);
    if (!cells) {
      setFlash("miss");
      return;
    }

    const word = letters(cells);
    // Reverse the cells, not the string: the grid is single ASCII letters, but
    // reversing cells is the operation we actually mean and cannot mangle.
    const reversed = letters([...cells].reverse());
    const match = props.view.words.find(
      (w) => !foundWords().has(w) && (w === word || w === reversed),
    );
    if (!match) {
      setFlash("miss");
      return;
    }

    const next = [...found(), { word: match, cells }];
    setFound(next);
    setFlash("hit");
    if (next.length === props.view.words.length) props.onFinish({ found: next });
  };

  const isAnchor = (r: number, c: number) => anchor()?.r === r && anchor()?.c === c;

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {found().length}/{props.view.words.length} found
        </span>
        <span
          class="badge"
          style={{ "--pop": flash() === "miss" ? "var(--pop-red)" : "var(--pop-yellow)" }}
        >
          {anchor() ? "now tap the last letter" : "tap the first letter"}
        </span>
      </div>

      <div
        class="mx-auto grid w-full max-w-md"
        style={{
          "grid-template-columns": `repeat(${props.view.size}, 1fr)`,
          "aspect-ratio": "1 / 1",
          background: "var(--paper-2)",
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        <For each={props.view.grid}>
          {(row, r) => (
            <For each={row}>
              {(letter, c) => {
                const done = () => foundCells().has(`${r()},${c()}`);
                return (
                  <button
                    type="button"
                    onClick={() => tap(r(), c())}
                    style={{
                      "aspect-ratio": "1 / 1",
                      display: "grid",
                      "place-items": "center",
                      "font-family": "var(--font-stack-display)",
                      "font-weight": 800,
                      "font-size": "clamp(0.8rem, 3.4vw, 1.2rem)",
                      color: "var(--ink)",
                      background: isAnchor(r(), c())
                        ? "var(--pop-yellow)"
                        : done()
                          ? "var(--pop-teal)"
                          : "transparent",
                      border: "1px solid rgb(34 32 43 / 0.18)",
                      padding: 0,
                      cursor: props.disabled ? "default" : "pointer",
                    }}
                    aria-label={`Row ${r() + 1} column ${c() + 1}, letter ${letter}`}
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
                "--pop": foundWords().has(word) ? "var(--pop-teal)" : "var(--paper-3)",
                "text-decoration": foundWords().has(word) ? "line-through" : "none",
                opacity: foundWords().has(word) ? 0.65 : 1,
              }}
            >
              {word}
            </span>
          )}
        </For>
      </div>

      <Show when={flash() === "miss"}>
        <p class="comment">not a word. straight lines only — across, down, or diagonal.</p>
      </Show>
    </div>
  );
}
