import { SPRITE_REGISTRY, type SpriteName } from "~/lib/sprites";

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
  /** Loading attribute for img */
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
      role={props.alt ? "img" : undefined}
      aria-label={props.alt}
      aria-hidden={props.alt ? undefined : "true"}
    >
      <img
        src={`/sprites/icons/${props.name}.png`}
        alt={props.alt ?? meta().label}
        width={size()}
        height={size()}
        loading={props.loading ?? "lazy"}
        decoding="async"
        class="h-full w-full object-contain pointer-events-none"
      />
    </span>
  );
}
