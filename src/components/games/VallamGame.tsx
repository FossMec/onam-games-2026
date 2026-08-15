import { For, Show, createMemo, createSignal } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import type { SpriteName } from "~/lib/sprites";

const ENEMY_PASSENGERS: SpriteName[] = [
  "tux-king",
  "ferris-crab",
  "gopher-king",
  "linus-torvalds",
  "octocat-garland",
  "vamana-umbrella",
  "bird-mascot",
  "docker-pookalam",
  "python-snake",
  "arch-crown",
  "nilavilakku",
  "papad-face",
  "floppy-onam",
];

/**
 * Escape the Vallam — sliding-block board.
 *
 * Interaction is tap-to-select then tap-a-destination, same as the jigsaw and
 * wend boards. Dragging a block along an axis on a phone means fighting page
 * scroll for a gesture the player has to repeat twenty times; two taps never
 * misfire and work one-handed.
 *
 * All the reachable cells for the selected boat are shown up front, so the
 * player is choosing between visible options rather than probing for what is
 * legal. That turns the fiddly part into the thinking part.
 *
 * Nothing here is authoritative. The move list is replayed server-side on a
 * board regenerated from the seed, so an edited client only produces a
 * rejected submission.
 */

export interface BoatView {
  id: number;
  r: number;
  c: number;
  len: number;
  horizontal: boolean;
}

export interface VallamViewData {
  kind: "vallam";
  size: number;
  exitRow: number;
  boats: BoatView[];
  par: number;
}

export interface VallamMove {
  b: number;
  d: number;
}

export interface VallamGameProps {
  view: VallamViewData;
  onFinish: (submission: { moves: VallamMove[] }) => void;
  disabled?: boolean;
  /** Moves from a previous visit, replayed to restore the board. */
  initialMoves?: VallamMove[];
  onProgress?: (moves: VallamMove[]) => void;
}

const BOAT_SPRITES = {
  hero: "/sprites/vallam/hero-vallam.webp",
  canoe: "/sprites/vallam/boat-canoe.webp",
  canoe3: "/sprites/vallam/boat-canoe-3.webp",
  wood: "/sprites/vallam/boat-wood.webp",
  small: "/sprites/vallam/boat-small-h.webp",
};

/** Pop color palette variations for enemy blocker boats */
const ENEMY_FILTERS = [
  "none",
  "hue-rotate(-45deg) saturate(1.3)",
  "hue-rotate(-85deg) saturate(1.4) brightness(1.05)",
  "hue-rotate(120deg) saturate(1.35)",
  "hue-rotate(40deg) saturate(1.2)",
  "hue-rotate(75deg) saturate(1.3)",
  "hue-rotate(-20deg) saturate(1.5)",
];

function getBoatSprite(boat: BoatView): string {
  if (boat.id === 0) return BOAT_SPRITES.hero;
  if (boat.len >= 3) {
    return BOAT_SPRITES.canoe3;
  }
  const pick = boat.id % 3;
  if (pick === 0) return BOAT_SPRITES.wood;
  if (pick === 1) return BOAT_SPRITES.canoe;
  return BOAT_SPRITES.small;
}

function getBoatFilter(boat: BoatView, isActive: boolean): string {
  if (boat.id === 0) {
    return isActive
      ? "drop-shadow(0 0 10px rgba(228, 88, 88, 0.9)) drop-shadow(0 4px 8px rgba(34, 32, 43, 0.4))"
      : "drop-shadow(0 2px 4px rgba(34, 32, 43, 0.3))";
  }
  const baseFilter = ENEMY_FILTERS[boat.id % ENEMY_FILTERS.length];
  const filterPrefix = baseFilter === "none" ? "" : `${baseFilter} `;
  return isActive
    ? `${filterPrefix}drop-shadow(0 0 8px rgba(255, 209, 102, 0.95)) drop-shadow(0 4px 8px rgba(34, 32, 43, 0.4))`
    : `${filterPrefix}drop-shadow(0 2px 4px rgba(34, 32, 43, 0.25))`;
}

function occupancy(boats: BoatView[], size: number): Int8Array {
  const grid = new Int8Array(size * size).fill(-1);
  for (const boat of boats) {
    for (let i = 0; i < boat.len; i += 1) {
      const r = boat.r + (boat.horizontal ? 0 : i);
      const c = boat.c + (boat.horizontal ? i : 0);
      grid[r * size + c] = boat.id;
    }
  }
  return grid;
}

/** Signed step counts the boat can legally slide, nearest first in each direction. */
function reachable(boats: BoatView[], boat: BoatView, size: number): number[] {
  const grid = occupancy(boats, size);
  const deltas: number[] = [];
  for (const dir of [-1, 1]) {
    for (let steps = 1; steps < size; steps += 1) {
      const from = boat.horizontal ? boat.c : boat.r;
      const to = from + dir * steps;
      // The cell at the boat's leading edge after this step.
      const lead = dir > 0 ? to + boat.len - 1 : to;
      if (lead < 0 || lead >= size) break;
      const cell = boat.horizontal ? boat.r * size + lead : lead * size + boat.c;
      const occupant = grid[cell];
      if (occupant !== -1 && occupant !== boat.id) break;
      deltas.push(dir * steps);
    }
  }
  return deltas;
}

