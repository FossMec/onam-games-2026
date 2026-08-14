import { createAsync } from "@solidjs/router";
import { Check, Copy, Sparkles, Terminal } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { getMe } from "~/server/auth/actions";
import { SpriteIcon } from "./art/SpriteIcon";

export function MaveliLetter() {
  const me = createAsync(() => getMe());
  const [copied, setCopied] = createSignal(false);
  const [showToast, setShowToast] = createSignal(false);

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
    <div class="relative max-w-4xl mx-auto my-8">
      {/* Postal Wax Seal / Stamp in corner */}
      <div
        class="absolute -top-4 -right-2 sm:-top-5 sm:right-6 z-20 rotate-12 flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--pop-yellow)] shadow-md border-2 border-[var(--ink)] select-none animate-bounce"
        style={{ "animation-duration": "3s" }}
      >
        <SpriteIcon name="tux-king" size={22} />
        <span
          class="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--ink)]"
          style={{ "font-family": "var(--font-stack-display)" }}
        >
          Royal Patala Post
        </span>
      </div>

      {/* Main Parchment / Letter Envelope Card */}
      <div
        class="relative overflow-hidden rounded-xl p-5 sm:p-8 bg-[#fffbf0] text-[var(--ink)] shadow-xl transition-all"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          "box-shadow": "6px 6px 0 var(--ink)",
        }}
      >
        {/* Subtle vintage parchment line header */}
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b-2 border-dashed border-[var(--ink)]/30 text-xs font-mono">
          <div class="space-y-0.5 min-w-0">
            <p class="flex items-center gap-1.5 font-bold text-[var(--ink-soft)]">
              <span class="font-extrabold text-[var(--ink)]">FROM:</span>
              <span class="truncate">mahali@pathalam-core-node-01 (Btw I use Arch)</span>
            </p>
            <p class="flex items-center gap-1.5 font-bold text-[var(--ink)]">
              <span class="font-extrabold">TO:</span>
              <span class="truncate text-[var(--pop-teal-deep)] font-black">
                {recipientName()} &lt;{recipientCollege()}&gt;
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
            <span class="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded bg-[var(--pop-teal)]/30 border border-[var(--ink)]">
              <Sparkles size={12} class="text-[var(--ink)]" />
              <span>Thrikkakara Dispatch</span>
            </span>
          </div>
        </div>

        {/* Letter Layout: Side Illustration + Letter Body */}
        <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* King Mahabali Typing Image */}
          <div class="w-full sm:w-64 md:w-56 shrink-0 flex flex-col items-center gap-2">
            <div
              class="relative rounded-lg overflow-hidden aspect-square w-48 sm:w-full bg-[var(--paper-3)]"
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
              <div class="absolute bottom-1.5 right-1.5 bg-[var(--paper)]/90 px-1.5 py-0.5 rounded text-[9px] font-mono font-black border border-[var(--ink)]">
                uptime: 1226y
              </div>
            </div>
            <p class="comment text-xs text-center">
              Maveli compiling custom kernel on coconut fiber.
            </p>
          </div>

          {/* Letter Prose */}
          <div class="flex-1 space-y-3.5 text-sm sm:text-[15px] font-semibold leading-relaxed">
            <h4
              class="text-lg sm:text-xl font-black tracking-tight text-[var(--ink)]"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Why Onam is Secretly an Open-Source Celebration
            </h4>

            <p>
              <span class="font-extrabold text-base text-[var(--ink)]">
                Dear {recipientName()},
              </span>
            </p>

            <p>
              Legend says Vamana asked for three steps of land, but the real story is that he showed
              me how cool{" "}
              <strong class="font-black underline decoration-[var(--pop-teal)]">Vim</strong> is on
              my machine. While I was busy{" "}
              <code class="px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--ink)] font-mono text-xs font-bold">
                hjkl
              </code>
              'ing, he trapped me inside without showing me how to quit, and revoked my root access
              to Patala. Once a year on Thiruvonam, I manage a brief{" "}
              <code class="px-1.5 py-0.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] font-mono text-xs font-black">
                :wq!
              </code>{" "}
              escape to visit Kerala, and the first place I check is <strong>Thrikkakara</strong>{" "}
              right next to <strong>Govt. Model Engineering College</strong>.
            </p>

            <p>
              I thought I'd find you MECians relaxing over Payasam in the canteen, but instead I see{" "}
              <strong class="font-black">FOSS MEC</strong> hacking together a 7-day arcade and
              hosting <strong class="font-black">Code-a-Pookalam</strong>! Honestly, why bend your
              back picking real flowers when you can calculate 400 lines of cursed SVG math on an
              HTML canvas? That is pure royal energy.
            </p>

            <p>
              Look, Onam has always been open-source: nobody patents the Avial recipe, you can fork
              the Payasam with extra cashews, and Sambhar comes with unlimited free redistribution.
              Meanwhile, proprietary vendors treat software like a locked black box where you don't
              even own what you consume — and now corporate suits at places like Anthropic claim
              open models are <em>"too dangerous"</em> for normal usage and only they should control
              the models.
            </p>

            <p class="font-extrabold text-[var(--ink)]">
              Eat Sadya until your memory leaks, push your pookalam code before the deadline, and
              keep your software free!
            </p>

            {/* Signature Block */}
            <div class="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-dashed border-[var(--ink)]/30">
              <div>
                <p class="text-xs font-mono font-bold" style={{ color: "var(--ink-soft)" }}>
                  Yours from the terminal,
                </p>
                <p
                  class="text-base sm:text-lg font-black"
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

            {/* PS Interactive Section */}
            <div class="mt-3 p-2.5 rounded-lg bg-[var(--paper-3)] border border-[var(--ink)] text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <Terminal size={14} class="shrink-0 text-[var(--ink)]" />
                <span class="truncate">
                  <strong class="font-black">PS:</strong> If anyone knows how to exit Vim, please
                  ssh in:
                </span>
              </div>

              <button
                type="button"
                onClick={copySSH}
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--pop-yellow)] hover:bg-[var(--pop-teal)] font-mono font-black text-xs border border-[var(--ink)] cursor-pointer transition-all active:translate-y-0.5 shrink-0"
                title="Copy SSH command"
              >
                <Show when={copied()} fallback={<Copy size={12} strokeWidth={2.5} />}>
                  <Check size={12} strokeWidth={2.5} class="text-emerald-700" />
                </Show>
                <span>{copied() ? "Copied!" : "ssh pathalam@mahali.local -p 22"}</span>
              </button>
            </div>

            <Show when={showToast()}>
              <div class="text-[11px] font-mono text-emerald-800 font-bold animate-pulse text-center sm:text-left">
                ⚡ Connection attempt recorded. Maveli is still typing :help in Patala.
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
