import { CELL_COUNT } from "./pookalam-grid";

/**
 * Where each of the 2500 cells actually sits.
 *
 * Storage is a flat array and stays one — the server writes nibble `i` and has
 * no opinion about geometry. This is the client's reading of that array, and it
 * reads it as a pookalam: concentric rings around a centre, not rows and
 * columns. Nobody lays a flower carpet on graph paper.
 *
 * THE RING SIZES ARE NOT ARBITRARY
 *
 * Divide the disc into `RING_COUNT` rings of equal thickness `dr`. Ring k sits
 * at radius (k+0.5)·dr, so its circumference is 2π(k+0.5)·dr, and giving it
 * 2π(k+0.5) cells makes the gap between neighbours along the ring exactly `dr`
 * — the same as the gap between rings. One weight, `2k+1`, and the spacing
 * comes out even in both directions everywhere on the disc.
 *
 * Summing that weight to 2500 wants π·n² = 2500, so n ≈ 28. The leftover from
 * rounding is handed to the rings with the largest fractional parts, which
 * keeps every ring complete — a partial outer ring would be the one thing the
 * eye picks out instantly.
 *
 * GAPS ARE CLOSED BY THE FLOWERS THEMSELVES
 *
 * Each cell carries its own radius, taken from whichever of its two spacings is
 * larger and then overlapped. Ring 3 and ring 27 need different sized flowers
 * to touch their neighbours, so they get them, and no cream shows through
 * anywhere without a uniform size having to be tuned by hand.
 *
 * Every ring is also rotated half a cell against the last, so cells interlock
 * like brickwork instead of lining up into visible radial seams.
 */

export const RING_COUNT = 28;

/** Overlap factor. Enough that neighbours merge, not so much that shapes vanish. */
const OVERLAP = 1.3;

export interface Slot {
  /** 0 at the centre. */
  ring: number;
  /** Radians, 0 pointing right. */
  angle: number;
  /** Distance from centre, in unit-disc terms (0 … 0.5). */
  radius: number;
  /** Centre, in unit-square terms (0 … 1). */
  x: number;
  y: number;
  /** Draw radius, unit-square terms. Already includes the overlap. */
  cellRadius: number;
}

interface Ring {
  count: number;
  /** Index of this ring's first cell in the flat array. */
  start: number;
  radius: number;
  /** Half-cell stagger, so consecutive rings interlock. */
  offset: number;
}

/**
 * Cells per ring, summing to exactly `CELL_COUNT`.
 *
 * Largest-remainder rather than plain rounding: rounding each ring
 * independently lands near 2500 but not on it, and the shortfall would have to
 * be dumped somewhere visible.
 */
function ringCounts(): number[] {
  const weights = Array.from({ length: RING_COUNT }, (_, k) => 2 * k + 1);
  const total = weights.reduce((sum, w) => sum + w, 0);

  const exact = weights.map((w) => (CELL_COUNT * w) / total);
  const counts = exact.map((value) => Math.max(1, Math.floor(value)));

  let remainder = CELL_COUNT - counts.reduce((sum, c) => sum + c, 0);
  const order = exact
    .map((value, k) => ({ k, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  // Hand the leftovers out one at a time, largest fractional part first, and
  // wrap if there are somehow more leftovers than rings.
  for (let i = 0; remainder > 0; i++) {
    counts[order[i % order.length].k] += 1;
    remainder -= 1;
  }
  return counts;
}

function buildRings(): Ring[] {
  const counts = ringCounts();
  const dr = 0.5 / RING_COUNT;
  let start = 0;
  return counts.map((count, k) => {
    const ring: Ring = {
      count,
      start,
      radius: (k + 0.5) * dr,
      // Half a cell of stagger per ring, alternating.
      offset: k % 2 === 0 ? 0 : 0.5,
    };
    start += count;
    return ring;
  });
}

export const RINGS: readonly Ring[] = buildRings();

export const PADDING_SCALE = 0.94;

function buildSlots(): Slot[] {
  const dr = 0.5 / RING_COUNT;
  const slots: Slot[] = [];

  for (const ring of RINGS) {
    // Distance to the next flower along the ring. Compared against the ring
    // thickness so the larger of the two decides how big the flower has to be.
    const arc = (2 * Math.PI * ring.radius) / ring.count;
    const cellRadius = (Math.max(dr, arc) / 2) * OVERLAP * PADDING_SCALE;
    const ringRadius = ring.radius * PADDING_SCALE;

    for (let j = 0; j < ring.count; j++) {
      const angle = (2 * Math.PI * (j + ring.offset)) / ring.count;
      slots.push({
        ring: RINGS.indexOf(ring),
        angle,
        radius: ringRadius,
        x: 0.5 + Math.cos(angle) * ringRadius,
        y: 0.5 + Math.sin(angle) * ringRadius,
        cellRadius,
      });
    }
  }
  return slots;
}

/** All 2500 slots, in flat-array order. Built once; never mutated. */
export const SLOTS: readonly Slot[] = buildSlots();

/**
 * Which cell a point lands on, or null for outside the disc.
 *
 * Coordinates are unit-square (0 … 1). Solved rather than searched: the ring
 * comes straight from the distance and the position within it from the angle,
 * so a tap is arithmetic instead of 2500 comparisons — which matters when this
 * runs on every pointer-move of a drag.
 */
export function slotAt(nx: number, ny: number): number | null {
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const distance = Math.hypot(dx, dy);
  if (distance > 0.5) return null;

  const dr = 0.5 / RING_COUNT;
  const ringIndex = Math.min(
    RING_COUNT - 1,
    Math.max(0, Math.floor(distance / PADDING_SCALE / dr)),
  );
  const ring = RINGS[ringIndex];

  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;

  const position = (angle / (Math.PI * 2)) * ring.count - ring.offset;
  const j = ((Math.round(position) % ring.count) + ring.count) % ring.count;
  return ring.start + j;
}

/** Filled fraction of the disc, for the meter. */
export function slotCount(): number {
  return SLOTS.length;
}
