import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SITE_URL } from "~/lib/site";

export interface InviteFriendsCardProps {
  class?: string;
}

export function InviteFriendsCard(props: InviteFriendsCardProps) {
  const [copied, setCopied] = createSignal(false);

  const homeUrl = () =>
    typeof window !== "undefined" && window.location.origin
      ? `${window.location.origin}/`
      : `${SITE_URL}/`;

  const shareText = () =>
    `🌸 Play Onam Games with me! 6 daily mini-game puzzles, Code-a-Pookalam contest, and ₹5K+ in cash prizes by FOSS MEC. Play now at: ${homeUrl()}`;

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(homeUrl());
      } else {
        const input = document.createElement("input");
        input.value = homeUrl();
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const whatsappShareUrl = () =>
    `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText())}`;

  const telegramShareUrl = () =>
    `https://t.me/share/url?url=${encodeURIComponent(homeUrl())}&text=${encodeURIComponent(
      "🌸 Play Onam Games by FOSS MEC! 6 daily puzzle challenges, Code-a-Pookalam, and ₹5K+ in cash bounties!",
    )}`;

  const twitterShareUrl = () =>
    `https://x.com/intent/tweet?text=${encodeURIComponent(
      "🌸 Play Onam Games by @FossMec! 6 daily mini-games, Code-a-Pookalam & ₹5K+ cash bounties! Join the festival fun:",
    )}&url=${encodeURIComponent(homeUrl())}`;

  return (
    <div
      class={`relative overflow-hidden rounded-xl p-4 sm:p-5 bg-[var(--pop-pink)] border-2 border-[var(--ink)] ${
        props.class ?? ""
      }`}
    >
      <Halftone opacity={0.12} />

      <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Copy Info */}
        <div class="space-y-2 text-center md:text-left flex-1 min-w-0">
          <div class="flex items-center justify-center md:justify-start gap-2 flex-wrap">
            <span
              class="sticker text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5"
              style={{ "--pop": "var(--pop-yellow)" }}
            >
              Spread The Word
            </span>
            <span
              class="badge text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5"
              style={{ "--pop": "var(--paper)" }}
            >
              Challenge Friends
            </span>
          </div>

          <div class="flex items-center justify-center md:justify-start gap-2.5">
            <SpriteIcon name="tux-king" size={32} animate="float" interactive />
            <h3
              class="text-lg sm:text-xl md:text-2xl font-black text-[var(--ink)] m-0 leading-tight"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Invite Your Friends to Play!
            </h3>
          </div>

          <p class="text-xs sm:text-sm font-semibold text-[var(--ink)] leading-relaxed m-0 max-w-xl">
            Everything is more fun when there's someone to beat on the leaderboard. Send the link to
            your college groups, friends, and fellow developers!
          </p>

          <p
            class="text-xs sm:text-sm font-bold text-[var(--ink)] m-0"
            style={{ "font-family": "var(--font-stack-hand)" }}
          >
            "tell them before they find out about the ₹200 daily prizes from someone else."
          </p>
        </div>

        {/* Right Actions & Share Buttons */}
        <div class="flex flex-col gap-2 shrink-0 w-full md:w-auto items-center md:items-end">
          {/* Quick Copy Link Bar */}
          <div class="flex items-center gap-1.5 w-full sm:w-auto">
            <div class="px-2.5 py-1.5 rounded-lg bg-[var(--paper)] border-2 border-[var(--ink)] text-xs font-mono font-bold text-[var(--ink)] truncate max-w-[200px] sm:max-w-xs select-all">
              {homeUrl()}
            </div>
            <button
              type="button"
              onClick={() => void copyToClipboard()}
              class="btn-brand px-3 py-1.5 text-xs font-black inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copied() ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied() ? "Copied!" : "Copy Link"}</span>
            </button>
          </div>

          {/* Social Share Icon Buttons */}
          <div class="flex items-center justify-center gap-1.5 pt-0.5">
            <span class="text-[10px] font-black uppercase tracking-wider text-[var(--ink)]/80 mr-1">
              Share to:
            </span>

            {/* WhatsApp */}
            <a
              href={whatsappShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              class="px-2.5 py-1 rounded-md bg-[#25D366] text-white border-2 border-[var(--ink)] text-xs font-black inline-flex items-center gap-1 hover:brightness-105 transition-all"
              title="Share on WhatsApp"
            >
              <MessageCircle size={13} strokeWidth={2.5} />
              <span>WhatsApp</span>
            </a>

            {/* Telegram */}
            <a
              href={telegramShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              class="px-2.5 py-1 rounded-md bg-[var(--pop-blue)] text-[var(--ink)] border-2 border-[var(--ink)] text-xs font-black inline-flex items-center gap-1 hover:brightness-105 transition-all"
              title="Share on Telegram"
            >
              <Send size={13} strokeWidth={2.5} />
              <span>Telegram</span>
            </a>

            {/* X / Twitter */}
            <a
              href={twitterShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              class="px-2 py-1 rounded-md bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] text-xs font-black inline-flex items-center gap-1 hover:bg-[var(--paper-2)] transition-all"
              title="Share on X"
            >
              <Share2 size={13} strokeWidth={2.5} />
              <span>X / Tweet</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
