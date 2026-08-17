import { Title } from "@solidjs/meta";
import { For, createSignal } from "solid-js";
import { Bubble, Halftone, ShoutBurst } from "~/components/art/Burst";
import { Confetti, ConfettiShape } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SHOUT_COLOR, type ShoutMood } from "~/lib/shouts";
import { SPRITE_REGISTRY, type SpriteName } from "~/lib/sprites";
import designPrompt from "../../../design-prompt.md?raw";
import { memeImage } from "~/lib/img";

/**
 * The FOSS Onam Design Language & System Specification.
 *
 * Every example on this page is a live, working component -
 * tokens are live CSS custom properties, shouts are reactive SVG components,
 * and confetti motifs demonstrate the Memphis × Onam geometric system.
 */

const PALETTE = [
  { name: "paper", token: "--paper", note: "newsprint cream. the base canvas." },
  { name: "paper-2", token: "--paper-2", note: "raised interactive panel." },
  { name: "paper-3", token: "--paper-3", note: "sunken, muted card background." },
  {
    name: "ink",
    token: "--ink",
    note: "warm comic near-black (#181511). every outline and glyph.",
  },
  { name: "red", token: "--pop-red", note: "coral vermilion. errors, countdowns, vallam." },
  { name: "yellow", token: "--pop-yellow", note: "marigold gold. primary highlights, hero crown." },
  { name: "teal", token: "--pop-teal", note: "mint. active navigation, FOSS affirmative." },
  { name: "blue", token: "--pop-blue", note: "periwinkle. informative callouts." },
  { name: "pink", token: "--pop-pink", note: "bubblegum. stickers and celebratory accents." },
  { name: "purple", token: "--pop-purple", note: "lilac. leaderboard tiers and special badges." },
];

const FONTS = [
  {
    family: "Bungee",
    job: "wordmark & primary brand logo",
    why: "Bold signage typeface with pure flat geometry. Reserved exclusively for the FOSS ONAM wordmark so brand impact stays sharp and uncompromised.",
    stack: "var(--font-stack-logo)",
  },
  {
    family: "Baloo Chettan 2",
    job: "headings, buttons & section titles",
    why: "Expressive, rounded Malayalam-inspired display face. Provides warm comic energy and confident presence across desktop and mobile screens.",
    stack: "var(--font-stack-display)",
  },
  {
    family: "Nunito",
    job: "body text & interface copy",
    why: "Curved terminals that harmonize with Baloo Chettan, maintaining crisp legibility even at small sizes on mobile displays.",
    stack: "var(--font-stack-body)",
  },
  {
    family: "Space Mono",
    job: "numerals, leaderboards & timers",
    why: "Fixed-width monospace digits preventing UI jitter as countdown timers and live leaderboards tick.",
    stack: "var(--font-stack-mono)",
  },
  {
    family: "Bangers",
    job: "game verdicts & celebratory shouts",
    why: "High-impact comic onomatopoeia typeface. Appears on victory bursts and result screens.",
    stack: "var(--font-stack-comic)",
  },
  {
    family: "Caveat",
    job: "margin scribbles & sarcastic asides",
    why: "Marker script that gives asides a distinct handwritten voice in margins without cluttering functional copy.",
    stack: "var(--font-stack-hand)",
  },
  {
    family: "Kalam",
    job: "proclamations & royal letters",
    why: "Authentic handwritten script used in the Royal Letter from Maveli, delivering comfortable narrative flow.",
    stack: "var(--font-stack-letter)",
  },
];

const MEMPHIS_MOTIFS = [
  {
    name: "Vallam (Snake Boat)",
    shape: "vallam" as const,
    color: "var(--pop-red)",
    description:
      "Angular dynamic zigzag representing the Aranmula snake boat racing through river ripples.",
  },
  {
    name: "Pookalam (Flower Carpet)",
    shape: "pookalam" as const,
    color: "var(--pop-yellow)",
    description: "Concentric floral circles echoing the sacred geometry of the Onam floral carpet.",
  },
  {
    name: "Muthukuda (Royal Parasol)",
    shape: "muthukuda" as const,
    color: "var(--pop-purple)",
    description:
      "Geometric half-circle with pendant bells styled after temple procession umbrellas.",
  },
  {
    name: "Ila (Banana Leaf)",
    shape: "ila" as const,
    color: "var(--pop-teal)",
    description: "Organic rounded trapezoid representing the fresh plantain leaf of the Onasadya.",
  },
  {
    name: "Thengu (Coconut Palm)",
    shape: "thengu" as const,
    color: "var(--pop-blue)",
    description:
      "Geometric palm with curved trunk and radiating fronds swaying in the coastal breeze.",
  },
  {
    name: "Pattom (Festival Kite)",
    shape: "kite" as const,
    color: "var(--pop-pink)",
    description: "Tilted diamond kite floating across the festival sky.",
  },
];

