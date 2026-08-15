import { For, Show, type JSX } from "solid-js";

/**
 * Project marks for the Tinder deck.
 *
 * These are hand-drawn homages, not the real logos. That is a deliberate call
 * on three counts: the real marks are trademarks with usage rules we have no
 * standing to interpret; they are raster assets we would have to ship from
 * somewhere; and dropping seventy foreign brand styles into a cream-and-ink
 * comic would look like a spreadsheet of favicons. Redrawing each one in flat
 * ink and washed pop colour keeps the deck recognisable *and* ours.
 *
 * Every mark is built from the same primitives — one ink weight, one palette,
 * halftone for shading, no gradients, no shadows. Anything without a curated
 * drawing falls through to `GenericMark`, a deterministic Memphis composition
 * built from the project's own id, so an unknown card never looks unfinished.
 *
 * IMPORTANT: nothing in here may hint at the answer. No mark may be styled by
 * licence, and the generic fallback hashes the id — not `open` — so the colour
 * of a card can never be read as its verdict.
 */

const POPS = [
  "var(--pop-red)",
  "var(--pop-yellow)",
  "var(--pop-teal)",
  "var(--pop-blue)",
  "var(--pop-pink)",
  "var(--pop-purple)",
];

/** FNV-1a. Stable across server and client, which SSR requires. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const INK = "var(--ink)";
const PAPER = "var(--paper-2)";

/* ------------------------------------------------------------------ marks */

/**
 * Curated drawings, keyed by card id. Coordinates are all in a 100x100 box so
 * every mark scales to whatever the card gives it.
 *
 * Brand traps deliberately share a drawing: Chromium and Chrome get the same
 * pinwheel, Docker Engine and Docker Desktop the same whale, VSCodium and VS
 * Code the same ribbon. Giving them distinct art would hand over the answer
 * that the game is specifically asking you to know.
 */
