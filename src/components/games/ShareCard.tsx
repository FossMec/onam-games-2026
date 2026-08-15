import { Camera, Download, Eye, EyeOff, Maximize2, Share2, Trash2, X } from "lucide-solid";
import { Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { fileToWebpDataUrl } from "~/lib/avatar";
import { canvasToBlob, captionFor, renderShareCard, type ShareCardData } from "~/lib/share-card";
import { shareFileName } from "~/lib/share-copy";

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

  // Customization signals
  const [hideAvatar, setHideAvatar] = createSignal(false);
  const [hideCollege, setHideCollege] = createSignal(false);
  const [hideBranch, setHideBranch] = createSignal(false);
  const [hideBatch, setHideBatch] = createSignal(false);
  const [hideInstagram, setHideInstagram] = createSignal(false);
  const [customPhoto, setCustomPhoto] = createSignal<string | null>(null);
  const [showOptions, setShowOptions] = createSignal(false);

  const caption = () => captionFor(props.data);

  /**
   * Everything that changes what the card looks like.
   */
  const signature = () => {
    const d = props.data;
    return [
      d.seed,
      d.rank,
      d.fieldSize,
      d.playerName,
      d.college,
      d.branch,
      d.batch,
      d.instagram,
      d.origin,
      hideAvatar(),
      hideCollege(),
      hideBranch(),
      hideBatch(),
      hideInstagram(),
      customPhoto(),
    ].join("|");
  };

  createEffect(
    on(signature, () => {
      const d = props.data;
      const data: ShareCardData = {
        ...d,
        customPhoto: customPhoto(),
        options: {
          hideAvatar: hideAvatar(),
          hideCollege: hideCollege(),
          hideBranch: hideBranch(),
          hideBatch: hideBatch(),
          hideInstagram: hideInstagram(),
        },
      };

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
          setFile(
            new File([blob], shareFileName(data.gameSlug), {
              type: "image/png",
            }),
          );
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

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !zoomed()) return;
      e.stopImmediatePropagation();
      setZoomed(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    onCleanup(() => window.removeEventListener("keydown", onKey, { capture: true }));
  });

  const onPhotoSelect = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToWebpDataUrl(file);
      setCustomPhoto(dataUrl);
      setHideAvatar(false);
    } catch {
      setNote("Could not load that photo.");
    }
  };

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
    const payload = {
      files: file() ? [file()!] : [],
      title: "FOSS Onam Games",
      text: caption(),
    };
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (file() && nav.share && nav.canShare?.(payload)) {
      try {
        await nav.share(payload);
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    download();
  };

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

      <Show when={phase() === "ready"}>
        <span
          class="pointer-events-none absolute grid place-items-center rounded"
          style={{
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
          {phase() === "ready" ? "Share Card" : "Drawing…"}
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
        <button
          type="button"
          class="btn-ghost flex items-center justify-center gap-1.5 text-xs py-1"
          onClick={() => setShowOptions((v) => !v)}
        >
          <span>{showOptions() ? "Hide options" : "Customize card"}</span>
        </button>
      </div>
    </Show>
  );

  return (
    <div class="space-y-3">
      <div
        classList={{
          "flex items-stretch gap-3 text-left": props.compact,
          "space-y-3": !props.compact,
        }}
      >
        {preview()}
        {actions()}
      </div>

      {/* Card Details Customization Controls */}
      <Show when={showOptions()}>
        <div class="card p-3 space-y-2.5 text-left bg-[var(--paper-2)] border-2 border-[var(--ink)]">
          <p class="font-extrabold text-xs text-[var(--ink)]">Customize details on this card:</p>

          {/* Toggle buttons for details */}
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setHideAvatar((v) => !v)}
              class={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                !hideAvatar()
                  ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                  : "bg-[var(--paper-1)] text-[var(--ink-soft)] border-[var(--ink-soft)] line-through"
              }`}
            >
              <Show when={!hideAvatar()} fallback={<EyeOff size={13} />}>
                <Eye size={13} />
              </Show>
              <span>Photo</span>
            </button>

            <Show when={props.data.college}>
              <button
                type="button"
                onClick={() => setHideCollege((v) => !v)}
                class={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                  !hideCollege()
                    ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                    : "bg-[var(--paper-1)] text-[var(--ink-soft)] border-[var(--ink-soft)] line-through"
                }`}
              >
                <Show when={!hideCollege()} fallback={<EyeOff size={13} />}>
                  <Eye size={13} />
                </Show>
                <span>College</span>
              </button>
            </Show>

            <Show when={props.data.branch}>
              <button
                type="button"
                onClick={() => setHideBranch((v) => !v)}
                class={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                  !hideBranch()
                    ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                    : "bg-[var(--paper-1)] text-[var(--ink-soft)] border-[var(--ink-soft)] line-through"
                }`}
              >
                <Show when={!hideBranch()} fallback={<EyeOff size={13} />}>
                  <Eye size={13} />
                </Show>
                <span>Branch</span>
              </button>
            </Show>

            <Show when={props.data.batch && props.data.batch !== "na"}>
              <button
                type="button"
                onClick={() => setHideBatch((v) => !v)}
                class={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                  !hideBatch()
                    ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                    : "bg-[var(--paper-1)] text-[var(--ink-soft)] border-[var(--ink-soft)] line-through"
                }`}
              >
                <Show when={!hideBatch()} fallback={<EyeOff size={13} />}>
                  <Eye size={13} />
                </Show>
                <span>Batch</span>
              </button>
            </Show>

            <Show when={props.data.instagram}>
              <button
                type="button"
                onClick={() => setHideInstagram((v) => !v)}
                class={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                  !hideInstagram()
                    ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                    : "bg-[var(--paper-1)] text-[var(--ink-soft)] border-[var(--ink-soft)] line-through"
                }`}
              >
                <Show when={!hideInstagram()} fallback={<EyeOff size={13} />}>
                  <Eye size={13} />
                </Show>
                <span>Instagram</span>
              </button>
            </Show>
          </div>

          {/* Photo attachment controls */}
          <div class="flex items-center gap-2 pt-1 border-t border-[var(--ink-soft)]">
            <label
              for="card-photo-input"
              class="btn-ghost py-1 px-2.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Camera size={14} />
              <span>{customPhoto() ? "Change card photo" : "Add custom photo"}</span>
            </label>
            <input
              id="card-photo-input"
              type="file"
              accept="image/*"
              class="sr-only"
              onChange={(e) => onPhotoSelect(e.currentTarget.files?.[0])}
            />

            <Show when={customPhoto()}>
              <button
                type="button"
                onClick={() => setCustomPhoto(null)}
                class="btn-ghost py-1 px-2 text-xs font-bold text-[var(--pop-red)] flex items-center gap-1"
                title="Reset to default avatar"
              >
                <Trash2 size={13} />
                <span>Reset photo</span>
              </button>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={note()}>
        <p class="text-center font-mono text-xs text-muted">{note()}</p>
      </Show>
      <Show when={phase() === "failed"}>
        <p class="text-center text-sm font-semibold text-muted">
          Your browser would not draw the card. A screenshot works just as well.
        </p>
      </Show>

      {/* Full screen view */}
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
          <button
            type="button"
            class="absolute grid place-items-center rounded-full cursor-pointer"
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
              class="btn-brand flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => void share()}
            >
              <Share2 size={18} />
              Share
            </button>
            <button
              type="button"
              class="btn-ghost flex items-center justify-center gap-2 text-sm cursor-pointer"
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
        <button
          type="button"
          class="absolute grid place-items-center rounded-full cursor-pointer"
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