const MEMES = [
  {
    title: "Root Privileges",
    src: memeImage("sudo-mkdir-pookalam.webp"),
    caption: "sudo mkdir -p /var/log/pookalam",
    tag: "SYSADMIN ONAM",
    color: "var(--pop-yellow)",
  },
  {
    title: "Torvalds' Law",
    src: memeImage("talk-is-cheap-sadya.webp"),
    caption: "Talk is cheap. Show me the Sadya recipe.",
    tag: "OPEN CUISINE",
    color: "var(--pop-teal)",
  },
  {
    title: "Out of Tokens",
    src: memeImage("need-more-tokens.webp"),
    caption: "Maveli ran out of tokens right before Thiruvonam trying to vibecode a pookalam.",
    tag: "RATE LIMIT",
    color: "var(--pop-purple)",
  },

  {
    title: "Rustaceans on Vallam",
    src: memeImage("failure-is-not-an-option.webp"),
    caption: "Failure is not an Option<T>, it's a Result<T, E>.",
    tag: "RUST BORROW",
    color: "var(--pop-red)",
  },
];

const ALL_SHOUTS: { mood: ShoutMood; label: string; shouts: string[] }[] = [
  {
    mood: "triumph",
    label: "Triumph (#1 Rank / Personal Best)",
    shouts: ["THEE THANNE NEE!", "ADIPOLI!", "PWOLI!", "YAYYYY!"],
  },
  {
    mood: "great",
    label: "Great (High Score / Victory)",
    shouts: ["PWOLI!", "ADIPOLI!", "KIDILAN!", "YAYYYY!"],
  },
  {
    mood: "decent",
    label: "Decent (Solid Attempt)",
    shouts: ["KOLLALO ATH!", "OK-ish!"],
  },

  {
    mood: "mid",
    label: "Mid-Table (Encouraging Poke)",
    shouts: ["MWONEEE...", "PAAVAM."],
  },
  {
    mood: "fail",
    label: "Fail (Game Over / Defeat)",
    shouts: ["DWAAAA...", "AYYO"],
  },
  {
    mood: "confused",
    label: "Confused (404 / Anomaly)",
    shouts: ["ENTHUVA!", "ENTHUVA IDHU?"],
  },
  {
    mood: "late",
    label: "Late (After Deadline)",
    shouts: ["LATE AAYI", "AYYO"],
  },
];

const RULES = [
  {
    title: "Zero Drop Shadows. Inked Depth Only.",
    body: "Comic books never used blurred drop shadows. Depth is achieved purely through ink outline thickness (--ink-w), flat color blocking, and radial halftone shading.",
  },
  {
    title: "Radial Halftone as Pookalam.",
    body: "Ben-Day dots from vintage pop-art are reimagined in radial flower-carpet symmetry. Rendered purely via CSS radial gradients with zero asset footprint.",
  },
  {
    title: "Memphis Confetti with Onam DNA.",
    body: "The confetti shapes are authentic Kerala motifs in disguise: zigzags are snake boats (vallam), concentric rings are pookalams, half-circles are muthukuda umbrellas, and squiggles are coconut palms.",
  },
  {
    title: "Cultural Manglish Feedback.",
    body: "Game reactions speak the native dialect: KIDILAN for high scores, MWONEEE for close calls, and DWAAAA for game overs.",
  },
  {
    title: "Confident Ink Hierarchy.",
    body: "Every surface and interactive button is bordered in solid comic ink (--ink-w: 2.5px mobile / 4px desktop). Never grey hairline dividers.",
  },
  {
    title: "Soothing Pastel-Faded Palette.",
    body: "Six vibrant pop accents calibrated to identical perceived lightness so they clash comfortably against newsprint cream - pastel, faded, and sun-washed rather than electric. Never neon fatigue.",
  },
  {
    title: "Purposeful Comic Tilt.",
    body: "Stickers and badges tilt 1° to 3° for organic print energy, while timers, leaderboards, and critical game elements remain strictly horizontal for legibility.",
  },
];

