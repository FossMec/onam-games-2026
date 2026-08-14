import { Title } from "@solidjs/meta";
import { For, Show } from "solid-js";
import { Bubble, Burst, Halftone, ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SHOUT_COLOR } from "~/lib/shouts";

/**
 * The design language, written down.
 *
 * Every example on this page is the real thing rather than a picture of it —
 * the swatches are the live tokens, the shouts are the live component, the
 * halftone is the same gradient the body uses. A design page that drifts from
 * the design is worse than no design page, and the only way to stop that is to
 * make drift impossible.
 */

const PALETTE = [
  { name: "paper", token: "--paper", note: "newsprint cream. the page itself." },
  { name: "paper-2", token: "--paper-2", note: "raised panel." },
  { name: "paper-3", token: "--paper-3", note: "sunken, muted, quiet." },
  { name: "ink", token: "--ink", note: "warm near-black. every outline, every glyph." },
  { name: "red", token: "--pop-red", note: "coral. danger, hearts, the vallam." },
  { name: "yellow", token: "--pop-yellow", note: "marigold. the primary shout." },
  { name: "teal", token: "--pop-teal", note: "mint. the FOSS yes." },
  { name: "blue", token: "--pop-blue", note: "periwinkle. information." },
  { name: "pink", token: "--pop-pink", note: "bubblegum. stickers." },
  { name: "purple", token: "--pop-purple", note: "lilac. rare things." },
];

const FONTS = [
  {
    family: "Bungee",
    job: "the wordmark, and nothing else",
    why: "An urban signage face. Reserved for the logo so it never loses its punch. The poster chrome is the same word drawn twice — the Bungee family's display cuts are not metric-compatible, so layering two different ones drifts a little further apart with every letter.",
    stack: "var(--font-stack-logo)",
  },
  {
    family: "Baloo Chettan 2",
    job: "headings, buttons, anything loud",
    why: "The fattest, roundest, most comic-annual face we could find that is actually well drawn. It ships a Malayalam cut, so a Malayalam word renders in the same voice instead of falling back to a stranger.",
    stack: "var(--font-stack-display)",
  },
  {
    family: "Nunito",
    job: "body text",
    why: "Rounded terminals to match Baloo, and it stays readable at 14px on a cheap phone — which most chunky faces do not.",
    stack: "var(--font-stack-body)",
  },
  {
    family: "Space Mono",
    job: "numbers only",
    why: "Timers and leaderboards. Quirky enough to belong here, boring enough to read under pressure.",
    stack: "var(--font-stack-mono)",
  },
  {
    family: "Bangers",
    job: "shouts only",
    why: "The comic-book onomatopoeia face. It appears when you win or lose and at no other time.",
    stack: "var(--font-stack-comic)",
  },
  {
    family: "Caveat",
    job: "the jokes in the margin",
    why: "A marker hand, so every aside looks scrawled next to the panel rather than typeset into it. Gives the sarcasm its own voice and keeps it out of the functional copy.",
    stack: "var(--font-stack-hand)",
  },
];

