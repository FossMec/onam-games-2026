import {
  Camera,
  Download,
  Eye,
  EyeOff,
  Maximize2,
  RefreshCw,
  Share2,
  Trash2,
  X,
} from "lucide-solid";
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

  // Live Camera Viewfinder State
  const [cameraActive, setCameraActive] = createSignal(false);
  const [facingMode, setFacingMode] = createSignal<"user" | "environment">("user");
  const [cameraLoading, setCameraLoading] = createSignal(false);
  const [cameraError, setCameraError] = createSignal("");
  let videoRef: HTMLVideoElement | undefined;
  let streamRef: MediaStream | null = null;

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

  const stopCamera = () => {
    if (streamRef) {
      streamRef.getTracks().forEach((track) => track.stop());
      streamRef = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
    setCameraError("");
  };

  const startCamera = async (mode: "user" | "environment" = facingMode()) => {
    if (typeof navigator === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      document.getElementById("card-photo-input")?.click();
      return;
    }
    stopCamera();
    setCameraActive(true);
    setCameraLoading(true);
    setCameraError("");
    setFacingMode(mode);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1080 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef = stream;
      setCameraLoading(false);
      // Wait for next tick so videoRef is bound
      setTimeout(() => {
        if (videoRef) {
          videoRef.srcObject = stream;
          void videoRef.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      console.error("[camera] access error:", err);
      setCameraError("Camera permission denied or unavailable.");
      setCameraLoading(false);
    }
  };

  const flipCamera = async () => {
    const nextMode = facingMode() === "user" ? "environment" : "user";
    await startCamera(nextMode);
  };

  const snapPhoto = () => {
    if (!videoRef) return;
    const vWidth = videoRef.videoWidth || 640;
    const vHeight = videoRef.videoHeight || 480;
    const dim = Math.min(vWidth, vHeight);
    const sx = Math.max(0, (vWidth - dim) / 2);
    const sy = Math.max(0, (vHeight - dim) / 2);

    const canvas = document.createElement("canvas");
    const targetDim = Math.min(640, dim);
    canvas.width = targetDim;
    canvas.height = targetDim;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode() === "user") {
      // Mirror horizontally so the selfie matches what the player saw on screen
      ctx.translate(targetDim, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(videoRef, sx, sy, dim, dim, 0, 0, targetDim, targetDim);
    const dataUrl = canvas.toDataURL("image/webp", 0.9);
    setCustomPhoto(dataUrl);
    setHideAvatar(false);
    stopCamera();
  };

  onCleanup(() => {
    stopCamera();
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
      class="relative shrink-0 overflow-hidden rounded transition-all cursor-zoom-in"
      style={{
        width: props.compact
          ? "min(220px, 62vw, calc((100dvh - 23rem) * 9 / 16))"
          : "min(280px, 68vw, calc((100dvh - 21rem) * 9 / 16))",
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

  const customizeDrawer = () => (
    <Show when={showOptions()}>
      <div class="card p-3 space-y-2.5 text-left bg-[var(--paper-2)] border-2 border-[var(--ink)] mb-2">
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

        {/* Selfie camera attachment controls */}
        <div class="flex items-center gap-2 pt-1 border-t border-[var(--ink-soft)]">
          <button
            type="button"
            onClick={() => void startCamera()}
            class="btn-ghost py-1 px-2.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Camera size={14} />
            <span>{customPhoto() ? "Retake selfie" : "Take a selfie"}</span>
          </button>
          <input
            id="card-photo-input"
            type="file"
            accept="image/*"
            capture="user"
            class="sr-only"
            onChange={(e) => onPhotoSelect(e.currentTarget.files?.[0])}
          />

          <Show when={customPhoto()}>
            <button
              type="button"
              onClick={() => setCustomPhoto(null)}
              class="btn-ghost py-1 px-2 text-xs font-bold text-[var(--pop-red)] flex items-center gap-1 cursor-pointer"
              title="Remove selfie"
            >
              <Trash2 size={13} />
              <span>Remove selfie</span>
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );

  const actions = () => (
    <Show when={phase() !== "failed"}>
      <div class="flex flex-1 flex-col justify-center gap-2 w-full">
        <button
          type="button"
          class="btn-ghost flex items-center justify-center gap-1.5 text-xs py-1.5 cursor-pointer"
          onClick={() => setShowOptions((v) => !v)}
        >
          <span>{showOptions() ? "Hide options ▲" : "Customize card ▼"}</span>
        </button>

        {customizeDrawer()}

        <button
          type="button"
          class="btn-brand flex items-center justify-center gap-2 cursor-pointer"
          classList={{ "text-lg": !props.compact }}
          disabled={phase() !== "ready"}
          onClick={() => void share()}
        >
          <Share2 size={props.compact ? 17 : 20} />
          {phase() === "ready" ? "Share Card" : "Drawing…"}
        </button>
        <button
          type="button"
          class="btn-ghost flex items-center justify-center gap-2 text-sm cursor-pointer"
          disabled={phase() !== "ready"}
          onClick={download}
        >
          <Download size={16} />
          Save image
        </button>
      </div>
    </Show>
  );

  return (
    <div class="space-y-3 w-full">
      {/* Responsive layout: Top-stacked on mobile, side-by-side on desktop */}
      <div
        class="flex flex-col items-center sm:flex-row sm:items-start gap-4 text-center sm:text-left w-full"
        classList={{
          "sm:items-center": !props.compact,
        }}
      >
        <div class="shrink-0 flex justify-center w-full sm:w-auto">{preview()}</div>
        <div class="flex-1 w-full max-w-sm sm:max-w-none">{actions()}</div>
      </div>

      <Show when={note()}>
        <p class="text-center font-mono text-xs text-muted">{note()}</p>
      </Show>
      <Show when={phase() === "failed"}>
        <p class="text-center text-sm font-semibold text-muted">
          Your browser would not draw the card. A screenshot works just as well.
        </p>
      </Show>

      {/* ---------------- Live Camera Selfie Viewfinder Modal ---------------- */}
      <Show when={cameraActive()}>
        <div
          class="fixed inset-0 z-[70] flex flex-col items-center justify-between p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Take a selfie for your score card"
        >
          {/* Header */}
          <div class="w-full max-w-md flex items-center justify-between z-10 pt-2 px-2">
            <span class="text-white font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
              <Camera size={18} class="text-[var(--pop-yellow)]" />
              Frame Your Selfie
            </span>
            <button
              type="button"
              class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center cursor-pointer transition-colors"
              onClick={stopCamera}
              aria-label="Close camera"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Viewfinder Card Frame (Aspect Ratio Matched) */}
          <div class="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden border-3 border-[var(--pop-yellow)] shadow-2xl bg-neutral-900 flex items-center justify-center my-auto">
            <video
              ref={(el) => {
                videoRef = el;
                if (streamRef && el) {
                  el.srcObject = streamRef;
                  void el.play().catch(() => {});
                }
              }}
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
              classList={{
                "scale-x-[-1]": facingMode() === "user",
              }}
            />

            {/* Viewfinder Guidelines */}
            <div class="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-2xl flex items-center justify-center">
              <div class="w-3/4 h-3/4 rounded-full border border-dashed border-white/40" />
            </div>

            <Show when={cameraLoading()}>
              <div class="absolute inset-0 bg-black/70 grid place-items-center text-white">
                <p class="font-extrabold text-sm animate-pulse">Starting camera…</p>
              </div>
            </Show>

            <Show when={cameraError()}>
              <div class="absolute inset-0 bg-black/85 p-4 flex flex-col items-center justify-center text-center gap-3 text-white">
                <p class="font-bold text-sm text-[var(--pop-red)]">{cameraError()}</p>
                <label
                  for="card-photo-input"
                  class="btn-brand py-1.5 px-3 text-xs font-black cursor-pointer"
                  onClick={stopCamera}
                >
                  Upload Photo Instead
                </label>
              </div>
            </Show>
          </div>

          {/* Bottom Shutter & Controls */}
          <div class="w-full max-w-md flex items-center justify-around py-4 z-10">
            <button
              type="button"
              class="w-12 h-12 rounded-full bg-white/15 text-white grid place-items-center cursor-pointer hover:bg-white/25 active:scale-95 transition-all"
              onClick={flipCamera}
              title="Flip camera"
              aria-label="Flip camera"
            >
              <RefreshCw size={20} />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              class="w-18 h-18 rounded-full border-4 border-white bg-[var(--pop-yellow)] active:scale-90 hover:scale-105 transition-all grid place-items-center shadow-lg cursor-pointer"
              onClick={snapPhoto}
              disabled={cameraLoading() || !!cameraError()}
              title="Snap Selfie"
              aria-label="Snap photo"
            >
              <div class="w-14 h-14 rounded-full border-2 border-[var(--ink)] bg-[var(--pop-yellow)]" />
            </button>

            <button
              type="button"
              class="w-12 h-12 rounded-full bg-white/15 text-white grid place-items-center cursor-pointer hover:bg-white/25 active:scale-95 transition-all"
              onClick={stopCamera}
              title="Cancel"
            >
              <X size={20} />
            </button>
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
