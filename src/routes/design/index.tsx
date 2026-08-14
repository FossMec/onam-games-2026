import { Title } from "@solidjs/meta";
import { For, createSignal } from "solid-js";
import { Bubble, Halftone, ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";

import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SHOUT_COLOR } from "~/lib/shouts";
import { SPRITE_REGISTRY, type SpriteName } from "~/lib/sprites";

/**
 * The FOSS Onam Design Language & System Specification.
 *
 * Every example on this page is the live, working component rather than a static mockup —
 * tokens are live CSS custom properties, shouts are reactive components, and the halftone
 * uses the exact radial gradient algorithm from the core layout.
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
    body: "Game reactions speak the native dialect: THAKARPPAN for high scores, MWONEEE for close calls, and DWAAAA for game overs.",
  },
  {
    title: "Confident Ink Hierarchy.",
    body: "Every surface and interactive button is bordered in solid comic ink (--ink-w: 2.5px mobile / 4px desktop). Never grey hairline dividers.",
  },
  {
    title: "Harmonious Washed Palette.",
    body: "Six vibrant pop accents calibrated to identical perceived lightness so they clash comfortably against newsprint cream without harsh neon fatigue.",
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
  const [selectedTag, setSelectedTag] = createSignal<string>("all");

  const allTags = () => {
    const set = new Set<string>();
    for (const [, info] of spriteEntries) {
      for (const t of info.tags) set.add(t);
    }
    return ["all", ...Array.from(set)];
  };

  const filteredSprites = () => {
    const t = selectedTag();
    if (t === "all") return spriteEntries;
    return spriteEntries.filter(([, info]) => info.tags.includes(t));
  };

  return (
    <main class="container space-y-12 py-6">
      <Title>Design System & Art Language — FOSS Onam Games</Title>

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
          <h1 class="text-3xl sm:text-5xl font-black">Pop Art × Comic Book × Onam</h1>
          <p
            class="text-base sm:text-lg font-extrabold"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Bold, approachable, expressive, and rooted in open-source culture. Inked lines, radial
            pookalam halftones, and zero drop shadows.
          </p>
        </div>
      </section>

      {/* Design Philosophy */}
      <Section title="Design Philosophy & Visual Roots">
        <div class="card card-plain p-6 space-y-4 bg-[var(--paper-2)]">
          <p class="text-base sm:text-lg font-semibold leading-relaxed">
            FOSS Onam Games combines <strong>90s comic book print aesthetics</strong>,{" "}
            <strong>Memphis design geometry</strong>, and{" "}
            <strong>traditional Kerala Onam iconography</strong> into a cohesive, high-energy
            interactive experience.
          </p>
          <p
            class="text-sm sm:text-base font-semibold leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            Rather than relying on generic modern dashboards with blurred shadows and dark-violet
            accents, every screen is treated like an authentic inked comic strip printed on warm
            newsprint paper. Tactile buttons, expressive typography, and culturally resonant
            Manglish reactions create an environment that feels fun and immediately accessible.
          </p>
          <Bubble color="var(--pop-yellow)">
            <p class="font-extrabold text-sm sm:text-base">
              The core principle: If an interface element doesn't spark delight or feel satisfying
              to interact with, it doesn't belong in the games arena.
            </p>
          </Bubble>
        </div>
      </Section>

      {/* Sprite System Showcase */}
      <Section title="The Sprite System (FOSS × Onam Collages)">
        <div class="space-y-4">
          <p class="font-semibold text-sm sm:text-base">
            30+ custom handcrafted sprites blending open-source mascots with traditional Onam
            festival elements — Tux wearing a Mahabali crown, Linus Torvalds with Sadya, Docker
            whale carrying a flower pookalam, and Ferris crab with a Kerala caparison.
          </p>

          {/* Filter Chips */}
          <div class="flex items-center gap-1.5 flex-wrap">
            <For each={allTags()}>
              {(tag) => {
                const isSel = tag === selectedTag();
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    class={`px-3 py-1 rounded-full text-xs font-black uppercase transition-all cursor-pointer ${
                      isSel
                        ? "bg-[var(--pop-yellow)] border-2 border-[var(--ink)] scale-105"
                        : "bg-[var(--paper-2)] border border-[var(--ink)]/30 hover:border-[var(--ink)]"
                    }`}
                  >
                    {tag}
                  </button>
                );
              }}
            </For>
          </div>

          {/* Sprites Grid */}
          <div class="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <For each={filteredSprites()}>
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
          Ten semantic tokens calibrated to harmonious perceptual lightness. All colors degrade
          gracefully across high-contrast monitors and mobile displays.
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

      {/* Manglish Result Shouts */}
      <Section title="Manglish Onomatopoeia Reaction System">
        <p class="font-semibold text-sm sm:text-base">
          Every win, close attempt, or game over renders an authentic Manglish shout burst styled
          after vintage action comics:
        </p>
        <div class="grid gap-4 sm:grid-cols-3">
          <For each={["THAKARPPAN!", "MWONEEE...", "DWAAAA..."]}>
            {(text, i) => (
              <div class="card card-plain grid place-items-center py-6">
                <ShoutBurst
                  text={text}
                  color={[SHOUT_COLOR.triumph, SHOUT_COLOR.mid, SHOUT_COLOR.fail][i()]}
                  seed={text}
                />
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* Footer Navigation CTA */}
      <section
        class="relative overflow-hidden rounded-xl p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-3)" }}
      >
        <Halftone opacity={0.12} />
        <div class="art-over space-y-3">
          <h2 class="text-2xl font-black">All styling encapsulated in pure Vanilla CSS</h2>
          <p class="font-semibold text-sm sm:text-base">
            Engineered with zero CSS bloat, full responsiveness, and accessible high-contrast
            tokens.
          </p>
          <div class="pt-2">
            <a href="/" class="btn-brand text-sm px-6 py-2.5">
              ← Return to Arena
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
