import { Title } from "@solidjs/meta";
import { BookOpen, ChevronLeft, ChevronRight, Layers, Send, Sparkles, X } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";

interface ComicBook {
  id: number;
  tag: string;
  tagColor: string;
  leftImage: string;
  rightImage: string;
  fullImage: string;
}

const COMIC_BOOKS: ComicBook[] = [
  {
    id: 1,
    tag: "Issue #1",
    tagColor: "var(--pop-yellow)",
    leftImage: "/images/comics/comic-1-left.webp",
    rightImage: "/images/comics/comic-1-right.webp",
    fullImage: "/images/comics/comic-1.webp",
  },
  {
    id: 2,
    tag: "Issue #2",
    tagColor: "var(--pop-teal)",
    leftImage: "/images/comics/comic-2-left.webp",
    rightImage: "/images/comics/comic-2-right.webp",
    fullImage: "/images/comics/comic-2.webp",
  },
  {
    id: 3,
    tag: "Issue #3",
    tagColor: "var(--pop-pink)",
    leftImage: "/images/comics/comic-3-left.webp",
    rightImage: "/images/comics/comic-3-right.webp",
    fullImage: "/images/comics/comic-3.webp",
  },
  {
    id: 4,
    tag: "Issue #4",
    tagColor: "var(--pop-purple)",
    leftImage: "/images/comics/comic-4-left.webp",
    rightImage: "/images/comics/comic-4-right.webp",
    fullImage: "/images/comics/comic-4.webp",
  },
  {
    id: 5,
    tag: "Issue #5",
    tagColor: "var(--pop-red)",
    leftImage: "/images/comics/comic-5-left.webp",
    rightImage: "/images/comics/comic-5-right.webp",
    fullImage: "/images/comics/comic-5.webp",
  },
];

