import { Download, Film, RefreshCw, X } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { drawFlower, flowerById } from "~/lib/pookalam-flowers";
import { CELL_COUNT, emptyGrid, writeCell } from "~/lib/pookalam-grid";
import { PADDING_SCALE, SLOTS } from "~/lib/pookalam-layout";

const GROUND = "#2b2733";
const CANVAS_PX = 800;
const FPS = 30;

type ExportPhase =
  | { type: "idle" }
  | { type: "fetching" }
  | { type: "encoding"; progress: number }
  | { type: "done"; url: string; filename: string }
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
  // Transparent background — callers set fillStyle before this if needed
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, (size / 2) * PADDING_SCALE, 0, Math.PI * 2);
  ctx.fillStyle = GROUND;
  ctx.fill();

  for (let i = 0; i < CELL_COUNT; i++) {
    // Read nibble from packed array
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

export function PookalamAnimationExport() {
  const [duration, setDuration] = createSignal(20);
  const [phase, setPhase] = createSignal<ExportPhase>({ type: "idle" });

  const reset = () => setPhase({ type: "idle" });

  const startExport = async () => {
    setPhase({ type: "fetching" });
    let diffs: DiffEntry[];

    try {
      const res = await fetch(`/api/admin/pookalam/export-animation?duration=${duration()}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch diffs");
      diffs = data.diffs as DiffEntry[];
    } catch (err) {
      setPhase({ type: "error", message: err instanceof Error ? err.message : "Network error" });
      return;
    }

    if (diffs.length === 0) {
      setPhase({ type: "error", message: "No diff data yet — start drawing first!" });
      return;
    }

    // Set up off-screen canvas
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_PX;
    canvas.height = CANVAS_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setPhase({ type: "error", message: "Canvas 2D context unavailable in this browser." });
      return;
    }

    // Encode using MediaRecorder + captureStream
    let stream: MediaStream;
    try {
      stream = (canvas as any).captureStream(FPS);
    } catch {
      setPhase({ type: "error", message: "captureStream not supported in this browser." });
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

    const targetDur = duration() * 1000; // ms
    const grid = emptyGrid();
    const dMin = new Date(diffs[0].t).getTime();
    const dMax = new Date(diffs[diffs.length - 1].t).getTime();
    const span = Math.max(1, dMax - dMin);

    setPhase({ type: "encoding", progress: 0 });
    recorder.start(100);

    const frameMs = 1000 / FPS;
    const totalFrames = Math.ceil((targetDur / 1000) * FPS);
    let diffIdx = 0;

    await new Promise<void>((resolve) => {
      let frame = 0;
      const step = () => {
        if (frame >= totalFrames) {
          resolve();
          return;
        }
        const elapsed = (frame / totalFrames) * targetDur; // ms into animation
        const wallTarget = dMin + (elapsed / targetDur) * span;

        // Apply all diffs up to this wall-clock target
        while (diffIdx < diffs.length) {
          const d = diffs[diffIdx];
          if (new Date(d.t).getTime() > wallTarget) break;
          writeCell(grid, d.i, d.f);
          diffIdx++;
        }

        drawGridToCanvas(ctx, grid, CANVAS_PX);
        setPhase({ type: "encoding", progress: Math.round((frame / totalFrames) * 100) });
        frame++;
        setTimeout(step, frameMs);
      };
      step();
    });

    recorder.stop();

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const filename = `pookalam-animation-${new Date().toISOString().slice(0, 10)}.webm`;
    setPhase({ type: "done", url, filename });
  };

  return (
    <div class="card card-plain p-4 bg-[var(--paper)] border-2 border-[var(--ink)] space-y-4">
      <div class="flex items-center gap-2">
        <Film size={18} strokeWidth={2.5} class="text-[var(--pop-purple)]" />
        <div>
          <h3 class="font-black text-sm m-0">Export Pookalam Animation</h3>
          <p class="text-[10.5px] font-semibold m-0" style={{ color: "var(--ink-soft)" }}>
            Replay the entire community pookalam growth as a WebM video with transparent-style
            background.
          </p>
        </div>
      </div>

      {/* Duration selector */}
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
            <span>Generate Video</span>
          </button>
        </div>
      </Show>

      {/* Fetching */}
      <Show when={phase().type === "fetching"}>
        <div class="flex items-center gap-2 text-xs font-bold">
          <RefreshCw size={14} class="animate-spin text-[var(--pop-teal)]" />
          <span>Fetching diff data from server…</span>
        </div>
      </Show>

      {/* Encoding */}
      <Show when={phase().type === "encoding"}>
        {(() => {
          const p = (phase() as { type: "encoding"; progress: number }).progress;
          return (
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs font-bold">
                <RefreshCw size={14} class="animate-spin text-[var(--pop-purple)]" />
                <span>Rendering animation… {p}%</span>
              </div>
              <div class="w-full bg-[var(--paper-3)] rounded-full h-2 border border-[var(--ink)]">
                <div
                  class="h-full rounded-full bg-[var(--pop-purple)] transition-all"
                  style={{ width: `${p}%` }}
                />
              </div>
              <p class="text-[10px] text-[var(--ink-soft)] font-semibold">
                This runs entirely in your browser — keep this tab in the foreground.
              </p>
            </div>
          );
        })()}
      </Show>

      {/* Done */}
      <Show when={phase().type === "done"}>
        {(() => {
          const d = phase() as { type: "done"; url: string; filename: string };
          return (
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
          );
        })()}
      </Show>

      {/* Error */}
      <Show when={phase().type === "error"}>
        {(() => {
          const e = phase() as { type: "error"; message: string };
          return (
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-bold text-[var(--pop-red)]">{e.message}</p>
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
