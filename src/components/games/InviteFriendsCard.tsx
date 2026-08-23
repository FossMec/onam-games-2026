import { Check, Copy } from "lucide-solid";
import { createSignal } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SITE_URL } from "~/lib/site";

export interface InviteFriendsCardProps {
  class?: string;
}

export function InviteFriendsCard(props: InviteFriendsCardProps) {
  const [copied, setCopied] = createSignal(false);
  const [instaNotif, setInstaNotif] = createSignal(false);

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

  const handleInstagramShare = async () => {
    await copyToClipboard();
    setInstaNotif(true);
    setTimeout(() => setInstaNotif(false), 3500);

    // On mobile devices with native share sheet, trigger it
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "FOSS MEC Onam Games",
          text: shareText(),
          url: homeUrl(),
        });
      } catch {
        /* share dismissed */
      }
    } else {
      window.open("https://instagram.com", "_blank", "noopener,noreferrer");
    }
  };

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
            "tell them before they find out about the ₹250 daily prizes from someone else."
          </p>
        </div>

        {/* Right Actions & Share Buttons */}
        <div class="flex flex-col gap-2.5 shrink-0 w-full md:w-auto items-center md:items-end">
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

          {/* Social Share Icon Buttons (WhatsApp + Instagram Only) */}
          <div class="flex items-center justify-center gap-2 pt-0.5">
            <span class="text-[10px] font-black uppercase tracking-wider text-[var(--ink)]/80 mr-0.5">
              Share to:
            </span>

            {/* WhatsApp */}
            <a
              href={whatsappShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 rounded-lg bg-[#25D366] text-white border-2 border-[var(--ink)] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-105 active:scale-95 transition-all shadow-xs"
              title="Share directly to WhatsApp chat or status"
            >
              {/* Clean SVG WhatsApp icon */}
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span>WhatsApp</span>
            </a>

            {/* Instagram */}
            <button
              type="button"
              onClick={() => void handleInstagramShare()}
              class="px-3 py-1.5 rounded-lg text-white border-2 border-[var(--ink)] text-xs font-black inline-flex items-center gap-1.5 hover:brightness-105 active:scale-95 transition-all shadow-xs cursor-pointer"
              style={{
                background:
                  "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              }}
              title="Share on Instagram Story or DM"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span>Instagram</span>
            </button>
          </div>

          {/* Instagram Toast Tip */}
          <div
            class={`text-[10px] font-black text-[var(--ink)] bg-[var(--pop-yellow)] px-2 py-0.5 rounded border border-[var(--ink)] transition-opacity duration-200 ${
              instaNotif() ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            📋 Link copied! Paste it in your Instagram Story or DM!
          </div>
        </div>
      </div>
    </div>
  );
}
