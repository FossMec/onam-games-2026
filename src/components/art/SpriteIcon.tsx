import { SPRITE_REGISTRY, type SpriteName } from "~/lib/sprites";

/**
 * Every sprite, emitted at build time in three widths.
 *
 * `size` is a runtime prop, so no single import width can be right: the call
 * sites are overwhelmingly tiny - 38 of them at 13px, 32 at 14px, 25 at 12px -
 * with only a handful reaching 36-68. One budget sized for the largest would
 * ship a 136px image to fill a 13px box, which is a hundred times the pixels
 * anybody sees. The sources were a flat 192px, sized for nothing at all.
 *
 * So the browser decides. Three candidates cover the whole range at 2x
 * (16px, 32px, 68px), `sizes` below tells it the CSS box, and it fetches the
 * smallest one that will do.
 *
 * Eager because the map must exist before first render - the values are just
 * URL strings, so the images themselves still load on demand.
 */
const SPRITE_SRCSETS = import.meta.glob<string>("~/assets/sprites/icons/*.webp", {
  query: { w: "32;64;136", format: "webp", quality: 82, as: "srcset" },
  import: "default",
  eager: true,
});

/** The largest candidate, for browsers that ignore `srcset`. */
const SPRITE_FALLBACK = import.meta.glob<string>("~/assets/sprites/icons/*.webp", {
  query: { w: 136, format: "webp", quality: 82 },
  import: "default",
  eager: true,
});

function pick(map: Record<string, string>, name: SpriteName): string {
  for (const [path, url] of Object.entries(map)) {
    if (path.endsWith(`/${name}.webp`)) return url;
  }
  return "";
}

export interface SpriteIconProps {
  name: SpriteName;
  /** Size in pixels (width and height). Defaults to 32 */
  size?: number;
  /**
   * Animation mode:
   * - "float": gentle continuous levitation
   * - "wobble": playful wiggle on hover
   * - "pulse": subtle rhythmic scale pulse
   * - "none": static
   */
  animate?: "float" | "wobble" | "pulse" | "none";
  /** Tilt angle in degrees (overrides default tilt from registry) */
  tilt?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Animation delay in seconds */
  delay?: number;
  /** Interactive hover scale + tilt */
  interactive?: boolean;
  /** CSS class */
  class?: string;
  /** Accessible alt text */
  alt?: string;
  /**
   * Loading attribute for img. Defaults to `eager`.
   *
   * The whole sprite set is ~255KB of 192px WebP, so lazy-loading them bought
   * nothing and cost a visible pop-in: the box is already reserved at the right
   * size, but it sat empty until the sprite scrolled into view. Pass `lazy`
   * explicitly for anything genuinely far down a long page.
   */
  loading?: "lazy" | "eager";
  /** Optional inline style override */
  style?: Record<string, string | number | undefined>;
}

export function SpriteIcon(props: SpriteIconProps) {
  const meta = () => SPRITE_REGISTRY[props.name] ?? SPRITE_REGISTRY["maveli-laptop"];
  const size = () => props.size ?? 32;
  const tilt = () => props.tilt ?? meta().defaultTilt ?? 0;
  const anim = () => props.animate ?? "none";

  const animClass = () => {
    switch (anim()) {
      case "float":
        return "anim-sprite-float";
      case "wobble":
        return "anim-sprite-wobble";
      case "pulse":
        return "anim-sprite-pulse";
      default:
        return "";
    }
  };

  return (
    <span
      class={`inline-flex items-center justify-center select-none ${animClass()} ${
        props.interactive ? "sprite-interactive cursor-pointer" : ""
      } ${props.class ?? ""}`}
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        "--sprite-tilt": `${tilt()}deg`,
        "--anim-duration": props.duration ? `${props.duration}s` : undefined,
        "--anim-delay": props.delay ? `${props.delay}s` : undefined,
        transform: anim() === "none" && tilt() !== 0 ? `rotate(${tilt()}deg)` : undefined,
        "flex-shrink": 0,
        ...props.style,
      }}
      aria-hidden={props.alt ? undefined : "true"}
    >
      <img
        src={pick(SPRITE_FALLBACK, props.name)}
        srcset={pick(SPRITE_SRCSETS, props.name)}
        // The box is square and known, so the browser can resolve the right
        // candidate before layout rather than guessing at 100vw.
        sizes={`${size()}px`}
        alt={props.alt ?? meta().label}
        width={size()}
        height={size()}
        // Decorative sprites below the fold should not compete with the first screen.
        // Callers can still opt into eager loading for genuinely above-the-fold art.
        loading={props.loading ?? "lazy"}
        decoding="async"
        class="h-full w-full object-contain pointer-events-none"
      />
    </span>
  );
}
