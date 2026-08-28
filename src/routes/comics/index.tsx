import { Title } from "@solidjs/meta";
import { BookOpen, ChevronLeft, ChevronRight, Layers, Send, Sparkles, X } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { comicImage } from "~/lib/img";

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
    leftImage: comicImage("comic-1-left.webp"),
    rightImage: comicImage("comic-1-right.webp"),
    fullImage: comicImage("comic-1.webp"),
  },
  {
    id: 2,
    tag: "Issue #2",
    tagColor: "var(--pop-teal)",
    leftImage: comicImage("comic-2-left.webp"),
    rightImage: comicImage("comic-2-right.webp"),
    fullImage: comicImage("comic-2.webp"),
  },
  {
    id: 3,
    tag: "Issue #3",
    tagColor: "var(--pop-pink)",
    leftImage: comicImage("comic-3-left.webp"),
    rightImage: comicImage("comic-3-right.webp"),
    fullImage: comicImage("comic-3.webp"),
  },
  {
    id: 4,
    tag: "Issue #4",
    tagColor: "var(--pop-purple)",
    leftImage: comicImage("comic-4-left.webp"),
    rightImage: comicImage("comic-4-right.webp"),
    fullImage: comicImage("comic-4.webp"),
  },
  {
    id: 5,
    tag: "Issue #5",
    tagColor: "var(--pop-red)",
    leftImage: comicImage("comic-5-left.webp"),
    rightImage: comicImage("comic-5-right.webp"),
    fullImage: comicImage("comic-5.webp"),
  },
];

/** Issue 6, left leaf: the invitation to send in a comic. */
function CommunityLeftPage() {
  return (
    /* Issue 6 Left Page: Memphis Comic Card Invite */
    <div
      class="w-full h-full flex flex-col justify-between p-4 sm:p-6 rounded-l-xl relative overflow-hidden text-center"
      style={{ background: "var(--pop-yellow)" }}
    >
      <Confetti seed="issue6-left" count={6} animate />
      <Halftone opacity={0.12} class="absolute inset-0 pointer-events-none" />

      <div class="relative z-10 flex items-center justify-between pb-1">
        <span class="text-[10px] font-black uppercase text-[var(--ink)]">Issue 6</span>
        <span
          class="badge text-[10px] font-black uppercase px-2 py-0.5 bg-[var(--pop-pink)] text-white"
          style={{ border: "1.5px solid var(--ink)" }}
        >
          <Sparkles size={11} class="inline mr-1" />
          Ideas Wanted
        </span>
      </div>

      <div class="relative z-10 my-auto space-y-2 max-w-xs mx-auto">
        <SpriteIcon name="tux-king" size={40} animate="wobble" interactive class="mx-auto" />
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
          Have a hilarious story about Linux, PRs, merge conflicts, or Maveli in tech? We'll make it
          into the next official comic!
        </p>
      </div>

      <div class="relative z-10 pt-1">
        <span class="text-[10px] font-bold text-[var(--ink)]/60">
          Turn to right page for Instagram DM →
        </span>
      </div>
    </div>
  );
}

/** Issue 6, right leaf: where to send it. */
function CommunityRightPage() {
  return (
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
        <SpriteIcon name="foss-mec-badge" size={40} animate="float" interactive class="mx-auto" />
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
  );
}

// Persist peeled strips across comic page flips using relative coordinates
interface RelativeStrip {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}
const GLOBAL_PEELED_STRIPS: RelativeStrip[] = [];
const PRELOADED_IMAGES = new Map<string, HTMLImageElement>();

