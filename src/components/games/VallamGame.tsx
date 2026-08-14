import { For, Show, createMemo, createSignal } from "solid-js";

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

/**
 * The other boats' hues. The vallam gets its own colour and is never in here —
 * the one block that matters has to be findable at a glance.
 */
const HULLS = [
  "var(--pop-teal)",
  "var(--pop-blue)",
  "var(--pop-purple)",
  "var(--pop-pink)",
  "var(--pop-yellow)",
];

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
    if (escapee.c + escapee.len === size()) props.onFinish({ moves: log });
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
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
          {moves().length} move{moves().length === 1 ? "" : "s"}
        </span>
        <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
          par {props.view.par}
        </span>
        <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
          {selected() === null ? "tap a boat" : "tap where it should go"}
        </span>
      </div>

      <div
        class="relative mx-auto w-full max-w-md"
        style={{
          "aspect-ratio": "1 / 1",
          background: "var(--paper-2)",
          border: "var(--ink-w-bold) solid var(--ink)",
          "border-right": "var(--ink-w-bold) dashed var(--ink)",
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
                  padding: "2%",
                  background: "transparent",
                  border: "none",
                  cursor: props.disabled ? "default" : "pointer",
                  transition: "left 140ms ease-out, top 140ms ease-out",
                }}
                aria-label={
                  isVallam
                    ? "The chundan vallam"
                    : `${boat.horizontal ? "Horizontal" : "Vertical"} boat, length ${boat.len}`
                }
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: isVallam ? "var(--pop-red)" : HULLS[boat.id % HULLS.length],
                    border: `${active() ? "var(--ink-w-bold)" : "var(--ink-w)"} solid var(--ink)`,
                    "border-radius": "999px",
                    display: "grid",
                    "place-items": "center",
                    "font-family": "var(--font-stack-display)",
                    "font-size": "clamp(0.7rem, 3vw, 1rem)",
                    color: "var(--ink)",
                  }}
                >
                  <Show when={isVallam}>
                    <span
                      style={{
                        transform: boat.horizontal ? "none" : "rotate(90deg)",
                        "white-space": "nowrap",
                      }}
                    >
                      ▸▸
                    </span>
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
