import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { edgesForPiece, pieceOutline, type JigsawTab } from "~/lib/jigsaw-shape";

/**
 * Pookalam Jigsaw board.
 *
 * A real jigsaw: every piece is loose on one board, you drag them around, and
 * when two pieces that genuinely belong together come close enough they snap
 * and from then on move as one lump. Finish when everything is a single lump.
 *
 * This replaces a tray-and-slots version where you tapped a piece and then
 * tapped a grid cell. That was easier to build and easier to verify, and it
 * was not a jigsaw — it never connected anything, so none of the satisfaction
 * of a jigsaw was there. Groups are the whole point.
 *
 * The win condition is "one group", not "pieces at the correct absolute
 * position". A finished jigsaw can sit anywhere on the table.
 *
 * Piece outlines come from the seeded edge specs the server sends, so tabs
 * differ per player over the same artwork. The image is painted through a clip
 * path — it is only a texture, which is what keeps swapping the artwork a
 * one-line change.
 */

export type { JigsawTab };

export interface JigsawViewData {
  kind: "jigsaw";
  cols: number;
  rows: number;
  imageUrl: string;
  hEdges: JigsawTab[][];
  vEdges: JigsawTab[][];
  /** Starting position of each piece, in cell units. */
  scatter: { id: number; x: number; y: number }[];
}

/** A drag that ended. Timing evidence, not a correctness record. */
interface Move {
  p: number;
  t: number;
}

interface Piece {
  id: number;
  /** Pieces sharing a groupId move together and are already joined. */
  groupId: number;
  /** Position of the piece's top-left, in cell units. */
  x: number;
  y: number;
}

export interface JigsawProgress {
  pieces: Piece[];
  moveLog: Move[];
}

export interface JigsawGameProps {
  view: JigsawViewData;
  startedAt: number;
  onFinish: (submission: {
    layout: { id: number; gx: number; gy: number }[];
    moveLog: Move[];
  }) => void;
  disabled?: boolean;
  initialProgress?: JigsawProgress | null;
  onProgress?: (progress: JigsawProgress) => void;
}

/** Unit cell for the SVG; the viewBox scales it, so this never needs pixels. */
const CELL = 100;

/** How much bigger the board is than the finished picture. Matches the server. */
const SPREAD = 1.6;

/** How close two pieces must be to snap, in cell units. */
const SNAP = 0.3;

/*
 * Piece outlines live in `~/lib/jigsaw-shape`, which is where the rule that a
 * shared edge must be the identical curve from both sides is enforced and
 * tested. That used to be done inline here, and got it wrong: an off-centre tab
 * came out mirrored when its neighbour drew it, so the knob and the hole sat in
 * different places along the edge and the pieces visibly did not fit.
 */

/**
 * Decides what the board opens with: restored progress, or a fresh scatter.
 *
 * Pulled out of `onMount` and exported so it can be tested, because the bug it
 * exists to prevent lives exactly here and is invisible to a server render —
 * `onMount` does not run during SSR, so a test that only renders the component
 * proves nothing about this path.
 *
 * Restored state is untrusted input, not a local variable. It comes from
 * localStorage, where an older version of this component may have written it,
 * and from the finished-board path, which handed over a *submission*
 * (`{ layout }`) where progress (`{ pieces }`) was expected. `initialProgress`
 * is typed as though that cannot happen, so the mismatch surfaced as a runtime
 * crash reading `.length` of undefined rather than as a type error. Anything
 * that is not the shape it claims to be is discarded for a fresh scatter:
 * losing a half-finished board is bad, but a board that will not render at all
 * is worse, and the server still owns the clock either way.
 */
export function restoreBoard(
  saved: JigsawProgress | null | undefined,
  view: Pick<JigsawViewData, "scatter">,
  count: number,
): { pieces: Piece[]; moveLog: Move[] } {
  if (Array.isArray(saved?.pieces) && saved.pieces.length === count) {
    return {
      pieces: saved.pieces.map((p) => ({ ...p })),
      moveLog: Array.isArray(saved.moveLog) ? saved.moveLog.slice() : [],
    };
  }
  // Each piece starts in its own group, which is what "loose on the board"
  // means: no two pieces are joined yet.
  return {
    pieces: (view.scatter ?? []).map((s) => ({ id: s.id, groupId: s.id, x: s.x, y: s.y })),
    moveLog: [],
  };
}

