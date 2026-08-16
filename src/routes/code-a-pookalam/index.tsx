import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { Pencil } from "lucide-solid";
import { Show, type JSX } from "solid-js";

import { Countdown } from "~/components/Countdown";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { PookalamHeroInvite } from "~/components/pookalam/PookalamHeroInvite";
import { PookalamInteractiveCanvas } from "~/components/pookalam/PookalamInteractiveCanvas";
import { PookalamRoad } from "~/components/pookalam/PookalamRoad";
import { POOKALAM } from "~/lib/event-content";
import { getPookalamState } from "~/server/pookalam/actions";

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--pop-yellow)",
  approved: "var(--pop-teal)",
  rejected: "var(--pop-red)",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "waiting on review",
  approved: "accepted",
  rejected: "not accepted",
};

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
  const state = createAsync(() => getPookalamState());
  const mine = () => state()?.mine ?? null;

  return (
    <main class="container space-y-12 py-6">
      <Title>{POOKALAM.title} - FOSS Onam Games</Title>

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
          {/* Prize and deadline together, above everything else. "Day 6
              midnight" tells nobody whether there is still time; a clock that
              says three days does, and it has to be on the first screen to do
              any work at all. */}
          <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
              ₹3,000 Prize Pool · Open All Week
            </span>

            <Show
              when={state()?.phases.submissions.closesAt}
              fallback={<span class="badge">Closes Day 6 midnight</span>}
            >
              {(closesAt) => (
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-black uppercase tracking-wider text-muted">
                    time left
                  </span>
                  <Countdown target={new Date(closesAt())} doneLabel="Submissions closed" />
                </div>
              )}
            </Show>
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
          <div id="studio" class="scroll-mt-28 pt-1 text-left">
            <PookalamInteractiveCanvas />
          </div>

          {/* The handoff: from playing with a pookalam to building one. */}
          <div class="pt-1">
            <PookalamHeroInvite />
          </div>

          <Show when={!state()?.phases.submissions.closesAt}>
            <p class="comment text-xs">Submissions close Day 6 Midnight</p>
          </Show>
        </div>
      </section>

      {/* --------------------------------------------------- YOUR ENTRY STATUS */}
      <Show when={mine()}>
        <section class="space-y-3">
          <div class="flex items-center gap-2">
            <SpriteIcon name="concentric-pookalam" size={22} interactive />
            <h2 class="rule m-0">Your entry</h2>
          </div>

          <div
            class="card space-y-3 sm:flex sm:items-start sm:gap-4 sm:space-y-0"
            style={{
              "--pop": mine()!.shortlisted ? "var(--pop-purple)" : STATUS_COLOR[mine()!.status],
            }}
          >
            <img
              src={mine()!.imageUrl}
              alt={mine()!.title}
              class="w-full sm:w-32 sm:shrink-0"
              style={{
                "aspect-ratio": "1 / 1",
                "object-fit": "contain",
                background: "var(--paper-2)",
                border: "var(--ink-w) solid var(--ink)",
                "border-radius": "var(--radius)",
              }}
            />
            <div class="w-full space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <Show when={mine()!.shortlisted}>
                  <span class="badge" style={{ "--pop": "var(--pop-purple)" }}>
                    shortlisted for Day 7
                  </span>
                </Show>
                <span class="badge" style={{ "--pop": STATUS_COLOR[mine()!.status] }}>
                  {STATUS_LABEL[mine()!.status]}
                </span>
                <p class="font-extrabold m-0">{mine()!.title}</p>
              </div>

              <p class="comment text-xs">
                <Show
                  when={mine()!.shortlisted}
                  fallback="your entry is in the review queue. shortlisted entries face the community vote on Day 7."
                >
                  the jury picked your pookalam for the head-to-head arena. the community votes all
                  day on Day 7 - good luck!
                </Show>
              </p>

              <Show when={mine()!.reviewNote}>
                <p
                  class="text-xs font-semibold m-0"
                  style={{
                    color: "var(--ink-soft)",
                    "border-left": "3px solid var(--ink-soft)",
                    "padding-left": "0.5rem",
                  }}
                >
                  note from the judges: {mine()!.reviewNote}
                </p>
              </Show>

              <a
                href="/code-a-pookalam/submit"
                class="btn-ghost text-xs inline-flex items-center gap-1.5"
              >
                <Pencil size={14} />
                <span>View / edit your entry</span>
              </a>
            </div>
          </div>
        </section>
      </Show>

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

      {/* ------------------------------------------------------------- THE ROAD
       * Everything that used to be four parallel sections - how it works, the
       * rules, the judging pillars, last year's gallery and the six tutorial
       * tracks - now lives inside the stop where it is actually needed. A page
       * of parallel cards asked the reader to work out the order; the road
       * hands it to them.
       */}
      <PookalamRoad
        hasEntry={Boolean(mine())}
        closesAt={state()?.phases.submissions.closesAt ?? null}
      />

      {/* ---------------------------------- NOT INTERESTED IN CODING? BUILD THE SHARED POOKALAM */}
      <section
        class="card card-plain p-5 sm:p-6 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--pop-blue)",
        }}
      >
        <div class="space-y-1.5 text-center sm:text-left">
          <div class="flex items-center justify-center sm:justify-start gap-2">
            <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
              No Code Needed
            </span>
          </div>
          <h2
            class="text-xl sm:text-2xl font-black m-0 text-[var(--ink)]"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Not interested in participating with code?
          </h2>
          <p class="m-0 text-xs sm:text-sm font-bold text-[var(--ink)] max-w-xl">
            Build the community pookalam with us! Drop petals, collaborate on the live shared
            canvas, and create art together throughout Onam.
          </p>
        </div>

        <a
          href="/#shared-pookalam"
          class="btn-brand shrink-0 inline-flex items-center gap-2 text-xs sm:text-sm font-black whitespace-nowrap"
          style={{
            background: "var(--pop-yellow)",
            color: "var(--ink)",
          }}
        >
          <SpriteIcon name="pookalam-flower" size={20} />
          <span>Draw on Community Pookalam →</span>
        </a>
      </section>
    </main>
  );
}