function PeelableComicPanel(props: { src: string; alt: string }) {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    const canvas = canvasRef;
    const container = containerRef;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let W = 400;
    let H = 400;
    let isPeeling = false;
    let lastX = 0;
    let lastY = 0;

    // List of peeled centers to allow peeling from any already-peeled edge
    const peeledSpots: Array<{ x: number; y: number }> = [];

    // Helper to carve a fibrous paper strip on canvas
    const drawStrip = (fromX: number, fromY: number, toX: number, toY: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";

      // Draw fibrous torn strip between the two drag points
      ctx.beginPath();
      ctx.lineWidth = Math.max(18, Math.min(32, W * 0.07));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Jagged fibrous paper tear edge marks
      ctx.beginPath();
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      const radius = 12 + Math.random() * 6;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = radius + (Math.random() - 0.5) * 8;
        const px = midX + Math.cos(angle) * r;
        const py = midY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Micro paper fiber specks
      for (let f = 0; f < 3; f++) {
        const fx = toX + (Math.random() - 0.5) * 24;
        const fy = toY + (Math.random() - 0.5) * 24;
        ctx.fillRect(fx, fy, 2, 2);
      }

      ctx.restore();
    };

    // Default initial peel nick relative position (centered on Gemini logo on Tux)
    const DEFAULT_NICK_U = 0.79;
    const DEFAULT_NICK_V = 0.9;

    const drawDefaultNick = (w: number, h: number) => {
      const cx = DEFAULT_NICK_U * w;
      const cy = DEFAULT_NICK_V * h;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";

      // Larger organic spiky paper tear polygon that fully covers the Gemini star logo
      ctx.beginPath();
      const radius = Math.max(14, Math.min(22, w * 0.048));
      const points = 12;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        // Diamond star bias with natural fibrous jitter
        const starBias = i % 3 === 0 ? 1.25 : 0.85;
        const r = radius * starBias + (Math.random() - 0.5) * 5;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Scattered paper fibers & scuffs along the torn contour
      for (let f = 0; f < 6; f++) {
        const fx = cx + (Math.random() - 0.5) * (radius * 2.2);
        const fy = cy + (Math.random() - 0.5) * (radius * 2.2);
        ctx.fillRect(fx, fy, 2, 2);
      }

      ctx.restore();

      peeledSpots.push({ x: cx, y: cy });
    };

    let loadedImg: HTMLImageElement | null = null;

    const paint = (img: HTMLImageElement) => {
      loadedImg = img;
      // Use the container's actual laid-out size so the image stretches to
      // the full page. Capping at 1200 avoids huge backing store but still
      // fills the page — the old 800 cap left a gap on large screens.
      W = Math.min(container.clientWidth || 400, 1200);
      H = Math.min(container.clientHeight || 400, 1200);
      if (W < 10 || H < 10) {
        // Layout not settled yet (flex aspect-square) — retry next frame
        requestAnimationFrame(() => paint(img));
        return;
      }
      // Cap DPR size to avoid huge backing store on large screens
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Stretch image to the full page (cover the whole canvas) — this is
      // what was missing: previously the canvas was painted once at mount
      // with a smaller W/H and never resized, leaving the yellow secret
      // card exposed at the bottom.
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);

      // Always draw the initial default peeled nick
      peeledSpots.length = 0;
      drawDefaultNick(W, H);

      // Replay peeled strips synchronously (relative coords scale to new W/H)
      for (const s of GLOBAL_PEELED_STRIPS) {
        const fromX = s.u0 * W;
        const fromY = s.v0 * H;
        const toX = s.u1 * W;
        const toY = s.v1 * H;
        drawStrip(fromX, fromY, toX, toY);
        peeledSpots.push({ x: toX, y: toY });
      }
    };

    const cached = PRELOADED_IMAGES.get(props.src);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      paint(cached);
    } else {
      const img = new Image();
      img.src = props.src;
      PRELOADED_IMAGES.set(props.src, img);
      if (img.complete && img.naturalWidth > 0) {
        paint(img);
      } else {
        img.onload = () => {
          paint(img);
        };
      }
    }

    // Keep canvas stretched when the book resizes (aspect-square flex,
    // window resize, orientation change). Without this the canvas stays at
    // its mount size and the bottom of the page shows the yellow card as a
    // solid block — the bug in the screenshot.
    const ro = new ResizeObserver(() => {
      if (loadedImg) paint(loadedImg);
    });
    ro.observe(container);
    onCleanup(() => ro.disconnect());

    // Check if a point is near an exposed peelable edge (default nick or already peeled spot)
    const isNearPeeledEdge = (x: number, y: number): boolean => {
      // Near default initial nick
      const nickDist = Math.hypot(x - DEFAULT_NICK_U * W, y - DEFAULT_NICK_V * H);
      if (nickDist <= 32) return true;

      // Near any already peeled spot
      for (let i = 0; i < peeledSpots.length; i++) {
        const spot = peeledSpots[i];
        const dist = Math.hypot(x - spot.x, y - spot.y);
        if (dist <= 32) return true;
      }
      return false;
    };

    // Peel off a small fibrous paper strip along the drag path
    const peelStrip = (fromX: number, fromY: number, toX: number, toY: number) => {
      // Don't peel top/left spine margins
      if (toX < W * 0.15 || toY < H * 0.18) return;

      drawStrip(fromX, fromY, toX, toY);
      peeledSpots.push({ x: toX, y: toY });
      GLOBAL_PEELED_STRIPS.push({
        u0: fromX / W,
        v0: fromY / H,
        u1: toX / W,
        v1: toY / H,
      });
    };

    const handleDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const fromRight = W - x;
      const fromBottom = H - y;
      const relX = (x / W).toFixed(4);
      const relY = (y / H).toFixed(4);

      console.log(
        `[Comic Peel Offset from Bottom-Right] dx=${fromRight.toFixed(1)}px, dy=${fromBottom.toFixed(1)}px | relative: (x=${relX}, y=${relY}) | canvas size: ${W}x${H}`,
      );

      // Must start from the corner or any already peeled edge
      if (isNearPeeledEdge(x, y)) {
        isPeeling = true;
        lastX = x;
        lastY = y;
        peelStrip(x, y, x, y);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    const handleMove = (e: PointerEvent) => {
      if (!isPeeling) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dist = Math.hypot(x - lastX, y - lastY);
      if (dist >= 6 && dist <= 60) {
        peelStrip(lastX, lastY, x, y);
        lastX = x;
        lastY = y;
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (!isPeeling) return;
      isPeeling = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerup", handleUp);
    canvas.addEventListener("pointercancel", handleUp);

    onCleanup(() => {
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", handleUp);
      canvas.removeEventListener("pointercancel", handleUp);
    });
  });

  return (
    <div
      ref={(el) => (containerRef = el)}
      class="relative w-full h-full overflow-hidden select-none bg-[var(--paper)]"
      style="contain: paint layout; isolation: isolate;"
    >
      {/* Secret Card Revealed Underneath - Sits strictly under the peelable area in bottom-right */}
      <div
        class="absolute z-0 flex flex-col items-center justify-center p-3 text-center bg-[var(--pop-yellow)] rounded-xl border-2 border-[var(--ink)] shadow-md select-none"
        style={{
          right: "4%",
          bottom: "4%",
          width: "52%",
          height: "42%",
        }}
      >
        {/* Inked Comic Treasure Chest Icon */}
        <svg
          viewBox="0 0 48 48"
          class="w-9 h-9 mb-1"
          fill="none"
          stroke="var(--ink)"
          stroke-width="2.5"
        >
          <rect x="6" y="20" width="36" height="22" rx="3" fill="var(--pop-yellow)" />
          <path d="M 6,20 C 6,11 42,11 42,20 Z" fill="#E8B038" />
          <path d="M 16,13 L 16,42 M 32,13 L 32,42" stroke="var(--ink)" stroke-width="2" />
          <circle
            cx="24"
            cy="27"
            r="3.5"
            fill="var(--paper)"
            stroke="var(--ink)"
            stroke-width="2"
          />
          <path d="M 24,27 L 24,30" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
        </svg>

        <p
          class="text-sm sm:text-base font-black text-[var(--ink)] m-0 leading-tight select-all"
          style={{ "font-family": "var(--font-stack-display)" }}
        >
          3X91A4
        </p>
      </div>

      {/* Top Peelable Canvas Layer */}
      <canvas
        ref={(el) => (canvasRef = el)}
        class="absolute inset-0 z-10 w-full h-full cursor-pointer block"
        style={{ "touch-action": "none" }}
      />
    </div>
  );
}

