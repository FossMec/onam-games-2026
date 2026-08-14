// Downloads the self-hosted webfonts into public/fonts/.
//
// We self-host rather than hotlinking Google's CDN: one less third party in the
// critical path, no cross-origin cache miss, and the site keeps working if
// fonts.googleapis.com is blocked (which happens on some campus networks).
//
// Every family here is free for commercial use. Re-run after changing the list;
// it is idempotent and overwrites in place.
//
// Usage: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "fonts");

// Google serves woff2 only to UAs it believes support it.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * `out`    — filename written to public/fonts (must match @font-face in app.css)
 * `query`  — Google Fonts CSS2 `family=` value
 * `subset` — which unicode subset block to keep. Everything is latin except the
 *            Malayalam cut of Baloo Chettan 2, where we take both.
 */
const FONTS = [
  // Wordmark only — two layers stacked for comic-poster chrome.
  { out: "bungee.woff2", query: "Bungee", subsets: ["latin"] },

  // Display / headings / buttons.
  { out: "baloo-chettan-2.woff2", query: "Baloo+Chettan+2:wght@400..800", subsets: ["latin"] },
  // Baloo Chettan 2 also ships a Malayalam cut (+44 KB). Nothing renders
  // Malayalam script today — the shouts are transliterated ("ADIPOLI", not
  // "അടിപൊളി") — so it is left out. Add this back the moment real Malayalam
  // appears in the UI, or it will fall back to a system font and look wrong:
  // { out: "baloo-chettan-2-ml.woff2", query: "Baloo+Chettan+2:wght@400..800",
  //   subsets: ["malayalam"] },

  // Body / UI.
  { out: "nunito.woff2", query: "Nunito:wght@400..900", subsets: ["latin"] },

  // Numerals — timers, leaderboards.
  { out: "space-mono-400.woff2", query: "Space+Mono:wght@400", subsets: ["latin"] },
  { out: "space-mono-700.woff2", query: "Space+Mono:wght@700", subsets: ["latin"] },

  // Onomatopoeia shouts.
  { out: "bangers.woff2", query: "Bangers", subsets: ["latin"] },

  // Margin scribbles / the sarcasm channel. Single weight: a marker hand is
  // never bolded, and the variable range costs 3x the bytes for nothing.
  { out: "caveat.woff2", query: "Caveat:wght@400", subsets: ["latin"] },
];

/**
 * The CSS2 response is a run of `/* subset *\/` comments each followed by an
 * @font-face block. Pair them up so we can pick a specific subset.
 */
function parseSubsets(css) {
  const found = new Map();
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/gi;
  let match;
  while ((match = re.exec(css)) !== null) {
    const [, subset, block] = match;
    const url = /src:\s*url\((https:\/\/[^)]+\.woff2)\)/i.exec(block)?.[1];
    // Keep the first hit; CSS2 lists one block per subset per weight range.
    if (url && !found.has(subset)) found.set(subset, url);
  }
  return found;
}

async function fetchFont({ out, query, subsets }) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": UA } });
  if (!cssRes.ok) throw new Error(`CSS ${cssRes.status} for ${query}`);
  const css = await cssRes.text();

  const available = parseSubsets(css);
  const subset = subsets.find((s) => available.has(s));
  if (!subset) {
    const got = [...available.keys()].join(", ");
    throw new Error(`no subset ${subsets.join("|")} for ${query} (got: ${got})`);
  }

  const fontRes = await fetch(available.get(subset), { headers: { "User-Agent": UA } });
  if (!fontRes.ok) throw new Error(`font ${fontRes.status} for ${query}`);
  const buffer = Buffer.from(await fontRes.arrayBuffer());
  await writeFile(join(OUT_DIR, out), buffer);
  return buffer.byteLength;
}

await mkdir(OUT_DIR, { recursive: true });

let total = 0;
for (const font of FONTS) {
  try {
    const bytes = await fetchFont(font);
    total += bytes;
    console.log(`  ${font.out.padEnd(34)} ${(bytes / 1024).toFixed(1).padStart(7)} KB`);
  } catch (error) {
    console.error(`  ${font.out.padEnd(34)}  FAILED — ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`\ntotal ${(total / 1024).toFixed(1)} KB across ${FONTS.length} files`);
