import { Meta, Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { Check, Mail, Send, Sparkles } from "lucide-solid";
import { createMemo, createSignal, onMount, Show } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { decodeGiftMessage, encodeGiftMessage } from "~/lib/gift-crypto";
import { SITE_URL } from "~/lib/site";

function FoldingOnamCard(props: { message: string }) {
  const [opened, setOpened] = createSignal(false);

  return (
    <div class="relative w-full max-w-sm sm:max-w-md mx-auto my-4 select-none">
      <Show when={opened()}>
        <Confetti seed="letter-revealed" count={8} animate />
      </Show>

      {/* ---------------- CARD STAGE ---------------- */}
      <div
        class="relative w-full max-w-[290px] sm:max-w-[320px] mx-auto aspect-[5/7] cursor-pointer"
        style={{ perspective: "1800px" }}
        onClick={() => setOpened(!opened())}
      >
        {/* -------- INSIDE: Right Page (Underneath Cover) -------- */}
        <div
          class="absolute inset-0 rounded-2xl bg-[#FFFDF5] p-5 sm:p-6 flex flex-col justify-between"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            "background-image":
              "repeating-linear-gradient(transparent, transparent 26px, rgba(34,32,43,0.07) 27px)",
          }}
        >
          {/* Top Header Motif */}
          <div class="flex items-center justify-between border-b-2 border-dashed border-[var(--ink)]/20 pb-2">
            <div class="flex items-center gap-1.5">
              <SpriteIcon name="pookalam-flower" size={18} class="shrink-0" />
              <span class="text-[10px] font-mono font-black uppercase text-[var(--ink-soft)] tracking-wider">
                A Festival Note
              </span>
            </div>
            <SpriteIcon name="muthukuda" size={20} class="shrink-0 text-[var(--pop-pink)]" />
          </div>

          {/* Letter Message Body */}
          <div class="flex-1 flex items-center justify-center text-center px-1 py-4 overflow-hidden">
            <p
              class="text-base sm:text-lg font-black text-[var(--ink)] leading-relaxed m-0 italic break-words [overflow-wrap:anywhere] max-w-full"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              "{props.message}"
            </p>
          </div>

          {/* Footer */}
          <div class="pt-3 border-t border-[var(--ink)]/15 flex items-end justify-between">
            <div class="space-y-0.5">
              <p class="text-[9px] font-black uppercase text-[var(--ink)] m-0">Sent with warmth</p>
              <p class="text-[8px] font-bold text-[var(--ink-soft)] m-0">From your friend</p>
            </div>
            <span class="text-[10px] font-bold text-[var(--pop-pink)]">Happy Onam! 🌸</span>
          </div>
        </div>

        {/* -------- COVER: Swings open smoothly on its left spine -------- */}
        <div
          class="absolute inset-0 rounded-2xl bg-[var(--pop-yellow)] overflow-hidden"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            "transform-style": "preserve-3d",
            "transform-origin": "left center",
            transform: opened() ? "rotateY(-155deg)" : "rotateY(0deg)",
            transition: "transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* 1. FRONT COVER FACE: Clean 50/50 Color Block */}
          <div
            class="absolute inset-0 w-full h-full flex flex-col overflow-hidden"
            style={{ "backface-visibility": "hidden" }}
          >
            {/* Top Half: 50% Festival Yellow */}
            <div class="relative w-full h-1/2 bg-[var(--pop-yellow)] flex flex-col items-center justify-center p-3 shrink-0">
              {/* Corner Decorative Sprites */}
              <div class="absolute top-2.5 left-2.5 opacity-80">
                <SpriteIcon name="pookalam-flower" size={18} />
              </div>
              <div class="absolute top-2.5 right-2.5 opacity-80">
                <SpriteIcon name="burst-yellow" size={20} />
              </div>

              {/* Inked Radial Halftone */}
              <div class="absolute inset-0 pointer-events-none">
                <Halftone size={10} opacity={0.12} />
              </div>

              {/* Concentric Decorative Rings */}
              <svg
                class="absolute"
                width="160"
                height="160"
                viewBox="0 0 200 200"
                style={{ opacity: 0.45 }}
              >
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="var(--ink)"
                  stroke-width="2"
                  stroke-dasharray="2 6"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="66"
                  fill="none"
                  stroke="var(--pop-red)"
                  stroke-width="5"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="48"
                  fill="none"
                  stroke="var(--pop-blue)"
                  stroke-width="5"
                />
              </svg>

              {/* Center Emblem Medallion with Muthukuda Sprite */}
              <div
                class="relative z-10 w-18 h-18 rounded-full bg-[#FFFCF5] grid place-items-center shadow-xs"
                style={{ border: "2.5px solid var(--ink)", transform: "rotate(-3deg)" }}
              >
                <SpriteIcon name="muthukuda" size={38} class="shrink-0" />
              </div>

              {/* Cover Title */}
              <p
                class="relative z-10 mt-2 text-center text-lg font-black text-[var(--ink)] leading-tight m-0"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Happy Onam
              </p>

              {/* "for you" Pink Pill Badge */}
              <span
                class="relative z-10 mt-1 text-[11px] font-bold text-[var(--ink)] bg-[var(--pop-pink)] px-2.5 py-0.5 rounded-md shadow-2xs"
                style={{ border: "1.5px solid var(--ink)", transform: "rotate(2.5deg)" }}
              >
                for you ✦
              </span>
            </div>

            {/* Bottom Half: 50% Festival Teal Split Block */}
            <div class="relative w-full h-1/2 bg-[var(--pop-teal)] border-t-2 border-[var(--ink)] overflow-hidden shrink-0">
              {/* Memphis Halftone */}
              <div class="absolute inset-0 pointer-events-none">
                <Halftone size={10} opacity={0.12} />
              </div>
            </div>
          </div>

          {/* 2. INSIDE LEFT COVER FACE (Properly formatted when opened) */}
          <div
            class="absolute inset-0 flex flex-col items-center justify-between p-5 bg-[#F4EBD4] text-[var(--ink)]"
            style={{ "backface-visibility": "hidden", transform: "rotateY(180deg)" }}
          >
            {/* Top Corner Stamp */}
            <div class="w-full flex justify-end">
              <span class="text-[9px] font-mono font-black uppercase text-[var(--ink-soft)] border border-[var(--ink)]/40 px-1.5 py-0.5 rounded">
                ONAM 2026
              </span>
            </div>

            {/* Center Comic Illustration */}
            <div class="flex flex-col items-center justify-center space-y-2 text-center">
              <div class="w-16 h-16 rounded-full bg-[#FFFDF5] border-2 border-[var(--ink)] grid place-items-center p-1">
                <SpriteIcon name="maveli-laptop" size={44} />
              </div>
              <p
                class="text-xs font-black text-[var(--ink)] m-0 leading-tight"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Festive Greetings
              </p>
              <p class="text-[9px] font-semibold text-[var(--ink-soft)] max-w-[130px] m-0">
                A warm festival wish sent straight to you.
              </p>
            </div>

            {/* Bottom Sign */}
            <div class="w-full text-center">
              <span
                class="text-xs font-bold text-[var(--ink-soft)] italic"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                — see you soon! 🌸
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LetterPage() {
  const [searchParams] = useSearchParams();
  const [inputMsg, setInputMsg] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [createMode, setCreateMode] = createSignal(false);
  const [origin, setOrigin] = createSignal("");

  onMount(() => {
    setOrigin(window.location.origin);
  });

  const queryMsg = () => {
    const raw = searchParams.msg || searchParams.g;
    return typeof raw === "string" ? raw : "";
  };

  const decodedMessage = createMemo(() => {
    const q = queryMsg();
    if (!q) return null;
    return decodeGiftMessage(q);
  });

  const hasReceivedGift = () => !createMode() && !!decodedMessage();

  const generatedUrl = createMemo(() => {
    const text = inputMsg().trim();
    if (!text) return "";
    const token = encodeGiftMessage(text);
    return `${origin()}/letter?msg=${token}`;
  });

  const handleShare = async () => {
    const url = generatedUrl();
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "A Special Onam Letter",
          text: "You received a festive Onam greeting letter from a friend!",
          url,
        });
        return;
      } catch {
        /* fallback to clipboard */
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback */
    }
  };

  return (
    <main class="container max-w-md mx-auto py-8 px-4 space-y-6">
      <Title>A Special Onam Letter For You - Onam Games</Title>
      <Meta name="description" content="You received a special Onam festival greeting letter!" />
      <Meta property="og:title" content="💌 You Received an Onam Letter from a Friend!" />
      <Meta
        property="og:description"
        content="Click to open your special Onam festival greeting letter!"
      />
      <Meta property="og:image" content={`${SITE_URL}/images/gift-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content="💌 You Received an Onam Letter from a Friend!" />
      <Meta
        name="twitter:description"
        content="Click to open your special Onam festival greeting letter!"
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/gift-og.webp`} />

      {/* -------------------- UNWRAP / CARD MODE -------------------- */}
      <Show when={hasReceivedGift()}>
        <section class="text-center space-y-4">
          <div class="space-y-1.5">
            <span
              class="sticker inline-flex items-center gap-1"
              style={{ "--pop": "var(--pop-pink)" }}
            >
              <Mail size={14} />
              <span>A Letter For You</span>
            </span>
            <h1
              class="text-2xl sm:text-3xl font-black text-[var(--ink)] m-0 leading-tight"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              YOU GOT A LETTER!
            </h1>
            <p class="text-xs font-semibold text-[var(--ink-soft)]">
              A friend sent you a festive Onam greeting. Tap the card to open it!
            </p>
          </div>

          {/* Interactive Folding Onam Card */}
          <FoldingOnamCard message={decodedMessage()!} />

          <div class="pt-2">
            <button
              type="button"
              onClick={() => {
                setCreateMode(true);
                setInputMsg("");
              }}
              class="btn-brand text-xs sm:text-sm py-2.5 px-5 inline-flex items-center gap-2 cursor-pointer font-black"
            >
              <Sparkles size={15} />
              <span>Send Your Own Onam Letter →</span>
            </button>
          </div>
        </section>
      </Show>

      {/* -------------------- COMPOSER MODE -------------------- */}
      <Show when={!hasReceivedGift()}>
        <section class="space-y-5 text-center">
          <div class="space-y-1.5">
            <span
              class="sticker inline-flex items-center gap-1"
              style={{ "--pop": "var(--pop-teal)" }}
            >
              <Mail size={14} />
              <span>Send Onam Letter</span>
            </span>
            <h1
              class="text-2xl sm:text-3xl font-black text-[var(--ink)] m-0 leading-tight"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              WRITE AN ONAM LETTER
            </h1>
            <p class="text-xs font-semibold text-[var(--ink-soft)] max-w-sm mx-auto">
              Write a short festive message (&lt; 100 chars). We will fold it into an Onam letter
              for your friends!
            </p>
          </div>

          <div class="card pop-yellow p-5 space-y-4 text-left border-2 border-[var(--ink)]">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label
                  for="letter-msg-input"
                  class="text-xs font-black uppercase text-[var(--ink)]"
                >
                  Your Message
                </label>
                <span class="text-xs font-mono font-bold text-[var(--ink-soft)]">
                  {inputMsg().length}/100
                </span>
              </div>
              <textarea
                id="letter-msg-input"
                value={inputMsg()}
                onInput={(e) => setInputMsg(e.currentTarget.value.slice(0, 100))}
                placeholder="e.g., Happy Onam! Wishing you delicious Sadya, zero bugs, and unlimited payasam!"
                rows={3}
                class="input w-full text-sm resize-none"
              />
            </div>

            <Show when={inputMsg().trim().length > 0}>
              <div class="pt-2 border-t-2 border-dashed border-[var(--ink)]/20">
                <button
                  type="button"
                  onClick={handleShare}
                  class="btn-brand w-full py-2.5 text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer font-black"
                >
                  <Show when={copied()} fallback={<Send size={15} strokeWidth={2.5} />}>
                    <Check size={15} strokeWidth={2.5} />
                  </Show>
                  <span>{copied() ? "Letter Link Copied!" : "Share Letter ➔"}</span>
                </button>
              </div>
            </Show>
          </div>
        </section>
      </Show>
    </main>
  );
}
