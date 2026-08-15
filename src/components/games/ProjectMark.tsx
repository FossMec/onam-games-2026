export interface ProjectMarkProps {
  id: string;
  name: string;
  size?: number;
  class?: string;
}

const PAPER = "#fdfbf7";
const INK = "#22202b";

/**
 * Official vector brand mark for the Open Source Tinder deck.
 * Renders the authentic multi-color vector brand SVG inside the comic paper badge.
 */
export function ProjectMark(props: ProjectMarkProps) {
  const size = () => props.size ?? 96;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size()}
      height={size()}
      class={props.class}
      role="img"
      aria-label={props.name}
      style={{ overflow: "visible" }}
    >
      <circle cx="50" cy="50" r="46" fill={PAPER} stroke={INK} stroke-width="4" />
      <image
        href={`/images/marks/${props.id}.svg`}
        x="18"
        y="18"
        width="64"
        height="64"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
