import { For, Show, createMemo, createSignal, onMount } from "solid-js";

/**
 * Pookalam Jigsaw board.
 *
 * Piece outlines are built from the seeded edge specs the server sends, so
 * every player gets differently-shaped tabs over the same artwork. The image
 * is painted through a clip path — it is only a texture, which is what makes
 * swapping the artwork a one-line change.
 *
 * Interaction is tap-to-select then tap-to-place, not free drag. On a phone,
 * dragging 25 small pieces around a 5x5 board is miserable and drops pieces
 * behind the tray; tapping is unambiguous, works with one thumb, and is
 * accessible for free.
 */

export interface JigsawTab {
  dir: 1 | -1;
  offset: number;
  neck: number;
  head: number;
  skew: number;
}

export interface JigsawViewData {
  kind: "jigsaw";
  cols: number;
  rows: number;
  imageUrl: string;
  hEdges: JigsawTab[][];
  vEdges: JigsawTab[][];
  trayOrder: number[];
}

interface Move {
  p: number;
  s: number;
  t: number;
}

export interface JigsawProgress {
  placement: (number | null)[];
  moveLog: Move[];
}

export interface JigsawGameProps {
  view: JigsawViewData;
  startedAt: number;
  onFinish: (submission: { placement: (number | null)[]; moveLog: Move[] }) => void;
  disabled?: boolean;
  /** Placement and moves from a previous visit. */
  initialProgress?: JigsawProgress | null;
  onProgress?: (progress: JigsawProgress) => void;
}

/** Unit cell; the SVG is scaled by viewBox so this never needs pixels. */
const CELL = 100;

/**
 * One edge of a piece, from `from` to `to` in unit space.
 *
 * `sign` flips the tab so two neighbours interlock: the same edge spec drawn
 * from one side must be the exact negative of the other, or the pieces will
 * not marry up.
 */
function edgePath(
  from: [number, number],
  to: [number, number],
  tab: JigsawTab | null,
  sign: number,
): string {
  if (!tab) return `L ${to[0]} ${to[1]}`;

  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  // Perpendicular, pointing "out" of the piece.
  const nx = -dy;
  const ny = dx;
  const bulge = tab.dir * sign * tab.head;

  const at = (t: number, out: number): [number, number] => [
    from[0] + dx * t + nx * out,
    from[1] + dy * t + ny * out,
  ];

  const a = tab.offset - tab.neck;
  const b = tab.offset + tab.neck;
  const skew = tab.skew;

  const p1 = at(a, 0);
  const c1 = at(a + tab.neck * 0.2, bulge * 0.35);
  const c2 = at(a - tab.neck * 0.5 + skew, bulge * 1.15);
  const p2 = at(tab.offset + skew, bulge * 1.25);
  const c3 = at(b + tab.neck * 0.5 + skew, bulge * 1.15);
  const c4 = at(b - tab.neck * 0.2, bulge * 0.35);
  const p3 = at(b, 0);

  return (
    `L ${p1[0]} ${p1[1]} ` +
    `C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]} ` +
    `C ${c3[0]} ${c3[1]} ${c4[0]} ${c4[1]} ${p3[0]} ${p3[1]} ` +
    `L ${to[0]} ${to[1]}`
  );
}

