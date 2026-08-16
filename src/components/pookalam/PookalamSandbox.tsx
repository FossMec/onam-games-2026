import { Play, RotateCcw, TriangleAlert } from "lucide-solid";
import { For, type JSX, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

/**
 * A tiny canvas playground that runs the stop's snippet.
 *
 * Reading code teaches nobody anything. Changing one number, pressing run and
 * watching twelve petals become sixty is the moment the loop stops being
 * abstract - so every drawing stop on the road ships with its snippet already
 * running, editable, and impossible to break permanently (Reset is one tap).
 *
 * The code runs inside a sandboxed iframe rather than in the page, and that is
 * not paranoia about the visitor: canvas tutorials are full of
 * `document.body.prepend(canvas)`, so the first version of this ran exactly
 * that and stapled a 400px canvas above the site header. In here, a snippet
 * that reaches for `document` gets the iframe's own document and wrecks
 * nothing. `allow-scripts` without `allow-same-origin` means it cannot read or
 * touch this page at all - errors come back over postMessage.
 *
 * It is deliberately not a submission tool. The snippets are teaching-sized and
 * everybody gets the same ones, so a tweaked copy scores nothing on originality
 * or craft - which the note under the canvas says out loud rather than leaving
 * somebody to discover it on judging day.
 */

const SIZE = 360;

/**
 * The page that runs inside the iframe. `ctx`, `W` and `H` are handed in.
 *
 * The snippet goes in as a JSON string literal with `<` escaped as well:
 * `JSON.stringify` alone passes `</script>` straight through, and typed text
 * that closes the tag becomes markup. The iframe is sandboxed so that would
 * wreck nothing outside it, but a playground that can be confused by its own
 * input is not one to leave standing.
 */
function sandboxDocument(code: string): string {
  const literal = JSON.stringify(code).replace(/</g, "\\u003c");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#181511">
    <canvas id="pookalam" width="${SIZE}" height="${SIZE}" style="display:block;width:100%;height:auto"></canvas>
    <script>
      const c = document.getElementById("pookalam");
      const ctx = c.getContext("2d");
      const W = ${SIZE}, H = ${SIZE};
      try {
        eval(${literal});
      } catch (e) {
        parent.postMessage(
          { pookalamSandboxError: String((e && e.message) || e).slice(0, 300) },
          "*",
        );
      }
    </script>
  </body>
</html>`;
}

/**
 * Colouring, from one regex.
 *
 * A real tokeniser (or a highlighting library) is a lot of weight for four
 * kinds of token in a five-line snippet. Comments, strings, numbers and the
 * handful of keywords these snippets use are the whole job, and getting them
 * coloured is what makes the editor read as code rather than as a form field.
 */
const TOKENS =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(const|let|var|for|of|in|if|else|while|function|return|new)\b|\b(\d+(?:\.\d+)?)\b|\b(Math|ctx|W|H)\b/g;

const TOKEN_COLOUR = ["#8d8898", "#7fd6bd", "#e9a8c6", "#f5c443", "#9fc0ff"];

type Piece = { text: string; colour?: string };

function highlight(code: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;

  for (const match of code.matchAll(TOKENS)) {
    const at = match.index ?? 0;
    if (at > last) pieces.push({ text: code.slice(last, at) });
    // Group 1..5 map to TOKEN_COLOUR in order; exactly one of them matched.
    const group = match.slice(1).findIndex((g) => g !== undefined);
    pieces.push({ text: match[0], colour: TOKEN_COLOUR[group] });
    last = at + match[0].length;
  }
  if (last < code.length) pieces.push({ text: code.slice(last) });

  return pieces;
}

/**
 * `intro` is the stop's steps, handed in so they can share the left column
 * with the editor. The canvas then sits beside them at the top of the card
 * instead of underneath, which is where the empty space was.
 */
export function PookalamSandbox(props: { snippet: string; intro?: JSX.Element }) {
  const [code, setCode] = createSignal(props.snippet);
  const [doc, setDoc] = createSignal(sandboxDocument(props.snippet));
  const [error, setError] = createSignal<string | null>(null);

  const pieces = createMemo(() => highlight(code()));

  const run = () => {
    setError(null);
    setDoc(sandboxDocument(code()));
  };

  const reset = () => {
    setCode(props.snippet);
    setError(null);
    setDoc(sandboxDocument(props.snippet));
  };

  onMount(() => {
    const onMessage = (event: MessageEvent) => {
      // Only from a sandboxed frame - one without `allow-same-origin` always
      // posts with a null origin, so anything with a real origin is somebody
      // else's message and none of our business. The payload is rendered as
      // text and capped at 300 characters either way.
      if (event.origin !== "null") return;
      const data = event.data as { pookalamSandboxError?: unknown } | null;
      if (data && typeof data.pookalamSandboxError === "string") {
        setError(data.pookalamSandboxError.slice(0, 300));
      }
    };
    window.addEventListener("message", onMessage);
    onCleanup(() => window.removeEventListener("message", onMessage));
  });

  return (
    <div class="space-y-2">
      <div class="grid items-start gap-3 sm:grid-cols-[1.4fr_1fr]">
        {/* the steps and the editor: a highlighted copy underneath, a
            see-through textarea on top. Both use identical type and wrapping so
            the caret lands where the glyphs are. */}
        <div class="space-y-3">
          <Show when={props.intro}>{props.intro}</Show>

          <div class="inked relative overflow-hidden rounded bg-[#181511]">
            <pre
              aria-hidden="true"
              class="pointer-events-none m-0 whitespace-pre-wrap break-words p-3 font-mono text-[13px] leading-relaxed"
              style={{ "min-height": "12rem" }}
            >
              <For each={pieces()}>
                {(piece) => <span style={{ color: piece.colour ?? "#fbf3e4" }}>{piece.text}</span>}
              </For>
            </pre>
            <textarea
              class="absolute inset-0 block h-full w-full resize-none whitespace-pre-wrap break-words bg-transparent p-3 font-mono text-[13px] leading-relaxed text-transparent caret-[#f5c443] outline-none"
              spellcheck={false}
              autocapitalize="off"
              autocorrect="off"
              value={code()}
              onInput={(e) => setCode(e.currentTarget.value)}
              aria-label="Editable pookalam code"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onClick={run} class="btn-accent min-h-0 gap-2 px-3 py-2 text-sm">
              <Play size={15} strokeWidth={3} />
              <span>Run it</span>
            </button>
            <button
              type="button"
              onClick={reset}
              class="btn-ghost min-h-0 gap-1.5 px-3 py-2 text-sm"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
            <span class="text-xs font-bold text-muted">change any number, then run</span>
          </div>
        </div>

        {/* the result, pinned to the top of the column so it fills the space
            beside the steps and stays in view while you scroll the editor */}
        <div class="space-y-2 sm:sticky sm:top-24">
          <iframe
            title="Your pookalam code, running"
            // `allow-scripts` and nothing else. Without `allow-same-origin` the
            // frame gets an opaque origin: no reading this page, no cookies, no
            // localStorage, no top-level navigation, no popups, no form posts.
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            loading="lazy"
            srcdoc={doc()}
            class="inked mx-auto block w-full max-w-[20rem] rounded"
            style={{ "aspect-ratio": "1 / 1", background: "#181511", border: "none" }}
          />
          <p class="comment m-0 text-center text-sm sm:text-left">your code, running. right now.</p>

          <Show when={error()}>
            <p
              class="m-0 flex items-start gap-1.5 rounded p-2 font-mono text-xs font-bold"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--pop-red)",
                color: "var(--ink)",
              }}
            >
              <TriangleAlert size={14} class="mt-0.5 shrink-0" />
              <span>{error()}</span>
            </p>
          </Show>
        </div>
      </div>

      <p
        class="m-0 rounded p-2.5 text-xs font-semibold leading-relaxed"
        style={{ border: "var(--ink-w) dashed var(--ink)", background: "var(--paper-3)" }}
      >
        <span class="font-black uppercase tracking-wide">This box is for learning. </span>
        Everyone on this page gets the same snippet, so a tweaked copy is not an entry - it scores
        nothing on originality or craft, two of the five things judges weigh. Take the idea, build
        your own in your own repo, with your own motifs.
      </p>
    </div>
  );
}
