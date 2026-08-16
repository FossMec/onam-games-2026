import { For } from "solid-js";

/**
 * Memphis confetti that is secretly Onam iconography.
 *
 *   vallam (snake boat) -> long zigzag
 *   pookalam            -> concentric rings
 *   muthukuda (umbrella)-> half circle
 *   banana leaf         -> organic blob
 *   palm                -> squiggle
 *
 * Reads as ordinary 80s Memphis scatter to an outsider and as Onam to anyone
 * from Kerala. That double reading is the whole point - it is decoration that
 * means something without having to explain itself.
 *
 * Layout-neutral by construction: absolutely positioned, `pointer-events:none`,
 * `aria-hidden`. It can never shift content or catch a tap.
 */

type ShapeKind = "vallam" | "pookalam" | "muthukuda" | "ila" | "thengu" | "kite" | "dots";

const SHAPES: readonly ShapeKind[] = [
  "vallam",
  "pookalam",
  "muthukuda",
  "ila",
  "thengu",
  "kite",
  "dots",
];

const COLORS = [
  "var(--pop-red)",
  "var(--pop-yellow)",
  "var(--pop-teal)",
  "var(--pop-blue)",
  "var(--pop-pink)",
  "var(--pop-purple)",
];

/** mulberry32 - the scatter must be identical on server and client or SSR tears. */
function rng(seed: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ConfettiShape(props: { kind: ShapeKind; color: string }) {
  const stroke = "var(--ink)";

  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
      {props.kind === "vallam" && (
        // Snake boat: a long low zigzag with the upturned prow.
        <polyline
          points="2,26 10,18 18,26 26,18 34,26 38,14"
          fill="none"
          stroke={props.color}
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      )}
      {props.kind === "pookalam" && (
        <>
          <circle cx="20" cy="20" r="17" fill={props.color} stroke={stroke} stroke-width="2.5" />
          <circle cx="20" cy="20" r="10" fill="var(--paper)" stroke={stroke} stroke-width="2.5" />
          <circle cx="20" cy="20" r="4" fill={props.color} stroke={stroke} stroke-width="2" />
        </>
      )}
      {props.kind === "muthukuda" && (
        <>
          <path
            d="M2 24a18 18 0 0 1 36 0Z"
            fill={props.color}
            stroke={stroke}
            stroke-width="2.5"
            stroke-linejoin="round"
          />
          <path d="M20 24v12" stroke={stroke} stroke-width="3" stroke-linecap="round" />
        </>
      )}
      {props.kind === "ila" && (
        // Banana leaf, as a Memphis blob.
        <path
          d="M20 3c11 5 16 12 16 18s-7 16-16 16S4 27 4 21 9 8 20 3Z"
          fill={props.color}
          stroke={stroke}
          stroke-width="2.5"
        />
      )}
      {props.kind === "thengu" && (
        // Coconut palm: curved trunk with geometric arching palm fronds
        <>
          <path
            d="M15 36 Q18 24 20 14"
            fill="none"
            stroke={stroke}
            stroke-width="3"
            stroke-linecap="round"
          />
          {/* Radiating Palm Fronds */}
          <path
            d="M20 14 Q28 8 35 13 M20 14 Q29 17 34 24 M20 14 Q12 7 5 11 M20 14 Q10 17 6 23 M20 14 Q20 4 21 2"
            fill="none"
            stroke={props.color}
            stroke-width="3.5"
            stroke-linecap="round"
          />
          <circle cx="18" cy="16" r="2" fill={stroke} />
          <circle cx="22" cy="16" r="2" fill={stroke} />
        </>
      )}

      {props.kind === "kite" && (
        <path
          d="M20 2 36 20 20 38 4 20Z"
          fill={props.color}
          stroke={stroke}
          stroke-width="2.5"
          stroke-linejoin="round"
        />
      )}
      {props.kind === "dots" && (
        <For each={[0, 1, 2, 3]}>
          {(row) => (
            <For each={[0, 1, 2, 3]}>
              {(col) => <circle cx={7 + col * 9} cy={7 + row * 9} r="2.6" fill={props.color} />}
            </For>
          )}
        </For>
      )}
    </svg>
  );
}

export interface ConfettiProps {
  /** How many pieces to scatter. Keep it low on small surfaces. */
  count?: number;
  /** Same seed = same scatter. Vary it per section so no two look alike. */
  seed?: string;
  /** Ambient drift. Off by default; never enable on a gameplay surface. */
  animate?: boolean;
  class?: string;
  opacity?: number;
}

export function Confetti(props: ConfettiProps) {
  const pieces = () => {
    const next = rng(props.seed ?? "onam");
    return Array.from({ length: props.count ?? 12 }, (_, i) => ({
      id: i,
      kind: SHAPES[Math.floor(next() * SHAPES.length)],
      color: COLORS[Math.floor(next() * COLORS.length)],
      left: next() * 100,
      top: next() * 100,
      size: 18 + next() * 30,
      spin: next() * 90 - 45,
      // Spread the drift phase so the field never pulses in unison.
      delay: next() * 6,
      duration: 6 + next() * 5,
    }));
  };

  return (
    <div class={`art-layer ${props.class ?? ""}`} aria-hidden="true">
      <For each={pieces()}>
        {(piece) => (
          <div
            class={props.animate ? "anim-drift" : undefined}
            style={{
              position: "absolute",
              left: `${piece.left}%`,
              top: `${piece.top}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              "--spin": `${piece.spin}deg`,
              transform: `rotate(${piece.spin}deg)`,
              "animation-delay": `${piece.delay}s`,
              "animation-duration": `${piece.duration}s`,
              opacity: props.opacity ?? 0.9,
            }}
          >
            <ConfettiShape kind={piece.kind} color={piece.color} />
          </div>
        )}
      </For>
    </div>
  );
}
