import { A } from "@solidjs/router";
import {
  Calendar,
  Check,
  Clock,
  FileText,
  GitBranch,
  Send,
  ShieldCheck,
  Trophy,
} from "lucide-solid";
import { For } from "solid-js";
import { Halftone } from "~/components/art/Burst";

export function PookalamNoFluff(props: { hasEntry?: boolean }) {
  const checklist = [
    {
      title: "1:1 Square Aspect Ratio",
      desc: "Uploaded image must be exactly square (e.g. 1024×1024).",
    },
    {
      title: "100% Anonymous Render",
      desc: "Zero names, handles, signatures, or watermarks on the image for blind voting.",
    },
    {
      title: "Public Repository with LICENSE",
      desc: "Open-source license (MIT, Apache 2.0, GPLv3, BSD) so the jury can verify and run your code.",
    },
    {
      title: "README with Run Instructions",
      desc: "Short instructions in README on how to execute your script or build the project.",
    },
  ];

  return (
    <div class="space-y-4">
      {/* ----------------- HEADER & QUICK SUBMIT ----------------- */}
      <section
        class="card pop-teal relative overflow-hidden p-4 sm:p-5 space-y-3"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        <Halftone opacity={0.06} />

        <div class="art-over flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="space-y-0.5">
            <span class="sticker text-[10px]" style={{ "--pop": "var(--pop-yellow)" }}>
              No-Fluff Handbook
            </span>
            <h2 class="font-display text-lg sm:text-xl font-black m-0">
              Participant Specifications & Submission Sheet
            </h2>
            <p class="m-0 text-xs font-semibold text-muted">
              Technical rules, repository checklist, and submission guidelines.
            </p>
          </div>

          <A
            href="/code-a-pookalam/submit"
            class="btn-brand inline-flex items-center gap-2 text-xs sm:text-sm font-black shrink-0"
          >
            <Send size={15} />
            <span>{props.hasEntry ? "Edit Your Entry" : "Go to Submit Form"}</span>
          </A>
        </div>
      </section>

      {/* ----------------- 1. SUBMISSION SPECIFICATIONS & PRE-FLIGHT ----------------- */}
      <section
        class="card card-plain bg-surface p-4 sm:p-5 space-y-3"
        style={{
          border: "var(--ink-w) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <div class="flex items-center gap-2">
          <ShieldCheck size={18} class="text-[var(--pop-teal-deep)]" />
          <h3 class="font-display text-base sm:text-lg font-black m-0">
            1. Technical Specifications & Pre-Flight Checklist
          </h3>
        </div>

        <ul class="m-0 list-none space-y-2 p-0">
          <For each={checklist}>
            {(item) => (
              <li class="flex items-start gap-2.5 text-xs sm:text-sm font-semibold">
                <span
                  class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded"
                  style={{
                    background: "var(--pop-teal)",
                    border: "1.5px solid var(--ink)",
                  }}
                >
                  <Check size={11} strokeWidth={3.5} />
                </span>
                <div>
                  <span class="font-black text-[var(--ink)]">{item.title}: </span>
                  <span class="text-muted">{item.desc}</span>
                </div>
              </li>
            )}
          </For>
        </ul>
      </section>

      {/* ----------------- 2. REPOSITORY & SUBMISSION SETUP ----------------- */}
      <section
        class="card card-plain bg-surface p-4 sm:p-5 space-y-3"
        style={{
          border: "var(--ink-w) solid var(--ink)",
          background: "var(--paper-2)",
        }}
      >
        <div class="flex items-center gap-2">
          <GitBranch size={18} class="text-[var(--pop-pink)]" />
          <h3 class="font-display text-base sm:text-lg font-black m-0">
            2. Repository Setup & Universal Guidelines
          </h3>
        </div>

        <div class="space-y-3">
          <div class="space-y-1">
            <p class="m-0 text-xs sm:text-sm font-bold text-[var(--ink)]">
              Any language or framework is accepted (HTML5 Canvas, Python, SVG, GLSL Shaders, Rust,
              C++, Processing, etc.).
            </p>
            <p class="m-0 text-xs font-semibold text-muted leading-relaxed">
              Your repository must be public and contain:
            </p>
          </div>

          <div class="grid gap-2 sm:grid-cols-3">
            <div
              class="card card-plain p-2.5 space-y-1"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--paper-3)",
              }}
            >
              <div class="flex items-center gap-1.5">
                <FileText size={14} class="text-[var(--ink)]" />
                <p class="m-0 text-xs font-black">LICENSE</p>
              </div>
              <p class="m-0 text-[11px] font-semibold text-muted">
                Open-source license (MIT, Apache 2.0, GPL, or BSD).
              </p>
            </div>

            <div
              class="card card-plain p-2.5 space-y-1"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--paper-3)",
              }}
            >
              <div class="flex items-center gap-1.5">
                <FileText size={14} class="text-[var(--ink)]" />
                <p class="m-0 text-xs font-black">README.md</p>
              </div>
              <p class="m-0 text-[11px] font-semibold text-muted">
                Instructions on dependencies and how to run your code.
              </p>
            </div>

            <div
              class="card card-plain p-2.5 space-y-1"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--paper-3)",
              }}
            >
              <div class="flex items-center gap-1.5">
                <FileText size={14} class="text-[var(--ink)]" />
                <p class="m-0 text-xs font-black">Executable Source</p>
              </div>
              <p class="m-0 text-[11px] font-semibold text-muted">
                Clean source files that generate the 1:1 render output.
              </p>
            </div>
          </div>

          <div class="space-y-1.5 pt-1">
            <p class="m-0 text-xs font-black uppercase tracking-wider text-muted">
              Quick Git Push Commands
            </p>
            <pre class="inked overflow-x-auto rounded bg-[#181511] p-3 font-mono text-xs leading-relaxed text-[#fbf3e4] m-0">
              <code>{`git init
git add .
git commit -m "Initial pookalam release"
git remote add origin https://github.com/YOUR_USERNAME/pookalam.git
git branch -M main
git push -u origin main`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ----------------- 3. HOW TO SUBMIT & WHAT TO EXPECT ----------------- */}
      <section
        class="card pop-pink relative overflow-hidden p-4 sm:p-5 space-y-4"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        <Halftone opacity={0.06} />

        <div class="art-over space-y-4">
          <div class="flex items-center gap-2">
            <Send size={20} />
            <h3 class="font-display text-base sm:text-lg font-black m-0">
              3. Submission Form Details & What to Expect
            </h3>
          </div>

          {/* Details Needed in the Submission Form */}
          <div class="space-y-2">
            <p class="m-0 text-xs font-black uppercase tracking-wider text-muted">
              What details you need on the submission form:
            </p>
            <div class="grid gap-2.5 sm:grid-cols-2">
              <div
                class="card card-plain bg-surface p-3 space-y-1"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <p class="m-0 text-xs font-black">1. Public Repository URL</p>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  Link to your GitHub / GitLab / Codeberg repository containing source code, README,
                  and open-source LICENSE.
                </p>
              </div>

              <div
                class="card card-plain bg-surface p-3 space-y-1"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <p class="m-0 text-xs font-black">2. Square 1:1 Render File</p>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  PNG or WebP image (min 800×800, recommended 1024×1024). Must be 100% anonymous
                  with zero names or watermarks.
                </p>
              </div>

              <div
                class="card card-plain bg-surface p-3 space-y-1"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <p class="m-0 text-xs font-black">3. Title & Creator's Note</p>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  A name for your pookalam and a short explanation of the math, procedural logic, or
                  cultural design concept.
                </p>
              </div>

              <div
                class="card card-plain bg-surface p-3 space-y-1"
                style={{ border: "var(--ink-w) solid var(--ink)" }}
              >
                <p class="m-0 text-xs font-black">4. Live Web Preview (Optional)</p>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  If your submission runs in the browser (GitHub Pages, CodePen, etc.), provide a
                  direct link for instant viewing.
                </p>
              </div>
            </div>
          </div>

          {/* Results Timeline & Next Steps */}
          <div class="space-y-2 pt-1 border-t border-[var(--ink)]/10">
            <p class="m-0 text-xs font-black uppercase tracking-wider text-muted">
              Results & Review Timeline:
            </p>
            <div class="grid gap-2 sm:grid-cols-3">
              <div
                class="card card-plain p-2.5 space-y-1"
                style={{
                  border: "var(--ink-w) solid var(--ink)",
                  background: "var(--paper-3)",
                }}
              >
                <div class="flex items-center gap-1.5 font-bold text-xs">
                  <Clock size={14} class="text-[var(--pop-yellow-deep)]" />
                  <span>Until Day 6 Midnight</span>
                </div>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  Submissions and repo edits stay open. You can push commits or update your entry
                  anytime.
                </p>
              </div>

              <div
                class="card card-plain p-2.5 space-y-1"
                style={{
                  border: "var(--ink-w) solid var(--ink)",
                  background: "var(--paper-3)",
                }}
              >
                <div class="flex items-center gap-1.5 font-bold text-xs">
                  <Calendar size={14} class="text-[var(--pop-teal-deep)]" />
                  <span>Day 6 Midnight</span>
                </div>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  Submissions freeze. The jury reviews code reproducibility and shortlists eligible
                  entries.
                </p>
              </div>

              <div
                class="card card-plain p-2.5 space-y-1"
                style={{
                  border: "var(--ink-w) solid var(--ink)",
                  background: "var(--paper-3)",
                }}
              >
                <div class="flex items-center gap-1.5 font-bold text-xs">
                  <Trophy size={14} class="text-[var(--pop-pink-deep)]" />
                  <span>Day 7 Arena & Winners</span>
                </div>
                <p class="m-0 text-[11px] font-semibold text-muted">
                  Blind 1v1 community matchmaking vote. Final ELO scores determine the ₹1,500 /
                  ₹1,000 / ₹500 winners!
                </p>
              </div>
            </div>
          </div>

          {/* Action CTA Bar */}
          <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--ink)]/10">
            <p class="m-0 text-xs font-bold text-muted">
              Ready to submit? Head over to the submission portal before the midnight cutoff.
            </p>
            <A
              href="/code-a-pookalam/submit"
              class="btn-brand inline-flex items-center gap-2 text-xs sm:text-sm font-black shrink-0"
            >
              <Send size={15} />
              <span>{props.hasEntry ? "Edit Your Entry →" : "Submit Your Pookalam →"}</span>
            </A>
          </div>
        </div>
      </section>
    </div>
  );
}
