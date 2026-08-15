import { Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { Download, Maximize2, Share2, X } from "lucide-solid";
import { canvasToBlob, captionFor, renderShareCard, type ShareCardData } from "~/lib/share-card";
import { shareFileName } from "~/lib/share-copy";

/**
 * The share card, on screen and on its way out.
 *
 * The card is *shown*, not hidden behind a button. A player who can see the
 * thing they would be posting shares far more often than one who has to press
 * "Share" to find out what it looks like — so this renders inline in the win
 * modal, the moment the run lands, with the buttons underneath it.
 *
 * Two details here are load-bearing and easy to undo by accident:
 *
 *  - The PNG is built **when the component mounts**, not when Share is pressed.
 *    iOS Safari only opens the share sheet if `navigator.share` is called
 *    inside the user gesture, and awaiting `toBlob()` first loses that gesture.
 *    By the time the button exists, the file already does.
 *
 *  - The preview is an `<img>` built from the blob, not the live `<canvas>`.
 *    Long-pressing an image on iOS offers "Save Image"; long-pressing a canvas
 *    offers nothing. That fallback is the last line of defence on a browser
 *    with no file sharing and a blocked download.
 */

type Phase = "drawing" | "ready" | "failed";

export interface ShareCardProps {
  data: ShareCardData;
  /** Narrower preview, for the win modal where the card sits inside a dialog. */
  compact?: boolean;
}

export function ShareCard(props: ShareCardProps) {
  const [phase, setPhase] = createSignal<Phase>("drawing");
  const [url, setUrl] = createSignal<string>("");
  const [file, setFile] = createSignal<File | null>(null);
  const [zoomed, setZoomed] = createSignal(false);
  const [note, setNote] = createSignal("");

  const caption = () => captionFor(props.data);

  /**
   * Everything that changes what the card looks like.
   *
   * The rank arrives a moment after the run does — it is a second round trip —
   * so the first `data` a card is handed usually has `rank: null`. Redrawing on
   * this signature is what turns that first "just for fun" card into the real
   * one with `#3 of 47` on it, instead of leaving the player with a card that
   * quietly under-sells them. Comparing a signature rather than object identity
   * keeps an unrelated re-render from redrawing a 1080×1920 canvas.
   */
  const signature = () => {
    const d = props.data;
    return [d.seed, d.rank, d.fieldSize, d.playerName, d.college, d.instagram, d.origin].join("|");
  };

  createEffect(
    on(signature, () => {
      const data = props.data;
      let cancelled = false;
      setPhase("drawing");
      void (async () => {
        try {
          const canvas = await renderShareCard(data);
          const blob = await canvasToBlob(canvas);
          if (cancelled) return;
          setUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return URL.createObjectURL(blob);
          });
          setFile(new File([blob], shareFileName(data.gameSlug), { type: "image/png" }));
          setPhase("ready");
        } catch {
          if (!cancelled) setPhase("failed");
        }
      })();
      onCleanup(() => {
        cancelled = true;
      });
    }),
  );

  onCleanup(() => {
    const current = url();
    if (current) URL.revokeObjectURL(current);
  });

  /*
   * Escape closes the full-screen card, and *only* that.
   *
   * Registered on the capture phase so it runs before the win modal's own
   * window listener, which would otherwise close the whole celebration behind
   * the overlay — one Escape, two dialogs gone, and the player back on the page
   * wondering what happened.
   */
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !zoomed()) return;
      e.stopImmediatePropagation();
      setZoomed(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    onCleanup(() => window.removeEventListener("keydown", onKey, { capture: true }));
  });

  const download = () => {
    const href = url();
    if (!href) return;
    const link = document.createElement("a");
    link.href = href;
    link.download = shareFileName(props.data.gameSlug);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNote("Saved to your downloads. Post it and tag @fossmec.");
  };

  const share = async () => {
    const payload = { files: file() ? [file()!] : [], title: "FOSS Onam Games", text: caption() };
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (file() && nav.share && nav.canShare?.(payload)) {
      try {
        await nav.share(payload);
        return;
      } catch (error) {
        // Dismissing the sheet is a decision, not a failure. Anything else and
        // we quietly fall through to the download, which always works.
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    download();
  };

  /*
   * The preview.
   *
   * Tapping it opens the card full screen rather than firing the share sheet.
   * At 118px the card is a thumbnail — before a player posts something with
   * their name and college on it, they want to *read* it, and an image that
   * cannot be enlarged is the one thing every phone user expects to be able
   * to do. Share is the button right beside it, and again inside the overlay.
   */
  const preview = () => (
    <div
      class="relative shrink-0 overflow-hidden rounded"
      classList={{
        "cursor-zoom-in": phase() === "ready",
        "mx-auto": !props.compact,
      }}
      style={{
        width: props.compact ? "118px" : "min(280px, 68vw)",
        "aspect-ratio": "9 / 16",
        border: "var(--ink-w) solid var(--ink)",
        background: "var(--paper-3)",
      }}
      role="button"
      tabindex={phase() === "ready" ? 0 : undefined}
      aria-label="View your score card full screen"
      onClick={() => {
        if (phase() === "ready") setZoomed(true);
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && phase() === "ready") {
          e.preventDefault();
          setZoomed(true);
        }
      }}
    >
      {/* Keep the previous card up while a redraw is in flight — blanking it
          mid-look reads as a glitch, and the redraw is only a refinement. */}
      <Show
        when={url()}
        fallback={
          <div class="grid h-full place-items-center p-2 text-center">
            <p class="font-mono text-xs font-bold text-muted">
              {phase() === "failed" ? "card unavailable" : "inking…"}
            </p>
          </div>
        }
      >
        <img src={url()} alt="Your FOSS Onam Games score card" class="h-full w-full object-cover" />
      </Show>

      {/* The enlarge affordance, as a sticker on the card rather than a button
          under it — a whole row of chrome to say "this picture is a picture". */}
      <Show when={phase() === "ready"}>
        <span
          class="pointer-events-none absolute grid place-items-center rounded"
          style={{
            // Top right: the corner of the card carrying decoration rather than
            // words. Bottom right sat on the footer and covered "fossmec".
            right: "5px",
            top: "5px",
            width: props.compact ? "24px" : "30px",
            height: props.compact ? "24px" : "30px",
            background: "var(--paper-2)",
            border: "2px solid var(--ink)",
          }}
          aria-hidden="true"
        >
          <Maximize2 size={props.compact ? 13 : 16} strokeWidth={2.5} />
        </span>
      </Show>
    </div>
  );

  const actions = () => (
    <Show when={phase() !== "failed"}>
      <div class="flex flex-1 flex-col justify-center gap-2">
        <button
          type="button"
          class="btn-brand flex items-center justify-center gap-2"
          classList={{ "text-lg": !props.compact }}
          disabled={phase() !== "ready"}
          onClick={() => void share()}
        >
          <Share2 size={props.compact ? 17 : 20} />
          {phase() === "ready" ? "Share" : "Drawing…"}
        </button>
        <button
          type="button"
          class="btn-ghost flex items-center justify-center gap-2 text-sm"
          disabled={phase() !== "ready"}
          onClick={download}
        >
          <Download size={16} />
          Save image
        </button>
        <Show when={props.compact}>
          <p class="text-center font-mono text-[0.65rem] leading-tight text-muted">
            tap the card to enlarge
          </p>
        </Show>
      </div>
    </Show>
  );

  return (
    <div class="space-y-2">
      {/*
        Side by side when compact. Stacked, this block was taller than the rest
        of the win modal put together and pushed "Go again" off the screen —
        which is a strange thing to do to the two buttons a player came for.
      */}
      <div
        classList={{
          "flex items-stretch gap-3 text-left": props.compact,
          "space-y-3": !props.compact,
        }}
      >
        {preview()}
        {actions()}
      </div>

      <Show when={note()}>
        <p class="text-center font-mono text-xs text-muted">{note()}</p>
      </Show>
      <Show when={phase() === "failed"}>
        <p class="text-center text-sm font-semibold text-muted">
          Your browser would not draw the card. A screenshot works just as well.
        </p>
      </Show>

      {/*
        Full screen: the card, as large as the screen allows, over an almost
        opaque backdrop. It sits above the win modal (z-60 to its z-50) and
        carries its own Share button, so a player who opened it to read the
        thing can post it without going back a step.
      */}
      <Show when={zoomed() && url()}>
        <div
          class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 p-4"
          style={{ background: "rgb(34 32 43 / 0.94)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Your score card"
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoomed(false);
          }}
        >
          <img
            src={url()}
            alt="Your FOSS Onam Games score card"
            class="max-h-[78vh] w-auto max-w-full rounded object-contain"
            style={{ border: "var(--ink-w) solid var(--ink)" }}
          />
          {/* Close is the X in the corner, where a full-screen image always
              puts it — not a third full-width button under the two that do
              something. */}
          <button
            type="button"
            class="absolute grid place-items-center rounded-full"
            style={{
              top: "1rem",
              right: "1rem",
              width: "2.75rem",
              height: "2.75rem",
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
              color: "var(--ink)",
            }}
            aria-label="Close"
            onClick={() => setZoomed(false)}
          >
            <X size={22} strokeWidth={2.5} />
          </button>

          <div class="grid w-full max-w-xs grid-cols-2 gap-2">
            <button
              type="button"
              class="btn-brand flex items-center justify-center gap-2"
              onClick={() => void share()}
            >
              <Share2 size={18} />
              Share
            </button>
            <button
              type="button"
              class="btn-ghost flex items-center justify-center gap-2 text-sm"
              onClick={download}
            >
              <Download size={16} />
              Save
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

/**
 * The same card in its own dialog, for the places where it is not already on
 * screen — the settled result panel and the leaderboard's own-rank row.
 */
export function ShareCardModal(props: { data: ShareCardData; onClose: () => void }) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    });
  });

  return (
    <div
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
      style={{ background: "rgb(34 32 43 / 0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Share your score"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="card anim-sheet-in pop-pink my-auto w-full max-w-sm space-y-3 text-center">
        {/* An X in the corner, not a button in the stack. Closing is not one of
            the two things this dialog is for. */}
        <button
          type="button"
          class="absolute grid place-items-center rounded-full"
          style={{
            top: "0.9rem",
            right: "0.75rem",
            width: "2.25rem",
            height: "2.25rem",
            background: "var(--paper-2)",
            border: "2px solid var(--ink)",
            color: "var(--ink)",
          }}
          aria-label="Close"
          onClick={props.onClose}
        >
          <X size={18} strokeWidth={2.5} />
        </button>
        <h2 class="font-display text-2xl font-extrabold">Share your score</h2>
        <ShareCard data={props.data} />
      </div>
    </div>
  );
}
