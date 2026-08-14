import { createAsync } from "@solidjs/router";
import { Check, ChevronDown, ChevronUp, Copy, Sparkles, Terminal } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { getMe } from "~/server/auth/actions";
import { SpriteIcon } from "./art/SpriteIcon";

export function MaveliLetter() {
  const me = createAsync(() => getMe());
  const [copied, setCopied] = createSignal(false);
  const [showToast, setShowToast] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);

  const copySSH = async () => {
    try {
      await navigator.clipboard.writeText("ssh pathalam@mahali.local -p 22");
      setCopied(true);
      setShowToast(true);
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setShowToast(false), 4000);
    } catch {
      // Fallback
    }
  };

  const recipientName = () => me()?.name || "Prajakale & Fellow Hacker";
  const recipientCollege = () => me()?.college || "Govt. Model Engineering College";

  return (
    <section class="relative w-full max-w-4xl mx-auto my-10 px-2 sm:px-4 overflow-hidden">
      {/* Postal Wax Seal / Stamp in corner */}
      <div
        class="absolute -top-2 right-4 sm:-top-4 sm:right-8 z-20 rotate-6 flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--pop-yellow)] shadow-md border-2 border-[var(--ink)] select-none animate-bounce"
        style={{ "animation-duration": "3.5s" }}
      >
        <SpriteIcon name="tux-king" size={22} class="shrink-0" />
        <span
          class="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--ink)]"
          style={{ "font-family": "var(--font-stack-display)" }}
        >
          Royal Patala Post
        </span>
      </div>

      {/* Main Parchment Letter Envelope Card with Perforated / Wavy Accents */}
      <div
        class="relative w-full rounded-2xl p-4 sm:p-7 md:p-9 bg-[#fffbf2] text-[var(--ink)] shadow-2xl transition-all"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          "box-shadow": "5px 5px 0 var(--ink)",
        }}
      >
        {/* Top Postal Cancellation SVG & Dispatch Details */}
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 mb-4 border-b-2 border-dashed border-[var(--ink)]/30 text-xs font-mono w-full">
          <div class="space-y-0.5 min-w-0 max-w-full">
            <p class="flex items-center gap-1 font-bold text-[var(--ink-soft)] truncate">
              <span class="font-extrabold text-[var(--ink)]">FROM:</span>
              <span class="truncate">mahali@pathalam-core-node-01 (Btw I use Arch)</span>
            </p>
            <p class="flex items-center gap-1 font-bold text-[var(--ink)] truncate">
              <span class="font-extrabold">TO:</span>
              <span class="truncate text-[var(--pop-teal-deep)] font-black">
                {recipientName()} &lt;{recipientCollege()}&gt;
              </span>
            </p>
          </div>

          {/* Postal Stamp SVG Graphic */}
          <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
            <svg
              class="h-8 w-auto opacity-75 text-[var(--ink)] hidden xs:block"
              viewBox="0 0 130 36"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              {/* Postmark Circle */}
              <circle cx="18" cy="18" r="15" stroke-dasharray="2 2" />
              <text
                x="18"
                y="15"
                text-anchor="middle"
                font-size="6"
                font-weight="bold"
                fill="currentColor"
              >
                THRIKKAKARA
              </text>
              <text
                x="18"
                y="23"
                text-anchor="middle"
                font-size="5"
                font-weight="bold"
                fill="currentColor"
              >
                2026 POST
              </text>
              {/* Wavy cancellation ink lines */}
              <path d="M 40 10 Q 55 5, 70 10 T 100 10 T 128 10" />
              <path d="M 40 18 Q 55 13, 70 18 T 100 18 T 128 18" />
              <path d="M 40 26 Q 55 21, 70 26 T 100 26 T 128 26" />
            </svg>

            <span class="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded bg-[var(--pop-teal)]/30 border border-[var(--ink)]">
              <Sparkles size={12} class="text-[var(--ink)]" />
              <span>Royal Memo</span>
            </span>
          </div>
        </div>

        {/* Letter Layout: Side Illustration + Handwritten Letter Body */}
        <div class="flex flex-col md:flex-row items-center md:items-start gap-5 sm:gap-7 w-full min-w-0">
          {/* King Mahabali Typing Photo Card */}
          <div class="w-full xs:w-56 sm:w-60 md:w-52 shrink-0 flex flex-col items-center gap-2">
            <div
              class="relative rounded-xl overflow-hidden aspect-square w-40 xs:w-full bg-[var(--paper-3)]"
              style={{
                border: "var(--ink-w-bold) solid var(--ink)",
                "box-shadow": "3px 3px 0 var(--ink)",
              }}
            >
              <img
                src="/images/maveli-typing.jpeg"
                alt="King Mahabali typing on laptop"
                class="w-full h-full object-cover aspect-square hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div class="absolute bottom-1.5 right-1.5 bg-[var(--paper)]/95 px-1.5 py-0.5 rounded text-[9px] font-mono font-black border border-[var(--ink)]">
                uptime: 1226y
              </div>
            </div>
            <p class="comment text-xs text-center">
              Maveli compiling custom kernel on coconut fiber.
            </p>
          </div>

          {/* Letter Prose (Written in Kalam handwriting font) */}
          <div class="flex-1 w-full min-w-0 space-y-3 font-medium text-base sm:text-lg leading-relaxed text-[var(--ink)]">
            <h4
              class="text-xl sm:text-2xl font-black tracking-tight text-[var(--ink)] pb-1"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Why Onam is Secretly an Open-Source Celebration
            </h4>

            <div
              style={{
                "font-family": "var(--font-stack-letter)",
                "letter-spacing": "0.01em",
              }}
              class="space-y-3"
            >
              <p class="text-lg sm:text-xl font-bold text-[var(--ink)]">Dear {recipientName()},</p>

              {/* Initial Teaser Lines (Always visible on mobile & desktop) */}
              <p>
                Legend says Vamana asked for three steps of land, but the real story is that he
                showed me how cool{" "}
                <strong class="font-extrabold underline decoration-[var(--pop-teal)] decoration-2">
                  Vim
                </strong>{" "}
                is on my machine. While I was busy{" "}
                <code class="px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--ink)] font-mono text-xs font-bold">
                  hjkl
                </code>
                'ing, he trapped me inside without showing me how to quit, and revoked my root
                access to Patala.
              </p>

              {/* Collapsible Content on Mobile (Default open on desktop `sm:`) */}
              <div class={`${isExpanded() ? "block" : "hidden sm:block"} space-y-3 transition-all`}>
                <p>
                  Once a year on Thiruvonam, I manage a brief{" "}
                  <code class="px-1.5 py-0.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] font-mono text-xs font-black">
                    :wq!
                  </code>{" "}
                  escape to visit Kerala, and the first place I check is{" "}
                  <strong>Thrikkakara</strong> right next to{" "}
                  <strong>Govt. Model Engineering College</strong>.
                </p>

                <p>
                  I thought I'd find you MECians relaxing over Payasam in the canteen, but instead I
                  see <strong class="font-bold text-[var(--ink)]">FOSS MEC</strong> hacking together
                  a 7-day arcade and hosting{" "}
                  <strong class="font-bold text-[var(--ink)]">Code-a-Pookalam</strong>! Honestly,
                  why bend your back picking real flowers when you can calculate 400 lines of cursed
                  SVG math on an HTML canvas? That is pure royal energy.
                </p>

                <p>
                  Look, Onam has always been open-source: nobody patents the Avial recipe, you can
                  fork the Payasam with extra cashews, and Sambhar comes with unlimited free
                  redistribution. Meanwhile, proprietary vendors treat software like a locked black
                  box where you don't even own what you consume — and now corporate suits at places
                  like Anthropic claim open models are <em>"too dangerous"</em> for normal usage and
                  only they should control the models.
                </p>

                <p class="font-bold text-[var(--ink)]">
                  Eat Sadya until your memory leaks, push your pookalam code before the deadline,
                  and keep your software free!
                </p>

                {/* Signature Block */}
                <div class="pt-3 flex items-center justify-between flex-wrap gap-2 border-t border-dashed border-[var(--ink)]/30">
                  <div>
                    <p class="text-xs font-mono font-bold" style={{ color: "var(--ink-soft)" }}>
                      Yours from the terminal,
                    </p>
                    <p
                      class="text-lg sm:text-xl font-black"
                      style={{ "font-family": "var(--font-stack-display)" }}
                    >
                      Mahabali (Maveli)
                    </p>
                    <p class="text-xs font-semibold text-[var(--pop-teal-deep)]">
                      Chief Patala Sysadmin
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <SpriteIcon name="maveli-laptop" size={32} animate="wobble" interactive />
                    <SpriteIcon name="nilavilakku" size={30} animate="float" interactive />
                  </div>
                </div>

                {/* PS Interactive Section with responsive text and copy action */}
                <div class="mt-3 p-2.5 rounded-lg bg-[var(--paper-3)] border border-[var(--ink)] text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 max-w-full">
                  <div class="flex items-center gap-1.5 min-w-0 max-w-full flex-wrap">
                    <Terminal size={14} class="shrink-0 text-[var(--ink)]" />
                    <span class="break-words">
                      <strong class="font-black">PS:</strong> If anyone knows how to exit Vim:
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={copySSH}
                    class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-[var(--pop-yellow)] hover:bg-[var(--pop-teal)] font-mono font-black text-xs border border-[var(--ink)] cursor-pointer transition-all active:translate-y-0.5 shrink-0"
                    title="Copy SSH command"
                  >
                    <Show when={copied()} fallback={<Copy size={12} strokeWidth={2.5} />}>
                      <Check size={12} strokeWidth={2.5} class="text-emerald-700" />
                    </Show>
                    <span class="break-all">
                      {copied() ? "Copied!" : "ssh pathalam@mahali.local -p 22"}
                    </span>
                  </button>
                </div>

                <Show when={showToast()}>
                  <div class="text-[11px] font-mono text-emerald-800 font-bold animate-pulse text-center sm:text-left">
                    ⚡ Connection attempt recorded. Maveli is still typing :help in Patala.
                  </div>
                </Show>
              </div>

              {/* Mobile Read More / Collapse Toggle Button */}
              <div class="sm:hidden pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  class="btn-brand py-1.5 px-4 text-xs font-extrabold rounded-full inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>{isExpanded() ? "Fold Royal Letter" : "Read Full Letter from Maveli"}</span>
                  <Show when={isExpanded()} fallback={<ChevronDown size={14} strokeWidth={2.5} />}>
                    <ChevronUp size={14} strokeWidth={2.5} />
                  </Show>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