function Section(props: { title: string; children: unknown }) {
  return (
    <section class="space-y-4">
      <h2 class="rule">{props.title}</h2>
      {props.children as never}
    </section>
  );
}

export default function DesignLanguage() {
  const spriteEntries = Object.entries(SPRITE_REGISTRY) as [
    SpriteName,
    (typeof SPRITE_REGISTRY)[SpriteName],
  ][];

  const [copied, setCopied] = createSignal(false);
  const copyPrompt = () => {
    void navigator.clipboard.writeText(designPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main class="container space-y-12 py-6">
      <Title>Design System & Art Language - FOSS Onam Games</Title>

      <a
        href="/"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4 hover:text-[var(--pop-teal-deep)]"
      >
        ← Back to Games
      </a>

      {/* Hero Banner */}
      <section
        class="relative overflow-hidden rounded-xl p-6 sm:p-10 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-teal)" }}
      >
        <Confetti seed="design-hero" count={14} animate />
        <div class="art-over space-y-3 max-w-2xl mx-auto">
          <div class="flex justify-center items-center gap-2">
            <SpriteIcon name="foss-mec-badge" size={36} animate="wobble" interactive />
            <span
              class="badge text-xs font-black uppercase"
              style={{ "--pop": "var(--pop-yellow)" }}
            >
              FOSS MEC Design Specs
            </span>
          </div>
          <h1 class="text-3xl sm:text-5xl font-black">Pop Art × Comic Book × Memphis × Onam</h1>
          <p
            class="text-base sm:text-lg font-extrabold"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Bold, approachable, expressive, and rooted in open-source culture. Inked lines, radial
            pookalam halftones, soothing pastel-faded colours, and zero drop shadows.
          </p>
        </div>
      </section>

      {/* Design Philosophy */}
      <Section title="Design Philosophy & Visual Roots">
        <div class="card card-plain p-6 space-y-4 bg-[var(--paper-2)]">
          <p class="text-base sm:text-lg font-semibold leading-relaxed">
            FOSS Onam Games combines <strong>90s comic book print aesthetics</strong>,{" "}
            <strong>1980s Memphis geometric movement</strong>, and{" "}
            <strong>traditional Kerala Onam heritage</strong> into an authentic, high-octane
            celebration.
          </p>
          <p
            class="text-sm sm:text-base font-semibold leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            Instead of standard corporate dark modes or generic cookie-cutter templates, the UI is
            treated as an inked, tactile comic book printed on warm newsprint cream. Tactile
            physical buttons, expressive typography, Memphis confetti geometry, and native Manglish
            shouts create an atmosphere of pure festive joy.
          </p>
          <Bubble color="var(--pop-yellow)">
            <p class="font-extrabold text-sm sm:text-base">
              The core design benchmark: If an interface element doesn't spark joy or feel
              satisfying to interact with, it doesn't belong in the games arena.
            </p>
          </Bubble>
        </div>
      </Section>

      {/* The Two Inspirations */}
      <Section title="The Two Inspirations: Memphis × Comic Book Print">
        <div class="grid gap-3.5 sm:grid-cols-2">
          <div class="card p-5 space-y-2" style={{ "--pop": "var(--pop-pink)" }}>
            <p class="font-black text-lg">1980s Memphis</p>
            <p class="text-sm font-semibold leading-relaxed text-[var(--ink-soft)]">
              The Memphis Group built loud, playful geometry from abstract shapes: squiggles,
              zigzags, dots, rounded arcs, and chunky forms in soothing pastel-faded colour fields.
              Naive on purpose - hand-drawn even when tiled.
            </p>
          </div>
          <div class="card p-5 space-y-2" style={{ "--pop": "var(--pop-blue)" }}>
            <p class="font-black text-lg">Comic Book Print</p>
            <p class="text-sm font-semibold leading-relaxed text-[var(--ink-soft)]">
              Thick inked contours, Ben-Day halftone dots, starbursts, speech bubbles, and a
              photocopied-annual imperfection. Everything reads as physically printed and handled,
              never rendered on a screen.
            </p>
          </div>
        </div>
        <div class="card card-plain p-5 space-y-2 bg-[var(--paper-2)]">
          <p class="font-black text-base">Why they share a language</p>
          <p class="text-sm font-semibold leading-relaxed text-[var(--ink-soft)]">
            Both use flat colour, confident outlines, and pattern to carry emotion. The Onam layer
            quietly replaces every abstract Memphis shape with a Kerala motif, so the same geometry
            reads as pop-art to outsiders and as festival to Malayalis. The decoration is never
            empty, but it never needs explaining.
          </p>
        </div>
      </Section>

      {/* The Muthukuda Cursor */}
      <Section title="The Muthukuda Cursor">
        <div class="space-y-4">
          <p class="font-semibold text-sm sm:text-base">
            Even the pointer is part of the identity. The system arrow is swapped for a muthukuda -
            the ceremonial umbrella - tilted so it reads as a pointer rather than a sticker parked
            on the page.
          </p>
          <div class="grid gap-3.5 sm:grid-cols-3">
            <div class="card card-plain p-4 text-center bg-[var(--paper-2)]">
              <div class="mx-auto w-12 h-12 grid place-items-center rounded-lg border-2 border-[var(--ink)] bg-[var(--paper)]">
                <img src="/cursors/muthukuda.png" alt="Resting muthukuda cursor" class="w-8 h-8" />
              </div>
              <p class="font-extrabold text-sm pt-3">Resting</p>
              <p class="text-xs font-semibold text-[var(--ink-soft)] pt-1">
                -18deg tilt. The default, resting state.
              </p>
            </div>
            <div class="card card-plain p-4 text-center bg-[var(--paper-2)]">
              <div class="mx-auto w-12 h-12 grid place-items-center rounded-lg border-2 border-[var(--ink)] bg-[var(--paper)]">
                <img
                  src="/cursors/muthukuda-point.png"
                  alt="Pointing muthukuda cursor"
                  class="w-8 h-8"
                />
              </div>
              <p class="font-extrabold text-sm pt-3">Pointing</p>
              <p class="text-xs font-semibold text-[var(--ink-soft)] pt-1">
                -38deg tilt. Leaning in over anything clickable.
              </p>
            </div>
            <div class="card card-plain p-4 text-center bg-[var(--paper-2)]">
              <div class="mx-auto w-12 h-12 grid place-items-center rounded-lg border-2 border-[var(--ink)] bg-[var(--paper)]">
                <img
                  src="/cursors/muthukuda-grab.png"
                  alt="Grabbing muthukuda cursor"
                  class="w-8 h-8"
                />
              </div>
              <p class="font-extrabold text-sm pt-3">Grabbing</p>
              <p class="text-xs font-semibold text-[var(--ink-soft)] pt-1">
                +24deg tilt. Leaning back while dragging or grabbing.
              </p>
            </div>
          </div>
          <p class="text-xs font-semibold text-[var(--ink-soft)]">
            The hotspot sits on the canopy's top-left, where the eye reads the point to be. Text
            inputs keep the system I-beam - a caret is a precision instrument and an umbrella cannot
            show which character you are between. Disabled controls keep the system not-allowed
            cursor.
          </p>
        </div>
      </Section>

      {/* Memphis Design × Onam Iconography Section */}
      <Section title="Memphis Geometric Movement × Kerala Onam DNA">
        <div class="space-y-4">
          <p class="font-semibold text-sm sm:text-base">
            The 1980s Memphis design style is famous for bold abstract geometric squiggles, zigzags,
            and confetti. We reinvented Memphis geometry so that every single floating shape is an
            authentic Kerala cultural artifact in disguise:
          </p>

          <div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <For each={MEMPHIS_MOTIFS}>
              {(motif) => (
                <div class="card card-plain p-4 flex items-start gap-3.5 bg-[var(--paper-2)]">
                  <div class="w-12 h-12 rounded-lg grid place-items-center shrink-0 border-2 border-[var(--ink)] bg-[var(--paper)]">
                    <div class="w-7 h-7">
                      <ConfettiShape kind={motif.shape} color={motif.color} />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-extrabold text-base">{motif.name}</p>
                    <p class="text-xs font-semibold pt-1 leading-relaxed text-[var(--ink-soft)]">
                      {motif.description}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Section>

      {/* Comic Memes & Visual Humour */}
      <Section title="FOSS × Onam Comic Memes & Visual Humour">
        <div class="space-y-4">
          <p class="font-semibold text-sm sm:text-base">
            Handcrafted comic artworks and memes capturing the mischievous overlap between Linux
            sysadmin life and Kerala Onam festivities:
          </p>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <For each={MEMES}>
              {(meme) => (
                <div class="card card-plain overflow-hidden p-0 flex flex-col bg-[var(--paper-2)] border-2 border-[var(--ink)]">
                  <div class="relative bg-[var(--paper)] border-b-2 border-[var(--ink)] overflow-hidden p-3 flex items-center justify-center min-h-[220px]">
                    <img
                      src={meme.src}
                      alt={meme.title}
                      class="w-full h-auto max-h-56 object-contain"
                      loading="lazy"
                    />
                    <span
                      class="badge absolute top-2 right-2 text-[10px] font-black uppercase"
                      style={{ "--pop": meme.color }}
                    >
                      {meme.tag}
                    </span>
                  </div>
                  <div class="p-3.5 space-y-1 flex-1 flex flex-col justify-between">
                    <p class="font-extrabold text-sm">{meme.title}</p>
                    <p class="text-xs font-semibold text-[var(--ink-soft)] leading-snug">
                      "{meme.caption}"
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Section>

      {/* Sprite System Showcase (Clean All-Sprite Grid) */}
      <Section title="The Sprite System (All 30+ FOSS × Onam Collages)">
        <div class="space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <p class="font-semibold text-sm sm:text-base">
              Custom sprites blending open-source mascots with traditional Onam festival elements -
              Tux wearing a Mahabali crown, Linus Torvalds with Sadya, Docker whale carrying a
              flower pookalam, and Ferris crab in a lotus.
            </p>
            <span
              class="badge text-xs font-black uppercase"
              style={{ "--pop": "var(--pop-yellow)" }}
            >
              {spriteEntries.length} Handcrafted Sprites
            </span>
          </div>

          {/* Sprites Grid */}
          <div class="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <For each={spriteEntries}>
              {([name, info]) => (
                <div class="card card-plain p-3 text-center flex flex-col items-center justify-between gap-2 hover:bg-[var(--paper)] transition-all group">
                  <div class="h-14 w-14 grid place-items-center relative">
                    <SpriteIcon
                      name={name}
                      size={44}
                      animate="wobble"
                      interactive
                      class="transition-transform group-hover:scale-110"
                    />
                  </div>
                  <div class="min-w-0 w-full">
                    <p class="font-mono text-xs font-black truncate">{name}</p>
                    <p class="text-[10px] font-semibold text-[var(--ink-soft)] truncate">
                      {info.label}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Section>

      {/* The Core Seven Rules */}
      <Section title="The Core Seven Rules">
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={RULES}>
            {(rule, index) => (
              <div
                class="card"
                style={{
                  "--pop": [
                    "var(--pop-red)",
                    "var(--pop-yellow)",
                    "var(--pop-teal)",
                    "var(--pop-blue)",
                    "var(--pop-pink)",
                    "var(--pop-purple)",
                  ][index() % 6],
                }}
              >
                <p class="font-black text-base">{rule.title}</p>
                <p
                  class="text-sm font-semibold pt-1 leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {rule.body}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* The Palette */}
      <Section title="The Color Tokens & Palette">
        <p class="font-semibold text-sm sm:text-base">
          Ten semantic tokens calibrated to harmonious perceptual lightness - soothing pastel-faded
          inks, like a comic annual handled for years. All colours degrade gracefully across
          high-contrast monitors and mobile displays.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <For each={PALETTE}>
            {(swatch) => (
              <div class="card card-plain p-3 space-y-2">
                <div
                  style={{
                    height: "3.5rem",
                    background: `var(${swatch.token})`,
                    border: "var(--ink-w) solid var(--ink)",
                    "border-radius": "var(--radius-base)",
                  }}
                />
                <p class="font-mono text-xs font-black">{swatch.name}</p>
                <p class="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {swatch.note}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* Typography System */}
      <Section title="The Typography Discipline">
        <p class="font-semibold text-sm sm:text-base">
          Seven distinct typefaces, each strictly assigned to a single role. All fonts are
          self-hosted woff2 files ensuring zero CDN dependencies and fast offline loading.
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={FONTS}>
            {(font) => (
              <div class="card card-plain p-4 space-y-1.5">
                <p
                  class="text-xl sm:text-2xl"
                  style={{ "font-family": font.stack, "font-weight": 800, "line-height": 1.2 }}
                >
                  {font.family}
                </p>
                <span
                  class="badge text-[10px] font-black uppercase"
                  style={{ "--pop": "var(--pop-yellow)" }}
                >
                  {font.job}
                </span>
                <p
                  class="text-xs font-semibold pt-1 leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {font.why}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* Depth Without Shadows */}
      <Section title="Depth Through Inking & Halftones">
        <p class="font-semibold text-sm sm:text-base">
          Instead of blurry drop shadows, elevation is achieved through three explicit comic print
          techniques:
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            class="relative overflow-hidden rounded-lg p-6 text-center"
            style={{ border: "var(--ink-w) solid var(--ink)", background: "var(--paper-2)" }}
          >
            <Halftone opacity={0.2} />
            <p class="art-over font-black text-sm">Radial Halftone Dots</p>
            <p class="art-over text-xs font-semibold text-[var(--ink-soft)]">
              Ben-Day pookalam shading
            </p>
          </div>
          <div
            class="rounded-lg p-6 text-center flex flex-col items-center justify-center"
            style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
          >
            <p class="font-black text-sm">Thick Inked Borders</p>
            <p class="text-xs font-semibold text-[var(--ink-soft)]">Confident black stroke depth</p>
          </div>
          <div
            class="rounded-lg p-6 text-center flex flex-col items-center justify-center"
            style={{ border: "var(--ink-w) solid var(--ink)", background: "var(--pop-yellow)" }}
          >
            <p class="font-black text-sm">Flat Color Blocking</p>
            <p class="text-xs font-semibold text-[var(--ink)]">Bold pop accent panels</p>
          </div>
        </div>
      </Section>

      {/* Complete Manglish Shouting Catalog */}
      <Section title="Complete Manglish Onomatopoeia Shout Catalog">
        <div class="space-y-4">
          <p class="font-semibold text-sm sm:text-base">
            Every win, personal best, mid attempt, game over, or anomaly triggers an authentic
            Manglish action shout burst in Bangers. Below is the complete catalog of all 13 shouts
            across 7 distinct moods:
          </p>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={ALL_SHOUTS}>
              {(group) => (
                <div class="card card-plain p-4 space-y-3 bg-[var(--paper-2)] flex flex-col justify-between">
                  <div>
                    <span
                      class="badge text-[10px] font-black uppercase"
                      style={{ "--pop": SHOUT_COLOR[group.mood] }}
                    >
                      {group.mood}
                    </span>
                    <p class="text-xs font-extrabold pt-1" style={{ color: "var(--ink-soft)" }}>
                      {group.label}
                    </p>
                  </div>

                  <div class="flex flex-wrap items-center justify-center gap-2 py-2">
                    <For each={group.shouts}>
                      {(shoutWord) => (
                        <div class="p-2 grid place-items-center">
                          <ShoutBurst
                            text={shoutWord}
                            color={SHOUT_COLOR[group.mood]}
                            seed={shoutWord}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Section>

      {/* Copy the Design Prompt */}
      <section
        class="relative overflow-hidden rounded-xl p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-3)" }}
      >
        <Halftone opacity={0.12} />
        <div class="art-over space-y-4">
          <h2 class="text-2xl font-black">Want to add this design to your app?</h2>
          <p class="font-semibold text-sm sm:text-base mx-auto max-w-xl">
            Grab a compact prompt distilled from the whole design system - palette, typography, the
            six rules, motifs, and mood colours - ready to hand to any AI agent.
          </p>
          <div class="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button type="button" class="btn-brand text-sm px-6 py-2.5" onClick={copyPrompt}>
              {copied() ? "Copied!" : "Copy the design prompt"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
