import { SpriteIcon } from "~/components/art/SpriteIcon";

/**
 * The last net under every page.
 *
 * Server reads that only decorate a page already degrade instead of throwing
 * (see `readOrDegrade`), so this should stay unused. It exists because the one
 * failure mode worth spending a component on is the one where a single throw
 * inside `Suspense` escapes hydration and leaves the visitor a blank white
 * document — no header, no footer, no way back. A boundary turns that into a
 * page with an exit.
 *
 * It replaces the route only: the navigation and the footer live outside it.
 */
export function AppError(props: { reset: () => void }) {
  return (
    <main class="container py-16">
      <div class="card pop-red mx-auto max-w-lg space-y-4 text-center">
        <div class="flex justify-center">
          <SpriteIcon name="tux-king" size={56} animate="wobble" alt="" />
        </div>
        <h1 class="text-2xl">Something broke on our side</h1>
        <p class="font-semibold leading-relaxed">
          This page could not be put together. It is almost certainly temporary — the rest of the
          festival is still standing.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button type="button" class="btn-brand cursor-pointer" onClick={() => props.reset()}>
            Try again
          </button>
          <a href="/" class="btn-ghost">
            Back to the front page
          </a>
        </div>
        <p class="comment">segfault in the sadya. reheating.</p>
      </div>
    </main>
  );
}
