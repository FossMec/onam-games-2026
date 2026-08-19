import { A } from "@solidjs/router";
import {
  Calendar,
  CheckCircle2,
  Code2,
  Eye,
  FileCheck,
  Map,
  Scale,
  Send,
  Swords,
  Zap,
} from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { POOKALAM } from "~/lib/event-content";

export type ViewMode = "road" | "nofluff";

export function WhatIsCodeAPookalam(props: {
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
}) {
  const [mobileTab, setMobileTab] = createSignal<"rules" | "judging">("rules");

  const phases = [
    {
      day: "Days 1–6",
      title: "Code & Submit",
      desc: "Design your pookalam in any language. Push code to a public repo and upload 1:1 render.",
      icon: Calendar,
      pop: "pop-yellow",
    },
    {
      day: "Day 6 Mid",
      title: "Jury Shortlist",
      desc: "Judges review submissions across 5 pillars (visuals, craft, pookalam spirit) to pick finalists.",
      icon: Scale,
      pop: "pop-teal",
    },
    {
      day: "Day 7 Vote",
      title: "Elo Arena",
      desc: "Blind 1v1 community showdowns with Elo matchmaking crown the champions!",
      icon: Swords,
      pop: "pop-pink",
    },
  ];

  const rules = [
    {
      title: "1:1 Square Render",
      desc: "Clean render (PNG, JPEG, WebP) downscaled to 1024×1024.",
      icon: CheckCircle2,
    },
    {
      title: "Public Repo + License",
      desc: "Hosted on GitHub/GitLab with open-source license (MIT, Apache, GPL).",
      icon: FileCheck,
    },
    {
      title: "100% Anonymous Render",
      desc: "Zero watermarks, names, or handles in the image for blind voting.",
      icon: Eye,
    },
    {
      title: "Executable Source Code",
      desc: "Runnable code in any stack. AI tools are welcome if your code runs!",
      icon: Code2,
    },
  ];

  return (
    <section id="about-code-a-pookalam" class="space-y-4 scroll-mt-28">
      {/* ----------------- COMPETITION BRIEF & TIMELINE ----------------- */}
      <div
        class="card pop-yellow relative overflow-hidden space-y-3.5 p-3.5 sm:p-5"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        <Halftone opacity={0.07} />

        <div class="art-over space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="sticker text-[10px]" style={{ "--pop": "var(--pop-pink)" }}>
              The Flagship Competition
            </span>
            <span class="badge text-[11px]" style={{ "--pop": "var(--paper-2)" }}>
              ₹3,000 Total Cash Prizes
            </span>
          </div>

          <div class="space-y-1">
            <h2
              class="m-0 text-lg sm:text-2xl font-black text-[var(--ink)] tracking-tight"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Code-a-Pookalam: Competition & Rules
            </h2>
            <p class="m-0 text-xs sm:text-sm font-bold text-[var(--ink)] leading-relaxed max-w-2xl">
              Code a Pookalam purely with programming. Submit your runnable source and 1:1 render
              before the{" "}
              <span class="underline decoration-2 decoration-[var(--pop-red)]">Day 6 deadline</span>
              . Jury shortlists the top entries, and on Day 7 the community votes blind in a
              pairwise Elo arena!
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-0.5">
            <A
              href="/code-a-pookalam/submit"
              class="btn-brand inline-flex items-center gap-1.5 text-xs sm:text-sm font-black"
            >
              <Send size={14} />
              <span>Submit Your Pookalam →</span>
            </A>
          </div>
        </div>

        {/* 3 Competition Timeline Phases */}
        <div class="art-over space-y-1.5">
          <p class="m-0 text-[10.5px] font-black uppercase tracking-wider text-muted">
            Competition Timeline
          </p>

          {/* Mobile: Compact single card list */}
          <div
            class="card card-plain bg-surface p-2.5 space-y-2 sm:hidden"
            style={{ border: "var(--ink-w) solid var(--ink)" }}
          >
            <For each={phases}>
              {(phase, idx) => (
                <div
                  class={`flex items-start gap-2 text-xs ${idx() > 0 ? "border-t border-[var(--ink)]/10 pt-1.5" : ""}`}
                >
                  <span
                    class="sticker shrink-0 text-[8.5px] py-0.5"
                    style={{ "--pop": `var(--${phase.pop})` }}
                  >
                    {phase.day}
                  </span>
                  <div class="min-w-0">
                    <p class="m-0 text-xs font-black text-[var(--ink)]">{phase.title}</p>
                    <p class="m-0 text-[10.5px] font-semibold leading-tight text-muted">
                      {phase.desc}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Desktop: 3-column cards */}
          <div class="hidden sm:grid sm:grid-cols-3 gap-2.5">
            <For each={phases}>
              {(phase) => (
                <div
                  class="card card-plain bg-surface p-3 space-y-1.5 flex flex-col justify-between"
                  style={{ border: "var(--ink-w) solid var(--ink)" }}
                >
                  <div class="space-y-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="sticker text-[9px]" style={{ "--pop": `var(--${phase.pop})` }}>
                        {phase.day}
                      </span>
                      <phase.icon size={15} class="text-muted shrink-0" />
                    </div>
                    <p class="m-0 text-sm font-black">{phase.title}</p>
                  </div>
                  <p class="m-0 text-xs font-semibold leading-relaxed text-muted">{phase.desc}</p>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Requirements & Judging Section */}
        <div class="art-over pt-0.5">
          {/* Mobile: Segmented Tab Toggle between Rules and Judging */}
          <div class="sm:hidden space-y-2">
            <div
              class="flex rounded p-0.5 gap-1"
              style={{ background: "var(--paper-3)", border: "var(--ink-w) solid var(--ink)" }}
            >
              <button
                type="button"
                onClick={() => setMobileTab("rules")}
                class="flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-xs font-black transition-colors cursor-pointer text-center outline-none focus:outline-none"
                style={
                  mobileTab() === "rules"
                    ? {
                        background: "var(--pop-yellow)",
                        border: "var(--ink-w) solid var(--ink)",
                        color: "var(--ink)",
                      }
                    : {
                        background: "transparent",
                        border: "var(--ink-w) solid transparent",
                        color: "var(--ink-soft)",
                      }
                }
              >
                <FileCheck size={12} strokeWidth={2.5} />
                <span>Rules (4)</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("judging")}
                class="flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-xs font-black transition-colors cursor-pointer text-center outline-none focus:outline-none"
                style={
                  mobileTab() === "judging"
                    ? {
                        background: "var(--pop-pink)",
                        border: "var(--ink-w) solid var(--ink)",
                        color: "var(--ink)",
                      }
                    : {
                        background: "transparent",
                        border: "var(--ink-w) solid transparent",
                        color: "var(--ink-soft)",
                      }
                }
              >
                <Scale size={12} strokeWidth={2.5} />
                <span>Judging (5)</span>
              </button>
            </div>

            <div
              class="card card-plain bg-surface p-3 space-y-2"
              style={{ border: "var(--ink-w) solid var(--ink)" }}
            >
              <Show
                when={mobileTab() === "rules"}
                fallback={
                  <div class="space-y-1.5">
                    <For each={POOKALAM.judging}>
                      {(criterion) => (
                        <div class="text-xs">
                          <p class="m-0 font-black text-[var(--ink)] leading-tight">
                            {criterion.name}
                          </p>
                          <p class="m-0 text-[10.5px] font-semibold text-muted leading-tight">
                            {criterion.body}
                          </p>
                        </div>
                      )}
                    </For>
                  </div>
                }
              >
                <div class="space-y-1.5">
                  <For each={rules}>
                    {(rule) => (
                      <div class="flex items-start gap-2 text-xs">
                        <span class="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded bg-[var(--pop-yellow)] border border-[var(--ink)]">
                          <rule.icon size={9} strokeWidth={2.5} />
                        </span>
                        <div>
                          <span class="font-black text-[var(--ink)]">{rule.title}: </span>
                          <span class="text-[10.5px] font-semibold text-muted leading-tight">
                            {rule.desc}
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Desktop: Side-by-side 2-Card Layout */}
          <div class="hidden sm:grid sm:grid-cols-2 gap-3">
            {/* Left Card: Submission Requirements */}
            <div
              class="card card-plain bg-surface p-3.5 sm:p-4 space-y-2.5 flex flex-col justify-between"
              style={{ border: "var(--ink-w) solid var(--ink)" }}
            >
              <div class="space-y-2.5">
                <div class="flex items-center gap-1.5 border-b border-[var(--ink)]/10 pb-1.5">
                  <FileCheck size={16} class="text-[var(--pop-teal-deep)]" />
                  <h4 class="m-0 text-xs sm:text-sm font-black uppercase tracking-wider">
                    Submission Requirements
                  </h4>
                </div>

                <div class="space-y-2">
                  <For each={rules}>
                    {(rule) => (
                      <div class="flex items-start gap-2 text-xs">
                        <span class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-[var(--pop-yellow)] border border-[var(--ink)]">
                          <rule.icon size={10} strokeWidth={2.5} />
                        </span>
                        <div>
                          <span class="font-black text-[var(--ink)]">{rule.title}: </span>
                          <span class="text-[11px] font-semibold text-muted leading-tight">
                            {rule.desc}
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Right Card: Judging Rubric (5 Pillars) */}
            <div
              class="card card-plain bg-surface p-3.5 sm:p-4 space-y-2.5 flex flex-col justify-between"
              style={{ border: "var(--ink-w) solid var(--ink)" }}
            >
              <div class="space-y-2.5">
                <div class="flex items-center gap-1.5 border-b border-[var(--ink)]/10 pb-1.5">
                  <Scale size={16} class="text-[var(--pop-pink-deep)]" />
                  <h4 class="m-0 text-xs sm:text-sm font-black uppercase tracking-wider">
                    Judging Criteria (5 Pillars)
                  </h4>
                </div>

                <div class="space-y-1.5">
                  <For each={POOKALAM.judging}>
                    {(criterion) => (
                      <div class="text-xs">
                        <p class="m-0 font-black text-[var(--ink)] leading-tight">
                          {criterion.name}
                        </p>
                        <p class="m-0 text-[11px] font-semibold text-muted leading-tight">
                          {criterion.body}
                        </p>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- VIEW MODE SELECTOR (ROAD vs NO-FLUFF) ----------------- */}
      <div
        class="card card-plain bg-surface p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{
          border: "var(--ink-w) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <p class="m-0 text-xs font-bold text-muted text-center sm:text-left">
          Select view: beginner guide or fast-track specifications
        </p>

        <div
          class="flex items-center p-1 rounded gap-1 shrink-0"
          style={{
            background: "var(--paper-3)",
            border: "var(--ink-w) solid var(--ink)",
          }}
          role="tablist"
          aria-label="View mode toggle"
        >
          <button
            type="button"
            role="tab"
            aria-selected={props.viewMode === "road"}
            onClick={() => props.onToggleViewMode("road")}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-black transition-colors cursor-pointer"
            style={
              props.viewMode === "road"
                ? {
                    background: "var(--pop-teal)",
                    border: "var(--ink-w) solid var(--ink)",
                    color: "var(--ink)",
                  }
                : {
                    background: "transparent",
                    border: "var(--ink-w) solid transparent",
                    color: "var(--ink-soft)",
                  }
            }
          >
            <Map size={13} strokeWidth={2.5} />
            <span>Beginner Road</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={props.viewMode === "nofluff"}
            onClick={() => props.onToggleViewMode("nofluff")}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-black transition-colors cursor-pointer"
            style={
              props.viewMode === "nofluff"
                ? {
                    background: "var(--pop-yellow)",
                    border: "var(--ink-w) solid var(--ink)",
                    color: "var(--ink)",
                  }
                : {
                    background: "transparent",
                    border: "var(--ink-w) solid transparent",
                    color: "var(--ink-soft)",
                  }
            }
          >
            <Zap size={13} strokeWidth={2.5} />
            <span>No-Fluff Handbook</span>
          </button>
        </div>
      </div>
    </section>
  );
}
