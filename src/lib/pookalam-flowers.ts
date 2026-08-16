/**
 * The poov catalogue — what you can actually place on the shared pookalam.
 *
 * Ten real flowers, the ones people in Kerala genuinely carry to a pookalam,
 * under their own names. Naming them `red`, `yellow`, `orange` would have been
 * easier and would have thrown away the only part of this that teaches anyone
 * anything.
 *
 * DRAWN, NOT LOADED
 *
 * Each is a handful of petals around a centre, drawn straight to canvas. No SVG
 * files, no sprite sheet, no network request — which matters when 2500 of them
 * can be on screen at once, and is the same joke as the rest of the contest:
 * the flower carpet is made of code.
 *
 * The ids are the nibble values written into the grid, so they are part of the
 * storage format. APPEND ONLY. Renumbering one silently rewrites every flower
 * already placed on the canvas into a different species.
 */

export type FlowerShape = "round" | "star" | "globe" | "leaf";

export interface Flower {
  /** Nibble value in the packed grid. 1–15; 0 means empty. Never renumber. */
  id: number;
  key: string;
  /** Malayalam name — what it is called at the pookalam. */
  name: string;
  /** English name, for the tooltip. */
  english: string;
  petal: string;
  /** Second petal tone, painted on alternating petals for depth. */
  petalAlt: string;
  centre: string;
  petals: number;
  shape: FlowerShape;
}

/**
 * Washed comic-print tones rather than photographic ones.
 *
 * Real marigolds are far more saturated than this. Rule 5 of the design
 * language is "washed, not neon", and 2500 saturated flowers on cream would
 * vibrate — so these sit near the `--pop-*` palette and let density do the work
 * that saturation does on a real pookalam.
 */
export const FLOWERS: readonly Flower[] = [
  {
    id: 1,
    key: "chethi",
    name: "Chethi",
    english: "Jungle geranium",
    petal: "#e2564b",
    petalAlt: "#cf4a42",
    centre: "#f5c443",
    petals: 4,
    shape: "round",
  },
  {
    id: 2,
    key: "bandhi",
    name: "Bandhi",
    english: "Marigold (orange)",
    petal: "#ee9440",
    petalAlt: "#dc8231",
    centre: "#c96f22",
    petals: 8,
    shape: "round",
  },
  {
    id: 3,
    key: "bandhi-manja",
    name: "Manja Bandhi",
    english: "Marigold (yellow)",
    petal: "#f5c443",
    petalAlt: "#e6b132",
    centre: "#d19a20",
    petals: 8,
    shape: "round",
  },
  {
    id: 4,
    key: "thumba",
    name: "Thumba",
    english: "White dead nettle",
    petal: "#fdf8ec",
    petalAlt: "#f2ead8",
    centre: "#e8d9b4",
    petals: 5,
    shape: "star",
  },
  {
    id: 5,
    key: "jamanthi",
    name: "Jamanthi",
    english: "Chrysanthemum",
    petal: "#e8a92f",
    petalAlt: "#d69a24",
    centre: "#b3820b",
    petals: 12,
    shape: "round",
  },
  {
    id: 6,
    key: "vadamalli",
    name: "Vadamalli",
    english: "Globe amaranth",
    petal: "#a86bb8",
    petalAlt: "#9459a5",
    centre: "#7d4a8c",
    petals: 0,
    shape: "globe",
  },
  {
    id: 7,
    key: "chemparathi",
    name: "Chemparathi",
    english: "Hibiscus",
    petal: "#c9414f",
    petalAlt: "#b53744",
    centre: "#f5c443",
    petals: 5,
    shape: "star",
  },
  {
    id: 8,
    key: "mulla",
    name: "Mulla",
    english: "Jasmine",
    petal: "#fffdf6",
    petalAlt: "#f6efdf",
    centre: "#f5c443",
    petals: 6,
    shape: "star",
  },
  {
    id: 9,
    key: "arali",
    name: "Arali",
    english: "Oleander",
    petal: "#e48bb4",
    petalAlt: "#d478a3",
    centre: "#f2e2c4",
    petals: 5,
    shape: "round",
  },
  {
    id: 10,
    key: "thulasi",
    name: "Thulasi",
    english: "Holy basil leaf",
    petal: "#6fae7c",
    petalAlt: "#5e9a6a",
    centre: "#4e8459",
    petals: 3,
    shape: "leaf",
  },
];

const BY_ID = new Map(FLOWERS.map((flower) => [flower.id, flower]));

export function flowerById(id: number): Flower | undefined {
  return BY_ID.get(id);
}

/**
 * Rule 4 of the design language: everything is inked. At a 13px cell one hair
 * of outline is what stops a dense patch reading as coloured mush.
 */
const INK = "#22202b";

/**
 * Paints one flower centred on (cx, cy) at radius r.
 *
 * Deliberately takes a plain 2D context and numbers — no component, no state —
 * so the same routine draws the live canvas, the previous days underneath it,
 * and the palette swatches, and all three can never drift apart.
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
  ctx.lineWidth = Math.max(0.5, r * 0.09);
  ctx.strokeStyle = INK;

  switch (flower.shape) {
    case "globe":
      paintGlobe(ctx, r, flower);
      break;
    case "leaf":
      paintLeaves(ctx, r, flower);
      break;
    case "star":
      paintPetals(ctx, r, flower, 0.52, 0.34);
      break;
    default:
      paintPetals(ctx, r, flower, 0.46, 0.44);
      break;
  }

  ctx.restore();
}

/** Petals as ellipses on a ring, alternating tone so density reads as texture. */
function paintPetals(
  ctx: CanvasRenderingContext2D,
  r: number,
  flower: Flower,
  reach: number,
  width: number,
): void {
  const step = (Math.PI * 2) / flower.petals;
  for (let i = 0; i < flower.petals; i++) {
    ctx.save();
    ctx.rotate(i * step);
    ctx.beginPath();
    ctx.ellipse(0, -r * reach, r * width, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? flower.petal : flower.petalAlt;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();
  ctx.stroke();
}

/** Vadamalli is a ball, not a bloom — concentric rings, no petals. */
function paintGlobe(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = flower.petal;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = flower.petalAlt;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();
}

/** Green, for the outlines and lettering a real pookalam picks out in leaf. */
function paintLeaves(ctx: CanvasRenderingContext2D, r: number, flower: Flower): void {
  const step = (Math.PI * 2) / flower.petals;
  for (let i = 0; i < flower.petals; i++) {
    ctx.save();
    ctx.rotate(i * step + Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.4, r * 0.3, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? flower.petal : flower.petalAlt;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = flower.centre;
  ctx.fill();
}
