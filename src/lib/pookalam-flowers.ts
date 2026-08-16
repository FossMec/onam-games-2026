/**
 * The poov catalogue — what you can actually place on the shared pookalam.
 *
 * Nine authentic Kerala flowers used in traditional pookalams, tuned to a golden
 * medium between the soothing theme design tokens and luminous festive vibrancy
 * so they pop clearly against the dark ground without dark muddiness or harsh neon.
 */

export type FlowerShape =
  | "chendumalli-orange"
  | "chendumalli-yellow"
  | "undamalli"
  | "arali"
  | "mulla"
  | "thulasi"
  | "thumba"
  | "jamanthi-yellow"
  | "jamanthi-white";

export interface Flower {
  /** Nibble value in the packed grid (1–15; 0 = empty). */
  id: number;
  key: string;
  /** Malayalam name as called at the pookalam. */
  name: string;
  /** English / botanical common name for tooltips. */
  english: string;
  petal: string;
  petalAlt: string;
  centre: string;
  shape: FlowerShape;
}

export const FLOWERS: readonly Flower[] = [
  {
    id: 2,
    key: "orange-chendumalli",
    name: "Orange Chendumalli",
    english: "Marigold (orange)",
    petal: "#FF7A18",
    petalAlt: "#FFA855",
    centre: "#D84800",
    shape: "chendumalli-orange",
  },
  {
    id: 3,
    key: "manja-chendumalli",
    name: "Manja Chendumalli",
    english: "Marigold (yellow)",
    petal: "#FFCA28",
    petalAlt: "#FFE082",
    centre: "#FF9800",
    shape: "chendumalli-yellow",
  },
  {
    id: 6,
    key: "undamalli",
    name: "Undamalli",
    english: "Globe amaranth (vadamalli)",
    petal: "#BA68C8",
    petalAlt: "#E1BEE7",
    centre: "#8E24AA",
    shape: "undamalli",
  },
  {
    id: 9,
    key: "arali",
    name: "Arali",
    english: "Oleander",
    petal: "#F06292",
    petalAlt: "#F8BBD0",
    centre: "#FFF9C4",
    shape: "arali",
  },
  {
    id: 8,
    key: "mulla",
    name: "Mulla",
    english: "Star Jasmine",
    petal: "#FFFFFF",
    petalAlt: "#FFF8E1",
    centre: "#FFCA28",
    shape: "mulla",
  },
  {
    id: 10,
    key: "thulasi",
    name: "Thulasi",
    english: "Holy basil",
    petal: "#26A69A",
    petalAlt: "#80CBC4",
    centre: "#00695C",
    shape: "thulasi",
  },
  {
    id: 4,
    key: "thumba",
    name: "Thumba",
    english: "Leucas flower",
    petal: "#FFFFFF",
    petalAlt: "#43A047",
    centre: "#1B5E20",
    shape: "thumba",
  },
  {
    id: 5,
    key: "manja-jamanthi",
    name: "Manja Jamanthi",
    english: "Chrysanthemum (yellow)",
    petal: "#FFB300",
    petalAlt: "#FFE082",
    centre: "#E65100",
    shape: "jamanthi-yellow",
  },
  {
    id: 1,
    key: "vella-jamanthi",
    name: "Vella Jamanthi",
    english: "Chrysanthemum (white)",
    petal: "#FFFFFF",
    petalAlt: "#FFF3E0",
    centre: "#FFB300",
    shape: "jamanthi-white",
  },
];

const BY_ID = new Map<number, Flower>();
for (const f of FLOWERS) {
  BY_ID.set(f.id, f);
}

// Fallback legacy ID mappings
BY_ID.set(7, FLOWERS[3]); // Arali fallback

export function flowerById(id: number): Flower | undefined {
  return BY_ID.get(id) ?? FLOWERS[0];
}

const INK_OUTLINE = "rgba(34, 32, 43, 0.4)";

/**
 * Paints one flower centred on (cx, cy) at radius r with luminous, clean solid fills
 * and delicate outer contouring that pops vibrantly without dark muddiness.
 */
export function drawFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  flower: Flower,
  rotation = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (rotation !== 0) ctx.rotate(rotation);

  ctx.lineWidth = Math.max(0.5, r * 0.055);
  ctx.strokeStyle = INK_OUTLINE;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (flower.shape) {
    case "chendumalli-orange":
    case "chendumalli-yellow":
      paintChendumalli(ctx, r, flower);
      break;
    case "undamalli":
      paintUndamalli(ctx, r, flower);
      break;
    case "arali":
      paintArali(ctx, r, flower);
      break;
    case "mulla":
      paintMulla(ctx, r, flower);
      break;
    case "thulasi":
      paintThulasi(ctx, r, flower);
      break;
    case "thumba":
      paintThumba(ctx, r, flower);
      break;
    case "jamanthi-yellow":
    case "jamanthi-white":
      paintJamanthi(ctx, r, flower);
      break;
    default:
      paintChendumalli(ctx, r, flower);
      break;
  }

  ctx.restore();
}

/**
 * Chendumalli (Marigold): Luminous layered pom-pom bloom.
 */
