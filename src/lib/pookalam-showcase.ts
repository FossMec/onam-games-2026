/**
 * The "look what this turns into" pookalam, sitting between stop 5 and stop 6.
 *
 * By stop 5 somebody has four rings of ellipses and is entitled to wonder
 * whether that is the ceiling. It is not, and the honest way to show that is a
 * finished piece with its source next to it - not a screenshot of somebody
 * else's entry.
 *
 * It is deliberately long and deliberately repetitive. Every clever trick was
 * taken out: no `forEach`, no destructuring, no arrow functions, no maths a
 * first-year has not met. What is left is four small named functions and a list
 * of calls, so the whole thing reads as "draw a ring, draw another ring" ninety
 * lines in a row. Somebody who understood stop 5 can read this top to bottom
 * and change any number in it, which is the entire point - a beginner should
 * finish it thinking "that is just more of what I did", not "that is magic".
 */

export const SHOWCASE_SNIPPET = `// A full pookalam, built out of one idea repeated:
//   go to the middle  ->  turn a little  ->  draw one shape
// Everything below is that, with different numbers.

// Every number below is measured for a 360 x 360 canvas. This one line makes
// the whole drawing fit whatever size the canvas actually is:
ctx.scale(W / 360, H / 360);

const cx = 180;
const cy = 180;

// ---------- the ground ----------
ctx.fillStyle = "#1B0B2A";
ctx.fillRect(0, 0, 360, 360);


// ---------- small helpers ----------

// one petal, lying on its side, "distance" away from the middle
function petal(distance, long, wide, colour) {
  ctx.beginPath();
  ctx.ellipse(distance, 0, long, wide, 0, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}

// one whole ring of petals
function ring(count, distance, long, wide, colour, twist) {
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * 2 * Math.PI) / count + twist);
    petal(distance, long, wide, colour);
    ctx.restore();
  }
}

// one ring of little round dots
function dots(count, distance, size, colour) {
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const x = cx + distance * Math.cos(angle);
    const y = cy + distance * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  }
}

// one ring of triangles - the saw-tooth edge you see on real pookalams
function spikes(count, distance, height, half, colour) {
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * 2 * Math.PI) / count);
    ctx.beginPath();
    ctx.moveTo(distance, -half);
    ctx.lineTo(distance + height, 0);
    ctx.lineTo(distance, half);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }
}

// a plain circle in the middle
function disc(size, colour) {
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}


// ---------- now just call them, outside first ----------

spikes(48, 156, 14, 7, "#F4A261");     // saw-tooth border
dots(48, 150, 3, "#FFD166");           // tiny gold beads on the edge

ring(36, 132, 24, 8, "#E63946", 0);    // big red outer petals
ring(36, 132, 12, 4, "#FF8FA3", 0);    // lighter red inside them

dots(24, 108, 5, "#FFFFFF");           // white bead ring

ring(24, 92, 26, 11, "#F4A261", 0.07); // orange layer
ring(24, 92, 13, 5, "#FFD166", 0.07);  // yellow highlight on top

ring(32, 68, 16, 6, "#2A9D8F", 0);     // green leaves
dots(32, 56, 3, "#A8E6CF");            // pale green beads

ring(16, 44, 18, 9, "#9C82D4", 0.2);   // violet inner ring
ring(16, 44, 9, 4, "#E0D3FF", 0.2);    // pale violet on top

disc(26, "#F5C443");                   // gold centre
disc(18, "#E76F51");                   // orange inside it
dots(8, 12, 3, "#FFFFFF");             // eight white petals in the middle
disc(5, "#FFFFFF");                    // the lamp itself
`;
