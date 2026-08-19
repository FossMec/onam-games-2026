import { Braces, Copy, Download, Eye, Sparkles, X } from "lucide-solid";
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";

import { SpriteIcon } from "~/components/art/SpriteIcon";
import { sandboxDocument } from "~/lib/pookalam-sandbox-doc";
import { SHOWCASE_SNIPPET } from "~/lib/pookalam-showcase";

/**
 * "Show me what's possible", between the fourth ring and the git stop.
 *
 * At that point on the road somebody has four rings of ellipses and no idea
 * whether that is the ceiling. Showing them a finished pookalam *with its
 * source next to it* answers the question honestly: it is ninety lines of the
 * same three moves they already know, not a different skill.
 *
 * Deliberately a popup rather than another card. It is a detour, not a stop -
 * nobody has to do anything with it, and the road should not grow a tenth
 * milestone for a thing you only look at.
 */
export function PookalamShowcase() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      {/* Tilted, because it is a hand-painted signboard nailed to a road, not a
          form control that happens to be in the way. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="btn-accent inline-flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm"
        style={{ transform: "rotate(-1.5deg)" }}
      >
        <Sparkles size={16} strokeWidth={2.5} />
        <span>Show me what's possible</span>
      </button>

      {/* Through a portal, always. This button is planted on the road, and the
          road leg positions it with a transform - a transformed ancestor
          becomes the containing block for `position: fixed`, so without the
          portal the dialog opens *inside* a 96px-tall strip of tarmac. */}
      <Show when={open()}>
        <Portal>
          <ShowcaseDialog onClose={() => setOpen(false)} />
        </Portal>
      </Show>
    </>
  );
}

function ShowcaseDialog(props: { onClose: () => void }) {
  const [tab, setTab] = createSignal<"result" | "code">("result");
  const [copied, setCopied] = createSignal(false);

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

  const copy = () => {
    void navigator.clipboard.writeText(SHOWCASE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadShowcaseTemplate = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Code-a-Pookalam</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #fbf3e4;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1.5rem;
    }
    h1 { margin-bottom: 0.5rem; color: #22202b; font-size: 1.5rem; font-weight: 900; }
    p { margin-bottom: 1.25rem; color: #555; font-size: 0.9rem; max-width: 600px; text-align: center; }
    canvas {
      background: #181511;
      border: 4px solid #22202b;
      border-radius: 8px;
      max-width: 90vw;
      max-height: 90vw;
      aspect-ratio: 1 / 1;
    }
    .controls { margin-top: 1.25rem; display: flex; gap: 0.75rem; }
    button {
      padding: 0.6rem 1.25rem;
      font-weight: 900;
      font-size: 0.9rem;
      background: #f5c443;
      color: #22202b;
      border: 3px solid #22202b;
      border-radius: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>🌸 My Code-a-Pookalam</h1>
  <p>Open this file in any browser or editor. Customize the rings and geometry to make it your own!</p>
  <canvas id="pookalam" width="1024" height="1024"></canvas>
  <div class="controls">
    <button onclick="downloadRender()">Download Square PNG (1024×1024)</button>
  </div>
  <script>
    const canvas = document.getElementById("pookalam");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

${SHOWCASE_SNIPPET}

    function downloadRender() {
      const link = document.createElement("a");
      link.download = "my-pookalam-1024.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  </script>
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-3 sm:p-4"
      style={{ background: "rgb(34 32 43 / 0.8)" }}
      role="dialog"
      aria-modal="true"
      aria-label="What a coded pookalam can look like"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="card pop-purple relative my-auto w-full max-w-3xl space-y-3">
        <button
          type="button"
          class="absolute right-3 top-3 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full"
          style={{ background: "var(--paper-2)", border: "var(--ink-w) solid var(--ink)" }}
          onClick={props.onClose}
          aria-label="Close"
        >
          <X size={16} strokeWidth={3} />
        </button>

        <div class="space-y-1 pr-10">
          <div class="flex items-center gap-2">
            <SpriteIcon name="concentric-pookalam" size={26} animate="float" interactive />
            <h2 class="m-0 font-display text-lg font-black sm:text-xl">
              This is the same code, just more of it
            </h2>
          </div>
          <p class="m-0 text-sm font-semibold leading-relaxed">
            No new tricks below - four small functions, then a list of "draw a ring" lines. Every
            one of them is the loop you already wrote, with different numbers.
          </p>
        </div>

        {/* tabs */}
        <div class="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("result")}
            class={`btn-ghost min-h-0 gap-1.5 px-3 py-1.5 text-xs ${tab() === "result" ? "font-black" : ""}`}
            style={tab() === "result" ? { background: "var(--pop-yellow)" } : undefined}
          >
            <Eye size={13} />
            <span>The pookalam</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            class={`btn-ghost min-h-0 gap-1.5 px-3 py-1.5 text-xs ${tab() === "code" ? "font-black" : ""}`}
            style={tab() === "code" ? { background: "var(--pop-yellow)" } : undefined}
          >
            <Braces size={13} />
            <span>The code that made it</span>
          </button>
        </div>

        <Show
          when={tab() === "result"}
          fallback={
            <div class="space-y-2">
              {/* Scrollable, and capped so the dialog never grows taller than
                  the screen - the whole point is that it is long. */}
              <pre
                class="inked select-text overflow-auto rounded bg-[#181511] p-3 font-mono text-[12px] leading-relaxed text-[#fbf3e4]"
                style={{ "max-height": "60vh" }}
              >
                <code>{SHOWCASE_SNIPPET}</code>
              </pre>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  class="btn-accent min-h-0 gap-1.5 px-3 py-2 text-xs"
                >
                  <Copy size={12} />
                  <span>{copied() ? "Copied - paste it into your own file" : "Copy the code"}</span>
                </button>
                <span class="comment text-sm">
                  ninety lines. you have written a third of it already.
                </span>
              </div>
            </div>
          }
        >
          <div class="space-y-2">
            <iframe
              title="A finished coded pookalam"
              sandbox="allow-scripts"
              referrerpolicy="no-referrer"
              srcdoc={sandboxDocument(SHOWCASE_SNIPPET, 0, 640)}
              class="inked mx-auto block w-full max-w-[26rem] rounded"
              style={{ "aspect-ratio": "1 / 1", background: "#181511", border: "none" }}
            />
            <p class="comment m-0 text-center text-sm">
              rings, dots, triangles, one lamp. that is the entire vocabulary.
            </p>
          </div>
        </Show>

        <p
          class="m-0 rounded p-2.5 text-xs font-semibold leading-relaxed"
          style={{ border: "var(--ink-w) dashed var(--ink)", background: "var(--paper-3)" }}
        >
          <span class="font-black uppercase tracking-wide">Still not an entry. </span>
          Everyone on this page can copy this one, so it scores nothing on originality. Read it,
          take the parts you like, and build a pookalam that is yours.
        </p>

        {/* Download starter index.html template */}
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-[var(--ink)]/10">
          <p class="m-0 text-xs font-semibold text-muted">
            Struggling to start from a blank canvas? Download this starter{" "}
            <code class="font-mono bg-[var(--paper-2)] px-1 py-0.5 rounded border border-[var(--ink)]">
              index.html
            </code>{" "}
            template as a foundation, and build your own custom artwork on top of it.
          </p>
          <button
            type="button"
            onClick={downloadShowcaseTemplate}
            class="btn-ghost min-h-0 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Download size={13} />
            <span>Download starter index.html</span>
          </button>
        </div>
      </div>
    </div>
  );
}
