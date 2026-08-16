import { For, createSignal, onCleanup, onMount } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import type { SpriteName } from "~/lib/sprites";

/**
 * The screen a player watches while their sign-in completes.
 *
 * There is a genuine wait here — a code exchange with Google, a round trip to
 * Supabase, the device fingerprint, then the session write — and it is the
 * first thing a new player ever sees. A grey spinner would be a wasted
 * introduction, so it gets the meme wall instead, on a rotation.
 *
 * Everything here is borrowed from somewhere else on the site: the paper ground
 * and its rays, a `card` with its colour strip, a `badge`, `wordmark`,
 * `comment`, the Onam-shaped Confetti, the sprite cast, and the same memes the
 * home and design pages already use. Nothing new was invented for it, which is
 * the point — a loading screen that introduces its own visual language reads as
 * a different website.
 *
 * The captions are the actual steps, in order, rather than decoration. Someone
 * staring at "binding this device to your account" and then hitting the
 * one-account-per-device wall has at least been told what happened.
 *
 * Cost is near zero: every layer is transform/opacity only and
 * `pointer-events: none`, sprites are the WebP the site already loaded, and
 * `prefers-reduced-motion` freezes it into a readable poster.
 */

/**
 * The whole meme wall, flipped fast.
 *
 * Not meant to be read. At this speed it registers as "this site has a pile of
 * these" and nothing more, which is the entire intent — the readable copy is
 * the status line underneath, which runs on its own slower clock so it stays
 * legible while the pictures blur past.
 *
 * All seven stay mounted and cross-fade on opacity rather than swapping a
 * `src`, so nothing hits the network mid-flip and there is no flicker on the
 * first pass through.
 */
const MEMES: { src: string; alt: string }[] = [
  { src: "/images/memes/need-more-tokens.webp", alt: "Maveli out of tokens" },
  { src: "/images/memes/sudo-mkdir-pookalam.webp", alt: "sudo mkdir pookalam" },
  { src: "/images/memes/talk-is-cheap-sadya.webp", alt: "Talk is cheap, show me the sadya" },
  { src: "/images/memes/failure-is-not-an-option.webp", alt: "Failure is not an Option" },
  { src: "/images/memes/meme-deploy.webp", alt: "Deploy day" },
  { src: "/images/memes/meme-celebrate.webp", alt: "Celebrating" },
  { src: "/images/memes/meme-footer.webp", alt: "Onam celebration" },
];

const MEME_MS = 850;
const STEP_MS = 2600;

interface Step {
  /** Badge text, in the design page's house style. */
  tag: string;
  /** What the server is actually doing while this one is up. */
  status: string;
  color: string;
}

/**
 * Roughly the real sequence.
 *
 * Not driven by real progress — the steps are server-side and mostly finish
 * faster than one beat — but the order is honest, so nothing here claims
 * something that did not happen.
 */
const STEPS: Step[] = [
  { tag: "HANDSHAKE", status: "asking Google who you are…", color: "var(--pop-purple)" },
  { tag: "SYSADMIN", status: "sudo mkdir -p /home/you", color: "var(--pop-yellow)" },
  {
    tag: "FAIR PLAY",
    status: "checking you're not four people in a trench coat…",
    color: "var(--pop-teal)",
  },
  {
    tag: "ONE PER DEVICE",
    status: "binding this device to your account…",
    color: "var(--pop-red)",
  },
  { tag: "SESSION", status: "signing your session cookie…", color: "var(--pop-blue)" },
  { tag: "ALMOST", status: "saving you a seat on the leaderboard…", color: "var(--pop-pink)" },
];

/** Marchers, in parade order. Duplicated in the strip for a seamless loop. */
const PARADE: SpriteName[] = [
  "tux-king",
  "maveli-laptop",
  "gopher-king",
  "muthukuda",
  "ferris-crab",
  "nilavilakku",
  "python-snake",
  "sadya-leaf",
  "octocat-garland",
  "vamana-umbrella",
  "docker-pookalam",
  "kite-pattern",
];