export default function ComicsPage() {
  // 0..4 = Comics 1..5, 5 = Comic 6 (Community Card)
  const [currentIssue, setCurrentIssue] = createSignal(0);
  const [viewMode, setViewMode] = createSignal<"flip" | "scroll">("flip");
  /*
   * A turn is two half-rotations, not one full one.
   *
   * The page used to rotate a full 180° while its content was swapped halfway
   * through. Past 90° you are looking at the *back* of the leaf, and with no
   * back face to show, the browser renders the front one mirrored — so the
   * second half of every turn displayed the page reversed before snapping flat.
   * That read as the old page flashing back.
   *
   * So: swing out to edge-on (90°, invisible), swap the content while nothing
   * is on screen, then swing the new page back in from the far edge. The
   * viewer never sees a backface, and the swap happens in the one frame where
   * the leaf has no width.
   */
  const [flip, setFlip] = createSignal<{ dir: "next" | "prev"; phase: "out" | "in" } | null>(null);

  const HALF_TURN_MS = 220;
  const totalIssues = 6;

  const isCommunityCard = () => currentIssue() === 5;
  const activeBook = () => (currentIssue() < 5 ? COMIC_BOOKS[currentIssue()] : null);

  const goToIssue = (nextIssue: number, dir: "next" | "prev") => {
    if (flip() || nextIssue === currentIssue()) return;
    setFlip({ dir, phase: "out" });
    window.setTimeout(() => {
      setCurrentIssue(nextIssue);
      setFlip({ dir, phase: "in" });
    }, HALF_TURN_MS);
    window.setTimeout(() => setFlip(null), HALF_TURN_MS * 2);
  };

  /** The animation class for a leaf, or "" when it is not the one turning. */
  const leafClass = (side: "next" | "prev") => {
    const state = flip();
    if (!state || state.dir !== side) return "";
    return state.phase === "out" ? `leaf-out-${side}` : `leaf-in-${side}`;
  };

  const prevIssue = () => {
    const next = currentIssue() > 0 ? currentIssue() - 1 : totalIssues - 1;
    goToIssue(next, "prev");
  };

  const nextIssue = () => {
    const next = currentIssue() < totalIssues - 1 ? currentIssue() + 1 : 0;
    goToIssue(next, "next");
  };

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (viewMode() === "flip") {
        if (e.key === "ArrowLeft") prevIssue();
        if (e.key === "ArrowRight") nextIssue();
      }
    };
    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
  });

  /*
   * Swipe, which on a phone is the only control anyone reaches for.
   *
   * Turning the page was arrow keys and two small buttons — neither of which
   * exists on a touch screen in the way a reader expects. A swipe is the
   * gesture people already try first, and it silently did nothing.
   *
   * The vertical check matters: a mostly-vertical drag is somebody trying to
   * scroll, and stealing that would trap them on the page. Only a clearly
   * horizontal travel past the threshold counts as a turn.
   */
  const SWIPE_MIN_PX = 45;
  let touchStartX = 0;
  let touchStartY = 0;

  const onTouchStart = (e: TouchEvent) => {
    const point = e.changedTouches[0];
    touchStartX = point.clientX;
    touchStartY = point.clientY;
  };

  const onTouchEnd = (e: TouchEvent) => {
    const point = e.changedTouches[0];
    const dx = point.clientX - touchStartX;
    const dy = point.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
    // Swiping left drags the page leftward, which advances — the same
    // direction the paper moves in the animation.
    if (dx < 0) nextIssue();
    else prevIssue();
  };

  return (
    <>
      <Title>Comics — FOSS Onam Games</Title>

      <style>{`
        .book-stage {
          perspective: 2200px;
        }
        .leaf-out-next,
        .leaf-in-next,
        .leaf-out-prev,
        .leaf-in-prev {
          transform-style: preserve-3d;
          /* Never render the reverse of a page — that was the flash. */
          backface-visibility: hidden;
          z-index: 30;
        }
        .leaf-out-next {
          animation: leafOutNext 0.22s ease-in forwards;
          transform-origin: left center;
        }
        .leaf-in-next {
          animation: leafInNext 0.22s ease-out forwards;
          transform-origin: left center;
        }
        .leaf-out-prev {
          animation: leafOutPrev 0.22s ease-in forwards;
          transform-origin: right center;
        }
        .leaf-in-prev {
          animation: leafInPrev 0.22s ease-out forwards;
          transform-origin: right center;
        }
        @keyframes leafOutNext {
          from {
            transform: rotateY(0deg);
            box-shadow: inset 10px 0 20px rgba(0, 0, 0, 0.05);
          }
          to {
            transform: rotateY(-90deg) scale(0.97);
            box-shadow: inset 40px 0 40px rgba(0, 0, 0, 0.25), -15px 0 30px rgba(0, 0, 0, 0.2);
          }
        }
        @keyframes leafInNext {
          from {
            transform: rotateY(90deg) scale(0.97);
            box-shadow: inset 40px 0 40px rgba(0, 0, 0, 0.25), -15px 0 30px rgba(0, 0, 0, 0.2);
          }
          to {
            transform: rotateY(0deg);
            box-shadow: inset 10px 0 20px rgba(0, 0, 0, 0.05);
          }
        }
        @keyframes leafOutPrev {
          from {
            transform: rotateY(0deg);
            box-shadow: inset -10px 0 20px rgba(0, 0, 0, 0.05);
          }
          to {
            transform: rotateY(90deg) scale(0.97);
            box-shadow: inset -40px 0 40px rgba(0, 0, 0, 0.25), 15px 0 30px rgba(0, 0, 0, 0.2);
          }
        }
        @keyframes leafInPrev {
          from {
            transform: rotateY(-90deg) scale(0.97);
            box-shadow: inset -40px 0 40px rgba(0, 0, 0, 0.25), 15px 0 30px rgba(0, 0, 0, 0.2);
          }
          to {
            transform: rotateY(0deg);
            box-shadow: inset -10px 0 20px rgba(0, 0, 0, 0.05);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .leaf-out-next,
          .leaf-in-next,
          .leaf-out-prev,
          .leaf-in-prev {
            animation-duration: 0.01s;
          }
        }
      `}</style>

      {/* ---------------------------------------------------- FLIP MODE: EXACT SQUARE BOOK SPREAD (ZERO EXTRA SPACE) */}
      <Show when={viewMode() === "flip"}>
        {/*
          Edge to edge on a phone, in the page flow on a desktop.

          A comic is the one thing here that wants the whole screen: fixed to
          the viewport it covers the header and footer entirely, so the reader
          gets glass and paper and nothing else. `overscroll-contain` plus
          `touch-action: pan-y` stops the browser rubber-banding the page
          behind it while the reader swipes. From `sm` up it drops back into
          normal flow, where the surrounding chrome is not in the way.
        */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          class="fixed inset-0 z-50 h-dvh w-screen overscroll-contain px-2 py-2 flex flex-col justify-between overflow-hidden select-none sm:static sm:z-auto sm:h-[calc(100dvh-4.25rem)] sm:w-full sm:max-w-5xl sm:mx-auto sm:px-4"
          style={{ background: "var(--paper)", "touch-action": "pan-y" }}
        >
          {/* Top Header */}
          <header class="flex items-center justify-between gap-2 shrink-0 py-1 border-b-2 border-[var(--ink)]/15">
            <div class="flex items-center gap-2 min-w-0">
              {/*
                The only way out on a phone. Going full screen hides the site
                header, so without this the reader is stuck in the book with
                nothing but the browser's own back gesture.
              */}
              <a
                href="/"
                aria-label="Leave the comics"
                class="sm:hidden shrink-0 grid place-items-center w-7 h-7 rounded-md bg-[var(--paper-2)] text-[var(--ink)]"
                style={{ border: "2px solid var(--ink)" }}
              >
                <X size={14} strokeWidth={3} />
              </a>
              <span
                class="badge text-[11px] sm:text-xs font-black px-2 py-0.5 shrink-0"
                style={{
                  background: isCommunityCard()
                    ? "var(--pop-pink)"
                    : activeBook()?.tagColor || "var(--pop-yellow)",
                  border: "2px solid var(--ink)",
                  color: isCommunityCard() ? "white" : "var(--ink)",
                }}
              >
                {isCommunityCard() ? "Issue #6 · Special" : `Issue #${currentIssue() + 1}`}
              </span>
              <span class="hidden sm:inline font-black text-xs sm:text-sm text-[var(--ink)] truncate">
                FOSS Onam Comic Book
              </span>
            </div>

            <div class="flex items-center gap-1 bg-[var(--paper-2)] p-1 rounded-md border border-[var(--ink)]">
              <button
                type="button"
                onClick={() => setViewMode("flip")}
                class="px-2 py-1 rounded text-[11px] font-black bg-[var(--pop-yellow)] text-[var(--ink)] border border-[var(--ink)] cursor-pointer"
              >
                <BookOpen size={13} class="inline mr-1" />
                Book Spread
              </button>

              <button
                type="button"
                onClick={() => setViewMode("scroll")}
                class="px-2 py-1 rounded text-[11px] font-black text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
              >
                <Layers size={13} class="inline mr-1" />
                Scroll
              </button>
            </div>
          </header>

          {/* OPEN COMIC BOOK CONTAINER (ASPECT SQUARE - FILLS 100% WITH ZERO GAP) */}
          <div class="book-stage flex-1 min-h-0 flex items-center justify-center p-1 sm:p-2 overflow-hidden">
            <div
              class="relative aspect-square max-h-full h-full max-w-full flex rounded-2xl overflow-hidden shadow-md mx-auto"
              style={{
                border: "3px solid var(--ink)",
                background: "var(--paper)",
              }}
            >
              {/* CENTER BOOK SPINE CREASE */}
              <div
                class="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 z-20 pointer-events-none"
                style={{
                  background: "var(--ink)",
                  opacity: "0.35",
                  "box-shadow": "0 0 6px rgba(0,0,0,0.15)",
                }}
              />

              {/* ----------------- LEFT SIDE OF BOOK (Panels 1 & 3) ----------------- */}
              <div
                class={`w-1/2 h-full flex flex-col justify-center overflow-hidden relative p-0 ${leafClass(
                  "prev",
                )}`}
                style={{
                  background: "var(--paper)",
                }}
              >
                <Show
                  when={!isCommunityCard()}
                  fallback={
                    /* Issue 6 Left Page: Memphis Comic Card Invite */
                    <div
                      class="w-full h-full flex flex-col justify-between p-4 sm:p-6 rounded-l-xl relative overflow-hidden text-center"
                      style={{ background: "var(--pop-yellow)" }}
                    >
                      <Confetti seed="issue6-left" count={6} animate />
                      <Halftone opacity={0.12} class="absolute inset-0 pointer-events-none" />

                      <div class="relative z-10 flex items-center justify-between pb-1">
                        <span class="text-[10px] font-black uppercase text-[var(--ink)]">
                          Issue 6
                        </span>
                        <span
                          class="badge text-[10px] font-black uppercase px-2 py-0.5 bg-[var(--pop-pink)] text-white"
                          style={{ border: "1.5px solid var(--ink)" }}
                        >
                          <Sparkles size={11} class="inline mr-1" />
                          Ideas Wanted
                        </span>
                      </div>

                      <div class="relative z-10 my-auto space-y-2 max-w-xs mx-auto">
                        <SpriteIcon
                          name="tux-king"
                          size={40}
                          animate="wobble"
                          interactive
                          class="mx-auto"
                        />
                        <h2
                          class="text-xl sm:text-2xl font-black text-[var(--ink)] m-0 leading-tight"
                          style={{ "font-family": "var(--font-stack-display)" }}
                        >
                          Need More FOSS Comics?
                        </h2>
                        <p class="text-xs sm:text-sm font-black text-[var(--pop-red)]">
                          Got a funny comic idea? Share it with us!
                        </p>
                        <p class="text-[11px] font-semibold text-[var(--ink)]/85 bg-[var(--paper)]/85 p-2.5 rounded-lg border border-[var(--ink)]/30">
                          Have a hilarious story about Linux, PRs, merge conflicts, or Maveli in
                          tech? We'll make it into the next official comic!
                        </p>
                      </div>

                      <div class="relative z-10 pt-1">
                        <span class="text-[10px] font-bold text-[var(--ink)]/60">
                          Turn to right page for Instagram DM →
                        </span>
                      </div>
                    </div>
                  }
                >
                  <img
                    src={activeBook()?.leftImage}
                    alt={`${activeBook()?.tag} Left Page (Panels 1 & 3)`}
                    class="w-full h-full object-fill select-none block"
                    loading="eager"
                  />
                </Show>
              </div>

              {/* ----------------- RIGHT SIDE OF BOOK (Panels 2 & 4) ----------------- */}
              <div
                class={`w-1/2 h-full flex flex-col justify-center overflow-hidden relative p-0 ${leafClass(
                  "next",
                )}`}
                style={{
                  background: "var(--paper)",
                }}
              >
                <Show
                  when={!isCommunityCard()}
                  fallback={
                    /* Issue 6 Right Page: Instagram DM Action Card */
                    <div
                      class="w-full h-full flex flex-col justify-between p-4 sm:p-6 rounded-r-xl relative overflow-hidden text-center"
                      style={{ background: "var(--pop-teal)" }}
                    >
                      <Confetti seed="issue6-right" count={6} animate />
                      <Halftone opacity={0.12} class="absolute inset-0 pointer-events-none" />

                      <div class="relative z-10 flex items-center justify-between pb-1">
                        <span class="text-[10px] font-bold text-[var(--ink)]">Right Page</span>
                        <span class="badge text-[10px] font-black uppercase px-2 py-0.5 bg-[var(--paper)] text-[var(--ink)]">
                          @foss_mec
                        </span>
                      </div>

                      <div class="relative z-10 my-auto space-y-3 max-w-xs mx-auto">
                        <SpriteIcon
                          name="foss-mec-badge"
                          size={40}
                          animate="float"
                          interactive
                          class="mx-auto"
                        />
                        <h3
                          class="text-lg sm:text-xl font-black text-[var(--ink)] m-0"
                          style={{ "font-family": "var(--font-stack-display)" }}
                        >
                          DM Us On Instagram
                        </h3>
                        <p class="text-xs font-semibold text-[var(--ink)]/85">
                          Slide into our DMs with your comic scripts, jokes, or sketches:
                        </p>

                        <a
                          href="https://instagram.com/foss_mec"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="btn-brand text-xs sm:text-sm px-4 py-2.5 inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer w-full"
                          style={{ background: "var(--pop-pink)", color: "white" }}
                        >
                          <Send size={15} strokeWidth={2.5} />
                          <span>DM @foss_mec on Instagram →</span>
                        </a>

                        <div class="pt-1">
                          <a
                            href="/"
                            class="btn-ghost text-xs py-1 px-3 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Play Today's Game</span>
                          </a>
                        </div>
                      </div>

                      <div class="relative z-10 pt-1">
                        <span class="text-[10px] font-bold text-[var(--ink)]/70">
                          FOSS MEC · Model Engineering College
                        </span>
                      </div>
                    </div>
                  }
                >
                  <img
                    src={activeBook()?.rightImage}
                    alt={`${activeBook()?.tag} Right Page (Panels 2 & 4)`}
                    class="w-full h-full object-fill select-none block"
                    loading="eager"
                  />
                </Show>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Prev, Selector Chips, Next */}
          <footer class="flex items-center justify-between gap-2 shrink-0 pt-1.5 pb-0.5 border-t-2 border-[var(--ink)]/15">
            <button
              type="button"
              onClick={prevIssue}
              disabled={flip() !== null}
              class="btn-brand text-xs px-3.5 py-1.5 inline-flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ChevronLeft size={15} strokeWidth={3} />
              <span>Prev Issue</span>
            </button>

            <div class="flex items-center gap-1.5 sm:gap-2">
              <For each={[0, 1, 2, 3, 4, 5]}>
                {(idx) => (
                  <button
                    type="button"
                    onClick={() => goToIssue(idx, idx > currentIssue() ? "next" : "prev")}
                    disabled={flip() !== null}
                    class={`w-7 h-7 sm:w-8 sm:h-8 rounded-md font-black text-xs grid place-items-center cursor-pointer transition-colors ${
                      currentIssue() === idx
                        ? "bg-[var(--pop-yellow)] text-[var(--ink)] border-2 border-[var(--ink)] shadow-xs"
                        : "bg-[var(--paper)] border border-[var(--ink)]/40 opacity-70 hover:opacity-100"
                    }`}
                    title={idx === 5 ? "Issue #6 (Community)" : `Issue #${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                )}
              </For>
            </div>

            <button
              type="button"
              onClick={nextIssue}
              disabled={flip() !== null}
              class="btn-brand text-xs px-3.5 py-1.5 inline-flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span>Next Issue</span>
              <ChevronRight size={15} strokeWidth={3} />
            </button>
          </footer>
        </div>
      </Show>

      {/* ---------------------------------------------------- SCROLL MODE: VERTICAL FEED */}
      <Show when={viewMode() === "scroll"}>
        <main class="container space-y-6 py-6 max-w-2xl">
          <header class="flex items-center justify-between gap-3 pb-3 border-b-2 border-[var(--ink)]/20">
            <h1
              class="text-2xl sm:text-3xl font-black text-[var(--ink)] m-0"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              FOSS Onam Comics
            </h1>

            <button
              type="button"
              onClick={() => setViewMode("flip")}
              class="btn-brand text-xs px-3 py-1.5 inline-flex items-center gap-1 cursor-pointer"
            >
              <BookOpen size={13} strokeWidth={2.5} />
              <span>Back to Book View</span>
            </button>
          </header>

          <div class="space-y-6">
            <For each={COMIC_BOOKS}>
              {(comic) => (
                <article
                  class="rounded-xl overflow-hidden bg-[var(--paper-2)] p-3 sm:p-4 space-y-2"
                  style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
                >
                  <span
                    class="badge text-xs font-black px-2 py-0.5"
                    style={{
                      background: comic.tagColor,
                      border: "1.5px solid var(--ink)",
                      color: "var(--ink)",
                    }}
                  >
                    {comic.tag}
                  </span>

                  <div
                    class="rounded-lg overflow-hidden"
                    style={{ border: "2px solid var(--ink)", background: "var(--paper)" }}
                  >
                    <img
                      src={comic.fullImage}
                      alt={`FOSS Onam Comic ${comic.tag}`}
                      class="w-full h-auto object-contain select-none block"
                      loading="lazy"
                    />
                  </div>
                </article>
              )}
            </For>

            {/* Card 6 in Scroll Mode */}
            <article
              class="rounded-xl overflow-hidden p-5 sm:p-6 space-y-3 text-center relative"
              style={{
                border: "var(--ink-w-bold) solid var(--ink)",
                background: "var(--pop-yellow)",
              }}
            >
              <Confetti seed="scroll-card6" count={8} animate />
              <div class="relative z-10 space-y-2 max-w-md mx-auto">
                <div class="inline-flex items-center gap-2">
                  <SpriteIcon name="tux-king" size={36} animate="wobble" interactive />
                  <span
                    class="badge text-xs font-black uppercase px-2 py-0.5 bg-[var(--pop-pink)] text-white"
                    style={{ border: "1.5px solid var(--ink)" }}
                  >
                    Issue #6 · Special
                  </span>
                </div>

                <h2
                  class="text-xl sm:text-2xl font-black text-[var(--ink)] m-0 leading-tight"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  Need More FOSS Comics?
                </h2>
                <p class="text-xs sm:text-sm font-semibold text-[var(--ink)]/85">
                  Got a funny comic idea about Linux, PRs, or Onam? Share it with us!
                </p>

                <div class="pt-2 flex justify-center">
                  <a
                    href="https://instagram.com/foss_mec"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-brand text-xs sm:text-sm px-4 py-2 inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                    style={{ background: "var(--pop-pink)", color: "white" }}
                  >
                    <Send size={15} strokeWidth={2.5} />
                    <span>DM @foss_mec on Instagram →</span>
                  </a>
                </div>
              </div>
            </article>
          </div>
        </main>
      </Show>
    </>
  );
}
