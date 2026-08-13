// Generates public/pookalam-placeholder.svg — a stand-in pookalam for the
// jigsaw until the real artwork lands.
//
// It is generated rather than hand-drawn so the parameters below can be tuned
// (ring count, petal counts, palette) and the file regenerated, instead of
// someone editing 400 hand-written path elements.
//
// SWAPPING IT: the jigsaw only ever uses this as a texture inside clip paths,
// so replacing it means pointing `games.assets_json.imageUrl` at a new file.
// Requirements for any replacement:
//   - SQUARE aspect ratio (the cutter assumes it)
//   - busy near the edges as well as the centre; a plain border makes the
//     corner pieces guesswork
//   - remember that a more symmetric design is a HARDER puzzle, so revisit
//     `minPlausibleMs` for the jigsaw in the registry when you change it.
//
// Usage: node scripts/make-pookalam.mjs
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const SIZE = 1000;
const C = SIZE / 2;

// The site palette, so the placeholder already looks like it belongs.
const PALETTE = {
  paper: "#FBF3E4",
  ink: "#22202B",
  red: "#F2695C",
  yellow: "#F5C443",
  teal: "#5FBFA8",
  blue: "#7B9BE0",
  pink: "#E48BB4",
  purple: "#9C82D4",
};

const parts = [];
const push = (s) => parts.push(s);

const rad = (deg) => (deg * Math.PI) / 180;
const x = (r, deg) => (C + r * Math.cos(rad(deg))).toFixed(2);
const y = (r, deg) => (C + r * Math.sin(rad(deg))).toFixed(2);

/** A ring of teardrop petals — the motif that reads most "pookalam". */
function petalRing(count, rInner, rOuter, fill, rotate = 0) {
  const step = 360 / count;
  const spread = step * 0.42;
  for (let i = 0; i < count; i += 1) {
    const a = i * step + rotate;
    push(
      `<path d="M ${x(rInner, a)} ${y(rInner, a)} ` +
        `Q ${x(rOuter, a - spread)} ${y(rOuter, a - spread)} ${x(rOuter, a)} ${y(rOuter, a)} ` +
        `Q ${x(rOuter, a + spread)} ${y(rOuter, a + spread)} ${x(rInner, a)} ${y(rInner, a)} Z" ` +
        `fill="${fill}" stroke="${PALETTE.ink}" stroke-width="3"/>`,
    );
  }
}

/** A ring of dots. Doubles as the Ben-Day nod. */
function dotRing(count, r, dotR, fill, rotate = 0) {
  const step = 360 / count;
  for (let i = 0; i < count; i += 1) {
    const a = i * step + rotate;
    push(
      `<circle cx="${x(r, a)}" cy="${y(r, a)}" r="${dotR}" fill="${fill}" stroke="${PALETTE.ink}" stroke-width="2.5"/>`,
    );
  }
}

/** A ring of triangles, for the Memphis edge. */
function triangleRing(count, rInner, rOuter, fill, rotate = 0) {
  const step = 360 / count;
  const half = step * 0.38;
  for (let i = 0; i < count; i += 1) {
    const a = i * step + rotate;
    push(
      `<path d="M ${x(rOuter, a)} ${y(rOuter, a)} L ${x(rInner, a - half)} ${y(rInner, a - half)} ` +
        `L ${x(rInner, a + half)} ${y(rInner, a + half)} Z" ` +
        `fill="${fill}" stroke="${PALETTE.ink}" stroke-width="2.5"/>`,
    );
  }
}

const ring = (r, fill, width = 4) =>
  push(
    `<circle cx="${C}" cy="${C}" r="${r}" fill="${fill}" stroke="${PALETTE.ink}" stroke-width="${width}"/>`,
  );

// --- build outward-in so later rings paint on top -------------------------
push(`<rect width="${SIZE}" height="${SIZE}" fill="${PALETTE.paper}"/>`);

// Corners get their own motifs: a plain background here would make the four
// corner pieces pure guesswork.
for (const [cx, cy] of [
  [90, 90],
  [SIZE - 90, 90],
  [90, SIZE - 90],
  [SIZE - 90, SIZE - 90],
]) {
  push(
    `<circle cx="${cx}" cy="${cy}" r="58" fill="${PALETTE.pink}" stroke="${PALETTE.ink}" stroke-width="4"/>`,
  );
  push(
    `<circle cx="${cx}" cy="${cy}" r="26" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="3"/>`,
  );
}

ring(478, PALETTE.purple);
petalRing(32, 400, 470, PALETTE.yellow);
ring(400, PALETTE.teal);
triangleRing(24, 330, 396, PALETTE.red, 7.5);
ring(330, PALETTE.paper);
dotRing(24, 305, 13, PALETTE.purple);
ring(280, PALETTE.blue);
petalRing(16, 200, 275, PALETTE.paper, 11);
ring(200, PALETTE.red);
triangleRing(12, 140, 196, PALETTE.yellow, 15);
ring(140, PALETTE.teal);
petalRing(8, 60, 135, PALETTE.pink, 22.5);
ring(60, PALETTE.yellow);
dotRing(6, 34, 12, PALETTE.ink);
ring(16, PALETTE.red, 3);

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">\n` +
  parts.map((p) => `  ${p}`).join("\n") +
  `\n</svg>\n`;

const out = join(process.cwd(), "public", "pookalam-placeholder.svg");
await writeFile(out, svg);
console.log(`wrote ${out} (${(svg.length / 1024).toFixed(1)} KB, ${parts.length} shapes)`);
