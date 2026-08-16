import { Show, createEffect } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";

/**
 * The last net under every page.
 *
 * A boundary turns uncaught runtime errors into a helpful recovery page with an exit.
 */
export function AppError(props: { error?: unknown; reset: () => void }) {
  createEffect(() => {
    if (props.error) {
      console.error("[AppError] Uncaught error caught by root ErrorBoundary:", props.error);
    }
  });

  const message = () => {
    if (!props.error) return null;
    if (props.error instanceof Error) return props.error.message;
    if (typeof props.error === "string") return props.error;
    try {
      return JSON.stringify(props.error);
    } catch {
      return "Unknown application error";
    }
  };

  const stack = () => {
    if (props.error instanceof Error && props.error.stack) {
      return props.error.stack;
    }
    return null;
  };

  return (
    <main class="container py-16">
      <div class="card pop-red mx-auto max-w-lg space-y-4 text-center">
        <div class="flex justify-center">
          <SpriteIcon name="tux-king" size={56} animate="wobble" alt="" />
        </div>
        <h1 class="text-2xl font-black text-[var(--ink)]">Something broke on our side</h1>
        <p class="font-semibold leading-relaxed text-sm">
          This page could not be loaded properly. It is almost certainly temporary - the rest of the
          festival is still standing.
        </p>

        <Show when={message()}>
          <div class="text-left bg-[var(--paper)] p-3 rounded-lg border-2 border-[var(--ink)] space-y-1">
            <p class="text-xs font-black text-[var(--pop-red)]">Error details:</p>
            <p class="text-xs font-mono break-words">{message()}</p>
            <Show when={stack()}>
              <details class="pt-1">
                <summary class="text-[10px] font-bold text-[var(--ink-soft)] cursor-pointer select-none">
                  Stack trace
                </summary>
                <pre class="mt-1 text-[10px] font-mono whitespace-pre-wrap break-all opacity-75 max-h-40 overflow-y-auto">
                  {stack()}
                </pre>
              </details>
            </Show>
          </div>
        </Show>

        <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button type="button" class="btn-brand cursor-pointer" onClick={() => props.reset()}>
            Try again
          </button>
          <a href="/" class="btn-ghost">
            Back to the front page
          </a>
        </div>
        <p class="comment text-xs">segfault in the sadya. reheating.</p>
      </div>
    </main>
  );
}