export function JigsawGame(props: JigsawGameProps) {
  const cols = () => props.view.cols;
  const rows = () => props.view.rows;
  const count = () => cols() * rows();

  const [placement, setPlacement] = createSignal<(number | null)[]>([]);
  const [tray, setTray] = createSignal<number[]>([]);
  const [selected, setSelected] = createSignal<number | null>(null);
  const [moveLog, setMoveLog] = createSignal<Move[]>([]);

  onMount(() => {
    const saved = props.initialProgress;
    if (saved && saved.placement.length === count()) {
      // Tray is derived rather than stored: it is exactly the pieces not on the
      // board, so keeping a second copy would only create a way for the two to
      // disagree after a restore.
      const placed = new Set(saved.placement.filter((id): id is number => id !== null));
      setPlacement(saved.placement.slice());
      setMoveLog(saved.moveLog.slice());
      setTray(props.view.trayOrder.filter((id) => !placed.has(id)));
      return;
    }
    setPlacement(Array.from<number | null>({ length: count() }).fill(null));
    setTray(props.view.trayOrder.slice());
  });

  /**
   * Outline for piece `id`, in its own local box. Each of the four edges is
   * looked up from the shared edge grid so neighbours always interlock.
   */
  const piecePath = (id: number): string => {
    const c = id % cols();
    const r = Math.floor(id / cols());
    const x0 = 0;
    const y0 = 0;
    const x1 = CELL;
    const y1 = CELL;

    const top = r > 0 ? props.view.hEdges[r - 1][c] : null;
    const bottom = r < rows() - 1 ? props.view.hEdges[r][c] : null;
    const left = c > 0 ? props.view.vEdges[r][c - 1] : null;
    const right = c < cols() - 1 ? props.view.vEdges[r][c] : null;

    // Signs chosen so a shared edge is drawn as exact negatives from each side.
    return (
      `M ${x0} ${y0} ` +
      edgePath([x0, y0], [x1, y0], top, -1) +
      edgePath([x1, y0], [x1, y1], right, 1) +
      edgePath([x1, y1], [x0, y1], bottom, 1) +
      edgePath([x0, y1], [x0, y0], left, -1) +
      "Z"
    );
  };

  const paths = createMemo(() => Array.from({ length: count() }, (_, id) => piecePath(id)));

  const place = (slot: number) => {
    const piece = selected();
    if (props.disabled || piece === null) return;

    const next = placement().slice();
    // Moving a piece vacates wherever it was; the server replay assumes this.
    const previous = next.indexOf(piece);
    if (previous !== -1) next[previous] = null;

    const displaced = next[slot];
    next[slot] = piece;
    setPlacement(next);
    setTray((t) => {
      const without = t.filter((p) => p !== piece);
      return displaced != null ? [...without, displaced] : without;
    });
    setSelected(null);

    // Build the log explicitly rather than reading the signal back after
    // setting it — that read already includes this move, so appending again
    // double-counted the final placement.
    const nextLog = [...moveLog(), { p: piece, s: slot, t: Date.now() - props.startedAt }];
    setMoveLog(nextLog);

    if (next.every((p, i) => p === i)) {
      props.onFinish({ placement: next, moveLog: nextLog });
    }
  };

  const takeBack = (slot: number) => {
    if (props.disabled) return;
    const piece = placement()[slot];
    if (piece == null) return;
    const next = placement().slice();
    next[slot] = null;
    setPlacement(next);
    setTray((t) => [...t, piece]);
    setSelected(piece);
  };

  /** The piece's own window onto the artwork. */
  const PieceImage = (p: { id: number; interactive: boolean }) => {
    const c = p.id % cols();
    const r = Math.floor(p.id / cols());
    const clipId = `clip-${p.id}`;
    // Overdraw so tabs that bulge outside the cell still show artwork.
    const pad = CELL * 0.35;
    return (
      <svg
        viewBox={`${-pad} ${-pad} ${CELL + pad * 2} ${CELL + pad * 2}`}
        style={{ width: "100%", height: "100%", overflow: "visible", display: "block" }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={paths()[p.id]} />
          </clipPath>
        </defs>
        <g clip-path={`url(#${clipId})`}>
          <image
            href={props.view.imageUrl}
            x={-c * CELL}
            y={-r * CELL}
            width={cols() * CELL}
            height={rows() * CELL}
            preserveAspectRatio="none"
          />
        </g>
        <path
          d={paths()[p.id]}
          fill="none"
          stroke="var(--ink)"
          stroke-width={p.interactive ? 3 : 2}
        />
      </svg>
    );
  };

  const remaining = () => placement().filter((p) => p === null).length;

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {cols()}x{rows()}
        </span>
        <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
          {remaining()} to place
        </span>
      </div>

      {/* Board. Square, so it never reflows as pieces land. */}
      <div
        class="mx-auto grid w-full max-w-md"
        style={{
          "grid-template-columns": `repeat(${cols()}, 1fr)`,
          "aspect-ratio": "1 / 1",
          background: "var(--paper-3)",
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        <For each={placement()}>
          {(piece, slot) => (
            <button
              type="button"
              class="relative"
              style={{
                "aspect-ratio": "1 / 1",
                background: "transparent",
                border: "1px dashed rgb(34 32 43 / 0.25)",
                padding: 0,
                cursor: props.disabled ? "default" : "pointer",
              }}
              onClick={() => (piece == null ? place(slot()) : takeBack(slot()))}
              aria-label={
                piece == null ? `Empty slot ${slot() + 1}` : `Piece in slot ${slot() + 1}`
              }
            >
              <Show when={piece != null}>
                <PieceImage id={piece!} interactive={false} />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Tray */}
      <div
        class="flex flex-wrap justify-center gap-1.5 rounded p-2"
        style={{ background: "var(--paper-3)", border: "var(--ink-w) solid var(--ink)" }}
      >
        <Show
          when={tray().length > 0}
          fallback={
            <p class="comment">tray empty. if the board looks wrong, tap a piece to lift it.</p>
          }
        >
          <For each={tray()}>
            {(piece) => (
              <button
                type="button"
                class="anim-wiggle"
                style={{
                  width: "clamp(40px, 13vw, 62px)",
                  height: "clamp(40px, 13vw, 62px)",
                  background: selected() === piece ? "var(--pop-yellow)" : "transparent",
                  border:
                    selected() === piece
                      ? "var(--ink-w) solid var(--ink)"
                      : "2px solid transparent",
                  "border-radius": "6px",
                  padding: "2px",
                }}
                onClick={() => setSelected(selected() === piece ? null : piece)}
                aria-label={`Piece ${piece + 1}`}
                aria-pressed={selected() === piece}
              >
                <PieceImage id={piece} interactive />
              </button>
            )}
          </For>
        </Show>
      </div>

      <p class="comment">
        {selected() === null
          ? "tap a piece, then tap where it goes"
          : "now tap a slot on the board"}
      </p>
    </div>
  );
}
