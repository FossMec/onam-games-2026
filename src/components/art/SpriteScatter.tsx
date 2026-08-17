import { For } from "solid-js";
import { AMBIENT_SPRITES, type SpriteName } from "~/lib/sprites";
import { SpriteIcon } from "./SpriteIcon";
import { useDeferredArt } from "./defer";

/** Deterministic PRNG to avoid SSR hydration mismatches */
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

export interface SpriteScatterProps {
  /** Deterministic seed for reproducible positioning */
  seed?: string;
  /** Number of ambient sprites */
  count?: number;
  /** Custom subset of sprites to pick from (defaults to AMBIENT_SPRITES) */
  pool?: SpriteName[];
  /** Enable gentle floating drift animation */
  animate?: boolean;
  /** Minimum size in px (defaults to 28) */
  minSize?: number;
  /** Maximum size in px (defaults to 46) */
  maxSize?: number;
  /** Overall layer opacity (defaults to 0.85) */
  opacity?: number;
  /** Additional container CSS classes */
  class?: string;
}

export function SpriteScatter(props: SpriteScatterProps) {
  const items = () => {
    const next = rng(props.seed ?? "foss-onam-sprites");
    const pool = props.pool && props.pool.length > 0 ? props.pool : AMBIENT_SPRITES;
    const count = props.count ?? 6;
    const minSize = props.minSize ?? 28;
    const maxSize = props.maxSize ?? 46;

    return Array.from({ length: count }, (_, i) => {
      const spriteName = pool[Math.floor(next() * pool.length)];
      const size = Math.round(minSize + next() * (maxSize - minSize));
      // Scatter mainly towards edges so central content remains legible
      const edge = next() > 0.5;
      const left = edge ? (next() > 0.5 ? next() * 22 : 78 + next() * 20) : 15 + next() * 70;
      const top = 6 + next() * 88;
      const tilt = Math.round(next() * 20 - 10);
      const delay = +(next() * 5).toFixed(2);
      const duration = +(5 + next() * 4).toFixed(2);

      return {
        id: i,
        name: spriteName,
        left,
        top,
        size,
        tilt,
        delay,
        duration,
      };
    });
  };

  // Decoration only: rendered after hydration, never into the SSR HTML.
  // Also keeps its sprite <img> tags out of the server's markup, which is
  // where a good chunk of the eager image requests were coming from.
  const ready = useDeferredArt();

  return (
    <div
      class={`art-layer ${props.class ?? ""}`}
      style={{ opacity: props.opacity ?? 0.85 }}
      aria-hidden="true"
    >
      <For each={ready() ? items() : []}>
        {(item) => (
          <div
            style={{
              position: "absolute",
              left: `${item.left}%`,
              top: `${item.top}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <SpriteIcon
              name={item.name}
              size={item.size}
              tilt={item.tilt}
              animate={props.animate !== false ? "float" : "none"}
              duration={item.duration}
              delay={item.delay}
            />
          </div>
        )}
      </For>
    </div>
  );
}
