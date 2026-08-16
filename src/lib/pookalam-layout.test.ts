import { describe, expect, it } from "vite-plus/test";
import { CELL_COUNT } from "./pookalam-grid";
import { RINGS, RING_COUNT, SLOTS, slotAt } from "./pookalam-layout";

describe("ring partition", () => {
  it("uses every one of the 2500 stored cells, exactly once", () => {
    expect(SLOTS).toHaveLength(CELL_COUNT);
    expect(RINGS.reduce((sum, ring) => sum + ring.count, 0)).toBe(CELL_COUNT);
  });

  it("leaves no ring empty or partial", () => {
    expect(RINGS).toHaveLength(RING_COUNT);
    for (const ring of RINGS) expect(ring.count).toBeGreaterThanOrEqual(1);
  });

  it("lays rings out contiguously in flat-array order", () => {
    let expected = 0;
    for (const ring of RINGS) {
      expect(ring.start).toBe(expected);
      expected += ring.count;
    }
    expect(expected).toBe(CELL_COUNT);
  });

  it("grows outward — an outer ring holds more than an inner one", () => {
    expect(RINGS[RING_COUNT - 1].count).toBeGreaterThan(RINGS[0].count);
    expect(RINGS[20].count).toBeGreaterThan(RINGS[5].count);
  });
});

describe("slot geometry", () => {
  it("keeps every flower inside the disc", () => {
    for (const slot of SLOTS) {
      const distance = Math.hypot(slot.x - 0.5, slot.y - 0.5);
      expect(distance).toBeLessThanOrEqual(0.5);
    }
  });

  it("sizes flowers to close the gap to their neighbours", () => {
    const dr = 0.5 / RING_COUNT;
    for (const ring of RINGS) {
      const slot = SLOTS[ring.start];
      const arc = (2 * Math.PI * ring.radius) / ring.count;
      // Big enough to bridge whichever spacing is larger, or the carpet shows
      // paper through it.
      expect(slot.cellRadius * 2).toBeGreaterThanOrEqual(Math.max(dr, arc) * 0.99);
    }
  });

  it("staggers alternate rings so cells interlock", () => {
    expect(RINGS[0].offset).toBe(0);
    expect(RINGS[1].offset).toBe(0.5);
  });
});

describe("slotAt", () => {
  it("round-trips every single slot back to its own index", () => {
    // The one that matters: a tap on a drawn flower must select that flower.
    for (let i = 0; i < SLOTS.length; i++) {
      expect(slotAt(SLOTS[i].x, SLOTS[i].y)).toBe(i);
    }
  });

  it("returns null outside the disc", () => {
    expect(slotAt(0, 0)).toBeNull();
    expect(slotAt(1, 1)).toBeNull();
    expect(slotAt(0.5, 1.01)).toBeNull();
  });

  it("finds the centre ring at the middle", () => {
    const index = slotAt(0.5, 0.5);
    expect(index).not.toBeNull();
    expect(SLOTS[index!].ring).toBe(0);
  });

  it("stays in range for points right on the rim", () => {
    for (const angle of [0, 1, 2, 3, 4, 5, 6]) {
      const index = slotAt(0.5 + Math.cos(angle) * 0.499, 0.5 + Math.sin(angle) * 0.499);
      expect(index).not.toBeNull();
      expect(index!).toBeGreaterThanOrEqual(0);
      expect(index!).toBeLessThan(CELL_COUNT);
    }
  });
});