const RULES = [
  {
    title: "No shadows. Anywhere.",
    body: "Hard offset shadows are the neobrutalism tell, and comics never used them. Depth comes from three things instead: how thick the ink outline is, flat colour blocking, and halftone dots as shading — which is literally how comics shaded. If something needs to feel raised, it gets dots.",
  },
  {
    title: "The halftone is a pookalam.",
    body: "Ben-Day dots are the signature of pop art. Ours sit in radial symmetry rather than a square grid, so the pop-art motif and the Onam motif are the same object. It is a CSS gradient, so it costs nothing and scales to any screen.",
  },
  {
    title: "The confetti is secretly Onam.",
    body: "Long zigzag is a vallam. Concentric rings are a pookalam. Half-circle is a muthukuda, blob is a banana leaf, squiggle is a palm. Reads as Memphis to everyone else and as Onam to Malayalis, which is exactly the joke.",
  },
  {
    title: "The shouts are in Manglish.",
    body: "Never POW or BAM. THAKARPPAN when you win, DWAAAA when you don't, ENTHUVA when the site is confused. Nobody else can copy this, because it only works if you are from here.",
  },
  {
    title: "Everything is inked.",
    body: "One warm near-black. Every box, button, input and avatar gets the same confident outline. Never a grey hairline — a grey hairline is what a form looks like, and this is not a form.",
  },
  {
    title: "Washed, not neon.",
    body: "Six accents tuned to almost the same lightness, so they clash harmoniously instead of fighting. Saturated neon on cream looks like a scam site. Washed vintage print looks like a comic annual somebody's cousin owned in 1994.",
  },
  {
    title: "Tilt is punctuation.",
    body: "A degree or two on a sticker sells the collage. Nothing you have to read under time pressure ever tilts — no boards, no timers, no leaderboard rows. A tilted number is a joke at the reader's expense.",
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
  return (
    <main class="container space-y-12 py-6">
      <Title>How it was designed — FOSS Onam Games</Title>

      <a
        href="/"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back
      </a>

      <section
        class="relative overflow-hidden rounded-lg p-6 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-teal)" }}
      >
        <Confetti seed="design-hero" count={12} animate />
        <div class="art-over space-y-3">
          <h1>Pop art × comic book × Memphis</h1>
          <p class="text-lg font-extrabold" style={{ "font-family": "var(--font-stack-display)" }}>
            Childlike, loud, funny, approachable. And absolutely no shadows.
          </p>
        </div>
      </section>

      <Section title="Where it came from">
        <p class="text-lg font-semibold">
          The first attempt was a dark terminal thing — monospace, sharp corners, very professional.
          It was killed for being professional. This is a college club event during Onam. If the
          design does not make you want to click something, the design has failed, and no amount of
          tasteful restraint fixes that.
        </p>
        <p class="font-semibold">
          So: comic books for the panels, the ink and the shouting. Memphis for the confetti and the
          nerve to put six clashing colours on one page. Linux ricing for the bit where somebody
          cares far too much about a colour palette nobody asked about. Printed on cream newsprint,
          because a comic annual is the reference and comic annuals were never white.
        </p>
        <Bubble color="var(--pop-yellow)">
          <p class="font-semibold">
            The test for every decision: would this look right next to a badly-photocopied poster
            taped to a corridor wall? If yes, ship it.
          </p>
        </Bubble>
      </Section>

      <Section title="The seven rules">
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
                <p class="font-extrabold">{rule.title}</p>
                <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {rule.body}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="The palette">
        <p class="font-semibold">
          Ten values, and that is the whole system. The six accents sit at nearly identical
          lightness on purpose — that is the trick that makes washed-out colours clash pleasantly
          instead of turning to mud. Two deeper cuts exist for text that has to pass contrast on
          cream, and they are the only exception.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <For each={PALETTE}>
            {(swatch) => (
              <div class="card card-plain space-y-2">
                {/* The live token, not a hex copy — this cannot drift. */}
                <div
                  style={{
                    height: "3.5rem",
                    background: `var(${swatch.token})`,
                    border: "var(--ink-w) solid var(--ink)",
                    "border-radius": "var(--radius)",
                  }}
                />
                <p class="font-mono text-sm font-extrabold">{swatch.name}</p>
                <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {swatch.note}
                </p>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="Six faces, one job each">
        <p class="font-semibold">
          Six fonts should look like a ransom note. The thing that stops it is discipline: every
          face has exactly one job, and it never does another. A reader should never have to wonder
          why the type changed — the change itself is the message.
        </p>
        <div class="space-y-3">
          <For each={FONTS}>
            {(font) => (
              <div class="card card-plain space-y-1">
                <p
                  class="text-2xl"
                  style={{ "font-family": font.stack, "font-weight": 800, "line-height": 1.2 }}
                >
                  {font.family}
                </p>
                <p class="font-extrabold">{font.job}</p>
                <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {font.why}
                </p>
              </div>
            )}
          </For>
        </div>
        <p class="comment">
          all six are free software, which is both the correct call for a FOSS event and a line in
          the footer.
        </p>
      </Section>

      <Section title="Depth without shadows">
        <p class="font-semibold">
          Every interface reaches for a drop shadow to say "this is on top". Comics could not — ink
          on paper has no blur — so they used dots. Denser dots read as darker, and darker reads as
          further back. Same information, no shadow, and it happens to be the single most
          recognisable texture in pop art.
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            class="relative overflow-hidden rounded-lg p-6 text-center"
            style={{ border: "var(--ink-w) solid var(--ink)", background: "var(--paper-2)" }}
          >
            <Halftone opacity={0.18} />
            <p class="art-over font-extrabold">halftone</p>
          </div>
          <div
            class="rounded-lg p-6 text-center"
            style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
          >
            <p class="font-extrabold">thicker ink</p>
          </div>
          <div
            class="rounded-lg p-6 text-center"
            style={{ border: "var(--ink-w) solid var(--ink)", background: "var(--pop-yellow)" }}
          >
            <p class="font-extrabold">flat colour</p>
          </div>
        </div>
        <p class="comment">
          three ways to say "closer". none of them is a shadow. the ink weight even steps up at the
          sm breakpoint, so a phone gets proportionally the same confidence.
        </p>
      </Section>

      <Section title="The shouting">
        <p class="font-semibold">
          Every result fires one word in Bangers over a starburst. It is seeded on the attempt, so
          refreshing shows you the same word rather than rerolling until you get a nicer one — the
          verdict should not be negotiable.
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

      <Section title="Motion, kept on a leash">
        <p class="font-semibold">
          Confetti drifts a few pixels on long offset loops. The background pookalam turns once
          every four minutes. Buttons sink two pixels and wash in dots when pressed. That is the
          entire animation budget.
        </p>
        <ul class="card pop-blue space-y-2">
          <li class="flex gap-2 font-semibold">
            <span style={{ color: "var(--pop-blue)" }}>▸</span>
            <span>
              Transform and opacity only, so cumulative layout shift stays at zero. Nothing on this
              site may reflow because it felt like it.
            </span>
          </li>
          <li class="flex gap-2 font-semibold">
            <span style={{ color: "var(--pop-blue)" }}>▸</span>
            <span>
              Nothing animates on a game page while an attempt is running. You are being timed;
              decoration can wait.
            </span>
          </li>
          <li class="flex gap-2 font-semibold">
            <span style={{ color: "var(--pop-blue)" }}>▸</span>
            <span>
              <code>prefers-reduced-motion</code> kills all of it. Not "reduces". Kills.
            </span>
          </li>
        </ul>
        <div class="flex flex-wrap items-center justify-center gap-6 py-4">
          <Burst color="var(--pop-pink)" seed="design-demo" double />
          <Show when={true}>
            <span class="sticker">stickers tilt</span>
          </Show>
          <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
            badges do not
          </span>
        </div>
      </Section>

      <Section title="Phone first, and not as a slogan">
        <p class="font-semibold">
          Almost everyone will play this on a mid-range Android on college wifi. So: tap targets
          never below 48px, boards sized to the viewport rather than to a desktop window, fonts
          self-hosted and subset to about 200KB total, no CDN, no external requests. SVG filters are
          opt-in on a handful of decorative elements and never on a game board, because
          <code> feTurbulence</code> is a real paint cost on a cheap phone.
        </p>
        <Bubble color="var(--pop-pink)">
          <p class="font-semibold">
            Two fonts are preloaded. The other four load lazily, and their fallbacks — Comic Sans,
            system rounded — are genuinely the right neighbourhood, so an un-fonted first paint
            still looks like this site rather than like a broken one.
          </p>
        </Bubble>
      </Section>

      <section
        class="relative overflow-hidden rounded-lg p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-3)" }}
      >
        <Halftone opacity={0.12} />
        <div class="art-over space-y-3">
          <h2 class="text-2xl">Every piece of this is in one CSS file.</h2>
          <p class="font-semibold">
            Restyle there, never in a route. Five class names carry the whole system.
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            <a href="/style" class="btn-ghost">
              The component gallery
            </a>
            <a href="/" class="btn-brand">
              Back to the games
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
