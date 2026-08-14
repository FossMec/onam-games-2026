import { Title } from "@solidjs/meta";
import { CheckCircle2, Layers, Send, Trophy, Vote } from "lucide-solid";
import { For } from "solid-js";

import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { PookalamInteractiveCanvas } from "~/components/pookalam/PookalamInteractiveCanvas";
import { PookalamTutorials } from "~/components/pookalam/PookalamTutorials";
import { PreviousPookalamCarousel } from "~/components/pookalam/PreviousPookalamCarousel";
import { POOKALAM } from "~/lib/event-content";

const POPS = ["pop-yellow", "pop-teal", "pop-blue", "pop-purple", "pop-pink"];

export default function CodeAPookalam() {
  return (
    <main class="container space-y-8 py-6 max-w-4xl">
      <Title>{POOKALAM.title} — FOSS Onam Games</Title>

      {/* ---------------------------------------------------- HERO HEADER */}
      <section class="card pop-yellow space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5 min-w-0">
            <SpriteIcon name="maveli-laptop" size={48} animate="float" class="shrink-0" />
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-2xl sm:text-3xl font-black">Code-a-Pookalam</h1>
                <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
                  ₹3,000 Prize Pool
                </span>
              </div>
              <p class="comment">{POOKALAM.tagline} · Open All Week (Closes Day 6)</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
            <a href="/code-a-pookalam/vote" class="btn-ghost">
              <Vote size={18} />
              <span>Elo Arena</span>
            </a>
            <a href="/code-a-pookalam/submit" class="btn-brand">
              <Send size={18} />
              <span>Submit Entry</span>
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- HERO LIVE CANVAS STUDIO */}
      <section class="space-y-4">
        <PookalamInteractiveCanvas />
      </section>

      {/* ---------------------------------------------------- PRIZES CALLOUT */}
      <section class="grid sm:grid-cols-3 gap-3">
        <div class="card pop-yellow flex items-center gap-3">
          <div class="w-10 h-10 rounded bg-surface-3 inked grid place-items-center font-black text-lg shrink-0">
            🥇
          </div>
          <div>
            <p class="text-xs uppercase font-extrabold text-muted">1st Place</p>
            <p class="text-lg font-black font-display">₹1,500 Cash</p>
          </div>
        </div>

        <div class="card pop-teal flex items-center gap-3">
          <div class="w-10 h-10 rounded bg-surface-3 inked grid place-items-center font-black text-lg shrink-0">
            🥈
          </div>
          <div>
            <p class="text-xs uppercase font-extrabold text-muted">2nd Place</p>
            <p class="text-lg font-black font-display">₹1,000 Cash</p>
          </div>
        </div>

        <div class="card pop-pink flex items-center gap-3">
          <div class="w-10 h-10 rounded bg-surface-3 inked grid place-items-center font-black text-lg shrink-0">
            🥉
          </div>
          <div>
            <p class="text-xs uppercase font-extrabold text-muted">3rd Place</p>
            <p class="text-lg font-black font-display">₹500 Cash</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- HOW IT WORKS & TIMELINE */}
      <section class="card pop-teal space-y-4">
        <div class="flex items-center gap-2">
          <Layers size={22} class="text-[var(--pop-teal-deep)]" />
          <h2 class="text-xl sm:text-2xl font-black">How the Competition Works</h2>
        </div>

        <div class="grid md:grid-cols-3 gap-3">
          <div class="card card-plain bg-surface space-y-2">
            <div class="flex items-center justify-between">
              <span class="w-6 h-6 rounded-full bg-[var(--pop-yellow)] inked grid place-items-center font-black text-xs">
                1
              </span>
              <span class="text-[10px] font-black uppercase text-muted">Days 1 – 6</span>
            </div>
            <h3 class="font-black text-base">Code & Submit</h3>
            <p class="text-xs font-semibold leading-relaxed text-muted">
              Create your pookalam in any language. Submit your GitHub repository link and output
              render before the Day 6 deadline.
            </p>
          </div>

          <div class="card card-plain bg-surface space-y-2">
            <div class="flex items-center justify-between">
              <span class="w-6 h-6 rounded-full bg-[var(--pop-teal)] inked grid place-items-center font-black text-xs">
                2
              </span>
              <span class="text-[10px] font-black uppercase text-muted">Day 6 Night</span>
            </div>
            <h3 class="font-black text-base">Jury Shortlist</h3>
            <p class="text-xs font-semibold leading-relaxed text-muted">
              Our jury reviews all submitted codebases and renders, shortlisting the standout
              pookalams based on geometry and craft.
            </p>
          </div>

          <div class="card card-plain bg-surface space-y-2">
            <div class="flex items-center justify-between">
              <span class="w-6 h-6 rounded-full bg-[var(--pop-pink)] inked grid place-items-center font-black text-xs">
                3
              </span>
              <span class="text-[10px] font-black uppercase text-muted">Day 7 All-Day</span>
            </div>
            <h3 class="font-black text-base">Community Elo Arena</h3>
            <p class="text-xs font-semibold leading-relaxed text-muted">
              Shortlisted entries face off head-to-head in our live pairwise Elo matchmaker where
              the community votes all day to settle the winners!
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- RULES & CRITERIA */}
      <section class="grid md:grid-cols-2 gap-4">
        {/* Rules */}
        <div class="card pop-blue space-y-3">
          <div class="flex items-center gap-2">
            <CheckCircle2 size={18} class="text-[var(--pop-blue)]" />
            <h3 class="text-lg font-black">Submission Guidelines</h3>
          </div>
          <ul class="space-y-2">
            <For each={POOKALAM.rules}>
              {(rule) => (
                <li class="flex items-start gap-2 text-xs sm:text-sm font-semibold leading-relaxed">
                  <span class="text-[var(--pop-pink)] font-black shrink-0">▸</span>
                  <span>{rule}</span>
                </li>
              )}
            </For>
          </ul>
        </div>

        {/* Judging Criteria */}
        <div class="card pop-purple space-y-3">
          <div class="flex items-center gap-2">
            <Trophy size={18} class="text-[var(--pop-yellow-deep)]" />
            <h3 class="text-lg font-black">Judging Pillars</h3>
          </div>
          <div class="space-y-2">
            <For each={POOKALAM.judging}>
              {(criterion, index) => (
                <div class="card card-plain bg-surface p-2.5 space-y-0.5">
                  <p class="font-black text-xs text-ink flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full"
                      style={{ background: `var(--${POPS[index() % POPS.length]})` }}
                    />
                    <span>{criterion.name}</span>
                  </p>
                  <p class="text-xs font-semibold text-muted">{criterion.body}</p>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- PREVIOUS YEAR CAROUSEL */}
      <PreviousPookalamCarousel />

      {/* ---------------------------------------------------- TUTORIALS & STARTER LAB */}
      <PookalamTutorials />

      {/* ---------------------------------------------------- BOTTOM CTA */}
      <section class="card pop-yellow text-center space-y-4 p-6 sm:p-8">
        <Confetti seed="pookalam-footer" count={6} />
        <div class="relative z-10 space-y-3 max-w-lg mx-auto">
          <SpriteIcon name="tux-king" size={48} animate="wobble" class="mx-auto" />
          <h2 class="text-2xl sm:text-3xl font-black">Ready to deploy your flower carpet?</h2>
          <p class="comment">
            Submissions are open now through Day 6. Submit your GitHub repository and render
            snapshot to enter the running!
          </p>
          <div class="pt-2 flex justify-center">
            <a href="/code-a-pookalam/submit" class="btn-brand">
              <Send size={18} />
              <span>Submit Your Pookalam Entry</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