/**
 * One face of one leaf.
 *
 * Both the settled spread and the leaf mid-turn draw their pages through here,
 * which is the whole reason the turn can be honest: the back of a turning page
 * is rendered by exactly the same code as the page it becomes.
 */
function PageFace(props: { issue: number; side: "left" | "right" }) {
  const book = () => (props.issue < COMIC_BOOKS.length ? COMIC_BOOKS[props.issue] : null);
  const isPeelable = () => props.issue === 2 && props.side === "right";

  return (
    <Show
      when={book()}
      fallback={props.side === "left" ? <CommunityLeftPage /> : <CommunityRightPage />}
    >
      <Show
        when={isPeelable()}
        fallback={
          <img
            src={props.side === "left" ? book()!.leftImage : book()!.rightImage}
            alt={`${book()!.tag} ${props.side} page`}
            class="w-full h-full object-fill select-none block"
            loading="eager"
            draggable={false}
          />
        }
      >
        <PeelableComicPanel src={book()!.rightImage} alt={`${book()!.tag} right page (peelable)`} />
      </Show>
    </Show>
  );
}

export default function ComicsPage() {
  // 0..4 = Comics 1..5, 5 = Comic 6 (Community Card)
  const [currentIssue, setCurrentIssue] = createSignal(0);
  const [viewMode, setViewMode] = createSignal<"flip" | "scroll">("flip");
  /*
   * A real page turn, with a real reverse side.
   *
   * The first attempt at this rotated a leaf a full 180° and swapped its
   * content halfway; the second swung it out to edge-on, swapped, and swung it
   * back. Both avoided the actual problem instead of solving it - a turning
   * page has *two* faces, and the one you see after 90° is the back of the
   * sheet you are lifting.
   *
   * In a bound book that back is not a mirror of the page you left. Turn a
   * right-hand page and its reverse lands as the new *left*-hand page. So the
   * leaf carries the page being left on its front and the page it becomes on
   * its back, and `backface-visibility` hands over between them exactly at the
   * halfway point. Underneath, the spread already shows the destination, so the
   * leaf lifts to reveal it the way paper does.
   */
  const [turning, setTurning] = createSignal<{
    dir: "next" | "prev";
    from: number;
    to: number;
  } | null>(null);

  const TURN_MS = 620;
  const totalIssues = 6;

  /*
   * How far through the turn we are, 0 to 1, and whether that value is being
   * eased or held.
   *
   * Splitting progress from the turn itself is what lets a finger drive the
   * page. A button press eases progress from 0 to 1 over `TURN_MS`; a drag
   * writes it straight from the pointer with easing switched off, so the paper
   * sits exactly where the hand left it and reverses if the hand does.
   */
  const [progress, setProgress] = createSignal(0);
  const [easing, setEasing] = createSignal(true);

  const isCommunityCard = () => currentIssue() === 5;
  const activeBook = () =>
    currentIssue() < COMIC_BOOKS.length ? COMIC_BOOKS[currentIssue()] : null;

  const targetFor = (dir: "next" | "prev") =>
    dir === "next"
      ? currentIssue() < totalIssues - 1
        ? currentIssue() + 1
        : 0
      : currentIssue() > 0
        ? currentIssue() - 1
        : totalIssues - 1;

  /** Land the turn: either commit to the destination, or fall back. */
  const settle = (commit: boolean) => {
    const t = turning();
    if (!t) return;
    setEasing(true);
    setProgress(commit ? 1 : 0);
    window.setTimeout(() => {
      if (commit) setCurrentIssue(t.to);
      setTurning(null);
      setEasing(true);
      setProgress(0);
    }, TURN_MS);
  };

  const goToIssue = (nextIssue: number, dir: "next" | "prev") => {
    if (turning() || nextIssue === currentIssue()) return;
    setTurning({ dir, from: currentIssue(), to: nextIssue });
    setEasing(false);
    setProgress(0);
    // One frame with the leaf flat and un-eased, so the transition has a
    // starting value to animate away from rather than snapping straight to 1.
    requestAnimationFrame(() => {
      setEasing(true);
      setProgress(1);
    });
    window.setTimeout(() => {
      setCurrentIssue(nextIssue);
      setTurning(null);
      setProgress(0);
    }, TURN_MS);
  };

  /*
   * Which issue each half of the settled spread is showing.
   *
   * The side the leaf is lifting off stays on the old issue until the leaf
   * is edge-on (p≈0.5); switching it at p=0 makes the page behind the leaf
   * flicker from old → new while the leaf front still covers it. Delaying the
   * swap to the halfway point keeps the hidden page identical to the leaf front
   * until the leaf has turned enough to reveal the new page.
   */
  const leftIssue = () => {
    const t = turning();
    if (!t) return currentIssue();
    if (t.dir === "next") return t.from;
    return t.to;
  };
  const rightIssue = () => {
    const t = turning();
    if (!t) return currentIssue();
    if (t.dir === "next") return t.to;
    return t.from;
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
   * Turning the page was arrow keys and two small buttons - neither of which
   * exists on a touch screen in the way a reader expects. A swipe is the
   * gesture people already try first, and it silently did nothing.
   *
   * The vertical check matters: a mostly-vertical drag is somebody trying to
   * scroll, and stealing that would trap them on the page. Only a clearly
   * horizontal travel past the threshold counts as a turn.
   */
  let stageRef: HTMLDivElement | undefined;

  /*
   * Drag-to-turn: the paper follows the finger.
   *
   * Releasing and *then* animating is what a carousel does, not what a book
   * does. Here the pointer writes `progress` directly on every move, so the
   * page hangs off the hand - you can take it halfway, stop, look, and pull it
   * back. Only on release does anything ease: past a third of the way it falls
   * open, short of that it drops closed.
   *
   * A drag is worth half the spread, which is the distance the page's free edge
   * actually travels, so the paper keeps pace with the finger instead of
   * racing it.
   *
   * Pointer events rather than touch: one path covers finger, pen and mouse.
   * Pointer capture keeps the events coming even when the finger slides off the
   * element mid-turn, which is otherwise a very easy way to strand a page at
   * 60°.
   */
  const COMMIT_AT = 0.34;

  onMount(() => {
    const stage = stageRef;
    if (!stage) return;

    let startX = 0;
    let startY = 0;
    let active = false;
    let decided = false;
    let pointerId: number | null = null;

    const reset = () => {
      active = false;
      decided = false;
      pointerId = null;
    };

    const down = (e: PointerEvent) => {
      if (turning()) return;
      active = true;
      decided = false;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
    };

    const move = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!decided) {
        // Wait until the gesture has committed to an axis. A mostly-vertical
        // drag belongs to the scroller, not to us.
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          reset();
          return;
        }
        decided = true;
        const dir = dx < 0 ? "next" : "prev";
        setTurning({ dir, from: currentIssue(), to: targetFor(dir) });
        setEasing(false);
        setProgress(0);
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety; the gesture still works without it.
        }
      }

      const span = Math.max(1, stage.getBoundingClientRect().width / 2);
      setProgress(Math.min(1, Math.max(0, Math.abs(dx) / span)));
    };

    const up = () => {
      if (!active) return;
      const wasDragging = decided;
      const p = progress();
      if (pointerId !== null) {
        try {
          stage.releasePointerCapture(pointerId);
        } catch {
          // Already released - nothing to undo.
        }
      }
      reset();
      if (wasDragging) settle(p >= COMMIT_AT);
    };

    stage.addEventListener("pointerdown", down, { passive: true });
    stage.addEventListener("pointermove", move, { passive: true });
    stage.addEventListener("pointerup", up, { passive: true });
    stage.addEventListener("pointercancel", up, { passive: true });
    onCleanup(() => {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    });
  });

  return (
    <>
      <Title>Comics - Onam Games</Title>

      <style>{`
        .book-stage {
          perspective: 2200px;
        }
        /*
          The leaf sits over one half of the spread and rotates on the spine.
          preserve-3d keeps its two faces in real 3D space; without it the
          browser flattens them and the back never appears at all.
        */
        .book-leaf {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          transform-style: preserve-3d;
          z-index: 40;
          pointer-events: none;
        }
        .book-leaf-next {
          left: 50%;
          transform-origin: left center;
        }
        .book-leaf-prev {
          left: 0;
          transform-origin: right center;
        }
        /*
          Paper standing on edge catches less light - done with an ink overlay,
          never a filter.

          A filter on the leaf silently forces preserve-3d back to flat, which
          collapses the two faces onto one plane: the turn then showed the front
          face mirrored for its whole second half instead of handing over to the
          back. Same for opacity below 1 and any overflow on the leaf itself.
        */
        .book-shade {
          position: absolute;
          inset: 0;
          background: #22202b;
          opacity: 0;
          pointer-events: none;
        }
        .book-face {
          position: absolute;
          inset: 0;
          overflow: hidden;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        /* Pre-rotated, so it reads the right way round once the leaf passes 90°. */
        .book-face-back {
          transform: rotateY(180deg);
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
          ref={(el) => (stageRef = el)}
          /*
            The `sm` height leaves more slack than the nav strictly needs.
            Subtracting only the nav pinned the reader's bottom edge to the
            exact bottom of the viewport, so anything else in the shell - the
            ban notice, a wrapper's padding, a nav a few pixels taller than the
            guess - pushed its footer, and therefore the page controls, below
            the fold. Losing a couple of rems of comic beats losing the
            "Next issue" button.
          */
          class="fixed inset-0 z-50 h-dvh w-screen overscroll-contain px-2 py-2 flex flex-col justify-between overflow-hidden select-none sm:static sm:z-auto sm:mb-6 sm:h-[calc(100dvh-6.5rem)] sm:w-full sm:max-w-5xl sm:mx-auto sm:px-4"
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

              {/* ----------------- THE SETTLED SPREAD ----------------- */}
              <div
                class="w-1/2 h-full overflow-hidden relative"
                style={{ background: "var(--paper)" }}
              >
                <PageFace issue={leftIssue()} side="left" />
              </div>
              <div
                class="w-1/2 h-full overflow-hidden relative"
                style={{ background: "var(--paper)" }}
              >
                <PageFace issue={rightIssue()} side="right" />
              </div>

              {/* ----------------- THE TURNING LEAF ----------------- */}
              <Show when={turning()}>
                {(turn) => (
                  <div
                    class={`book-leaf ${turn().dir === "next" ? "book-leaf-next" : "book-leaf-prev"}`}
                    aria-hidden="true"
                    style={{
                      transform: `rotateY(${(turn().dir === "next" ? -180 : 180) * progress()}deg)`,
                      transition: easing()
                        ? `transform ${TURN_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                        : "none",
                    }}
                  >
                    <div class="book-face" style={{ background: "var(--paper)" }}>
                      <PageFace
                        issue={turn().from}
                        side={turn().dir === "next" ? "right" : "left"}
                      />
                      <div
                        class="book-shade"
                        style={{ opacity: Math.sin(progress() * Math.PI) * 0.34 }}
                      />
                    </div>
                    {/*
                      The reverse. Turning a right page leftwards puts its back
                      down as the new left page - so that is literally what is
                      drawn here, not a mirror of the front.
                    */}
                    <div class="book-face book-face-back" style={{ background: "var(--paper)" }}>
                      <PageFace issue={turn().to} side={turn().dir === "next" ? "left" : "right"} />
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </div>

          {/* Bottom Bar: Prev, Selector Chips, Next */}
          <footer class="flex items-center justify-between gap-2 shrink-0 pt-1.5 pb-0.5 border-t-2 border-[var(--ink)]/15">
            <button
              type="button"
              onClick={prevIssue}
              disabled={turning() !== null}
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
                    disabled={turning() !== null}
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
              disabled={turning() !== null}
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
                    <Show
                      when={comic.id === 3}
                      fallback={
                        <img
                          src={comic.fullImage}
                          alt={`FOSS Onam Comic ${comic.tag}`}
                          class="w-full h-auto object-contain select-none block"
                          loading="lazy"
                        />
                      }
                    >
                      <div
                        class="aspect-square w-full relative overflow-hidden"
                        style="contain: paint layout; content-visibility: auto;"
                      >
                        <PeelableComicPanel
                          src={comic.fullImage}
                          alt={`FOSS Onam Comic ${comic.tag} (peelable)`}
                        />
                      </div>
                    </Show>
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
