import { Title } from "@solidjs/meta";
import { For } from "solid-js";
import { Bubble, Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { POOKALAM } from "~/lib/event-content";

const POPS = ["pop-yellow", "pop-teal", "pop-blue", "pop-purple"];

/**
 * Code-a-Pookalam details. Separate from the daily games entirely — it is not
 * timed, not an attempt, and has no leaderboard row; it runs alongside the week
 * and is judged by public voting.
 *
 * All copy comes from `src/lib/event-content.ts`.
 */
export default function CodeAPookalam() {
  return (
    <main class="container space-y-12 py-6">
      <Title>{POOKALAM.title} — FOSS Onam Games</Title>

      <a
        href="/"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back
      </a>

      <section
        class="relative overflow-hidden rounded-lg p-6 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-pink)" }}
      >
        <Confetti seed="pookalam-hero" count={12} animate />
        <div class="art-over space-y-3">
          <h1>{POOKALAM.title}</h1>
          <p class="text-lg font-extrabold" style={{ "font-family": "var(--font-stack-display)" }}>
            {POOKALAM.tagline}
          </p>
        </div>
      </section>

      <section class="space-y-4">
        <p class="text-lg font-semibold">{POOKALAM.blurb}</p>
        <div class="flex flex-wrap gap-2">
          <span class="sticker">Submit by {POOKALAM.submitBy}</span>
          <span class="sticker sticker-alt" style={{ "--pop": "var(--pop-teal)" }}>
            Voting {POOKALAM.votingOn}
          </span>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="rule">The rules</h2>
        <ul class="card pop-red space-y-2">
          <For each={POOKALAM.rules}>
            {(rule) => (
              <li class="flex gap-2 font-semibold">
                <span style={{ color: "var(--pop-red)" }}>▸</span>
                <span>{rule}</span>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="space-y-4">
        <h2 class="rule">How it's judged</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={POOKALAM.judging}>
            {(criterion, index) => (
              <div class={`card ${POPS[index() % POPS.length]}`}>
                <p class="font-extrabold">{criterion.name}</p>
                <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {criterion.body}
                </p>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="rule">Public voting</h2>
        <Bubble color="var(--pop-yellow)">
          <p class="font-semibold">{POOKALAM.votingBlurb}</p>
        </Bubble>
        <p class="comment">{POOKALAM.aside}</p>
      </section>

      <section
        class="relative overflow-hidden rounded-lg p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-3)" }}
      >
        <Halftone opacity={0.12} />
        <div class="art-over space-y-3">
          <h2 class="text-2xl">Ready to draw with maths?</h2>
          {/* TODO: point at the real submission form once it exists. */}
          <p class="font-semibold">Submissions open closer to the date.</p>
          <a href="/" class="btn-brand">
            Back to the games
          </a>
        </div>
      </section>
    </main>
  );
}
