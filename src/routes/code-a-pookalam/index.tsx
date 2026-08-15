import { Title } from "@solidjs/meta";
import { Send } from "lucide-solid";
import { For, type JSX } from "solid-js";

import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { PookalamInteractiveCanvas } from "~/components/pookalam/PookalamInteractiveCanvas";
import { PookalamTutorials } from "~/components/pookalam/PookalamTutorials";
import { PreviousPookalamCarousel } from "~/components/pookalam/PreviousPookalamCarousel";
import { POOKALAM } from "~/lib/event-content";

const POPS = ["pop-yellow", "pop-teal", "pop-blue", "pop-purple", "pop-pink"];

function Section(props: {
  title: string;
  children: JSX.Element;
  id?: string;
  confettiSeed?: string;
  confettiCount?: number;
}) {
  return (
    <section id={props.id} class="relative space-y-5 scroll-mt-28">
      {props.confettiSeed && (
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed={props.confettiSeed} count={props.confettiCount ?? 5} animate />
        </div>
      )}
      <h2 class="rule">{props.title}</h2>
      {props.children}
    </section>
  );
}

export default function CodeAPookalam() {
  return (
    <main class="container space-y-12 py-6">
      <Title>{POOKALAM.title} — FOSS Onam Games</Title>

      {/* ------------------------------------------------------------- HERO */}
      <section
        class="relative overflow-hidden rounded-lg px-4 sm:px-6 py-6 sm:py-8 text-center space-y-4"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <Confetti seed="pookalam-hero" count={8} animate />
        <SpriteScatter
          seed="pookalam-sprites"
          count={5}
          pool={[
            "maveli-laptop",
            "tux-king",
            "sadya-leaf",
            "octocat-garland",
            "arch-crown",
            "docker-pookalam",
            "ferris-crab",
            "gopher-king",
            "foss-mec-badge",
          ]}
          minSize={32}
          maxSize={48}
          opacity={0.85}
          animate
        />

        <div class="art-over space-y-3 max-w-3xl mx-auto">
          {/* Top Prize Badge */}
          <div class="flex justify-center">
            <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
              ₹3,000 Prize Pool · Open All Week
            </span>
          </div>

          {/* Main Title Row */}
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 min-w-0">
            <div class="flex justify-end shrink-0">
              <SpriteIcon name="concentric-pookalam" size={36} animate="float" interactive />
            </div>
            <p
              class="wordmark min-w-0"
              data-text="CODE-A-POOKALAM"
              style={{ "font-size": "clamp(1.4rem, 5.5vw, 3rem)" }}
            >
              CODE-A-POOKALAM
            </p>
            <div class="flex justify-start shrink-0">
              <SpriteIcon name="tux-king" size={36} animate="float" delay={1.2} interactive />
            </div>
          </div>

          <p
            class="mx-auto max-w-lg text-base sm:text-lg font-extrabold"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            {POOKALAM.tagline}
          </p>

          {/* Interactive Pookalam Canvas & Studio Centerpiece */}
          <div class="pt-1 text-left">
            <PookalamInteractiveCanvas />
          </div>

          <p class="comment text-xs">Submissions close Day 6 Midnight</p>
        </div>
      </section>

      {/* ---------------------------------------------------- PRIZES & BOUNTIES */}
      <Section title="Prizes & Bounties" id="prizes" confettiSeed="cap-prizes" confettiCount={5}>
        <div class="grid sm:grid-cols-3 gap-3">
          <div class="card pop-yellow flex items-center gap-3.5">
            <SpriteIcon name="tux-king" size={38} animate="wobble" interactive class="shrink-0" />
            <div>
              <p class="text-xs uppercase font-extrabold text-muted">1st Place Champion</p>
              <p class="text-xl font-black font-display">₹1,500 Cash</p>
            </div>
          </div>

          <div class="card pop-teal flex items-center gap-3.5">
            <SpriteIcon name="ferris-crab" size={38} animate="float" interactive class="shrink-0" />
            <div>
              <p class="text-xs uppercase font-extrabold text-muted">2nd Place Podium</p>
              <p class="text-xl font-black font-display">₹1,000 Cash</p>
            </div>
          </div>

          <div class="card pop-pink flex items-center gap-3.5">
            <SpriteIcon name="gopher-king" size={38} animate="float" interactive class="shrink-0" />
            <div>
              <p class="text-xs uppercase font-extrabold text-muted">3rd Place Podium</p>
              <p class="text-xl font-black font-display">₹500 Cash</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------- HOW IT WORKS */}
      <Section
        title="How the Competition Works"
        id="how-it-works"
        confettiSeed="cap-how"
        confettiCount={4}
      >
        <div class="grid md:grid-cols-3 gap-3">
          <div class="card pop-yellow space-y-2">
            <div class="flex items-center justify-between">
              <SpriteIcon name="git-nodes" size={24} interactive />
              <span class="badge text-[10px]">Days 1 – 6</span>
            </div>
            <h3 class="font-black text-base">1. Code & Submit</h3>
            <p class="text-xs font-semibold leading-relaxed text-muted">
              Create your pookalam in any language. Submit your GitHub repository link and output
              render before the Day 6 deadline.
            </p>
          </div>

          <div class="card pop-teal space-y-2">
            <div class="flex items-center justify-between">
              <SpriteIcon name="sadya-leaf" size={24} interactive />
              <span class="badge text-[10px]">Day 6 Night</span>
            </div>
            <h3 class="font-black text-base">2. Jury Shortlist</h3>
            <p class="text-xs font-semibold leading-relaxed text-muted">
              Our jury reviews all submitted codebases and renders, shortlisting the standout
              pookalams based on geometry, craft, and originality.
            </p>
          </div>

          <div class="card pop-pink space-y-2">
            <div class="flex items-center justify-between">
              <SpriteIcon name="docker-pookalam" size={24} interactive />
              <span class="badge text-[10px]">Day 7 All-Day</span>
            </div>
            <h3 class="font-black text-base">3. Community Elo Arena</h3>
            <p class="text-xs font-semibold leading-relaxed text-muted">
              Shortlisted entries face off head-to-head in our live pairwise Elo matchmaker where
              the community votes all day to settle the winners!
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------- RULES & CRITERIA */}
      <Section title="Rules & Judging" confettiSeed="cap-rules" confettiCount={4}>
        <div class="grid md:grid-cols-2 gap-4">
          {/* Rules */}
          <div class="card pop-blue space-y-3">
            <div class="flex items-center gap-2">
              <SpriteIcon name="arch-crown" size={22} interactive />
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
              <SpriteIcon name="nilavilakku" size={22} interactive />
              <h3 class="text-lg font-black">Judging Pillars</h3>
            </div>
            <div class="space-y-2">
              <For each={POOKALAM.judging}>
                {(criterion, index) => (
                  <div class="card card-plain bg-surface p-2.5 space-y-0.5">
                    <p class="font-black text-xs text-ink flex items-center gap-1.5">
                      <span
                        class="w-2 h-2 rounded-full"
                        style={{
                          background: `var(--${POPS[index() % POPS.length]})`,
                        }}
                      />
                      <span>{criterion.name}</span>
                    </p>
                    <p class="text-xs font-semibold text-muted">{criterion.body}</p>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------- PREVIOUS YEAR CAROUSEL */}
      <Section title="Past Community Creations" confettiSeed="cap-past" confettiCount={5}>
        <PreviousPookalamCarousel />
      </Section>

      {/* ---------------------------------------------------- TUTORIALS & STARTER LAB */}
      <Section title="Ways to Code a Pookalam" confettiSeed="cap-tutorials" confettiCount={4}>
        <PookalamTutorials />
      </Section>

      {/* ---------------------------------------------------- BOTTOM CTA */}
      <section class="card pop-yellow p-6 sm:p-8 relative overflow-hidden">
        <Confetti seed="pookalam-footer" count={8} animate opacity={0.5} />
        <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
          {/* Deploy Meme on the Left on Desktop */}
          <img
            src="/images/memes/meme-deploy.webp"
            alt="Deploy Flower Carpet Meme"
            class="w-38 sm:w-40 md:w-44 h-auto object-contain select-none shrink-0 rounded-xl border-2 border-[var(--ink)] block"
          />

          <div class="space-y-3 text-center md:text-left flex-1">
            <h2 class="text-2xl sm:text-3xl font-black text-[var(--ink)]">
              Ready to deploy your flower carpet?
            </h2>
            <p class="comment  sm:text-lg font-bold">
              Submissions are open now through Day 6. Submit your GitHub repository and render
              snapshot to enter the running!
            </p>
            <div class="pt-1 flex justify-center md:justify-start">
              <a href="/code-a-pookalam/submit" class="btn-brand inline-flex items-center gap-2">
                <Send size={18} />
                <span>Submit Your Pookalam Entry</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
