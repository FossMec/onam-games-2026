import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARKS_DIR = path.resolve(ROOT, "public", "images", "marks");
const OUT_DIR = path.resolve(ROOT, ".cache", "icon-previews");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Clean previous previews
for (const file of fs.readdirSync(OUT_DIR)) {
  if (file.endsWith(".svg") || file.endsWith(".png")) {
    fs.unlinkSync(path.join(OUT_DIR, file));
  }
}

const markFiles = fs
  .readdirSync(MARKS_DIR)
  .filter((f) => f.endsWith(".svg"))
  .sort();
console.log(`Generating preview cards for ${markFiles.length} official icons into ${OUT_DIR}...`);

const svgFiles = [];

for (let i = 0; i < markFiles.length; i++) {
  const file = markFiles[i];
  const id = path.basename(file, ".svg");
  const num = String(i + 1).padStart(2, "0");
  const fileName = `${num}_${id}.svg`;
  const filePath = path.join(OUT_DIR, fileName);
  const markContent = fs.readFileSync(path.join(MARKS_DIR, file), "utf8");

  const base64Svg = Buffer.from(markContent).toString("base64");
  const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="500" height="550">
  <!-- Card Background -->
  <rect width="200" height="220" rx="14" fill="#fdfbf7" stroke="#22202b" stroke-width="4" />
  
  <!-- Outer Paper Disc Badge with Ink Border -->
  <circle cx="100" cy="92" r="70" fill="#ffffff" stroke="#22202b" stroke-width="4" />
  
  <!-- Isolated 100% Authentic Multi-Color SVG Image -->
  <image x="42" y="34" width="116" height="116" href="${dataUri}" preserveAspectRatio="xMidYMid meet" />
  
  <!-- Pill Label -->
  <rect x="20" y="174" width="160" height="32" rx="8" fill="#22202b" />
  <text x="100" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="#ffffff" letter-spacing="0.5">${id} (${i + 1}/${markFiles.length})</text>
</svg>`;

  fs.writeFileSync(filePath, svgContent, "utf8");
  svgFiles.push(filePath);
}

console.log(`Successfully generated ${svgFiles.length} SVG icon previews!`);
console.log(`Opening icons in feh...`);

// Launch feh
const fehProcess = spawn(
  "feh",
  [
    "-g",
    "500x550",
    "--auto-zoom",
    "--scale-down",
    "--draw-filename",
    "--sort",
    "filename",
    ...svgFiles,
  ],
  {
    stdio: "inherit",
    detached: true,
  },
);

fehProcess.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error("\n'feh' is not installed or not in PATH.");
    console.log(`Generated SVG files are available in: ${OUT_DIR}`);
    console.log(
      `You can view them with: xdg-open ${OUT_DIR} or install feh with: sudo apt install feh`,
    );
  } else {
    console.error("Failed to start feh:", err);
  }
});

fehProcess.unref();
