import { ExternalLink, MessageCircle, Send } from "lucide-solid";
import { createAsync } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { shell } from "~/lib/queries";

export interface CommunityGroupCardProps {
  compact?: boolean;
  class?: string;
}

const DEFAULT_TELEGRAM_LINK = "https://t.me/joinchat/wHtSpuMBQxODhl";

export function CommunityGroupCard(props: CommunityGroupCardProps) {
  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me;
  const links = () => shellData()?.communityLinks;

  // Only MEC students get community group links based on their passout/batch year
  const isMec = () => me()?.college === "mec";
  const batch = () => me()?.batch;

  const whatsappUrl = createMemo(() => {
    if (!isMec()) return "";
    const b = batch();
    const l = links();
    if (!l) return "";
    if (b === "27" && l.mec2027?.trim()) return l.mec2027.trim();
    if (b === "28" && l.mec2028?.trim()) return l.mec2028.trim();
    if (b === "29" && l.mec2029?.trim()) return l.mec2029.trim();
    if (b === "30" && l.mec2030?.trim()) return l.mec2030.trim();
    return "";
  });

  const batchName = createMemo(() => {
    const b = batch();
    if (b === "27") return "Batch '27 (4th Year)";
    if (b === "28") return "Batch '28 (3rd Year)";
    if (b === "29") return "Batch '29 (2nd Year)";
    if (b === "30") return "Batch '30 (1st Year)";
    return "MEC Community";
  });

  const batchTag = createMemo(() => {
    const b = batch();
    if (b === "27") return "Batch '27";
    if (b === "28") return "Batch '28";
    if (b === "29") return "Batch '29";
    if (b === "30") return "Batch '30";
    return "MEC";
  });

  return (
    <Show when={Boolean(whatsappUrl())}>
      <Show
        when={!props.compact}
        fallback={
          /* Compact modal card for treasure clue popup */
          <div
            class={`relative overflow-hidden rounded-xl p-3 bg-[var(--paper)] border-2 border-[var(--ink)] text-left ${
              props.class ?? ""
            }`}
          >
            <Halftone opacity={0.08} />
            <div class="relative z-10 flex items-center justify-between gap-2.5 flex-wrap">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-[var(--pop-yellow)] border-2 border-[var(--ink)] grid place-items-center shrink-0">
                  <SpriteIcon name="foss-mec-badge" size={20} />
                </div>
                <div class="min-w-0">
                  <p
                    class="text-xs font-black text-[var(--ink)] m-0 leading-tight truncate"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    FOSS MEC {batchTag()} Community
                  </p>
                  <p class="text-[10px] font-semibold text-[var(--ink-soft)] m-0 truncate">
                    Join {batchName()} WhatsApp group for clues & banter
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="px-2.5 py-1 rounded-md bg-[#25D366] text-white border-2 border-[var(--ink)] text-[11px] font-black inline-flex items-center gap-1 hover:brightness-105 transition-all"
                  title="Join Batch WhatsApp Group"
                >
                  <MessageCircle size={12} strokeWidth={2.5} />
                  <span>Join {batchTag()} Group</span>
                </a>
              </div>
            </div>
          </div>
        }
      >
        {/* Full Memphis × Comic Print Banner Card */}
        <div
          class={`relative overflow-hidden rounded-xl p-4 sm:p-5 bg-[var(--pop-yellow)] border-2 border-[var(--ink)] ${
            props.class ?? ""
          }`}
        >
          <Halftone opacity={0.1} />

          <div class="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left info */}
            <div class="space-y-2 text-center sm:text-left flex-1 min-w-0">
              <div class="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span
                  class="sticker text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5"
                  style={{ "--pop": "var(--paper)" }}
                >
                  Exclusive for {batchName()}
                </span>
                <span
                  class="badge text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5"
                  style={{ "--pop": "var(--pop-teal)" }}
                >
                  MEC Community
                </span>
              </div>

              <div class="flex items-center justify-center sm:justify-start gap-2.5">
                <SpriteIcon name="foss-mec-badge" size={32} animate="wobble" interactive />
                <h3
                  class="text-lg sm:text-xl md:text-2xl font-black text-[var(--ink)] m-0 leading-tight"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  Join the FOSS MEC {batchTag()} Community
                </h3>
              </div>

              <p class="text-xs sm:text-sm font-semibold text-[var(--ink)] leading-relaxed m-0 max-w-xl">
                Connect with your {batchName()} batchmates, discuss daily puzzle clues, get instant
                launch announcements, and celebrate Onam together!
              </p>

              <p
                class="text-xs sm:text-sm font-bold text-[var(--ink)] m-0"
                style={{ "font-family": "var(--font-stack-hand)" }}
              >
                "maveli is already in your batch group (he mostly lurks between games)."
              </p>
            </div>

            {/* Action Join Buttons */}
            <div class="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto justify-center">
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                class="btn-brand px-4 py-2.5 text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer bg-[#25D366] text-white hover:brightness-105 border-2 border-[var(--ink)] rounded-lg transition-all"
              >
                <MessageCircle size={16} strokeWidth={2.5} />
                <span>Join {batchTag()} WhatsApp</span>
                <ExternalLink size={13} strokeWidth={2.5} />
              </a>

              <a
                href={DEFAULT_TELEGRAM_LINK}
                target="_blank"
                rel="noopener noreferrer"
                class="btn-accent px-4 py-2 text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer bg-[var(--pop-teal)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-lg transition-all"
              >
                <Send size={15} strokeWidth={2.5} />
                <span>FOSS MEC Telegram</span>
                <ExternalLink size={13} strokeWidth={2.5} />
              </a>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}
