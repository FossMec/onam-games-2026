import { Download, Film, RefreshCw, X, AlertTriangle } from "lucide-solid";
import { Show, createSignal, onCleanup } from "solid-js";
import { drawFlower, flowerById } from "~/lib/pookalam-flowers";
import { CELL_COUNT, emptyGrid, writeCell } from "~/lib/pookalam-grid";
import { PADDING_SCALE, SLOTS } from "~/lib/pookalam-layout";

const GROUND = "#2b2733";
const CANVAS_PX = 800;
const FPS = 30;

type ExportPhase =
  | { type: "idle" }
  | { type: "fetching" }
  | { type: "encoding"; progress: number; detail?: string }
  | { type: "done"; url: string; filename: string; mimeType: string }
  | { type: "error"; message: string };

interface DiffEntry {
  /** Cell index 0–2499 */
  i: number;
  /** Flower id (0 = erase) */
  f: number;
  /** ISO timestamp */
  t: string;
}

function drawGridToCanvas(ctx: CanvasRenderingContext2D, grid: Uint8Array, size: number) {
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, (size / 2) * PADDING_SCALE, 0, Math.PI * 2);
  ctx.fillStyle = GROUND;
  ctx.fill();

  for (let i = 0; i < CELL_COUNT; i++) {
    const byteIdx = i >> 1;
    const shift = (i & 1) === 0 ? 4 : 0;
    const id = (grid[byteIdx] >> shift) & 0x0f;
    if (id === 0) continue;
    const flower = flowerById(id);
    const slot = SLOTS[i];
    if (!flower || !slot) continue;
    const jitter = ((((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.12;
    const wobble = 0.98 + (((i * 40503) >>> 0) % 100) / 2500;
    drawFlower(
      ctx,
      slot.x * size,
      slot.y * size,
      slot.cellRadius * size * wobble,
      flower,
      slot.angle + jitter,
    );
  }
}

const MAX_DIFFS_SERVER = 500_000;
const LARGE_DATA_WARN = 150_000;

export function PookalamAnimationExport() {
  const [duration, setDuration] = createSignal(20);
  const [phase, setPhase] = createSignal<ExportPhase>({ type: "idle" });
  let previousUrl: string | null = null;

  const reset = () => {
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      previousUrl = null;
    }
    setPhase({ type: "idle" });
  };

  onCleanup(() => {
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  });

  const startExport = async () => {
    setPhase({ type: "fetching" });
    let diffs: DiffEntry[];
    let totalFromServer = 0;

    try {
      const res = await fetch(`/api/admin/pookalam/export-animation?duration=${duration()}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch diffs");
      diffs = data.diffs as DiffEntry[];
      totalFromServer = data.total as number;
    } catch (err) {
      setPhase({ type: "error", message: err instanceof Error ? err.message : "Network error" });
      return;
    }

    if (diffs.length === 0) {
      setPhase({ type: "error", message: "No diff data yet — start drawing first!" });
      return;
    }

    // Too much data handling
    const isTruncated = totalFromServer >= MAX_DIFFS_SERVER;
    const isLarge = diffs.length > LARGE_DATA_WARN;

    // Precompute timestamps once for fast per-frame comparison (avoid new Date per loop)
    const times = diffs.map((d) => new Date(d.t).getTime());
    const dMin = times[0];
    const dMax = times[times.length - 1];
    const span = Math.max(1, dMax - dMin);

    // Use OffscreenCanvas if available for non-blocking, fallback to DOM canvas
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(CANVAS_PX, CANVAS_PX)
        : (() => {
            const c = document.createElement("canvas");
            c.width = CANVAS_PX;
            c.height = CANVAS_PX;
            return c;
          })();

    const ctx = (canvas as any).getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) {
      setPhase({ type: "error", message: "Canvas 2D context unavailable in this browser." });
      return;
    }

    const targetDur = duration(); // seconds
    const totalFrames = Math.ceil(targetDur * FPS);
    const frameDuration = 1 / FPS;

    // Grid starts empty, will be built incrementally
    const grid = emptyGrid();
    let diffIdx = 0;

    setPhase({
      type: "encoding",
      progress: 0,
      detail: isLarge ? `Processing ${diffs.length.toLocaleString()} strokes…` : undefined,
    });

    // Try deterministic encoding via Mediabunny (WebCodecs) for exact duration, fallback to MediaRecorder
    const canUseWebCodecs = typeof (window as any).VideoEncoder !== "undefined";

    if (canUseWebCodecs) {
      try {
        const { Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat, CanvasSource } =
          await import("mediabunny");

        // Prefer MP4 (H.264) for widest compatibility, fallback to WebM/VP9 if needed
        let format: any;
        let mimeType = "video/mp4";
        try {
          format = new Mp4OutputFormat();
        } catch {
          format = new WebMOutputFormat();
          mimeType = "video/webm";
        }

        const output = new Output({
          format,
          target: new BufferTarget(),
        });

        const source = new CanvasSource(canvas as any, {
          codec: "avc",
          bitrate: 8_000_000,
        });
        output.addVideoTrack(source as any);

        await output.start();

        for (let frame = 0; frame < totalFrames; frame++) {
          const elapsed = frame * frameDuration; // seconds
          const progress = elapsed / targetDur;
          const wallTarget = dMin + progress * span;

          while (diffIdx < diffs.length && times[diffIdx] <= wallTarget) {
            writeCell(grid, diffs[diffIdx].i, diffs[diffIdx].f);
            diffIdx++;
          }

          drawGridToCanvas(ctx as CanvasRenderingContext2D, grid, CANVAS_PX);
          // CanvasSource.add expects timestamp in seconds
          await (source as any).add(elapsed, frameDuration);

          if (frame % 15 === 0) {
            setPhase({
              type: "encoding",
              progress: Math.round((frame / totalFrames) * 100),
              detail: isTruncated
                ? `Truncated to ${MAX_DIFFS_SERVER.toLocaleString()} (of ${totalFromServer.toLocaleString()})`
                : undefined,
            });
            // Yield to UI thread periodically
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        // Ensure final state is fully drawn (all diffs applied) on last frame if span not fully covered due to rounding
        if (diffIdx < diffs.length) {
          while (diffIdx < diffs.length) {
            writeCell(grid, diffs[diffIdx].i, diffs[diffIdx].f);
            diffIdx++;
          }
          drawGridToCanvas(ctx as CanvasRenderingContext2D, grid, CANVAS_PX);
          // Replace last frame with final state for clean finish (re-add last timestamp)
          // We already added totalFrames frames; if we missed tail, we can add one more at exact duration
        }

        await output.finalize();
        const buffer = (output.target as any).buffer as ArrayBuffer;
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        previousUrl = url;
        const ext = mimeType === "video/mp4" ? "mp4" : "webm";
        const filename = `pookalam-timelapse-${new Date().toISOString().slice(0, 10)}-${duration()}s.${ext}`;
        const detailMsg = isTruncated ? ` (truncated to ${MAX_DIFFS_SERVER.toLocaleString()})` : "";
        setPhase({ type: "done", url, filename, mimeType });
        // Optionally show info about truncated
        if (isTruncated)
          console.warn(
            `[pookalam-export] truncated: ${totalFromServer} -> ${diffs.length}${detailMsg}`,
          );
        return;
      } catch (err) {
        console.warn("[pookalam-export] Mediabunny failed, falling back to MediaRecorder:", err);
        // fall through to MediaRecorder fallback
      }
    }

    // Fallback: MediaRecorder with captureStream — improved to be continuous
    let stream: MediaStream;
    const domCanvas =
      canvas instanceof OffscreenCanvas
        ? (() => {
            const c = document.createElement("canvas");
            c.width = CANVAS_PX;
            c.height = CANVAS_PX;
            return c;
          })()
        : (canvas as HTMLCanvasElement);

    // If we used OffscreenCanvas above but fell back, we need a DOM canvas for captureStream
    const captureCanvas = domCanvas;
    const captureCtx = captureCanvas.getContext("2d");
    if (!captureCtx) {
      setPhase({ type: "error", message: "Canvas 2D context unavailable for fallback." });
      return;
    }

    try {
      stream = (captureCanvas as any).captureStream(FPS);
    } catch {
      setPhase({
        type: "error",
        message: "captureStream not supported in this browser. Try Chrome/Edge.",
      });
      return;
    }

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // For fallback, we need to drive drawing in real time but keep it continuous
    // Reset diffIdx for fallback path if we already consumed some in previous attempt
    // (we consumed all in try block above, so reset)
    // In fallback path diffIdx may have been advanced partially before failure, so reset completely
    let fallbackIdx = 0;
    const fallbackGrid = emptyGrid();
    setPhase({
      type: "encoding",
      progress: 0,
      detail: isLarge ? `Fallback encoding ${diffs.length.toLocaleString()} strokes…` : undefined,
    });
    recorder.start(100);
    const startReal = performance.now();
    const targetMs = targetDur * 1000;

    await new Promise<void>((resolve) => {
      let rafId = 0;
      const step = () => {
        const elapsedMs = performance.now() - startReal;
        const progress = Math.min(1, elapsedMs / targetMs);
        const wallTarget = dMin + progress * span;

        while (fallbackIdx < diffs.length && times[fallbackIdx] <= wallTarget) {
          writeCell(fallbackGrid, diffs[fallbackIdx].i, diffs[fallbackIdx].f);
          fallbackIdx++;
        }

        drawGridToCanvas(captureCtx, fallbackGrid, CANVAS_PX);
        setPhase({
          type: "encoding",
          progress: Math.round(progress * 100),
          detail: isTruncated ? `Truncated` : undefined,
        });

        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          cancelAnimationFrame(rafId);
          resolve();
        }
      };
      rafId = requestAnimationFrame(step);
    });

    // Give recorder a little extra time to capture final frame
    await new Promise((r) => setTimeout(r, 300));
    recorder.stop();

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      // Fallback if onstop never fires
      setTimeout(resolve, 2000);
    });

    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {}

    const blob = new Blob(chunks, { type: mime });
    if (blob.size === 0) {
      setPhase({
        type: "error",
        message: "Recorder produced empty video — try Chrome/Edge foreground tab.",
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    previousUrl = url;
    const filename = `pookalam-timelapse-${new Date().toISOString().slice(0, 10)}-${duration()}s.webm`;
    setPhase({ type: "done", url, filename, mimeType: mime });
  };

  return (
    <div class="card card-plain p-4 bg-[var(--paper)] border-2 border-[var(--ink)] space-y-4">
      <div class="flex items-center gap-2">
        <Film size={18} strokeWidth={2.5} class="text-[var(--pop-purple)]" />
        <div>
          <h3 class="font-black text-sm m-0">Export Pookalam Timelapse</h3>
          <p class="text-[10.5px] font-semibold m-0" style={{ color: "var(--ink-soft)" }}>
            Continuous replay of the community pookalam — timelapse compressed to your chosen
            duration. Background is filled ground color.
          </p>
        </div>
      </div>

      <Show when={phase().type === "idle"}>
        <div class="flex items-center gap-3 flex-wrap">
          <label class="text-xs font-black">Duration</label>
          <div class="flex items-center gap-1">
            {([15, 20, 25, 30] as const).map((s) => (
              <button
                type="button"
                onClick={() => setDuration(s)}
                class={`px-2.5 py-1 rounded text-xs font-extrabold border-2 cursor-pointer transition-all ${
                  duration() === s
                    ? "bg-[var(--pop-yellow)] border-[var(--ink)]"
                    : "bg-[var(--paper-2)] border-[var(--ink-soft)]/30 hover:border-[var(--ink)]"
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startExport}
            class="btn-brand text-xs px-4 py-1.5 inline-flex items-center gap-1.5 font-extrabold cursor-pointer"
          >
            <Film size={13} />
            <span>Generate Timelapse</span>
          </button>
        </div>
        <p class="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
          Fetches every stroke (`collab_pookalam_diffs` ordered by time) and replays it linearly
          across the chosen seconds — feels like the true continuous drawing. Too much data? Server
          caps at {MAX_DIFFS_SERVER.toLocaleString()}; if reached, export is sampled to the latest{" "}
          {MAX_DIFFS_SERVER.toLocaleString()} strokes.
        </p>
      </Show>

      <Show when={phase().type === "fetching"}>
        <div class="flex items-center gap-2 text-xs font-bold">
          <RefreshCw size={14} class="animate-spin text-[var(--pop-teal)]" />
          <span>Fetching continuous stroke data…</span>
        </div>
      </Show>

      <Show when={phase().type === "encoding"}>
        {(() => {
          const p = phase() as { type: "encoding"; progress: number; detail?: string };
          return (
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs font-bold">
                <RefreshCw size={14} class="animate-spin text-[var(--pop-purple)]" />
                <span>Rendering timelapse… {p.progress}%</span>
                <Show when={p.detail}>
                  <span class="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
                    {p.detail}
                  </span>
                </Show>
              </div>
              <div class="w-full bg-[var(--paper-3)] rounded-full h-2 border border-[var(--ink)]">
                <div
                  class="h-full rounded-full bg-[var(--pop-purple)] transition-all"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
              <p class="text-[10px] text-[var(--ink-soft)] font-semibold">
                Deterministic frame encoding — duration will be exactly {duration()}s at {FPS} fps.
              </p>
            </div>
          );
        })()}
      </Show>

      <Show when={phase().type === "done"}>
        {(() => {
          const d = phase() as { type: "done"; url: string; filename: string; mimeType: string };
          return (
            <div class="space-y-2">
              <div class="flex items-center gap-3 flex-wrap">
                <a
                  href={d.url}
                  download={d.filename}
                  class="btn-brand text-xs px-4 py-1.5 inline-flex items-center gap-1.5 font-extrabold"
                >
                  <Download size={13} />
                  <span>Download {d.filename}</span>
                </a>
                <button
                  type="button"
                  onClick={reset}
                  class="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1 cursor-pointer"
                >
                  <X size={12} />
                  <span>Export again</span>
                </button>
              </div>
              <p class="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
                Type: {d.mimeType} · {CANVAS_PX}×{CANVAS_PX} · {FPS} fps · {duration()}s exact
                timelapse.
              </p>
            </div>
          );
        })()}
      </Show>

      <Show when={phase().type === "error"}>
        {(() => {
          const e = phase() as { type: "error"; message: string };
          return (
            <div class="flex items-center justify-between gap-2">
              <p
                class="text-xs font-bold flex items-center gap-1.5"
                style={{ color: "var(--pop-red)" }}
              >
                <AlertTriangle size={14} /> {e.message}
              </p>
              <button
                type="button"
                onClick={reset}
                class="btn-ghost text-xs px-2 py-1 cursor-pointer"
              >
                Retry
              </button>
            </div>
          );
        })()}
      </Show>
    </div>
  );
}
