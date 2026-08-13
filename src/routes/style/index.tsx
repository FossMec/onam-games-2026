import { Title } from "@solidjs/meta";
import { For } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { Bubble, Burst, Halftone, ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SHOUT_COLOR, type ShoutMood } from "~/lib/shouts";

/**
 * Live style guide. This is the review surface — open it on a phone, not a
 * laptop, because that is what 500 students will be holding.
 *
 * Everything here is static markup on purpose: no data, no auth, no server
 * calls, so it renders even when the database is down.
 */

const SWATCHES = [
  { name: "paper", value: "var(--paper)" },
  { name: "paper-2", value: "var(--paper-2)" },
  { name: "paper-3", value: "var(--paper-3)" },
  { name: "ink", value: "var(--ink)" },
  { name: "pop-red", value: "var(--pop-red)" },
  { name: "pop-yellow", value: "var(--pop-yellow)" },
  { name: "pop-teal", value: "var(--pop-teal)" },
  { name: "pop-blue", value: "var(--pop-blue)" },
  { name: "pop-pink", value: "var(--pop-pink)" },
  { name: "pop-purple", value: "var(--pop-purple)" },
];

const MOODS: { mood: ShoutMood; text: string; when: string }[] = [
  { mood: "triumph", text: "THEE THANNE NEE!", when: "Rank 1 / personal best" },
  { mood: "great", text: "ADIPOLI!", when: "Top 20%" },
  { mood: "decent", text: "KOLLALO ATH!", when: "Above median" },
  { mood: "mid", text: "MWONEEE...", when: "Mid table" },
  { mood: "fail", text: "DWAAAA...", when: "Rejected" },
  { mood: "confused", text: "ENTHUVA!", when: "Broken / 404" },
];

const POPS = ["pop-red", "pop-yellow", "pop-teal", "pop-blue", "pop-pink", "pop-purple"];

function Section(props: { title: string; children: unknown }) {
  return (
    <section class="space-y-4">
      <h2 class="rule">{props.title}</h2>
      {props.children as never}
    </section>
  );
}

export default function StyleGuide() {
  const releaseIn = new Date(Date.now() + 1000 * 60 * 60 * 30);

  return (
    <main class="container space-y-12 py-8">
      <Title>Style guide — FOSS Onam Games</Title>

      <section
        class="relative overflow-hidden rounded-lg p-6 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="styleguide" count={10} animate />
        <div class="art-over space-y-2">
          <p class="wordmark text-3xl" data-text="STYLE GUIDE">
            STYLE GUIDE
          </p>
          <p class="comment">if it isn't on this page, it doesn't exist</p>
        </div>
      </section>

      <Section title="Colour">
        <div class="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <For each={SWATCHES}>
            {(swatch) => (
              <div class="space-y-1">
                <div
                  class="h-16 rounded"
                  style={{ background: swatch.value, border: "var(--ink-w) solid var(--ink)" }}
                />
                <p class="text-xs font-bold">{swatch.name}</p>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="Type">
        <div class="card pop-blue space-y-3">
          <p class="wordmark text-3xl" data-text="BUNGEE">
            BUNGEE
          </p>
          <p class="text-xs" style={{ color: "var(--ink-soft)" }}>
            Wordmark only — layered Shade behind Regular for poster chrome.
          </p>
          <hr style={{ border: 0, "border-top": "2px dashed var(--ink)", opacity: 0.3 }} />
          <h1>Baloo Chettan 2</h1>
          <p class="text-xs" style={{ color: "var(--ink-soft)" }}>
            Display / headings / buttons.
          </p>
          <hr style={{ border: 0, "border-top": "2px dashed var(--ink)", opacity: 0.3 }} />
          <p class="font-semibold">
            Nunito carries body copy. It stays readable at 14px on a cheap phone, which most chunky
            faces do not.
          </p>
          <p class="tabular-nums text-lg">Space Mono 0123456789 · 12.4s · 4,300 m</p>
          <p class="comment">and Caveat does the sarcasm, in the margin, where it belongs</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-brand">
            Play now
          </button>
          <button type="button" class="btn-accent">
            Start game
          </button>
          <button type="button" class="btn-ghost">
            Leaderboard
          </button>
          <button type="button" class="btn-danger">
            Give up
          </button>
          <button type="button" class="btn-brand" disabled>
            Out of runs
          </button>
        </div>
        <p class="comment">press one. the dots are the shadow we refuse to draw.</p>
      </Section>

      <Section title="Panels">
        <div class="grid gap-4 sm:grid-cols-2">
          <For each={POPS}>
            {(pop) => (
              <article class={`card ${pop}`}>
                <p class="text-lg font-extrabold">{pop}</p>
                <p class="text-sm" style={{ color: "var(--ink-soft)" }}>
                  Depth comes from the ink weight and the colour strip. No shadows anywhere.
                </p>
              </article>
            )}
          </For>
        </div>
      </Section>

      <Section title="Shouts">
        <div class="grid gap-6 sm:grid-cols-3">
          <For each={MOODS}>
            {(item) => (
              <div class="space-y-1 text-center">
                <ShoutBurst text={item.text} color={SHOUT_COLOR[item.mood]} seed={item.mood} />
                <p class="text-xs font-bold">{item.when}</p>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section title="Stickers, badges, bubbles">
        <div class="flex flex-wrap items-center gap-3">
          <span class="sticker">Live now</span>
          <span class="sticker sticker-alt" style={{ "--pop": "var(--pop-pink)" }}>
            Day 5
          </span>
          <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
            12 runs left
          </span>
          <span class="badge">Coming soon</span>
        </div>
        <Bubble color="var(--pop-yellow)" class="max-w-sm">
          <p class="font-bold">Only one attempt. The timer starts when you press start.</p>
        </Bubble>
      </Section>

      <Section title="Countdown">
        <Countdown target={releaseIn} />
        <Countdown target={new Date(Date.now() - 1000)} />
      </Section>

      <Section title="Halftone & burst">
        <div class="flex items-center gap-6">
          <div
            class="relative h-28 w-28 rounded"
            style={{ border: "var(--ink-w) solid var(--ink)", background: "var(--pop-teal)" }}
          >
            <Halftone opacity={0.3} />
          </div>
          <div class="h-28 w-28">
            <Burst color="var(--pop-pink)" seed="demo" double />
          </div>
        </div>
        <p class="comment">dots are how comics shaded. we just kept doing it.</p>
      </Section>

      <Section title="Form">
        <div class="card pop-purple space-y-3">
          <label for="demo-input">Your name</label>
          <input id="demo-input" class="input" placeholder="Maveli" />
          <label for="demo-select">College</label>
          <select id="demo-select" class="input">
            <option>MEC</option>
            <option>Other</option>
          </select>
        </div>
      </Section>

      <Section title="Leaderboard row">
        <div class="card card-plain overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th class="text-right">Time</th>
                <th class="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>🥇 1</td>
                <td class="font-bold">Anandhu</td>
                <td class="text-right tabular-nums">12.4s</td>
                <td class="text-right tabular-nums font-bold">1050</td>
              </tr>
              <tr style={{ background: "var(--pop-yellow-soft)" }}>
                <td>🥈 2</td>
                <td class="font-bold">
                  You <span class="text-xs">· you</span>
                </td>
                <td class="text-right tabular-nums">13.1s</td>
                <td class="text-right tabular-nums font-bold">988</td>
              </tr>
              <tr>
                <td>🥉 3</td>
                <td class="font-bold">Fathima</td>
                <td class="text-right tabular-nums">14.0s</td>
                <td class="text-right tabular-nums font-bold">921</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