function paintChendumalli(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const count = 10;
  const step = (Math.PI * 2) / count;

  // 1. Outer scalloped pom-pom silhouette
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const angle = i * step;
    const px = Math.cos(angle) * r * 0.65;
    const py = Math.sin(angle) * r * 0.65;
    ctx.arc(px, py, r * 0.38, 0, Math.PI * 2);
  }
  ctx.fillStyle = flower.petal;
  ctx.fill();
  ctx.stroke();

  // 2. Middle highlight tier
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const angle = (i * Math.PI * 2) / 7 + Math.PI / 7;
    const px = Math.cos(angle) * r * 0.38;
    const py = Math.sin(angle) * r * 0.38;
    ctx.arc(px, py, r * 0.26, 0, Math.PI * 2);
  }
  ctx.fillStyle = flower.petalAlt;
  ctx.fill();

  // 3. Warm center core
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();

  // 4. Center radiant dot
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = flower.petalAlt;
  ctx.fill();
}

/**
 * Undamalli (Globe Amaranth / Vadamalli): Luminous purple textured globe.
 */
function paintUndamalli(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const bractCount = 10;
  const step = (Math.PI * 2) / bractCount;

  // 1. Outer bract silhouette
  ctx.beginPath();
  for (let i = 0; i < bractCount; i++) {
    const angle = i * step;
    const px = Math.cos(angle) * r * 0.62;
    const py = Math.sin(angle) * r * 0.62;
    ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
  }
  ctx.fillStyle = flower.petal;
  ctx.fill();
  ctx.stroke();

  // 2. Inner vibrant body
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = flower.petalAlt;
  ctx.fill();

  // 3. Dense purple heart
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();

  // 4. Crown sparkle
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.12, r * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
}

/**
 * Arali (Oleander): 5-blade pinwheel swirling petals in luminous coral pink.
 */
function paintArali(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const petals = 5;
  const step = (Math.PI * 2) / petals;

  // 1. Swirling 5-petal pinwheel
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate(i * step);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(r * 0.38, -r * 0.32, r * 0.52, -r * 0.82, 0, -r * 0.95);
    ctx.bezierCurveTo(-r * 0.28, -r * 0.72, -r * 0.16, -r * 0.25, 0, 0);
    ctx.fillStyle = i % 2 === 0 ? flower.petal : flower.petalAlt;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 2. Center corona star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r * 0.28 : r * 0.14;
    const x = Math.cos(angle) * rad;
    const y = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = flower.centre;
  ctx.fill();
}

/**
 * Mulla (Star Jasmine): Radiant pure white radiating star petals with golden center.
 */
function paintMulla(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const petals = 7;
  const step = (Math.PI * 2) / petals;

  // 1. Pure white radiating petals
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate(i * step);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.52, r * 0.19, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 2. Golden eye center
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();

  // 3. Highlight dot
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
}

/**
 * Thulasi (Holy Basil): Radiant emerald teal 4-leaf cluster with delicate veins.
 */
function paintThulasi(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const leaves = 4;
  const step = (Math.PI * 2) / leaves;

  for (let i = 0; i < leaves; i++) {
    ctx.save();
    ctx.rotate(i * step + Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.54, r * 0.25, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? flower.petal : flower.petalAlt;
    ctx.fill();
    ctx.stroke();

    // Subtle vein
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2);
    ctx.lineTo(0, -r * 0.82);
    ctx.strokeStyle = flower.centre;
    ctx.lineWidth = Math.max(0.4, r * 0.05);
    ctx.stroke();

    ctx.restore();
  }

  // Central teal node
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();
}

/**
 * Thumba (Leucas aspera) — Authentic Kerala Redesign:
 * Signature green spherical calyx ball ("thumbakkudam") with pure brilliant white
 * hooded florets blooming around the crown.
 */
function paintThumba(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const floretCount = 5;
  const step = (Math.PI * 2) / floretCount;

  // 1. Five pure white hooded florets radiating outward
  for (let i = 0; i < floretCount; i++) {
    ctx.save();
    ctx.rotate(i * step - Math.PI / 2);
    ctx.beginPath();
    // Authentic Leucas hooded lip shape (slender base spreading to a curved white lip)
    ctx.moveTo(0, -r * 0.2);
    ctx.bezierCurveTo(r * 0.3, -r * 0.4, r * 0.35, -r * 0.85, 0, -r * 0.96);
    ctx.bezierCurveTo(-r * 0.35, -r * 0.85, -r * 0.3, -r * 0.4, 0, -r * 0.2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.stroke();

    // Soft golden pollen speck at lip throat
    ctx.beginPath();
    ctx.arc(0, -r * 0.65, r * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = "#FFCA28";
    ctx.fill();

    ctx.restore();
  }

  // 2. Prominent spherical green calyx ball ("thumbakkudam") at the center
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = flower.petalAlt; // Fresh herbal green (#43A047)
  ctx.fill();
  ctx.stroke();

  // 3. Bract ribs on the green globe
  for (let i = 0; i < floretCount; i++) {
    const angle = i * step;
    const bx = Math.cos(angle) * r * 0.26;
    const by = Math.sin(angle) * r * 0.26;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "#66BB6A";
    ctx.fill();
  }

  // 4. Center calyx eye
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();
}

/**
 * Jamanthi (Chrysanthemum): Radiant ray petals with golden amber disc.
 */
function paintJamanthi(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const count = 12;
  const step = (Math.PI * 2) / count;

  // 1. Radiating ray petals
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.rotate(i * step);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.58, r * 0.15, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = flower.petal;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 2. Inner ray petal tier
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 8 + step / 2);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.42, r * 0.13, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = flower.petalAlt;
    ctx.fill();
    ctx.restore();
  }

  // 3. Radiant amber-gold center disc
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();

  // 4. Center disc eye
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = flower.shape === "jamanthi-white" ? "#FFB300" : "#D84800";
  ctx.fill();
}
