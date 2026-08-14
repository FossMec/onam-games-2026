import { createAsync } from "@solidjs/router";
import { ChevronDown, ChevronUp, Key, ShieldCheck } from "lucide-solid";
import { Show, createSignal } from "solid-js";

import { getMe } from "~/server/auth/actions";
import { SpriteIcon } from "./art/SpriteIcon";

export function MaveliLetter() {
  const me = createAsync(() => getMe());
  const [isExpanded, setIsExpanded] = createSignal(false);

  const recipientName = () => me()?.name || "Prajakale & Fellow Hacker";
  const recipientCollege = () => me()?.college || "Govt. Model Engineering College";

  return (
    <div class="w-full max-w-4xl mx-auto">
      {/* Postcard Container with Folded Corner Effect & Inset Badges */}

      <div
        class="relative w-full rounded-2xl p-4 sm:p-6 bg-[#fffdf5] text-[var(--ink)] transition-all"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
        }}
      >
        {/* Top Header Bar: Postal Header + Inset Stamp + Postmark SVG */}
        <div class="flex items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-dashed border-[var(--ink)]/25 flex-wrap">
          {/* From / To Metadata */}
          <div class="text-[11px] sm:text-xs font-mono min-w-0 max-w-full">
            <p class="truncate text-[var(--ink-soft)]">
              <span class="font-black text-[var(--ink)]">FROM:</span> mahali@pathalam-01 (Arch)
            </p>
            <p class="truncate text-[var(--ink)] font-bold">
              <span class="font-black">TO:</span>{" "}
              <span class="text-[var(--pop-teal-deep)] font-extrabold">{recipientName()}</span>{" "}
              <span class="text-[var(--ink-soft)] text-[10px]">({recipientCollege()})</span>
            </p>
          </div>

          {/* Postal Badges & Stamps (Properly Inset Inside Card) */}
          <div class="flex items-center gap-2 shrink-0">
            {/* SVG Postmark Stamp */}
            <svg
              class="h-6 sm:h-7 w-auto opacity-70 text-[var(--ink)] hidden xs:block"
              viewBox="0 0 115 32"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <circle cx="16" cy="16" r="13" stroke-dasharray="2 2" />
              <text
                x="16"
                y="14"
                text-anchor="middle"
                font-size="5.5"
                font-weight="bold"
                fill="currentColor"
              >
                THRIKKAKARA
              </text>
              <text
                x="16"
                y="21"
                text-anchor="middle"
                font-size="4.5"
                font-weight="bold"
                fill="currentColor"
              >
                POST · 2026
              </text>
              <path d="M 35 10 Q 50 6, 65 10 T 90 10 T 112 10" />
              <path d="M 35 16 Q 50 12, 65 16 T 90 16 T 112 16" />
              <path d="M 35 22 Q 50 18, 65 22 T 90 22 T 112 22" />
            </svg>

            {/* Inset Royal Stamp */}
            <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)]">
              <SpriteIcon name="tux-king" size={16} class="shrink-0" />
              <span>Royal Dispatch</span>
            </span>
          </div>
        </div>

        {/* Postcard Body: Compact Side Image + Letter Text */}
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 w-full min-w-0">
          {/* Small Compact Artwork Card */}
          <div class="w-28 xs:w-32 sm:w-36 md:w-40 shrink-0 flex flex-col items-center gap-1.5 self-center sm:self-start">
            <div
              class="relative rounded-lg overflow-hidden aspect-square w-full bg-[var(--paper-3)]"
              style={{
                border: "var(--ink-w) solid var(--ink)",
              }}
            >
              <img
                src="/images/maveli-typing.jpeg"
                alt="King Mahabali typing on laptop"
                class="w-full h-full object-cover aspect-square"
                loading="lazy"
              />
              <div class="absolute bottom-1 right-1 bg-[var(--paper)]/95 px-1 py-0.2 rounded text-[8px] font-mono font-black border border-[var(--ink)]">
                uptime: 1226y
              </div>
            </div>
            <span class="comment text-xs font-bold text-center leading-tight mt-1 text-[var(--ink)] block">
              Maveli compiling Linux with banana fibers in Patala.
            </span>
          </div>

          {/* Letter Prose (Small, Crisp Kalam Handwriting) */}
          <div class="flex-1 w-full min-w-0 space-y-2 text-[13px] sm:text-[14px] leading-snug text-[var(--ink)]">
            <div class="flex items-baseline justify-between gap-2">
              <h4
                class="text-base sm:text-lg font-black tracking-tight text-[var(--ink)]"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Why Onam is Secretly an Open-Source Celebration
              </h4>
              <span class="text-[10px] font-mono text-[var(--ink-soft)] hidden md:inline">
                kernel-v6.12-patala
              </span>
            </div>

            <div
              style={{
                "font-family": "var(--font-stack-letter)",
                "line-height": "1.45",
              }}
              class="space-y-2 font-medium"
            >
              <p class="font-bold text-sm sm:text-base text-[var(--ink)]">
                Dear {recipientName()},
              </p>

              {/* Initial Teaser Paragraph (Always visible) */}
              <p>
                Legend says Vamana asked for three steps of land, but the real story is that he
                showed me how cool{" "}
                <strong class="font-bold underline decoration-[var(--pop-teal)] decoration-2">
                  Vim
                </strong>{" "}
                is. While I was busy{" "}
                <code class="px-1 py-0.2 rounded bg-[var(--paper-3)] border border-[var(--ink)] font-mono text-[11px] font-bold">
                  hjkl
                </code>
                'ing, he trapped me inside without showing me how to quit, and banished my root
                access to Patala.
              </p>

              {/* Collapsible Content on Mobile (Always open on sm: desktop) */}
              <div class={`${isExpanded() ? "block" : "hidden sm:block"} space-y-2`}>
                <p>
                  Every Thiruvonam I run a quick{" "}
                  <code class="px-1 py-0.2 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] font-mono text-[11px] font-black">
                    :wq!
                  </code>{" "}
                  escape to visit <strong>Thrikkakara</strong> next to{" "}
                  <strong>Govt. Model Engineering College</strong>. I expected to find you MECians
                  relaxing over Payasam, but instead I see{" "}
                  <strong class="font-bold">FOSS MEC</strong> running a 7-day arcade and{" "}
                  <strong class="font-bold">Code-a-Pookalam</strong>! Why bend your back picking
                  flowers when you can calculate 400 lines of SVG math on Canvas?
                </p>

                <p>
                  Onam is pure open-source: nobody patents the Avial recipe, Payasam is forkable
                  with extra cashews, and Sambhar has unlimited free redistribution. Meanwhile,
                  corporate suits at Anthropic claim open models are <em>"too dangerous"</em> for
                  normal developers — classic proprietary gatekeeping.
                </p>

                <p class="font-bold text-[var(--ink)]">
                  Eat Sadya until your memory leaks, submit your pookalam before the deadline, and
                  keep software free!
                </p>

                {/* Compact Signature Line */}
                <div class="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-dashed border-[var(--ink)]/25">
                  <div>
                    <p class="text-[10px] font-mono text-[var(--ink-soft)]">
                      Yours from the terminal,
                    </p>
                    <p
                      class="text-sm sm:text-base font-black"
                      style={{ "font-family": "var(--font-stack-display)" }}
                    >
                      Mahabali (Maveli) ·{" "}
                      <span class="text-xs font-semibold text-[var(--pop-teal-deep)]">
                        Chief Patala Sysadmin
                      </span>
                    </p>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <SpriteIcon name="maveli-laptop" size={26} animate="wobble" interactive />
                    <SpriteIcon name="nilavilakku" size={24} animate="float" interactive />
                  </div>
                </div>

                {/* Cryptographic GPG Signed Box */}
                <div class="mt-2.5 p-2.5 rounded-lg bg-[var(--paper-3)] border border-[var(--ink)] text-[11px] font-mono space-y-1">
                  <div class="flex items-center justify-between flex-wrap gap-1 text-[10px] pb-1 border-b border-[var(--ink-soft)]/20">
                    <span class="inline-flex items-center gap-1 font-bold text-emerald-800">
                      <ShieldCheck size={13} class="text-emerald-700 shrink-0" />
                      <span>GPG SIGNED PROCLAMATION</span>
                    </span>
                    <span class="text-[var(--ink-soft)]">KEY-ID: 0xMAVELI_ONAM_2026</span>
                  </div>

                  <p class="leading-relaxed text-[11px]">
                    <strong>PS:</strong> If you know how to exit Vim:{" "}
                    <code class="px-1.5 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)] font-bold text-[10.5px] select-all">
                      ssh pathalam@mahali.local -p 22
                    </code>
                  </p>

                  <p class="text-[9.5px] text-[var(--ink-soft)] font-mono flex items-center gap-1 pt-0.5">
                    <Key size={10} class="shrink-0 opacity-60" />
                    <span class="truncate">
                      Fingerprint: 800A D122 6YON AMF0 SSME C202 6PAT ALAM
                    </span>
                  </p>
                </div>
              </div>

              {/* Mobile Read More / Collapse Toggle Button */}
              <div class="sm:hidden pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  class="btn-brand py-1 px-3 text-[11px] font-extrabold rounded-full inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{isExpanded() ? "Fold Letter ↑" : "Read Full Letter from Maveli ↓"}</span>
                  <Show when={isExpanded()} fallback={<ChevronDown size={13} strokeWidth={2.5} />}>
                    <ChevronUp size={13} strokeWidth={2.5} />
                  </Show>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