export function SignInScene() {
  // Two clocks on purpose: pictures flip fast, words stay readable.
  const [meme, setMeme] = createSignal(0);
  const [step, setStep] = createSignal(0);
  const current = () => STEPS[step()];

  onMount(() => {
    const memeTimer = setInterval(() => setMeme((n) => (n + 1) % MEMES.length), MEME_MS);
    const stepTimer = setInterval(() => setStep((n) => (n + 1) % STEPS.length), STEP_MS);
    onCleanup(() => {
      clearInterval(memeTimer);
      clearInterval(stepTimer);
    });
  });

  return (
    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: "var(--paper)" }}
      role="status"
      aria-live="polite"
    >
      <Confetti seed="signin-scene" count={14} opacity={0.5} animate />

      <div class="art-over anim-signin-panel w-full max-w-sm">
        <div class="card text-center space-y-3" style={{ "--pop": current().color }}>
          <div class="flex justify-center">
            <span class="badge text-[10px]" style={{ "--pop": current().color }}>
              {current().tag}
            </span>
          </div>

          {/*
            A fixed square that all seven share. Their aspect ratios differ by
            a few pixels, and at this flip rate letting the box follow each one
            would read as the card twitching.
          */}
          <div
            class="relative mx-auto w-36 sm:w-40"
            style={{ "aspect-ratio": "1 / 1" }}
            aria-hidden="true"
          >
            <For each={MEMES}>
              {(item, i) => (
                <img
                  src={item.src}
                  alt=""
                  width={512}
                  height={506}
                  loading="eager"
                  decoding="async"
                  class="absolute inset-0 h-full w-full object-contain select-none"
                  style={{
                    opacity: meme() === i() ? 1 : 0,
                    transform:
                      meme() === i() ? "scale(1) rotate(0deg)" : "scale(0.82) rotate(-7deg)",
                    transition:
                      "opacity 220ms ease, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              )}
            </For>
          </div>

          <p class="wordmark text-2xl sm:text-3xl m-0" data-text="SIGNING IN">
            SIGNING IN
          </p>

          {/* Fixed height so a longer line never nudges the card. */}
          <p
            class="font-extrabold text-sm m-0 flex items-center justify-center"
            style={{ "min-height": "2.8em" }}
          >
            {current().status}
          </p>

          {/* Three dots keeping time — the "it has not hung" signal. */}
          <div class="flex justify-center gap-2" aria-hidden="true">
            <For each={["var(--pop-red)", "var(--pop-yellow)", "var(--pop-teal)"]}>
              {(color, i) => (
                <span
                  class="anim-signin-blink inline-block"
                  style={{
                    "--anim-delay": `${i() * 0.16}s`,
                    width: "10px",
                    height: "10px",
                    "border-radius": "50%",
                    background: color,
                    border: "2px solid var(--ink)",
                  }}
                />
              )}
            </For>
          </div>

          <p class="comment text-xs">hang tight, this only happens once.</p>
        </div>
      </div>

      {/* ------------------------------------------------------ the parade */}
      <div
        class="absolute inset-x-0 overflow-hidden"
        aria-hidden="true"
        style={{ bottom: "5vh", "pointer-events": "none" }}
      >
        <div
          class="absolute inset-x-0"
          style={{
            bottom: "0",
            height: "3px",
            "background-image":
              "repeating-linear-gradient(90deg, var(--ink) 0 14px, transparent 14px 28px)",
            opacity: 0.28,
          }}
        />
        <div class="anim-signin-march flex items-end gap-9" style={{ width: "max-content" }}>
          {/* Twice through, so the -50% loop point is invisible. */}
          <For each={[...PARADE, ...PARADE]}>
            {(sprite, i) => (
              <span
                class="anim-signin-hop inline-flex"
                style={{ "--anim-delay": `${(i() % PARADE.length) * 0.14}s` }}
              >
                <SpriteIcon name={sprite} size={42} animate="none" />
              </span>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
