import { Title } from "@solidjs/meta";
import { CheckCircle2, Layers, Send, Sparkles, Trophy, Vote } from "lucide-solid";
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
    <main class="container space-y-12 py-6 max-w-5xl">
      <Title>{POOKALAM.title} — FOSS Onam Games</Title>

      {/* ---------------------------------------------------- TOP SUBMIT ACTION BAR */}
      <section class="rounded-2xl p-4 sm:p-5 bg-[var(--pop-yellow)] border-4 border-[var(--ink)] shadow-[6px_6px_0px_0px_var(--ink)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3.5 min-w-0">
          <SpriteIcon name="maveli-laptop" size={44} animate="float" class="shrink-0" />
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="badge text-[10px] py-0 px-2 uppercase font-black bg-[var(--paper-2)] border border-[var(--ink)]">
                ₹3,000 Prize Pool
              </span>
              <span class="text-xs font-black uppercase text-[var(--ink)] tracking-wider">
                Open All Week · Closes Day 6
              </span>
            </div>
            <h2
              class="text-lg sm:text-xl font-black truncate mt-0.5"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Code-a-Pookalam 2026
            </h2>
          </div>
        </div>

        <div class="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
          <a
            href="/code-a-pookalam/vote"
            class="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] font-black text-xs sm:text-sm text-center hover:bg-[var(--pop-teal)] transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--ink)] active:translate-y-0.5 inline-flex items-center justify-center gap-1.5"
          >
            <Vote size={15} strokeWidth={2.5} />
            <span>Elo Voting Arena</span>
          </a>
          <a
            href="/code-a-pookalam/submit"
            class="flex-1 md:flex-initial btn-brand py-2.5 px-5 rounded-xl text-xs sm:text-sm font-black text-center shadow-[3px_3px_0px_0px_var(--ink)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 inline-flex items-center justify-center gap-1.5"
          >
            <Send size={15} strokeWidth={2.5} />
            <span>Submit Your Pookalam</span>
          </a>
        </div>
      </section>

      {/* ---------------------------------------------------- HERO & INTERACTIVE CANVAS */}
      <section class="space-y-6">
        <div class="text-center max-w-2xl mx-auto space-y-2.5">
          <div class="inline-flex items-center gap-1.5 text-xs font-black uppercase px-3 py-1 rounded-full bg-[var(--pop-teal)] border-2 border-[var(--ink)] shadow-[2px_2px_0px_0px_var(--ink)]">
            <Sparkles size={13} />
            <span>Generative Floral Art</span>
          </div>
          <h1
            class="text-3xl sm:text-5xl font-black tracking-tight"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Code a Pookalam.
          </h1>
          <p
            class="text-sm sm:text-base font-semibold leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            {POOKALAM.blurb}
          </p>
        </div>

        {/* Live Interactive Canvas Studio Component */}
        <PookalamInteractiveCanvas />
      </section>

      {/* ---------------------------------------------------- PRIZES CALLOUT */}
      <section class="grid sm:grid-cols-3 gap-4">
        <div class="card card-plain p-4 bg-[var(--pop-yellow)] flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center font-black text-xl shrink-0 shadow-[2px_2px_0px_0px_var(--ink)]">
            🥇
          </div>
          <div>
            <p class="text-xs font-black uppercase text-[var(--ink-soft)]">1st Place Champion</p>
            <p class="text-xl font-black">₹1,500 Cash</p>
          </div>
        </div>

        <div class="card card-plain p-4 bg-[var(--pop-teal)] flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center font-black text-xl shrink-0 shadow-[2px_2px_0px_0px_var(--ink)]">
            🥈
          </div>
          <div>
            <p class="text-xs font-black uppercase text-[var(--ink-soft)]">2nd Place Podium</p>
            <p class="text-xl font-black">₹1,000 Cash</p>
          </div>
        </div>

        <div class="card card-plain p-4 bg-[var(--pop-pink)] flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center font-black text-xl shrink-0 shadow-[2px_2px_0px_0px_var(--ink)]">
            🥉
          </div>
          <div>
            <p class="text-xs font-black uppercase text-[var(--ink-soft)]">3rd Place Podium</p>
            <p class="text-xl font-black">₹500 Cash</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- HOW IT WORKS & TIMELINE */}
      <section class="rounded-2xl bg-[var(--paper-2)] border-3 border-[var(--ink)] shadow-[6px_6px_0px_0px_var(--ink)] p-6 sm:p-8 space-y-6">
        <div class="flex items-center gap-2">
          <Layers size={20} class="text-[var(--pop-teal)]" />
          <h2
            class="text-2xl font-black tracking-tight"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            How the Competition Works
          </h2>
        </div>

        <div class="grid md:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] space-y-2 shadow-[3px_3px_0px_0px_var(--ink)]">
            <div class="flex items-center justify-between">
              <span class="w-7 h-7 rounded-full bg-[var(--pop-yellow)] border-2 border-[var(--ink)] grid place-items-center font-black text-xs">
                1
              </span>
              <span class="text-[10px] font-black uppercase text-[var(--ink-soft)]">
                Days 1 – 6
              </span>
            </div>
            <h3 class="font-black text-base">Code & Submit</h3>
            <p class="text-xs font-semibold leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Create your pookalam in any language. Submit your source code link
              (GitHub/gist/sketch) along with a rendered picture before Day 6 deadline.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] space-y-2 shadow-[3px_3px_0px_0px_var(--ink)]">
            <div class="flex items-center justify-between">
              <span class="w-7 h-7 rounded-full bg-[var(--pop-teal)] border-2 border-[var(--ink)] grid place-items-center font-black text-xs">
                2
              </span>
              <span class="text-[10px] font-black uppercase text-[var(--ink-soft)]">
                Day 6 Night
              </span>
            </div>
            <h3 class="font-black text-base">Jury Shortlist</h3>
            <p class="text-xs font-semibold leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Our expert jury reviews all submitted codebases and renders, shortlisting the top
              standout pookalams based on geometry, craft, and originality.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] space-y-2 shadow-[3px_3px_0px_0px_var(--ink)]">
            <div class="flex items-center justify-between">
              <span class="w-7 h-7 rounded-full bg-[var(--pop-pink)] border-2 border-[var(--ink)] grid place-items-center font-black text-xs">
                3
              </span>
              <span class="text-[10px] font-black uppercase text-[var(--ink-soft)]">
                Day 7 All-Day
              </span>
            </div>
            <h3 class="font-black text-base">Community Elo Arena</h3>
            <p class="text-xs font-semibold leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Shortlisted entries face off head-to-head in our live pairwise Elo matchmaker where
              the community votes all day to settle the winners!
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- RULES & CRITERIA */}
      <section class="grid md:grid-cols-2 gap-6">
        {/* Rules */}
        <div class="rounded-2xl bg-[var(--paper-2)] border-3 border-[var(--ink)] shadow-[5px_5px_0px_0px_var(--ink)] p-5 sm:p-6 space-y-4">
          <div class="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-3">
            <CheckCircle2 size={18} class="text-[var(--pop-teal)]" />
            <h3 class="text-lg font-black uppercase tracking-tight">Submission Guidelines</h3>
          </div>
          <ul class="space-y-3">
            <For each={POOKALAM.rules}>
              {(rule) => (
                <li class="flex items-start gap-2.5 text-xs sm:text-sm font-semibold leading-relaxed">
                  <span class="text-[var(--pop-pink)] font-black text-base shrink-0">▸</span>
                  <span>{rule}</span>
                </li>
              )}
            </For>
          </ul>
        </div>

        {/* Judging Criteria */}
        <div class="rounded-2xl bg-[var(--paper-2)] border-3 border-[var(--ink)] shadow-[5px_5px_0px_0px_var(--ink)] p-5 sm:p-6 space-y-4">
          <div class="flex items-center gap-2 border-b-2 border-[var(--ink)] pb-3">
            <Trophy size={18} class="text-[var(--pop-yellow)]" />
            <h3 class="text-lg font-black uppercase tracking-tight">Judging Pillars</h3>
          </div>
          <div class="space-y-2.5">
            <For each={POOKALAM.judging}>
              {(criterion, index) => (
                <div class="p-3 rounded-lg bg-[var(--paper)] border-2 border-[var(--ink)] shadow-[2px_2px_0px_0px_var(--ink)] space-y-0.5">
                  <p class="font-black text-xs text-[var(--ink)] flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full"
                      style={{ background: `var(--${POPS[index() % POPS.length]})` }}
                    />
                    <span>{criterion.name}</span>
                  </p>
                  <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                    {criterion.body}
                  </p>
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
      <section class="relative overflow-hidden rounded-2xl p-8 text-center space-y-4 bg-[var(--paper-2)] border-4 border-[var(--ink)] shadow-[8px_8px_0px_0px_var(--ink)]">
        <Confetti seed="pookalam-footer" count={8} />
        <div class="relative z-10 space-y-3 max-w-xl mx-auto">
          <SpriteIcon name="tux-king" size={48} animate="wobble" class="mx-auto" />
          <h2
            class="text-2xl sm:text-3xl font-black"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Ready to deploy your flower carpet?
          </h2>
          <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            Submissions are open now through Day 6. Submit your code repo and a render snapshot to
            enter the running!
          </p>
          <div class="pt-2 flex justify-center">
            <a
              href="/code-a-pookalam/submit"
              class="btn-brand py-3 px-8 rounded-xl text-sm sm:text-base font-black flex items-center gap-2 shadow-[4px_4px_0px_0px_var(--ink)] hover:translate-x-0.5 hover:translate-y-0.5"
            >
              <Send size={16} strokeWidth={2.5} />
              <span>Submit Your Pookalam Entry</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
