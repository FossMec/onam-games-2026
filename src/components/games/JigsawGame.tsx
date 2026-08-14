import { For, createMemo, createSignal, onMount } from "solid-js";

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
  let board: HTMLDivElement | undefined;

  const cols = () => props.view.cols;
  const rows = () => props.view.rows;
  const count = () => cols() * rows();

  const [pieces, setPieces] = createSignal<Piece[]>([]);
  const [moveLog, setMoveLog] = createSignal<Move[]>([]);
  /** The group currently under the finger, drawn on top of everything else. */
  const [activeGroup, setActiveGroup] = createSignal<number | null>(null);

  onMount(() => {
    const saved = props.initialProgress;
    if (saved && saved.pieces.length === count()) {
      setPieces(saved.pieces.map((p) => ({ ...p })));
      setMoveLog(saved.moveLog.slice());
      return;
    }
    // Each piece starts in its own group, which is what "loose on the board"
    // means: no two pieces are joined yet.
    setPieces(props.view.scatter.map((s) => ({ id: s.id, groupId: s.id, x: s.x, y: s.y })));
  });

  const homeOf = (id: number) => ({ x: id % cols(), y: Math.floor(id / cols()) });

  const groupCount = createMemo(() => new Set(pieces().map((p) => p.groupId)).size);
  const solved = () => pieces().length > 0 && groupCount() === 1;

  const report = (next: Piece[], log: Move[]) => {
    props.onProgress?.({ pieces: next, moveLog: log });
  };

  /* ------------------------------------------------------------ dragging */

  let pointerId: number | null = null;
  let origin = { x: 0, y: 0 };
  let startPositions: Piece[] = [];

  /** Board width in px per cell unit — everything is stored in cell units. */
  const unit = () => (board?.getBoundingClientRect().width ?? 1) / (cols() * SPREAD);

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
      const c = id % cols();
      const r = Math.floor(id / cols());
      const top = r > 0 ? props.view.hEdges[r - 1][c] : null;
      const bottom = r < rows() - 1 ? props.view.hEdges[r][c] : null;
      const left = c > 0 ? props.view.vEdges[r][c - 1] : null;
      const right = c < cols() - 1 ? props.view.vEdges[r][c] : null;
      out.push(
        `M 0 0 ` +
          edgePath([0, 0], [CELL, 0], top, -1) +
          edgePath([CELL, 0], [CELL, CELL], right, 1) +
          edgePath([CELL, CELL], [0, CELL], bottom, 1) +
          edgePath([0, CELL], [0, 0], left, -1) +
          "Z",
      );
    }
    return out;
  });

  const PieceArt = (p: { id: number }) => {
    const c = p.id % cols();
    const r = Math.floor(p.id / cols());
    const clipId = `jig-clip-${p.id}`;
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

  /** Pieces in draw order, with the dragged group last so it sits on top. */
  const drawOrder = createMemo(() => {
    const group = activeGroup();
    return [...pieces()].sort((a, b) => {
      const ay = a.groupId === group ? 1 : 0;
      const by = b.groupId === group ? 1 : 0;
      return ay - by;
    });
  });

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {count() - groupCount() + 1}/{count()} joined
        </span>
        <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
          {solved() ? "done" : "drag pieces together"}
        </span>
      </div>

      <div
        ref={(el) => (board = el)}
        class="relative mx-auto w-full"
        style={{
          "max-width": "min(100%, 34rem)",
          "aspect-ratio": `${cols() * SPREAD} / ${rows() * SPREAD}`,
          background: "var(--paper-2)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-radius": "var(--radius)",
          // Without this the browser takes the drag for scrolling and pieces
          // simply never move on a phone.
          "touch-action": "none",
          overflow: "hidden",
        }}
      >
        <For each={drawOrder()}>
          {(piece) => (
            <div
              role="button"
              tabindex="0"
              aria-label={`Piece ${piece.id + 1}`}
              onPointerDown={(e) => onPointerDown(e, piece)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: "absolute",
                left: `${(piece.x / (cols() * SPREAD)) * 100}%`,
                top: `${(piece.y / (rows() * SPREAD)) * 100}%`,
                width: `${(1 / (cols() * SPREAD)) * 100}%`,
                height: `${(1 / (rows() * SPREAD)) * 100}%`,
                cursor: props.disabled || solved() ? "default" : "grab",
                "z-index": piece.groupId === activeGroup() ? 10 : 1,
                "touch-action": "none",
              }}
            >
              <PieceArt id={piece.id} />
            </div>
          )}
        </For>
      </div>

      <p class="comment">
        drag a piece onto its neighbour — when they fit they lock together and move as one.
      </p>
    </div>
  );
}