const MARKS: Record<string, () => JSX.Element> = {
  /* ------------------------------------------------------------ browsers */
  firefox: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-blue)" stroke={INK} stroke-width="4" />
      <path
        d="M50 22c14 0 22 9 22 20 0 14-10 24-22 24s-22-9-22-21c0-7 4-13 10-16-2 7 1 12 6 13-4-8 0-17 6-20z"
        fill="var(--pop-red)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <circle cx="50" cy="48" r="7" fill="var(--pop-yellow)" stroke={INK} stroke-width="3.5" />
    </>
  ),
  chromium: () => <Pinwheel />,
  chrome: () => <Pinwheel />,
  arc: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-purple)" stroke={INK} stroke-width="4" />
      <path
        d="M30 68c6-24 14-36 20-36s14 12 20 36"
        fill="none"
        stroke={INK}
        stroke-width="8"
        stroke-linecap="round"
      />
      <circle cx="66" cy="62" r="7" fill="var(--pop-yellow)" stroke={INK} stroke-width="3.5" />
    </>
  ),
  safari: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-blue)" stroke={INK} stroke-width="4" />
      <circle cx="50" cy="50" r="26" fill={PAPER} stroke={INK} stroke-width="3" />
      <path d="M66 34 55 55 34 66 45 45z" fill="var(--pop-red)" stroke={INK} stroke-width="3.5" />
    </>
  ),

  /* -------------------------------------------------------------- editors */
  gimp: () => (
    <>
      <path
        d="M28 62c0-16 10-30 22-30s22 12 22 28c0 12-9 20-22 20s-22-8-22-18z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="4"
      />
      <circle cx="41" cy="52" r="7" fill={PAPER} stroke={INK} stroke-width="3" />
      <circle cx="59" cy="52" r="7" fill={PAPER} stroke={INK} stroke-width="3" />
      <circle cx="42" cy="53" r="3" fill={INK} />
      <circle cx="60" cy="53" r="3" fill={INK} />
      <path d="M44 68q6 6 12 0" fill="none" stroke={INK} stroke-width="4" stroke-linecap="round" />
    </>
  ),
  krita: () => <Brush color="var(--pop-pink)" />,
  photoshop: () => <LetterTile text="Ps" color="var(--pop-blue)" />,
  illustrator: () => <LetterTile text="Ai" color="var(--pop-yellow)" />,
  premiere: () => <LetterTile text="Pr" color="var(--pop-purple)" />,
  inkscape: () => (
    <>
      <path
        d="M50 22 74 70H26z"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <For
        each={[
          [50, 22],
          [74, 70],
          [26, 70],
        ]}
      >
        {([x, y]) => (
          <rect
            x={x - 6}
            y={y - 6}
            width="12"
            height="12"
            fill={PAPER}
            stroke={INK}
            stroke-width="3.5"
          />
        )}
      </For>
    </>
  ),
  canva: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-teal)" stroke={INK} stroke-width="4" />
      <path
        d="M62 38a18 18 0 1 0 0 24"
        fill="none"
        stroke={INK}
        stroke-width="8"
        stroke-linecap="round"
      />
    </>
  ),

  /* -------------------------------------------------------- code + shell */
  vscodium: () => <Ribbon />,
  vscode: () => <Ribbon />,
  sublime: () => (
    <>
      <path
        d="M28 34 72 22v20L28 54z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M72 78 28 66V46l44 12z"
        fill="var(--pop-red)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  vim: () => <Terminal color="var(--pop-teal)" />,
  neovim: () => <Terminal color="var(--pop-teal)" />,
  notepadpp: () => <Terminal color="var(--pop-blue)" />,

  /* ------------------------------------------------------------ languages */
  python: () => (
    <>
      <path
        d="M50 20c12 0 16 4 16 12v10H42v4h30c6 0 8 6 8 14s-2 14-8 14h-8v-12c0-8-4-12-14-12H40c-6 0-10-4-10-12V32c0-8 6-12 20-12z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="3.5"
        stroke-linejoin="round"
      />
      <circle cx="42" cy="30" r="3.5" fill={PAPER} stroke={INK} stroke-width="2" />
      <path
        d="M50 80c-12 0-16-4-16-12V58h24v-4H28c-6 0-8-6-8-14s2-14 8-14h8v12c0 8 4 12 14 12h10c6 0 10 4 10 12v10c0 8-6 8-20 8z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="3.5"
        stroke-linejoin="round"
        opacity="0"
      />
      <circle cx="58" cy="70" r="3.5" fill={PAPER} stroke={INK} stroke-width="2" />
      <path
        d="M50 80c-14 0-20 0-20-8V62c0-8 4-12 10-12h12c10 0 14-4 14-12V38h6c6 0 8 6 8 14v16c0 8-4 12-16 12z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="3.5"
        stroke-linejoin="round"
      />
    </>
  ),
  rust: () => (
    <>
      <Gear color="var(--pop-red)" />
      <text
        x="50"
        y="62"
        text-anchor="middle"
        fill={INK}
        style={{ font: "800 30px var(--font-stack-display)" }}
      >
        R
      </text>
    </>
  ),
  nodejs: () => (
    <>
      <path
        d="M50 18 79 35v34L50 86 21 69V35z"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <text
        x="50"
        y="62"
        text-anchor="middle"
        fill={INK}
        style={{ font: "800 26px var(--font-stack-display)" }}
      >
        JS
      </text>
    </>
  ),
  react: () => (
    <>
      <ellipse
        cx="50"
        cy="50"
        rx="36"
        ry="14"
        fill="none"
        stroke={INK}
        stroke-width="4"
        transform="rotate(0 50 50)"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="36"
        ry="14"
        fill="none"
        stroke={INK}
        stroke-width="4"
        transform="rotate(60 50 50)"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="36"
        ry="14"
        fill="none"
        stroke={INK}
        stroke-width="4"
        transform="rotate(120 50 50)"
      />
      <circle cx="50" cy="50" r="9" fill="var(--pop-blue)" stroke={INK} stroke-width="3.5" />
    </>
  ),

  /* ------------------------------------------------------ infra + devops */
  git: () => (
    <>
      <path d="M30 70 30 40 66 40" fill="none" stroke={INK} stroke-width="5" />
      <path d="M30 55 50 55" fill="none" stroke={INK} stroke-width="5" />
      <Node cx={30} cy={74} color="var(--pop-red)" />
      <Node cx={30} cy={36} color="var(--pop-red)" />
      <Node cx={70} cy={40} color="var(--pop-yellow)" />
      <Node cx={54} cy={55} color="var(--pop-teal)" />
    </>
  ),
  jenkins: () => (
    <>
      <circle cx="50" cy="42" r="20" fill="var(--pop-red)" stroke={INK} stroke-width="4" />
      <circle cx="43" cy="40" r="5" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <circle cx="57" cy="40" r="5" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <path
        d="M34 64q16 14 32 0v16H34z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  dockerengine: () => <Whale />,
  dockerdesktop: () => <Whale />,
  kubernetes: () => (
    <>
      <path
        d="M50 16 80 32v36L50 84 20 68V32z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <circle cx="50" cy="50" r="11" fill={PAPER} stroke={INK} stroke-width="3.5" />
      <For each={[0, 72, 144, 216, 288]}>
        {(angle) => (
          <line
            x1="50"
            y1="50"
            x2={50 + 24 * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={50 + 24 * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke={INK}
            stroke-width="4"
            stroke-linecap="round"
          />
        )}
      </For>
      <circle cx="50" cy="50" r="11" fill={PAPER} stroke={INK} stroke-width="3.5" />
    </>
  ),
  nginx: () => <LetterTile text="N" color="var(--pop-teal)" />,
  postgres: () => (
    <>
      <ellipse
        cx="50"
        cy="46"
        rx="26"
        ry="24"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
      />
      <path
        d="M30 60c-2 14 4 22 10 22M70 60c2 14-4 22-10 22"
        fill="none"
        stroke={INK}
        stroke-width="4"
        stroke-linecap="round"
      />
      <circle cx="42" cy="42" r="4.5" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <circle cx="60" cy="42" r="4.5" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <path
        d="M30 34q-10-6-14 2"
        fill="none"
        stroke={INK}
        stroke-width="4"
        stroke-linecap="round"
      />
    </>
  ),
  ansible: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-yellow)" stroke={INK} stroke-width="4" />
      <path
        d="M50 28 68 72 50 58 38 66z"
        fill={PAPER}
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  wireshark: () => (
    <>
      <path
        d="M22 56c8-20 20-30 28-30s20 10 28 30c-8 12-18 18-28 18s-20-6-28-18z"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <circle cx="50" cy="50" r="10" fill={PAPER} stroke={INK} stroke-width="3.5" />
      <circle cx="50" cy="50" r="4" fill={INK} />
    </>
  ),

  /* ------------------------------------------------------------ media/av */
  vlc: () => (
    <>
      <path
        d="M50 20 74 76H26z"
        fill="var(--pop-red)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="M41 44h18l4 10H37z" fill={PAPER} stroke={INK} stroke-width="3" />
      <rect
        x="22"
        y="74"
        width="56"
        height="8"
        rx="3"
        fill={PAPER}
        stroke={INK}
        stroke-width="3.5"
      />
    </>
  ),
  obs: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-purple)" stroke={INK} stroke-width="4" />
      <circle cx="50" cy="50" r="14" fill={PAPER} stroke={INK} stroke-width="4" />
      <path
        d="M50 22a28 28 0 0 1 24 14"
        fill="none"
        stroke={INK}
        stroke-width="5"
        stroke-linecap="round"
      />
    </>
  ),
  audacity: () => <Waveform color="var(--pop-yellow)" />,
  kdenlive: () => <FilmStrip color="var(--pop-teal)" />,
  handbrake: () => <FilmStrip color="var(--pop-red)" />,
  finalcut: () => <FilmStrip color="var(--pop-purple)" />,
  spotify: () => (
    <>
      <circle cx="50" cy="50" r="34" fill="var(--pop-teal)" stroke={INK} stroke-width="4" />
      <For each={[0, 1, 2]}>
        {(i) => (
          <path
            d={`M${32 + i * 4} ${42 + i * 10}q${18 - i * 4} -8 ${36 - i * 8} 0`}
            fill="none"
            stroke={INK}
            stroke-width="5"
            stroke-linecap="round"
          />
        )}
      </For>
    </>
  ),
  tiktok: () => (
    <>
      <path
        d="M44 70a10 10 0 1 0 10-10V24h10c2 8 6 12 14 13"
        fill="none"
        stroke={INK}
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="44" cy="70" r="11" fill="var(--pop-pink)" stroke={INK} stroke-width="4" />
    </>
  ),
  blender: () => (
    <>
      <circle cx="50" cy="54" r="26" fill="var(--pop-blue)" stroke={INK} stroke-width="4" />
      <circle cx="50" cy="54" r="12" fill={PAPER} stroke={INK} stroke-width="3.5" />
      <circle cx="50" cy="54" r="5" fill={INK} />
      <path
        d="M28 34 62 24l6 10H30z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="3.5"
        stroke-linejoin="round"
      />
    </>
  ),
  godot: () => (
    <>
      <path
        d="M24 38h52v22q-26 18-52 0z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <circle cx="38" cy="48" r="7" fill={PAPER} stroke={INK} stroke-width="3" />
      <circle cx="62" cy="48" r="7" fill={PAPER} stroke={INK} stroke-width="3" />
      <circle cx="38" cy="48" r="3" fill={INK} />
      <circle cx="62" cy="48" r="3" fill={INK} />
    </>
  ),
  unity: () => (
    <>
      <path
        d="M50 20 80 37v34L50 88 20 71V37z"
        fill="var(--pop-purple)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M50 34 68 62H32z"
        fill={PAPER}
        stroke={INK}
        stroke-width="3.5"
        stroke-linejoin="round"
      />
    </>
  ),

  /* ------------------------------------------------------------- comms */
  signal: () => <Bubble color="var(--pop-blue)" />,
  whatsapp: () => <Bubble color="var(--pop-teal)" />,
  discord: () => (
    <>
      <path
        d="M26 62q-4-24 8-32 24-6 32 0 12 8 8 32-8 8-16 8l-4-6h-8l-4 6q-8 0-16-8z"
        fill="var(--pop-purple)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <ellipse cx="40" cy="50" rx="5" ry="7" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <ellipse cx="60" cy="50" rx="5" ry="7" fill={PAPER} stroke={INK} stroke-width="2.5" />
    </>
  ),
  slack: () => (
    <>
      <For each={[0, 90, 180, 270]}>
        {(angle) => (
          <g transform={`rotate(${angle} 50 50)`}>
            <rect
              x="44"
              y="16"
              width="12"
              height="26"
              rx="6"
              fill={POPS[(angle / 90) % POPS.length]}
              stroke={INK}
              stroke-width="3.5"
            />
          </g>
        )}
      </For>
      <circle cx="50" cy="50" r="8" fill={PAPER} stroke={INK} stroke-width="3.5" />
    </>
  ),
  teams: () => <LetterTile text="T" color="var(--pop-purple)" />,
  zoom: () => (
    <>
      <rect
        x="20"
        y="34"
        width="44"
        height="32"
        rx="8"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
      />
      <path
        d="M64 44 82 34v32L64 56z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  jitsi: () => (
    <>
      <rect
        x="20"
        y="34"
        width="44"
        height="32"
        rx="8"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
      />
      <path
        d="M64 44 82 34v32L64 56z"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  thunderbird: () => (
    <>
      <path
        d="M20 36h60v32H20z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M20 36 50 58 80 36"
        fill="none"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  mastodon: () => (
    <>
      <path
        d="M28 34q22-10 44 0 6 16 0 30-22 8-44 0-6-14 0-30z"
        fill="var(--pop-purple)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="M38 72q12 6 24 0" fill="none" stroke={INK} stroke-width="4" stroke-linecap="round" />
      <circle cx="42" cy="48" r="4" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <circle cx="58" cy="48" r="4" fill={PAPER} stroke={INK} stroke-width="2.5" />
    </>
  ),

  /* ------------------------------------------------------- desktop/files */
  windows: () => (
    <>
      <For
        each={[
          [24, 26],
          [54, 22],
          [24, 56],
          [54, 52],
        ]}
      >
        {([x, y]) => (
          <rect
            x={x}
            y={y}
            width="24"
            height="24"
            fill="var(--pop-blue)"
            stroke={INK}
            stroke-width="4"
          />
        )}
      </For>
    </>
  ),
  macos: () => (
    <>
      <path
        d="M50 30c-14 0-24 10-24 24 0 14 10 26 18 26 4 0 5-2 6-2s2 2 6 2c8 0 18-12 18-26 0-14-10-24-24-24z"
        fill="var(--pop-purple)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M50 30q2-10 12-12"
        fill="none"
        stroke={INK}
        stroke-width="4"
        stroke-linecap="round"
      />
    </>
  ),
  linux: () => (
    <>
      <ellipse cx="50" cy="56" rx="24" ry="28" fill={PAPER} stroke={INK} stroke-width="4" />
      <ellipse cx="50" cy="36" rx="16" ry="18" fill={INK} />
      <circle cx="44" cy="34" r="5" fill={PAPER} />
      <circle cx="56" cy="34" r="5" fill={PAPER} />
      <circle cx="44" cy="35" r="2.5" fill={INK} />
      <circle cx="56" cy="35" r="2.5" fill={INK} />
      <path
        d="M44 44q6 6 12 0l-6 6z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <ellipse
        cx="38"
        cy="82"
        rx="10"
        ry="5"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="3"
      />
      <ellipse
        cx="62"
        cy="82"
        rx="10"
        ry="5"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="3"
      />
    </>
  ),
  sevenzip: () => <LetterTile text="7z" color="var(--pop-yellow)" />,
  dropbox: () => (
    <>
      <For
        each={[
          [30, 34],
          [70, 34],
          [30, 62],
          [70, 62],
        ]}
      >
        {([x, y]) => (
          <path
            d={`M${x} ${y - 12} ${x + 14} ${y} ${x} ${y + 12} ${x - 14} ${y}z`}
            fill="var(--pop-blue)"
            stroke={INK}
            stroke-width="3.5"
            stroke-linejoin="round"
          />
        )}
      </For>
    </>
  ),
  nextcloud: () => (
    <>
      <path
        d="M32 62a14 14 0 0 1 2-28 18 18 0 0 1 33 4 13 13 0 0 1-2 24z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <circle cx="50" cy="52" r="7" fill={PAPER} stroke={INK} stroke-width="3" />
    </>
  ),
  keepassxc: () => <Key color="var(--pop-teal)" />,
  onepassword: () => <Key color="var(--pop-blue)" />,
  fdroid: () => (
    <>
      <rect
        x="26"
        y="30"
        width="48"
        height="46"
        rx="10"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
      />
      <path d="M36 30 30 18M64 30 70 18" stroke={INK} stroke-width="4" stroke-linecap="round" />
      <circle cx="40" cy="48" r="4" fill={PAPER} stroke={INK} stroke-width="2.5" />
      <circle cx="60" cy="48" r="4" fill={PAPER} stroke={INK} stroke-width="2.5" />
    </>
  ),

  /* --------------------------------------------------------- productivity */
  libreoffice: () => <Document color="var(--pop-teal)" />,
  msoffice: () => <Document color="var(--pop-red)" />,
  gdocs: () => <Document color="var(--pop-blue)" />,
  notion: () => <LetterTile text="N" color={PAPER} />,
  obsidian: () => (
    <>
      <path
        d="M50 18 74 40 62 82H38L26 40z"
        fill="var(--pop-purple)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="M50 18 62 82M26 40h48" fill="none" stroke={INK} stroke-width="3" />
    </>
  ),
  figma: () => (
    <>
      <circle cx="58" cy="50" r="12" fill="var(--pop-teal)" stroke={INK} stroke-width="3.5" />
      <path
        d="M46 26h12a12 12 0 0 1 0 24H46a12 12 0 0 1 0-24z"
        fill="var(--pop-red)"
        stroke={INK}
        stroke-width="3.5"
      />
      <path
        d="M46 50h12v12a12 12 0 1 1-12-12z"
        fill="var(--pop-purple)"
        stroke={INK}
        stroke-width="3.5"
      />
      <path
        d="M34 62h12v12a12 12 0 1 1-12-12z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="3.5"
      />
    </>
  ),
  sketch: () => (
    <>
      <path
        d="M50 20 78 42 50 82 22 42z"
        fill="var(--pop-yellow)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M22 42h56M50 20 36 42l14 40M50 20l14 22-14 40"
        fill="none"
        stroke={INK}
        stroke-width="3"
      />
    </>
  ),
  miro: () => <LetterTile text="M" color="var(--pop-yellow)" />,
  trello: () => (
    <>
      <rect
        x="22"
        y="24"
        width="56"
        height="52"
        rx="8"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
      />
      <rect
        x="32"
        y="34"
        width="16"
        height="32"
        rx="3"
        fill={PAPER}
        stroke={INK}
        stroke-width="3"
      />
      <rect
        x="54"
        y="34"
        width="16"
        height="18"
        rx="3"
        fill={PAPER}
        stroke={INK}
        stroke-width="3"
      />
    </>
  ),
  jira: () => (
    <>
      <path
        d="M50 16 76 42 50 68 24 42z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M50 46 66 62 50 78 34 62z"
        fill="var(--pop-teal)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  ),
  postman: () => (
    <>
      <circle cx="50" cy="50" r="32" fill="var(--pop-red)" stroke={INK} stroke-width="4" />
      <path
        d="M36 60 62 34m0 0-4 14m4-14-14 4"
        fill="none"
        stroke={INK}
        stroke-width="4.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </>
  ),
  raycast: () => (
    <>
      <path
        d="M50 18 82 50 50 82 18 50z"
        fill="var(--pop-red)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="M38 50h24M50 38v24" stroke={INK} stroke-width="5" stroke-linecap="round" />
    </>
  ),
  tableau: () => (
    <>
      <For
        each={[
          [30, 62, 12],
          [44, 62, 26],
          [58, 62, 18],
          [72, 62, 34],
        ]}
      >
        {([x, base, h]) => (
          <rect
            x={x - 6}
            y={base - h}
            width="12"
            height={h}
            fill={POPS[(x / 14) % POPS.length]}
            stroke={INK}
            stroke-width="3.5"
          />
        )}
      </For>
      <line x1="20" y1="66" x2="80" y2="66" stroke={INK} stroke-width="4" stroke-linecap="round" />
    </>
  ),
};

/* ------------------------------------------------------------ primitives */

function Pinwheel() {
  return (
    <>
      <circle cx="50" cy="50" r="34" fill={PAPER} stroke={INK} stroke-width="4" />
      <For
        each={[
          { a: -90, c: "var(--pop-red)" },
          { a: 30, c: "var(--pop-yellow)" },
          { a: 150, c: "var(--pop-teal)" },
        ]}
      >
        {(seg) => (
          <path
            d="M50 50 L50 16 A34 34 0 0 1 79 33 Z"
            fill={seg.c}
            stroke={INK}
            stroke-width="3.5"
            stroke-linejoin="round"
            transform={`rotate(${seg.a + 90} 50 50)`}
          />
        )}
      </For>
      <circle cx="50" cy="50" r="13" fill="var(--pop-blue)" stroke={INK} stroke-width="4" />
    </>
  );
}

function Ribbon() {
  return (
    <>
      <path
        d="M70 20 32 50l38 30z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M22 40 32 34l38 30v10z"
        fill={PAPER}
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  );
}

function Whale() {
  return (
    <>
      <For
        each={[
          [34, 44],
          [46, 44],
          [58, 44],
          [46, 32],
        ]}
      >
        {([x, y]) => (
          <rect
            x={x}
            y={y}
            width="11"
            height="11"
            fill="var(--pop-blue)"
            stroke={INK}
            stroke-width="3"
          />
        )}
      </For>
      <path
        d="M22 58h56q0 16-16 16H40q-14 0-18-16z"
        fill="var(--pop-blue)"
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="M78 58q8-4 10-10 2 10-4 14" fill={PAPER} stroke={INK} stroke-width="3.5" />
      <circle cx="34" cy="64" r="3" fill={INK} />
    </>
  );
}

function Terminal(props: { color: string }) {
  return (
    <>
      <rect
        x="18"
        y="28"
        width="64"
        height="46"
        rx="6"
        fill={props.color}
        stroke={INK}
        stroke-width="4"
      />
      <path
        d="M32 44 42 52 32 60"
        fill="none"
        stroke={INK}
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M50 62h16" stroke={INK} stroke-width="5" stroke-linecap="round" />
    </>
  );
}

function Brush(props: { color: string }) {
  return (
    <>
      <path
        d="M64 22 78 36 46 68 32 54z"
        fill={props.color}
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M32 54 46 68q-6 12-22 12 6-14 8-26z"
        fill={PAPER}
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
    </>
  );
}

function Waveform(props: { color: string }) {
  return (
    <>
      <circle cx="50" cy="50" r="34" fill={props.color} stroke={INK} stroke-width="4" />
      <For
        each={[
          [32, 10],
          [40, 20],
          [48, 28],
          [56, 18],
          [64, 8],
        ]}
      >
        {([x, h]) => (
          <line
            x1={x}
            y1={50 - h}
            x2={x}
            y2={50 + h}
            stroke={INK}
            stroke-width="5"
            stroke-linecap="round"
          />
        )}
      </For>
    </>
  );
}

function FilmStrip(props: { color: string }) {
  return (
    <>
      <rect
        x="18"
        y="30"
        width="64"
        height="42"
        rx="6"
        fill={props.color}
        stroke={INK}
        stroke-width="4"
      />
      <For each={[26, 40, 54, 68]}>
        {(x) => (
          <>
            <rect x={x} y="34" width="8" height="7" fill={PAPER} stroke={INK} stroke-width="2.5" />
            <rect x={x} y="61" width="8" height="7" fill={PAPER} stroke={INK} stroke-width="2.5" />
          </>
        )}
      </For>
    </>
  );
}

function Bubble(props: { color: string }) {
  return (
    <>
      <path
        d="M50 26c18 0 30 10 30 22s-12 22-30 22c-4 0-8 0-11-2l-14 6 4-11c-6-4-9-9-9-15 0-12 12-22 30-22z"
        fill={props.color}
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <For each={[38, 50, 62]}>{(x) => <circle cx={x} cy="48" r="4" fill={PAPER} />}</For>
    </>
  );
}

function Document(props: { color: string }) {
  return (
    <>
      <path
        d="M28 18h30l16 16v48H28z"
        fill={props.color}
        stroke={INK}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="M58 18v16h16" fill="none" stroke={INK} stroke-width="4" stroke-linejoin="round" />
      <For each={[48, 58, 68]}>
        {(y) => <path d={`M38 ${y}h26`} stroke={INK} stroke-width="4" stroke-linecap="round" />}
      </For>
    </>
  );
}

function Key(props: { color: string }) {
  return (
    <>
      <circle cx="38" cy="42" r="16" fill={props.color} stroke={INK} stroke-width="4" />
      <circle cx="38" cy="42" r="6" fill={PAPER} stroke={INK} stroke-width="3" />
      <path
        d="M48 52 74 78M64 68l8 8M58 62l8 8"
        stroke={INK}
        stroke-width="5"
        stroke-linecap="round"
      />
    </>
  );
}

function Gear(props: { color: string }) {
  return (
    <>
      <For each={[0, 45, 90, 135]}>
        {(angle) => (
          <rect
            x="44"
            y="12"
            width="12"
            height="76"
            rx="4"
            fill={props.color}
            stroke={INK}
            stroke-width="3"
            transform={`rotate(${angle} 50 50)`}
          />
        )}
      </For>
      <circle cx="50" cy="50" r="26" fill={props.color} stroke={INK} stroke-width="4" />
      <circle cx="50" cy="50" r="17" fill={PAPER} stroke={INK} stroke-width="3.5" />
    </>
  );
}

function Node(props: { cx: number; cy: number; color: string }) {
  return (
    <circle cx={props.cx} cy={props.cy} r="9" fill={props.color} stroke={INK} stroke-width="4" />
  );
}

function LetterTile(props: { text: string; color: string }) {
  return (
    <>
      <rect
        x="20"
        y="20"
        width="60"
        height="60"
        rx="12"
        fill={props.color}
        stroke={INK}
        stroke-width="4"
      />
      <text
        x="50"
        y="50"
        text-anchor="middle"
        dominant-baseline="central"
        fill={INK}
        style={{ font: `800 ${props.text.length > 1 ? 30 : 40}px var(--font-stack-display)` }}
      >
        {props.text}
      </text>
    </>
  );
}

/**
 * The fallback: a Memphis composition built from the id's hash, so every card
 * without a curated drawing still gets something specific and repeatable.
 * Hashed on the id alone — never on `open`, which is not in the browser and
 * must not be inferable from the art.
 */
function GenericMark(props: { id: string; name: string }) {
  const seed = () => hash(props.id);
  const color = () => POPS[seed() % POPS.length];
  const shape = () => seed() % 4;
  const ornament = () => (seed() >> 3) % 3;

  const initials = () => {
    const words = props.name
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  return (
    <>
      <Show when={shape() === 0}>
        <circle cx="50" cy="50" r="34" fill={color()} stroke={INK} stroke-width="4" />
      </Show>
      <Show when={shape() === 1}>
        <rect
          x="16"
          y="16"
          width="68"
          height="68"
          rx="16"
          fill={color()}
          stroke={INK}
          stroke-width="4"
        />
      </Show>
      <Show when={shape() === 2}>
        <path
          d="M50 14 81 32v36L50 86 19 68V32z"
          fill={color()}
          stroke={INK}
          stroke-width="4"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={shape() === 3}>
        {/* Pookalam petals — the house shape, so the fallback still reads Onam. */}
        <For each={[0, 60, 120, 180, 240, 300]}>
          {(angle) => (
            <ellipse
              cx="50"
              cy="28"
              rx="13"
              ry="20"
              fill={color()}
              stroke={INK}
              stroke-width="3.5"
              transform={`rotate(${angle} 50 50)`}
            />
          )}
        </For>
      </Show>

      <Show when={ornament() === 0}>
        <For each={[0, 45, 90, 135, 180, 225, 270, 315]}>
          {(angle) => (
            <circle
              cx={50 + 40 * Math.cos((angle * Math.PI) / 180)}
              cy={50 + 40 * Math.sin((angle * Math.PI) / 180)}
              r="3.5"
              fill={INK}
              opacity="0.5"
            />
          )}
        </For>
      </Show>
      <Show when={ornament() === 1}>
        <path
          d="M8 88 16 78l8 10 8-10 8 10"
          fill="none"
          stroke={INK}
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.6"
        />
      </Show>
      <Show when={ornament() === 2}>
        <circle cx="50" cy="50" r="42" fill="none" stroke={INK} stroke-width="3" opacity="0.35" />
      </Show>

      <circle cx="50" cy="50" r="21" fill={PAPER} stroke={INK} stroke-width="4" />
      <text
        x="50"
        y="50"
        text-anchor="middle"
        dominant-baseline="central"
        fill={INK}
        style={{ font: "800 22px var(--font-stack-display)" }}
      >
        {initials()}
      </text>
    </>
  );
}

export interface ProjectMarkProps {
  id: string;
  name: string;
  /** Rendered size in pixels. */
  size?: number;
  class?: string;
}

export function ProjectMark(props: ProjectMarkProps) {
  const drawing = () => MARKS[props.id];

  return (
    <svg
      viewBox="0 0 100 100"
      width={props.size ?? 96}
      height={props.size ?? 96}
      class={props.class}
      role="presentation"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <Show when={drawing()} fallback={<GenericMark id={props.id} name={props.name} />}>
        {drawing()!()}
      </Show>
    </svg>
  );
}
