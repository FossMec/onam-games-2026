import { Show } from "solid-js";

/**
 * The comic action starburst — the spiky explosion a shout sits inside.
 *
 * Points are generated rather than hand-drawn so the spikiness can vary per
 * use without maintaining a dozen path strings, and so a `seed` gives each
 * burst its own irregular silhouette. Perfectly regular stars read as
 * clip-art; slightly uneven ones read as drawn.
 */

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

function starPoints(spikes: number, seed: string): string {
  const next = rng(seed);
  const cx = 50;
  const cy = 50;
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const outer = i % 2 === 0;
    // Jitter both radius and angle so no two spikes match.
    const radius = outer ? 44 + next() * 6 : 24 + next() * 6;
    const angle = (Math.PI * i) / spikes + (next() - 0.5) * 0.08;
    points.push(
      `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

export interface BurstProps {
  /** Fill colour — pass a `--pop-*` var. */
  color?: string;
  spikes?: number;
  seed?: string;
  /** Second, larger burst behind the first for a layered poster look. */
  double?: boolean;
  class?: string;
}

export function Burst(props: BurstProps) {
  const seed = () => props.seed ?? "burst";
  return (
    <svg
      viewBox="0 0 100 100"
      class={props.class}
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Show when={props.double}>
        <polygon
          points={starPoints((props.spikes ?? 12) + 3, `${seed()}-back`)}
          fill="var(--ink)"
          opacity="0.15"
        />
      </Show>
      <polygon
        points={starPoints(props.spikes ?? 12, seed())}
        fill={props.color ?? "var(--pop-yellow)"}
        stroke="var(--ink)"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/**
 * Halftone dots — the comic way to shade. Used anywhere a shadow would have
 * been, which in this system is everywhere depth is needed.
 */
export function Halftone(props: { class?: string; size?: number; opacity?: number }) {
  return (
    <div
      class={`art-layer ${props.class ?? ""}`}
      aria-hidden="true"
      style={{
        "background-image": "radial-gradient(var(--ink) 1.4px, transparent 1.5px)",
        "background-size": `${props.size ?? 7}px ${props.size ?? 7}px`,
        opacity: props.opacity ?? 0.16,
      }}
    />
  );
}

/**
 * Comic speech bubble with a tail. The tail is part of the same path so the
 * outline is continuous — a separate triangle always shows a seam.
 */
export function Bubble(props: {
  children: unknown;
  color?: string;
  /** Which side the tail hangs from. */
  tail?: "left" | "right";
  class?: string;
}) {
  return (
    <div class={`relative ${props.class ?? ""}`}>
      <div
        class="relative rounded-2xl px-4 py-3"
        style={{
          background: props.color ?? "var(--paper-2)",
          border: "var(--ink-w) solid var(--ink)",
        }}
      >
        {props.children as never}
      </div>
      <svg
        viewBox="0 0 30 24"
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "calc(-1 * var(--ink-w) - 17px)",
          [props.tail === "right" ? "right" : "left"]: "2rem",
          width: "30px",
          height: "24px",
          transform: props.tail === "right" ? "scaleX(-1)" : undefined,
        }}
      >
        {/* Drawn slightly taller than the viewport so the top edge tucks under
            the bubble's border and the joint is invisible. */}
        <path
          d="M2 -4 L28 -4 L10 22 Z"
          fill={props.color ?? "var(--paper-2)"}
          stroke="var(--ink)"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  );
}

export interface ShoutProps {
  text: string;
  color?: string;
  seed?: string;
  class?: string;
  /**
   * A smaller cut of the same thing, for a shout that sits inside a panel
   * rather than owning the moment.
   *
   * It is scaled, never substituted. Standing a shout down to a plain badge
   * loses the burst, the comic face and the ink stroke — which is to say all of
   * it, since the treatment *is* the design. Both dimensions come down together
   * so the proportions hold.
   */
  compact?: boolean;
}

/** A shout inside its burst — the standard win/fail moment. */
export function ShoutBurst(props: ShoutProps) {
  return (
    <div class={`relative inline-grid place-items-center ${props.class ?? ""}`}>
      <div class={`col-start-1 row-start-1 w-full anim-pop ${props.compact ? "h-20" : "h-40"}`}>
        <Burst color={props.color} seed={props.seed} double />
      </div>
      <span
        class="shout col-start-1 row-start-1 anim-pop"
        style={
          props.compact
            ? {
                "font-size": "clamp(1rem, 4vw, 1.45rem)",
                "-webkit-text-stroke": "1.5px var(--ink)",
                padding: "0 0.4rem",
              }
            : undefined
        }
      >
        {props.text}
      </span>
    </div>
  );
}