/** Replays a move list onto the starting position. */
function replay(start: BoatView[], moves: VallamMove[]): BoatView[] {
  let boats = start;
  for (const move of moves) {
    boats = boats.map((b) =>
      b.id === move.b
        ? { ...b, r: b.horizontal ? b.r : b.r + move.d, c: b.horizontal ? b.c + move.d : b.c }
        : b,
    );
  }
  return boats;
}

export function VallamGame(props: VallamGameProps) {
  /*
   * Restored by replaying the move list rather than by storing boat positions.
   * The move list is what gets submitted and what the server replays, so
   * rebuilding from it means the board a resuming player sees is exactly the
   * board their submission describes — two representations could drift.
   */
  const [moves, setMoves] = createSignal<VallamMove[]>(props.initialMoves ?? []);
  const [boats, setBoats] = createSignal<BoatView[]>(
    replay(props.view.boats, props.initialMoves ?? []),
  );
  const [selected, setSelected] = createSignal<number | null>(null);

  const size = () => props.view.size;
  const vallam = () => boats().find((b) => b.id === 0)!;
  const escaped = () => vallam().c + vallam().len === size();

  /** Destination cell -> steps, for every place the selected boat can go. */
  const targets = createMemo(() => {
    const id = selected();
    if (id === null || props.disabled) return new Map<string, number>();
    const boat = boats().find((b) => b.id === id);
    if (!boat) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const d of reachable(boats(), boat, size())) {
      // Key on the cell the boat's leading end reaches — "tap where the nose
      // should end up". Every such cell is empty by construction (reachable
      // stops at the first obstruction) and none of them sit under the boat's
      // current footprint, so the markers never hide the boat they belong to.
      const from = boat.horizontal ? boat.c : boat.r;
      const lead = d > 0 ? from + boat.len - 1 + d : from + d;
      map.set(boat.horizontal ? `${boat.r},${lead}` : `${lead},${boat.c}`, d);
    }
    return map;
  });

  const slide = (boatId: number, d: number) => {
    const next = boats().map((b) =>
      b.id === boatId
        ? { ...b, r: b.horizontal ? b.r : b.r + d, c: b.horizontal ? b.c + d : b.c }
        : b,
    );
    const log = [...moves(), { b: boatId, d }];
    setBoats(next);
    setMoves(log);
    setSelected(null);
    props.onProgress?.(log);

    const escapee = next.find((b) => b.id === 0)!;
    if (escapee.c + escapee.len === size()) {
      // Smoothly travel outside via the exit
      setTimeout(() => {
        setBoats((prev) => prev.map((b) => (b.id === 0 ? { ...b, c: b.c + 1.2 } : b)));
        setTimeout(() => {
          props.onFinish({ moves: log });
        }, 320);
      }, 140);
    }
  };

  const tapCell = (r: number, c: number) => {
    if (props.disabled || escaped()) return;
    const d = targets().get(`${r},${c}`);
    if (d !== undefined) {
      slide(selected()!, d);
      return;
    }
    // Not a destination: either pick up whatever boat is here, or drop the
    // current selection so a stray tap on water is an undo, not a no-op.
    const occupant = occupancy(boats(), size())[r * size() + c];
    setSelected(occupant === -1 || occupant === selected() ? null : occupant);
  };

  const reset = () => {
    if (props.disabled) return;
    setBoats(props.view.boats);
    setMoves([]);
    setSelected(null);
    props.onProgress?.([]);
  };

  const pct = (n: number) => `${(n / size()) * 100}%`;

  return (
    <div class="mx-auto flex h-full w-full max-w-sm flex-col justify-between space-y-2 text-center">
      <div class="flex shrink-0 items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {moves().length} moves (par {props.view.par})
        </span>
        <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
          {selected() === null ? "tap a boat" : "tap where it should go"}
        </span>
      </div>

      <div
        class="relative mx-auto my-auto aspect-square w-full max-w-md max-h-[min(55dvh,400px)]"
        style={{
          background: "var(--paper-2)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-right": "var(--ink-w-bold) dashed var(--ink)",
          "touch-action": "none",
        }}
      >
        {/* Water. Purely decorative grid lines — the tap targets are on top. */}
        <div
          class="absolute inset-0 grid"
          style={{
            "grid-template-columns": `repeat(${size()}, 1fr)`,
            "grid-template-rows": `repeat(${size()}, 1fr)`,
          }}
          aria-hidden="true"
        >
          <For each={Array.from({ length: size() * size() })}>
            {() => <div style={{ border: "1px solid rgb(34 32 43 / 0.12)" }} />}
          </For>
        </div>

        {/* The gap in the right wall the vallam has to reach. */}
        <div
          class="absolute"
          style={{
            top: pct(props.view.exitRow),
            right: "calc(var(--ink-w-bold) * -1)",
            width: "var(--ink-w-bold)",
            height: pct(1),
            background: "var(--pop-teal)",
          }}
          aria-hidden="true"
        />

        {/* Boats. */}
        <For each={boats()}>
          {(boat) => {
            const isVallam = boat.id === 0;
            const active = () => selected() === boat.id;
            return (
              <button
                type="button"
                onClick={() => tapCell(boat.r, boat.c)}
                disabled={props.disabled}
                style={{
                  position: "absolute",
                  left: pct(boat.c),
                  top: pct(boat.r),
                  width: pct(boat.horizontal ? boat.len : 1),
                  height: pct(boat.horizontal ? 1 : boat.len),
                  padding: "2px",
                  background: "transparent",
                  border: "none",
                  cursor: props.disabled ? "default" : "pointer",
                  transition: "left 140ms ease-out, top 140ms ease-out",
                  "z-index": active() ? 10 : 2,
                }}
                aria-label={
                  isVallam
                    ? "The chundan vallam"
                    : `${boat.horizontal ? "Horizontal" : "Vertical"} boat, length ${boat.len}`
                }
              >
                <div
                  class="relative h-full w-full select-none flex items-center justify-center"
                  style={{
                    transform: active() ? "scale(1.05)" : "scale(1)",
                    transition: "transform 120ms ease-out",
                  }}
                >
                  <Show
                    when={boat.horizontal}
                    fallback={
                      /* Vertical boat: natural horizontal sprite rotated 90deg to fill vertical cell slot */
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          width: `${boat.len * 100}%`,
                          height: `${(1 / boat.len) * 100}%`,
                          transform: "translate(-50%, -50%) rotate(90deg)",
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "center",
                        }}
                      >
                        <img
                          src={getBoatSprite(boat)}
                          alt=""
                          draggable={false}
                          style={{
                            width: "100%",
                            height: "100%",
                            "object-fit": "contain",
                            filter: getBoatFilter(boat, active()),
                            transition: "filter 140ms ease-out",
                          }}
                        />
                        <Show when={!isVallam}>
                          {/* Upright passenger on vertical boat */}
                          <div
                            class="pointer-events-none absolute z-10 flex items-center justify-center"
                            style={{
                              transform: "rotate(-90deg)",
                              filter: "drop-shadow(0 2px 3px rgba(34,32,43,0.4))",
                            }}
                          >
                            <SpriteIcon
                              name={ENEMY_PASSENGERS[boat.id % ENEMY_PASSENGERS.length]}
                              size={boat.len >= 3 ? 24 : 20}
                              animate="wobble"
                            />
                          </div>
                        </Show>
                      </div>
                    }
                  >
                    {/* Horizontal boat: faces right toward exit (hero vallam flipped horizontally so prow points right) */}
                    <img
                      src={getBoatSprite(boat)}
                      alt=""
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        "object-fit": "contain",
                        transform: isVallam ? "scaleX(-1)" : "none",
                        filter: getBoatFilter(boat, active()),
                        transition: "filter 140ms ease-out",
                      }}
                    />
                    <Show when={!isVallam}>
                      {/* Passenger in horizontal enemy boat */}
                      <div
                        class="pointer-events-none absolute z-10 flex items-center justify-center"
                        style={{
                          filter: "drop-shadow(0 2px 3px rgba(34,32,43,0.4))",
                        }}
                      >
                        <SpriteIcon
                          name={ENEMY_PASSENGERS[boat.id % ENEMY_PASSENGERS.length]}
                          size={boat.len >= 3 ? 24 : 20}
                          animate="wobble"
                        />
                      </div>
                    </Show>
                  </Show>
                </div>
              </button>
            );
          }}
        </For>

        {/*
          Destination markers, painted over the boats so a legal slide is
          always tappable even where it passes under the boat's own footprint.
        */}
        <For each={[...targets().entries()]}>
          {([key, d]) => {
            const [r, c] = key.split(",").map(Number);
            return (
              <button
                type="button"
                onClick={() => slide(selected()!, d)}
                style={{
                  position: "absolute",
                  left: pct(c),
                  top: pct(r),
                  width: pct(1),
                  height: pct(1),
                  display: "grid",
                  "place-items": "center",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                aria-label={`Slide here (${Math.abs(d)} space${Math.abs(d) === 1 ? "" : "s"})`}
              >
                <span
                  style={{
                    width: "34%",
                    height: "34%",
                    "border-radius": "999px",
                    background: "var(--ink)",
                    opacity: 0.45,
                  }}
                />
              </button>
            );
          }}
        </For>
      </div>

      <div class="flex items-center justify-between gap-2">
        <p class="comment">
          the vallam only moves sideways. everything else is someone else's problem.
        </p>
        <button type="button" class="btn-ghost" onClick={reset} disabled={props.disabled}>
          Reset
        </button>
      </div>
    </div>
  );
}
