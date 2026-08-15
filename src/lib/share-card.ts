/**
 * The share card, drawn in canvas.
 *
 * A player who finishes a run should leave with something better than a
 * screenshot. This draws that something: 1080×1920 (Instagram story), in the
 * site's own fonts, sprites and memes, obeying the six rules in `design.md` —
 * no shadows, halftone as shading, Memphis geometry that is secretly Onam,
 * everything inked, washed colour, and a degree or two of tilt.
 *
 * Why canvas and not html2canvas: the card has to be pixel-identical on every
 * phone, and it has to produce a `Blob` we can hand to `navigator.share`.
 * Rasterising live DOM does neither reliably.
 *
 * TWO RULES FOR ANYONE EDITING THIS FILE
 *
 *  1. Nothing cross-origin may be drawn. One tainted pixel and `toBlob()`
 *     throws SecurityError, which kills the entire feature. That is why the
 *     player's Google avatar is *not* on the card — an initial medallion
 *     stands in for it.
 *  2. The card is read at thumbnail size in someone's story feed before it is
 *     ever read full size. If a line does not survive being 200px wide, it
 *     does not belong on the card.
 */

import { SPRITE_REGISTRY, type SpriteName } from "~/lib/sprites";
import {
  aside,
  brag,
  buildCaption,
  figureFor,
  memeFor,
  spriteFor,
  taunt,
  tierFor,
  type ShareTier,
} from "~/lib/share-copy";

/* ------------------------------------------------------------------ paint */

/**
 * The palette, mirrored from `:root` in `app.css`.
 *
 * Canvas cannot read CSS custom properties, so these are copies. If a colour
 * changes there it must change here — they are the same six inks.
 */
const INK = "#22202b";
const INK_SOFT = "#6b6478";
const PAPER = "#fbf3e4";
const PAPER_2 = "#fffcf5";
const PAPER_3 = "#f0e4cc";
/** The deeper cut, for small type that has to pass contrast on cream. */
const TEAL_DEEP = "#2f8f79";
const POP = {
  red: "#f2695c",
  yellow: "#f5c443",
  teal: "#5fbfa8",
  blue: "#7b9be0",
  pink: "#e48bb4",
  purple: "#9c82d4",
} as const;

const ACCENTS = [POP.red, POP.yellow, POP.teal, POP.blue, POP.pink, POP.purple];

/** The two-tone panel split, per tier. Two accents only — rule 5. */
const TIER_PANEL: Record<ShareTier, [string, string]> = {
  champion: [POP.yellow, POP.teal],
  podium: [POP.teal, POP.pink],
  sharp: [POP.teal, POP.blue],
  middle: [POP.pink, POP.purple],
  tail: [POP.purple, POP.blue],
  late: [POP.blue, POP.pink],
  unranked: [POP.pink, POP.teal],
};

/** The starburst behind the rank medallion and the shout. */
const TIER_BURST: Record<ShareTier, string> = {
  champion: POP.yellow,
  podium: POP.yellow,
  sharp: POP.teal,
  middle: POP.pink,
  tail: POP.purple,
  late: POP.blue,
  unranked: POP.yellow,
};

export const CARD_W = 1080;
export const CARD_H = 1920;

/*
 * The bottom third, in one place.
 *
 * Meme, shout, brag, aside and footer are stacked with only a few pixels
 * between them, so every one of these numbers is load-bearing: nudge one and
 * something below it collides. They are constants rather than inline literals
 * for exactly that reason.
 */
const MEME_BOX = { x: 60, y: 1235, w: 380, h: 380 };
const SHOUT = { cx: 772, cy: 1400, r: 230 };
const BRAG_Y = 1655;
const BRAG_LINE_H = 42;
const ASIDE_Y = 1765;
const FOOTER_Y = 1790;
const FOOTER_H = 98;

/* -------------------------------------------------------------- utilities */

/** mulberry32, seeded by FNV-1a — the same generator the on-page art uses. */
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

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Rounded rectangle path.
 *
 * Hand-rolled rather than `ctx.roundRect`, which iOS Safari only got in 16.
 * Plenty of players are on older phones and a missing method here would throw
 * mid-draw and produce no card at all.
 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** A flat panel with the one outline treatment. Rule 4: everything is inked. */
function inkedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  lineWidth = 7,
) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();
}

type FontFace = "display" | "body" | "mono" | "comic" | "hand" | "logo";

/** The six voices, each with exactly one job. Same split as `app.css`. */
function font(face: FontFace, px: number, weight = 400): string {
  switch (face) {
    case "display":
      return `${weight} ${px}px "Baloo Chettan 2", "Comic Sans MS", system-ui, sans-serif`;
    case "body":
      return `${weight} ${px}px Nunito, system-ui, sans-serif`;
    case "mono":
      return `${weight} ${px}px "Space Mono", ui-monospace, monospace`;
    case "comic":
      return `${px}px Bangers, Impact, fantasy`;
    case "hand":
      return `${px}px Caveat, "Comic Sans MS", cursive`;
    case "logo":
      return `${px}px Bungee, Impact, sans-serif`;
  }
}

/**
 * Largest size at which `text` still fits `maxWidth`.
 *
 * Names on this card come from Google accounts, so they range from "Ann" to
 * something with four initials and a house name. The chip is a fixed box; the
 * type is what gives.
 */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  face: FontFace,
  maxPx: number,
  minPx: number,
  weight = 400,
): number {
  let px = maxPx;
  while (px > minPx) {
    ctx.font = font(face, px, weight);
    if (ctx.measureText(text).width <= maxWidth) return px;
    px -= 2;
  }
  return minPx;
}

/**
 * Split a short phrase into at most `maxLines`, as evenly as the words allow.
 *
 * Used for the shout, where greedy wrapping is wrong: "CAN YOU BEAT ME?" wants
 * to be two balanced lines, not one long line and one orphan — and stacking
 * every word on its own line shrinks the type until it stops being a shout.
 */
function balanceLines(text: string, maxLines: number): string[] {
  const words = text.split(/\s+/);
  if (words.length <= 1 || maxLines <= 1) return [text];
  const lines = Math.min(maxLines, words.length);
  const perLine = Math.ceil(words.length / lines);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += perLine) {
    out.push(words.slice(i, i + perLine).join(" "));
  }
  return out;
}

/** "generated 15 aug 2026, 8:14 pm ist" — always IST, like every other clock here. */
function stampedAt(when?: Date): string {
  const date = when ?? new Date();
  const text = date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `generated ${text.toLowerCase()} ist`;
}

/** Greedy word wrap at a fixed size. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

/**
 * Text with a comic ink outline.
 *
 * Stroke first, fill second: the stroke is centred on the glyph path, so the
 * fill covers its inner half and what is left reads as a drawn outline. This
 * is the canvas equivalent of `paint-order: stroke fill` in `.shout`.
 */
function inkedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  strokeWidth: number,
) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/* ------------------------------------------------------------------- art  */

/**
 * The comic action starburst. Ported from `starPoints` in `art/Burst.tsx` —
 * radius and angle are both jittered so no two spikes match, because a
 * perfectly regular star reads as clip-art and a slightly uneven one reads as
 * drawn.
 */
