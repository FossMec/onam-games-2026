/**
 * Jigsaw piece outlines.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 * An edge shared by two pieces must be *the same curve* in absolute space,
 * whichever piece draws it. A jigsaw where the tab and the socket are not
 * congruent looks broken even when the puzzle logic is perfect — the pieces
 * snap together and still visibly do not fit, which reads as a bug in the game
 * rather than a quirk of the art.
 *
 * The subtlety that gets this wrong: a piece walks its own outline clockwise,
 * so of the four edges it draws, two are traversed in the opposite direction to
 * the neighbour that shares them. Generating the curve from whichever end
 * happens to come first puts the tab at `offset` measured from *that* end — so
 * the two sides place it at `offset` and `1 - offset` respectively, and the
 * shapes only agree when `offset` is exactly 0.5. With `offset` roaming
 * 0.35..0.65 and an asymmetric `skew` on top, every shared edge was mismatched
 * by up to 15% of its length.
 *
 * The fix is the whole design here: every edge is generated once in a canonical
 * direction — left-to-right for horizontal edges, top-to-bottom for vertical
 * ones — and a piece that needs to walk it the other way emits the *same*
 * points in reverse. Reversing a cubic Bézier is exact: swap the endpoints and
 * swap the two control points. So both pieces trace geometry that is identical
 * to the last decimal, by construction rather than by tolerance.
 */

export interface JigsawTab {
  /** 1 = tab bulges one way along the canonical normal, -1 = the other. */
  dir: 1 | -1;
  /** Where along the edge the tab sits (0.35-0.65). */
  offset: number;
  /** Neck width as a fraction of the edge. */
  neck: number;
  /** How far the head bulges, as a fraction of the cell. */
  head: number;
  /** Lateral lean, so no two tabs are quite the same shape. */
  skew: number;
}

type Pt = [number, number];

/**
 * The seven points describing one edge — three on-curve, four control — always
 * in the edge's canonical direction.
 *
 * The normal is the canonical direction rotated a quarter turn, so for a
 * left-to-right edge it points down the screen and for a top-to-bottom edge it
 * points left. Which way a tab actually bulges is then purely `dir`, and both
 * pieces sharing the edge compute the same thing.
 */
function edgeNodes(from: Pt, to: Pt, tab: JigsawTab): [Pt, Pt, Pt, Pt, Pt, Pt, Pt] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const nx = -dy;
  const ny = dx;
  const bulge = tab.dir * tab.head;

  const at = (t: number, out: number): Pt => [
    from[0] + dx * t + nx * out,
    from[1] + dy * t + ny * out,
  ];

  const a = tab.offset - tab.neck;
  const b = tab.offset + tab.neck;
  const skew = tab.skew;

  return [
    at(a, 0),
    at(a + tab.neck * 0.2, bulge * 0.35),
    at(a - tab.neck * 0.5 + skew, bulge * 1.15),
    at(tab.offset + skew, bulge * 1.25),
    at(b + tab.neck * 0.5 + skew, bulge * 1.15),
    at(b - tab.neck * 0.2, bulge * 0.35),
    at(b, 0),
  ];
}

const fmt = (p: Pt) => `${round(p[0])} ${round(p[1])}`;
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * One edge of an outline, as SVG path commands continuing from the current
 * point.
 *
 * `cFrom`/`cTo` are always the edge's canonical endpoints, regardless of which
 * way this particular piece is walking it. `forward` says which way that is.
 */
export function edgeSegment(cFrom: Pt, cTo: Pt, tab: JigsawTab | null, forward: boolean): string {
  const end = forward ? cTo : cFrom;
  if (!tab) return `L ${fmt(end)}`;

  const [p1, c1, c2, p2, c3, c4, p3] = edgeNodes(cFrom, cTo, tab);
  if (forward) {
    return `L ${fmt(p1)} C ${fmt(c1)} ${fmt(c2)} ${fmt(p2)} C ${fmt(c3)} ${fmt(c4)} ${fmt(p3)} L ${fmt(cTo)}`;
  }
  // The same curve, walked backwards: endpoints swapped, control points of each
  // cubic swapped with them.
  return `L ${fmt(p3)} C ${fmt(c4)} ${fmt(c3)} ${fmt(p2)} C ${fmt(c2)} ${fmt(c1)} ${fmt(p1)} L ${fmt(cFrom)}`;
}

export interface PieceEdges {
  /** Shared with the piece above. Null on the top row. */
  top: JigsawTab | null;
  /** Shared with the piece to the right. Null on the last column. */
  right: JigsawTab | null;
  /** Shared with the piece below. Null on the bottom row. */
  bottom: JigsawTab | null;
  /** Shared with the piece to the left. Null on the first column. */
  left: JigsawTab | null;
}

/**
 * A closed outline for one piece, in its own local frame: (0,0) to (cell,cell).
 *
 * Walked clockwise from the top-left. Top and right run with their canonical
 * direction; bottom and left run against it, which is exactly the case the
 * reversal above exists to handle.
 */
export function pieceOutline(cell: number, edges: PieceEdges): string {
  const tl: Pt = [0, 0];
  const tr: Pt = [cell, 0];
  const br: Pt = [cell, cell];
  const bl: Pt = [0, cell];

  return (
    `M 0 0 ` +
    // Canonical for a horizontal edge is left-to-right.
    edgeSegment(tl, tr, edges.top, true) +
    // Canonical for a vertical edge is top-to-bottom.
    edgeSegment(tr, br, edges.right, true) +
    // Same edge as the piece below draws as its top: canonical is still
    // left-to-right, but this piece is walking right-to-left.
    edgeSegment(bl, br, edges.bottom, false) +
    // Same edge as the piece to the left draws as its right: canonical is still
    // top-to-bottom, but this piece is walking bottom-to-top.
    edgeSegment(tl, bl, edges.left, false) +
    `Z`
  );
}

/**
 * Every edge in a grid, resolved for one piece.
 *
 * `hEdges[r][c]` is the edge between rows r and r+1; `vEdges[r][c]` is the edge
 * between columns c and c+1. Keeping this lookup in one place is what stops the
 * two pieces sharing an edge from ever reading different specs for it.
 */
export function edgesForPiece(
  id: number,
  cols: number,
  rows: number,
  hEdges: JigsawTab[][],
  vEdges: JigsawTab[][],
): PieceEdges {
  const c = id % cols;
  const r = Math.floor(id / cols);
  return {
    top: r > 0 ? hEdges[r - 1][c] : null,
    right: c < cols - 1 ? vEdges[r][c] : null,
    bottom: r < rows - 1 ? hEdges[r][c] : null,
    left: c > 0 ? vEdges[r][c - 1] : null,
  };
}