export function JigsawGame(props: JigsawGameProps) {
  let board: HTMLDivElement | undefined;

  const cols = () => props.view.cols;
  const rows = () => props.view.rows;
  const count = () => cols() * rows();

  const [pieces, setPieces] = createSignal<Piece[]>([]);
  const [moveLog, setMoveLog] = createSignal<Move[]>([]);
  /** The group currently under the finger, drawn on top of everything else. */
  const [activeGroup, setActiveGroup] = createSignal<number | null>(null);

  onMount(() => {
    const restored = restoreBoard(props.initialProgress, props.view, count());
    setPieces(restored.pieces);
    setMoveLog(restored.moveLog);
  });

  const homeOf = (id: number) => ({ x: id % cols(), y: Math.floor(id / cols()) });

  const groupCount = createMemo(() => new Set(pieces().map((p) => p.groupId)).size);
  const solved = () => pieces().length > 0 && groupCount() === 1;

  /**
   * The window onto the board, in cell units.
   *
   * While playing it is the whole scattered area — pieces need somewhere to
   * live. The moment the puzzle comes together that space is dead weight: the
   * finished pookalam sat in a corner at a third of the width with two thirds
   * of the panel empty, which is a poor look at the one moment the player has
   * earned a good one. Solved, the view crops to the picture itself.
   *
   * The margin leaves room for tabs on the outer edge, which bulge up to 0.325
   * of a cell beyond the piece.
   */
  const MARGIN = 0.4;
  const viewport = createMemo(() => {
    if (!solved()) {
      return { ox: 0, oy: 0, w: cols() * SPREAD, h: rows() * SPREAD };
    }
    const xs = pieces().map((p) => p.x);
    const ys = pieces().map((p) => p.y);
    return {
      ox: Math.min(...xs) - MARGIN,
      oy: Math.min(...ys) - MARGIN,
      w: cols() + MARGIN * 2,
      h: rows() + MARGIN * 2,
    };
  });

  const report = (next: Piece[], log: Move[]) => {
    props.onProgress?.({ pieces: next, moveLog: log });
  };

  /* ------------------------------------------------------------ dragging */

  let pointerId: number | null = null;
  let origin = { x: 0, y: 0 };
  let startPositions: Piece[] = [];

  /** Board width in px per cell unit — everything is stored in cell units. */
  const unit = () => (board?.getBoundingClientRect().width ?? 1) / viewport().w;

  const onPointerDown = (event: PointerEvent, piece: Piece) => {
    if (props.disabled || solved()) return;
    event.preventDefault();
    pointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    origin = { x: event.clientX, y: event.clientY };
    startPositions = pieces().map((p) => ({ ...p }));
    setActiveGroup(piece.groupId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId || activeGroup() === null) return;
    const scale = unit();
    const dx = (event.clientX - origin.x) / scale;
    const dy = (event.clientY - origin.y) / scale;
    const group = activeGroup();
    setPieces(
      startPositions.map((p) => (p.groupId === group ? { ...p, x: p.x + dx, y: p.y + dy } : p)),
    );
  };

  /**
   * Looks for a join and, if it finds one, snaps the dragged group onto it.
   *
   * For every piece in the moved group, check every piece outside it: if the
   * two are grid neighbours and the outside one is sitting close to where it
   * would be if they were joined, that is a match. The whole dragged group then
   * shifts by the offset that makes the join exact, so the pieces already stuck
   * to it come along and stay aligned.
   */
  const trySnap = (current: Piece[], group: number): Piece[] | null => {
    const inGroup = current.filter((p) => p.groupId === group);
    for (const active of inGroup) {
      const activeHome = homeOf(active.id);
      for (const other of current) {
        if (other.groupId === group) continue;
        const otherHome = homeOf(other.id);
        const dRow = otherHome.y - activeHome.y;
        const dCol = otherHome.x - activeHome.x;
        // Grid neighbours only — pieces that do not touch cannot join.
        if (Math.abs(dRow) + Math.abs(dCol) !== 1) continue;

        // Where `other` would sit if the two were correctly joined.
        const wantX = active.x + dCol;
        const wantY = active.y + dRow;
        if (Math.hypot(other.x - wantX, other.y - wantY) > SNAP) continue;

        const offsetX = other.x - wantX;
        const offsetY = other.y - wantY;
        return current.map((p) =>
          p.groupId === group
            ? { ...p, x: p.x + offsetX, y: p.y + offsetY, groupId: other.groupId }
            : p,
        );
      }
    }
    return null;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    const group = activeGroup();
    setActiveGroup(null);
    if (group === null) return;

    let next = pieces();
    // Keep snapping: one drag can close two joins at once, and leaving the
    // second one unmade would look broken.
    for (let pass = 0; pass < count(); pass += 1) {
      const snapped = trySnap(next, next.find((p) => p.groupId === group)?.groupId ?? group);
      if (!snapped) break;
      next = snapped;
    }
    setPieces(next);

    const log = [...moveLog(), { p: group, t: Math.max(0, Date.now() - props.startedAt) }];
    setMoveLog(log);
    report(next, log);

    if (new Set(next.map((p) => p.groupId)).size === 1) {
      /*
       * Positions are floats — the assembled picture sits wherever the player
       * left it. They are reported relative to piece 0 and rounded, which is
       * exact because every piece in a group shares the same fractional offset.
       */
      const anchor = next.find((p) => p.id === 0)!;
      props.onFinish({
        layout: next.map((p) => ({
          id: p.id,
          gx: Math.round(p.x - anchor.x),
          gy: Math.round(p.y - anchor.y),
        })),
        moveLog: log,
      });
    }
  };

  /* ---------------------------------------------------------------- art */

  const paths = createMemo(() => {
    const out: string[] = [];
    for (let id = 0; id < count(); id += 1) {
      out.push(
        pieceOutline(CELL, edgesForPiece(id, cols(), rows(), props.view.hEdges, props.view.vEdges)),
      );
    }
    return out;
  });

  const instanceId = Math.random().toString(36).slice(2, 8);

  const PieceArt = (p: { id: number }) => {
    const c = p.id % cols();
    const r = Math.floor(p.id / cols());
    const clipId = `jig-clip-${instanceId}-${p.id}`;
    // Overdraw so tabs bulging outside the cell still carry artwork.
    const pad = CELL * 0.35;
    return (
      <svg
        viewBox={`${-pad} ${-pad} ${CELL + pad * 2} ${CELL + pad * 2}`}
        style={{
          position: "absolute",
          // The SVG is bigger than the cell so the tabs have somewhere to go;
          // it is offset back by exactly the padding to stay aligned.
          left: `${(-pad / CELL) * 100}%`,
          top: `${(-pad / CELL) * 100}%`,
          width: `${((CELL + pad * 2) / CELL) * 100}%`,
          height: `${((CELL + pad * 2) / CELL) * 100}%`,
          overflow: "visible",
          "pointer-events": "none",
        }}
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
          stroke-width={3}
          stroke-linejoin="round"
        />
      </svg>
    );
  };

  const pieceIds = createMemo(() => Array.from({ length: count() }, (_, i) => i));

  return (
    <div class="mx-auto flex h-full w-full flex-col justify-between space-y-2 text-center">
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {count() - groupCount() + 1}/{count()} joined
        </span>
        <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
          {solved() ? "done" : "drag pieces together"}
        </span>
      </div>

      <div
        ref={(el) => (board = el)}
        class="relative mx-auto my-auto w-full max-h-[min(60dvh,460px)]"
        style={{
          "max-width": "min(100%, 34rem)",
          "aspect-ratio": `${viewport().w} / ${viewport().h}`,
          background: "var(--paper-2)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-radius": "var(--radius)",
          // Without this the browser takes the drag for scrolling and pieces
          // simply never move on a phone.
          "touch-action": "none",
          overflow: "hidden",
        }}
      >
        <For each={pieceIds()}>
          {(id) => {
            const piece = () => pieces().find((p) => p.id === id);
            return (
              <Show when={piece()}>
                <div
                  role="button"
                  tabindex="0"
                  aria-label={`Piece ${id + 1}`}
                  onPointerDown={(e) => onPointerDown(e, piece()!)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${((piece()!.x - viewport().ox) / viewport().w) * 100}%`,
                    top: `${((piece()!.y - viewport().oy) / viewport().h) * 100}%`,
                    width: `${(1 / viewport().w) * 100}%`,
                    height: `${(1 / viewport().h) * 100}%`,
                    cursor: props.disabled || solved() ? "default" : "grab",
                    "z-index": piece()!.groupId === activeGroup() ? 20 : 1,
                    "touch-action": "none",
                    // Only once nothing can move again, so a drag is never animated.
                    transition: solved() ? "left 320ms ease, top 320ms ease" : "none",
                  }}
                >
                  <PieceArt id={id} />
                </div>
              </Show>
            );
          }}
        </For>
      </div>

      <p class="comment shrink-0 text-xs sm:text-sm">
        drag a piece onto its neighbour — when they fit they lock together and move as one.
      </p>
    </div>
  );
}