function burst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  spikes: number,
  color: string,
  seed: string,
  lineWidth = 8,
) {
  const next = rng(seed);
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const outer = i % 2 === 0;
    const r = radius * (outer ? 0.88 + next() * 0.12 : 0.48 + next() * 0.12);
    const angle = (Math.PI * i) / spikes + (next() - 0.5) * 0.08;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Rule 2: the halftone *is* a pookalam.
 *
 * Ben-Day dots laid out in concentric rings rather than a square grid, so the
 * pop-art shading motif and the Onam motif are the same object. This is the
 * card's only "shadow".
 */
function halftonePookalam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  from: number,
  to: number,
) {
  ctx.save();
  ctx.fillStyle = INK;
  for (let r = from; r <= to; r += 46) {
    const count = Math.max(8, Math.round((2 * Math.PI * r) / 38));
    // Alternate rings breathe in and out so the field never looks mechanical.
    const dot = r % 92 === 0 ? 6 : 4.2;
    ctx.globalAlpha = 0.16 - (r / to) * 0.07;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + r * 0.004;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

type ShapeKind = "vallam" | "pookalam" | "muthukuda" | "ila" | "thengu" | "kite" | "dots";
const SHAPES: ShapeKind[] = ["vallam", "pookalam", "muthukuda", "ila", "thengu", "kite", "dots"];

/**
 * Rule 3: Memphis decoration that secretly means Onam. Ported one-for-one from
 * `ConfettiShape` in `art/Confetti.tsx`, drawn in a 40×40 box at the origin so
 * the caller can scale and rotate it freely.
 */
function confettiShape(ctx: CanvasRenderingContext2D, kind: ShapeKind, color: string) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (kind) {
    case "vallam": {
      // Snake boat: a long low zigzag with the upturned prow.
      ctx.beginPath();
      ctx.moveTo(2, 26);
      for (const [x, y] of [
        [10, 18],
        [18, 26],
        [26, 18],
        [34, 26],
        [38, 14],
      ]) {
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.stroke();
      break;
    }
    case "pookalam": {
      const rings: [number, string][] = [
        [17, color],
        [10, PAPER],
        [4, color],
      ];
      for (const [r, fill] of rings) {
        ctx.beginPath();
        ctx.arc(20, 20, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      break;
    }
    case "muthukuda": {
      ctx.beginPath();
      ctx.moveTo(2, 24);
      ctx.arc(20, 24, 18, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, 24);
      ctx.lineTo(20, 36);
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case "ila": {
      // Banana leaf, as a Memphis blob.
      ctx.beginPath();
      ctx.moveTo(20, 3);
      ctx.bezierCurveTo(31, 8, 36, 15, 36, 21);
      ctx.bezierCurveTo(36, 27, 29, 37, 20, 37);
      ctx.bezierCurveTo(11, 37, 4, 27, 4, 21);
      ctx.bezierCurveTo(4, 15, 9, 8, 20, 3);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case "thengu": {
      ctx.beginPath();
      ctx.moveTo(15, 36);
      ctx.quadraticCurveTo(18, 24, 20, 14);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      const fronds: [number, number, number, number][] = [
        [28, 8, 35, 13],
        [29, 17, 34, 24],
        [12, 7, 5, 11],
        [10, 17, 6, 23],
        [20, 4, 21, 2],
      ];
      for (const [cx, cy, x, y] of fronds) {
        ctx.beginPath();
        ctx.moveTo(20, 14);
        ctx.quadraticCurveTo(cx, cy, x, y);
        ctx.stroke();
      }
      break;
    }
    case "kite": {
      ctx.beginPath();
      ctx.moveTo(20, 2);
      ctx.lineTo(36, 20);
      ctx.lineTo(20, 38);
      ctx.lineTo(4, 20);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case "dots": {
      ctx.fillStyle = color;
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          ctx.beginPath();
          ctx.arc(7 + col * 9, 7 + row * 9, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
}

/**
 * Scatter confetti everywhere except over the panel — the geometry is
 * decoration, and decoration never sits on top of a number somebody has to
 * read at thumbnail size.
 */
function scatterConfetti(
  ctx: CanvasRenderingContext2D,
  seed: string,
  count: number,
  keepOut: { x: number; y: number; w: number; h: number }[],
) {
  const next = rng(`${seed}-confetti`);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 120) {
    guard += 1;
    const size = 46 + next() * 54;
    const x = next() * (CARD_W - size);
    const y = next() * (CARD_H - size);
    const kind = SHAPES[Math.floor(next() * SHAPES.length)];
    const color = ACCENTS[Math.floor(next() * ACCENTS.length)];
    const spin = next() * 90 - 45;
    const clash = keepOut.some(
      (box) =>
        x + size > box.x - 10 &&
        x < box.x + box.w + 10 &&
        y + size > box.y - 10 &&
        y < box.y + box.h + 10,
    );
    if (clash) continue;
    placed += 1;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(rad(spin));
    ctx.scale(size / 40, size / 40);
    ctx.translate(-20, -20);
    confettiShape(ctx, kind, color);
    ctx.restore();
  }
}

/* --------------------------------------------------------------- loading  */

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;

  // Data URLs are already local in-memory
  if (src.startsWith("data:")) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Cross-origin URLs: fetch with CORS and create local object URL to avoid tainting canvas
  if (src.startsWith("http://") || src.startsWith("https://")) {
    try {
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) return null;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
    } catch {
      // If CORS fetch fails, resolve null so the card draws the initial medallion safely
      return null;
    }
  }

  // Same-origin local static assets
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Load every face the card sets, at a representative size.
 *
 * Without this the first `fillText` runs before the woff2 has landed and the
 * card silently renders in Comic Sans — which is a fine fallback for a web page
 * and a disaster for an image that outlives the session.
 */
export async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const specs = [
    '400 100px "Bungee"',
    '800 100px "Baloo Chettan 2"',
    '400 100px "Baloo Chettan 2"',
    "800 100px Nunito",
    '700 100px "Space Mono"',
    '400 100px "Space Mono"',
    "400 100px Bangers",
    "400 100px Caveat",
  ];
  try {
    await Promise.all(specs.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch {
    // A refused font load is not worth failing the card over.
  }
}

/* ------------------------------------------------------------------ card  */

export interface ShareCardData {
  playerName: string;
  avatarUrl?: string | null;
  customPhoto?: string | null;
  /** Already resolved to a display label ("Model Engineering College", etc). */
  college?: string | null;
  branch?: string | null;
  branchOther?: string | null;
  batch?: string | null;
  occupation?: string | null;
  /** Handle without the `@`. Omitted from the card when absent. */
  instagram?: string | null;
  gameTitle: string;
  gameSlug: string;
  day: number;
  metric: "time" | "score" | "fcfs";
  durationMs: number | null;
  score: number | null;
  rank: number | null;
  fieldSize: number | null;
  afterDeadline: boolean;
  /** `window.location.origin` — the one piece of the card doing any work. */
  origin: string;
  /** Stable per attempt, so the same run always draws the same card. */
  seed: string;
  /** When the card was drawn. Defaults to now; injectable so tests can pin it. */
  generatedAt?: Date;
  options?: {
    hideAvatar?: boolean;
    hideCollege?: boolean;
    hideBranch?: boolean;
    hideBatch?: boolean;
    hideInstagram?: boolean;
  };
}

/** The caption that travels with the image. */
export function captionFor(data: ShareCardData): string {
  const tier = tierFor(data);
  return buildCaption({
    playerName: data.playerName,
    gameTitle: data.gameTitle,
    day: data.day,
    rank: data.rank,
    fieldSize: data.fieldSize,
    figure: figureFor(data).value,
    tier,
    seed: data.seed,
    origin: data.origin,
  });
}

/**
 * Draw the whole card. Everything is laid out against the fixed 1080×1920
 * frame — there is no responsive behaviour here by design, because the output
 * is an image, not a page.
 */
export async function renderShareCard(data: ShareCardData): Promise<HTMLCanvasElement> {
  const tier = tierFor(data);
  const seed = data.seed;

  await ensureFonts();

  const spriteName = spriteFor(tier, seed) as SpriteName;
  const photoUrl = !data.options?.hideAvatar ? data.customPhoto || data.avatarUrl : null;

  const [memeImg, badgeImg, spriteImg, secondSpriteImg, photoImg] = await Promise.all([
    loadImage(memeFor(seed)),
    loadImage("/sprites/icons/foss-mec-badge.png"),
    loadImage(`/sprites/icons/${spriteName}.png`),
    loadImage("/sprites/icons/pookalam-flower.png"),
    photoUrl ? loadImage(photoUrl).catch(() => null) : Promise.resolve(null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const [panelA, panelB] = TIER_PANEL[tier];
  const burstColor = TIER_BURST[tier];

  /* ---- 1. paper ------------------------------------------------------- */
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Print grain. Restrained — rule: printed, never distressed.
  const grain = rng(`${seed}-grain`);
  ctx.fillStyle = INK;
  for (let i = 0; i < 900; i += 1) {
    ctx.globalAlpha = 0.02 + grain() * 0.05;
    ctx.fillRect(grain() * CARD_W, grain() * CARD_H, 2, 2);
  }
  ctx.globalAlpha = 1;

  /* ---- 2. the pookalam halftone --------------------------------------- */
  const panel = { x: 60, y: 300, w: CARD_W - 120, h: 900 };
  halftonePookalam(ctx, CARD_W / 2, panel.y + panel.h / 2, 150, 980);

  /* ---- 3. starbursts behind the panel --------------------------------- */
  burst(ctx, CARD_W - 90, panel.y - 20, 250, 13, POP.yellow, `${seed}-b1`, 7);
  burst(ctx, 96, panel.y + panel.h - 40, 210, 12, POP.yellow, `${seed}-b2`, 7);

  /* ---- 4. Memphis confetti (secretly Onam) ---------------------------- */
  const memeBox = MEME_BOX;
  scatterConfetti(ctx, seed, 12, [
    panel,
    memeBox,
    { x: 55, y: 66, w: 175, h: 180 },
    { x: 232, y: 76, w: 660, h: 150 },
    { x: SHOUT.cx - SHOUT.r, y: SHOUT.cy - SHOUT.r, w: SHOUT.r * 2, h: SHOUT.r * 2 },
    { x: 60, y: BRAG_Y - 40, w: CARD_W - 120, h: 150 },
    { x: 60, y: FOOTER_Y - 8, w: CARD_W - 120, h: FOOTER_H + 16 },
  ]);

  /* ---- 5. header: badge + wordmark ------------------------------------ */
  if (badgeImg) {
    ctx.save();
    ctx.translate(140, 158);
    ctx.rotate(rad(-3));
    ctx.drawImage(badgeImg, -78, -78, 156, 156);
    ctx.restore();
  }

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const markSize = fitSize(ctx, "FOSS × ONAM", 620, "logo", 76, 48);
  ctx.font = font("logo", markSize);
  ctx.fillStyle = POP.yellow;
  ctx.fillText("FOSS × ONAM", 254 + markSize * 0.06, 146 + markSize * 0.07);
  ctx.fillStyle = INK;
  ctx.fillText("FOSS × ONAM", 254, 146);

  ctx.font = font("mono", 30, 700);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`DAY ${data.day} · ${data.gameTitle.toUpperCase()}`, 256, 200);

  ctx.font = font("display", 27, 800);
  ctx.fillStyle = TEAL_DEEP;
  ctx.fillText("BY FOSSMEC", 256, 240);

  /* ---- 6. the panel --------------------------------------------------- */
  ctx.save();
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 54);
  ctx.clip();
  ctx.fillStyle = panelA;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.beginPath();
  ctx.moveTo(panel.x + panel.w * 0.46, panel.y);
  ctx.lineTo(panel.x + panel.w, panel.y);
  ctx.lineTo(panel.x + panel.w, panel.y + panel.h);
  ctx.lineTo(panel.x + panel.w * 0.63, panel.y + panel.h);
  ctx.closePath();
  ctx.fillStyle = panelB;
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 54);
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();

  /* ---- 7. chips inside the panel -------------------------------------- */
  const chipX = panel.x + 46;
  const chipW = panel.w - 92;
  const centreX = chipX + chipW / 2;

  // Resolve detail lines according to toggle options
  const showCollege = !data.options?.hideCollege && !!data.college?.trim();
  const showBranch = !data.options?.hideBranch && !!data.branch;
  const showBatch = !data.options?.hideBatch && !!data.batch && data.batch !== "na";
  const showInsta = !data.options?.hideInstagram && !!data.instagram?.trim();

  const collegeText = showCollege ? data.college!.trim() : "";
  const branchBatchParts: string[] = [];
  if (showBranch) {
    branchBatchParts.push(
      data.branch === "other" && data.branchOther ? data.branchOther : data.branch!.toUpperCase(),
    );
  }
  if (showBatch) {
    branchBatchParts.push(data.batch!.startsWith("2") ? `Batch ${data.batch}` : data.batch!);
  }
  const branchBatchText = branchBatchParts.join(" · ");
  const instaText = showInsta ? `@${data.instagram!.trim()}` : "";

  // Compute detail lines
  const detailLines: { text: string; isHandle?: boolean }[] = [];
  if (collegeText) detailLines.push({ text: collegeText });
  if (branchBatchText) detailLines.push({ text: branchBatchText });
  if (instaText) detailLines.push({ text: instaText, isHandle: true });

  const hasDetails = detailLines.length > 0;
  const hasPhoto = !!photoImg;

  // Chip 1 — the name + optional avatar photo
  const nameChipH = hasPhoto ? 210 : hasDetails ? 180 : 220;
  const nameChipY = panel.y + 50;
  inkedRect(ctx, chipX, nameChipY, chipW, nameChipH, 26, PAPER_2, 7);

  const name = data.playerName.trim().toUpperCase() || "PLAYER";

  if (hasPhoto && photoImg) {
    const photoSize = 130;
    const photoX = chipX + 36;
    const photoY = nameChipY + (nameChipH - photoSize) / 2;

    // Draw round cropped photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const pMin = Math.min(photoImg.width, photoImg.height);
    const pSx = (photoImg.width - pMin) / 2;
    const pSy = (photoImg.height - pMin) / 2;
    ctx.drawImage(photoImg, pSx, pSy, pMin, pMin, photoX, photoY, photoSize, photoSize);
    ctx.restore();

    // Ink border around photo
    ctx.beginPath();
    ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Name text next to photo
    const textLeft = photoX + photoSize + 30;
    const textW = chipX + chipW - textLeft - 20;
    const nameSize = fitSize(ctx, name, textW, "display", 76, 36, 800);
    ctx.textAlign = "left";
    ctx.font = font("display", nameSize, 800);
    ctx.fillStyle = INK;
    ctx.fillText(name, textLeft, nameChipY + nameChipH / 2 + 6);
    ctx.font = font("mono", 22, 700);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText("PLAYED FOSS ONAM GAMES", textLeft, nameChipY + nameChipH - 32);
  } else {
    const nameSize = fitSize(ctx, name, chipW - 70, "display", 92, 40, 800);
    ctx.textAlign = "center";
    ctx.font = font("display", nameSize, 800);
    ctx.fillStyle = INK;
    ctx.fillText(name, centreX, nameChipY + nameChipH / 2 + (hasDetails ? 4 : 14));
    ctx.font = font("mono", 24, 700);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText("PLAYED FOSS ONAM GAMES", centreX, nameChipY + nameChipH - 30);
  }

  // Chip 2 — dynamic details chip
  let cursor = nameChipY + nameChipH + 22;
  if (hasDetails) {
    const infoH = detailLines.length === 1 ? 110 : detailLines.length === 2 ? 148 : 180;
    inkedRect(ctx, chipX, cursor, chipW, infoH, 26, PAPER_2, 7);
    ctx.textAlign = "center";

    if (detailLines.length === 1) {
      const line = detailLines[0];
      const size = fitSize(ctx, line.text.toUpperCase(), chipW - 60, "display", 50, 24, 800);
      ctx.font = font(line.isHandle ? "mono" : "display", size, 800);
      ctx.fillStyle = line.isHandle ? POP.pink : INK;
      ctx.fillText(line.text.toUpperCase(), centreX, cursor + infoH / 2 + 14);
    } else if (detailLines.length === 2) {
      const line1 = detailLines[0];
      const line2 = detailLines[1];
      const size1 = fitSize(ctx, line1.text.toUpperCase(), chipW - 60, "display", 44, 22, 800);
      ctx.font = font(line1.isHandle ? "mono" : "display", size1, 800);
      ctx.fillStyle = line1.isHandle ? POP.pink : INK;
      ctx.fillText(line1.text.toUpperCase(), centreX, cursor + 58);

      const size2 = fitSize(ctx, line2.text.toUpperCase(), chipW - 60, "display", 38, 20, 800);
      ctx.font = font(line2.isHandle ? "mono" : "display", size2, 800);
      ctx.fillStyle = line2.isHandle ? POP.pink : INK_SOFT;
      ctx.fillText(line2.text.toUpperCase(), centreX, cursor + 112);
    } else {
      // 3 lines
      const line1 = detailLines[0];
      const line2 = detailLines[1];
      const line3 = detailLines[2];
      ctx.font = font("display", 38, 800);
      ctx.fillStyle = INK;
      ctx.fillText(line1.text.toUpperCase(), centreX, cursor + 48);

      ctx.font = font("display", 32, 700);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(line2.text.toUpperCase(), centreX, cursor + 96);

      ctx.font = font("mono", 32, 700);
      ctx.fillStyle = POP.pink;
      inkedText(ctx, line3.text, centreX, cursor + 148, POP.pink, 4);
    }

    cursor += infoH + 22;
  }

  // Row 3 — the rank medallion on the left, the figure on the right.
  const rowH = panel.y + panel.h - 46 - cursor;
  const medallionR = Math.min(rowH / 2, 126);
  const medallionCx = chipX + medallionR + 10;
  const medallionCy = cursor + rowH / 2;

  burst(ctx, medallionCx, medallionCy, medallionR + 20, 16, burstColor, `${seed}-rank`, 7);
  ctx.textAlign = "center";
  if (data.rank) {
    const rankText = `#${data.rank}`;
    const rankSize = fitSize(ctx, rankText, medallionR * 1.7, "display", 92, 40, 800);
    ctx.font = font("display", rankSize, 800);
    inkedText(ctx, rankText, medallionCx, medallionCy + 6, PAPER_2, 8);
    ctx.font = font("mono", 28, 700);
    ctx.fillStyle = INK;
    ctx.fillText(data.fieldSize ? `of ${data.fieldSize}` : "ranked", medallionCx, medallionCy + 52);
  } else {
    ctx.font = font("display", 46, 800);
    inkedText(ctx, "JUST", medallionCx, medallionCy - 6, PAPER_2, 7);
    inkedText(ctx, "FOR FUN", medallionCx, medallionCy + 46, PAPER_2, 7);
  }

  const figureX = medallionCx + medallionR + 44;
  const figureW = chipX + chipW - figureX;
  inkedRect(ctx, figureX, cursor, figureW, rowH, 26, PAPER_2, 7);
  const figure = figureFor(data);
  const figureCx = figureX + figureW / 2;
  const figSize = fitSize(ctx, figure.value, figureW - 56, "mono", 104, 44, 700);
  ctx.font = font("mono", figSize, 700);
  ctx.fillStyle = INK;
  ctx.fillText(figure.value, figureCx, cursor + rowH / 2 + 14);
  const labelSize = fitSize(ctx, figure.label, figureW - 44, "display", 30, 18, 800);
  ctx.font = font("display", labelSize, 800);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(figure.label, figureCx, cursor + rowH - 34);

  /* ---- 8. prominent meme / player photo card -------------------------- */
  const displayCardImg = photoImg || memeImg;
  if (displayCardImg) {
    ctx.save();
    ctx.translate(memeBox.x + memeBox.w / 2, memeBox.y + memeBox.h / 2);
    ctx.rotate(rad(-3.5));
    const frame = memeBox.w;
    // Cover-crop to a square so a portrait/photo is never squashed.
    const side = Math.min(displayCardImg.width, displayCardImg.height);
    const sx = (displayCardImg.width - side) / 2;
    const sy = (displayCardImg.height - side) / 2;
    ctx.save();
    roundRectPath(ctx, -frame / 2, -frame / 2, frame, frame, 22);
    ctx.clip();
    ctx.fillStyle = PAPER_2;
    ctx.fillRect(-frame / 2, -frame / 2, frame, frame);
    ctx.drawImage(displayCardImg, sx, sy, side, side, -frame / 2, -frame / 2, frame, frame);
    ctx.restore();
    roundRectPath(ctx, -frame / 2, -frame / 2, frame, frame, 22);
    ctx.lineWidth = 9;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // If custom photo or player photo is featured, add a prominent comic stamp/badge across the bottom
    if (photoImg && displayCardImg === photoImg) {
      const tagText = "★ PLAYER PHOTO ★";
      ctx.font = font("display", 24, 800);
      const tagW = ctx.measureText(tagText).width + 28;
      const tagH = 36;
      const tagX = -tagW / 2;
      const tagY = frame / 2 - tagH - 12;

      inkedRect(ctx, tagX, tagY, tagW, tagH, 8, POP.yellow, 4);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.fillText(tagText, 0, tagY + 25);
    }

    ctx.restore();
  }

  /* ---- 9. the taunt --------------------------------------------------- */
  burst(ctx, SHOUT.cx, SHOUT.cy, SHOUT.r, 14, burstColor, `${seed}-shout`, 8);
  ctx.save();
  ctx.translate(SHOUT.cx, SHOUT.cy);
  ctx.rotate(rad(-4));
  // Two lines at most, split as evenly as the words allow. Three or four
  // stacked words shrink the type to the point where the shout stops shouting.
  const shoutLines = balanceLines(taunt(tier, seed), 2);
  const longest = shoutLines.reduce((a, b) => (a.length > b.length ? a : b));
  const shoutSize = fitSize(ctx, longest, SHOUT.r * 1.55, "comic", 116, 48);
  ctx.font = font("comic", shoutSize);
  ctx.textAlign = "center";
  const lineH = shoutSize * 0.86;
  shoutLines.forEach((line, i) => {
    inkedText(
      ctx,
      line,
      0,
      (i - (shoutLines.length - 1) / 2) * lineH + shoutSize * 0.3,
      PAPER_2,
      9,
    );
  });
  ctx.restore();

  /* ---- 10. the brag, in its own band under the meme and the shout ----- */
  ctx.textAlign = "center";
  ctx.font = font("body", 34, 800);
  ctx.fillStyle = INK;
  const bragLines = wrapLines(ctx, brag(tier, seed), CARD_W - 180, 2);
  bragLines.forEach((line, i) => {
    ctx.fillText(line, CARD_W / 2, BRAG_Y + i * BRAG_LINE_H);
  });

  /* ---- 11. the handwritten aside -------------------------------------- */
  // One line, always: this is a margin note, and a margin note that wraps is a
  // paragraph. The type shrinks instead.
  ctx.save();
  ctx.translate(70, ASIDE_Y);
  ctx.rotate(rad(-1.2));
  ctx.textAlign = "left";
  ctx.font = font("hand", 46);
  ctx.fillStyle = POP.teal;
  ctx.fillText("↳", 0, 0);
  const asideText = aside(seed);
  const asideSize = fitSize(ctx, asideText, CARD_W - 220, "hand", 46, 30);
  ctx.font = font("hand", asideSize);
  ctx.fillStyle = INK;
  ctx.fillText(asideText, 46, 0);
  ctx.restore();

  /* ---- 12. sprites, tilted like stickers ------------------------------ */
  const stick = (
    img: HTMLImageElement | null,
    x: number,
    y: number,
    size: number,
    tilt: number,
  ) => {
    if (!img) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad(tilt));
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
  stick(spriteImg, 985, 1215, 175, SPRITE_REGISTRY[spriteName]?.defaultTilt ?? -3);
  stick(secondSpriteImg, 852, 208, 130, 6);

  /* ---- 13. footer ----------------------------------------------------- */
  inkedRect(ctx, 60, FOOTER_Y, CARD_W - 120, FOOTER_H, 28, PAPER_3, 8);
  const baseline = FOOTER_Y + 46;
  ctx.textAlign = "left";
  const url = data.origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const urlSize = fitSize(ctx, url, 560, "mono", 34, 22, 700);
  ctx.font = font("mono", urlSize, 700);
  ctx.fillStyle = INK;
  ctx.fillText(url, 100, baseline);
  ctx.textAlign = "right";
  ctx.font = font("display", 38, 800);
  ctx.fillStyle = INK;
  ctx.fillText("fossmec", CARD_W - 100, baseline);

  /*
   * When the card was made.
   *
   * A leaderboard moves all week, so "#3 of 47" is only true as of a moment —
   * and a card doing the rounds three days later should say when it was true
   * rather than quietly claim to be current. IST, because the whole event is.
   */
  ctx.textAlign = "center";
  ctx.font = font("mono", 22, 400);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(stampedAt(data.generatedAt), CARD_W / 2, FOOTER_Y + FOOTER_H - 18);

  return canvas;
}

/** The card as a PNG blob, ready for `navigator.share` or a download. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the card"));
    }, "image/png");
  });
}
