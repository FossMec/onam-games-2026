import { Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  FPS,
  MAX_FRAMES,
  MAX_INPUTS,
  PLATFORM_BREAKABLE,
  PLATFORM_H,
  PLATFORM_MOVING,
  PLATFORM_SPRING,
  PLATFORM_W,
  PLAYER_H,
  PLAYER_W,
  VIEW_H,
  WORLD_W,
  type SimState,
  initialState,
  packInput,
  platformX,
  step,
} from "~/lib/jump-sim";

/**
 * Maveli Jump — the visible half.
 *
 * This component owns rendering and input capture and nothing else. Physics is
 * `~/lib/jump-sim`, which the server runs too; the score shown here is a
 * preview of what that server run will produce, not a claim.
 *
 * The loop is a fixed-timestep accumulator rather than delta-time. A 144Hz
 * laptop and a stuttering phone must simulate the same run at the same real
 * speed — that is both the only fair way to rank this and a hard requirement
 * for the server replay to agree with what the player saw.
 */

export interface JumpViewData {
  kind: "jump";
  seed: string;
  fps: number;
  maxFrames: number;
}

export interface JumpGameProps {
  view: JumpViewData;
  /** Packed direction-change deltas — never a score. See `~/lib/jump-sim`. */
  onFinish: (submission: { inputs: number[] }) => void;
  disabled?: boolean;
}

const MS_PER_FRAME = 1000 / FPS;
/**
 * Catch-up limit. A tab that was backgrounded returns with a huge accumulated
 * delta; simulating all of it would fast-forward the player into a platform
 * they never saw. Dropping the excess makes the run run *slower* than real
 * time, which is the direction the server's clock check tolerates.
 */
const MAX_CATCHUP_STEPS = 5;

interface Palette {
  ink: string;
  paper: string;
  paper3: string;
  red: string;
  yellow: string;
  teal: string;
  blue: string;
  pink: string;
}

function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: get("--ink", "#22202b"),
    paper: get("--paper", "#fbf3e4"),
    paper3: get("--paper-3", "#f0e4cc"),
    red: get("--pop-red", "#f2695c"),
    yellow: get("--pop-yellow", "#f5c443"),
    teal: get("--pop-teal", "#5fbfa8"),
    blue: get("--pop-blue", "#7b9be0"),
    pink: get("--pop-pink", "#e48bb4"),
  };
}

const PLATFORM_FILL = (palette: Palette, type: number): string =>
  type === PLATFORM_SPRING
    ? palette.pink
    : type === PLATFORM_MOVING
      ? palette.blue
      : type === PLATFORM_BREAKABLE
        ? palette.yellow
        : palette.teal;

/** Maveli: pot belly, moustache, crown. Recognisable at thirty pixels or bust. */
function drawMaveli(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.5, w * 0.09);
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = "round";

  // Belly.
  ctx.fillStyle = palette.yellow;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.18, w * 0.5, h * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head.
  ctx.fillStyle = palette.red;
  ctx.beginPath();
  ctx.arc(0, -h * 0.24, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Crown.
  ctx.fillStyle = palette.yellow;
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.4);
  ctx.lineTo(-w * 0.32, -h * 0.62);
  ctx.lineTo(-w * 0.11, -h * 0.5);
  ctx.lineTo(0, -h * 0.7);
  ctx.lineTo(w * 0.11, -h * 0.5);
  ctx.lineTo(w * 0.32, -h * 0.62);
  ctx.lineTo(w * 0.32, -h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Moustache, leaning whichever way he is travelling.
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = Math.max(1.2, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, -h * 0.16);
  ctx.quadraticCurveTo(0, -h * 0.06 + facing * h * 0.02, w * 0.22, -h * 0.16);
  ctx.stroke();

  ctx.restore();
}

export function JumpGame(props: JumpGameProps) {
  let canvas: HTMLCanvasElement | undefined;
  let shell: HTMLDivElement | undefined;

  const [score, setScore] = createSignal(0);
  const [started, setStarted] = createSignal(false);

  /*
   * Deliberately plain mutable state, not signals: these are written up to 60
   * times a second inside an animation frame and read only by the renderer.
   * Routing them through reactivity would schedule work for no observer.
   */
  const state: SimState = initialState(props.view.seed);
  /** Packed deltas, built as we go — this array *is* the submission. */
  const inputs: number[] = [];
  let lastInputFrame = -1;
  let dir = 0;
  let finished = false;
  const held = { left: false, right: false };

  const setDir = (next: number) => {
    if (finished || next === dir) return;
    // Refusing to record past the cap keeps the payload inside
    // `maxSubmissionBytes` rather than having the server reject it at the door.
    // A run this long has already been going for minutes; freezing the last
    // direction is a far better failure than losing the whole attempt.
    if (inputs.length >= MAX_INPUTS) return;
    dir = next;
    inputs.push(packInput(state.frame - lastInputFrame, next));
    lastInputFrame = state.frame;
    if (!started()) setStarted(true);
  };

  const applyHeld = () => setDir(held.left === held.right ? 0 : held.left ? -1 : 1);

  const finish = () => {
    if (finished) return;
    finished = true;
    props.onFinish({ inputs: [...inputs] });
  };

  onMount(() => {
    if (!canvas || !shell) return;
    // Captured once so the closures below are not re-reading a mutable ref.
    const el = canvas;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const palette = readPalette(shell);

    let frameHandle = 0;
    let last = performance.now();
    let accumulator = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    /** World units -> canvas pixels. World y is up; canvas y is down. */
    const scale = () => width / WORLD_W;
    const screenY = (worldY: number) => height - (worldY - state.cameraY) * (height / VIEW_H);

    const render = () => {
      const s = scale();
      const vs = height / VIEW_H;

      ctx.fillStyle = palette.paper;
      ctx.fillRect(0, 0, width, height);

      // Height rungs every 100 units. They scroll past, so the climb reads as
      // progress even on a stretch with no platforms in el.
      ctx.strokeStyle = palette.paper3;
      ctx.lineWidth = 2;
      ctx.fillStyle = palette.paper3;
      ctx.font = `600 ${Math.round(11)}px var(--font-stack-mono), monospace`;
      const firstRung = Math.floor(state.cameraY / 100) * 100;
      for (let mark = firstRung; mark < state.cameraY + VIEW_H; mark += 100) {
        if (mark <= 0) continue;
        const y = screenY(mark);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(`${mark}`, 6, y - 4);
      }

      ctx.lineWidth = Math.max(1.5, s * 0.25);
      ctx.strokeStyle = palette.ink;
      ctx.lineJoin = "round";

      for (let i = state.floor; i < state.level.platforms.length; i += 1) {
        const platform = state.level.platforms[i];
        if (platform.y > state.cameraY + VIEW_H) break;
        if (state.broken.has(i)) continue;
        const left = platformX(platform, state.frame) * s;
        const top = screenY(platform.y);
        ctx.fillStyle = PLATFORM_FILL(palette, platform.type);
        ctx.beginPath();
        ctx.roundRect(left, top, PLATFORM_W * s, PLATFORM_H * vs, 999);
        ctx.fill();
        ctx.stroke();
      }

      // Maveli, drawn once per wrap seam so he is never half-missing.
      const py = screenY(state.py) - (PLAYER_H * vs) / 2;
      for (const offset of [-WORLD_W, 0, WORLD_W]) {
        const px = (state.px + offset) * s;
        if (px < -PLAYER_W * s || px > width + PLAYER_W * s) continue;
        drawMaveli(ctx, palette, px, py, PLAYER_W * s, PLAYER_H * vs, state.vx > 0 ? 1 : -1);
      }
    };

    const loop = (now: number) => {
      frameHandle = requestAnimationFrame(loop);
      accumulator += now - last;
      last = now;

      let steps = 0;
      while (accumulator >= MS_PER_FRAME && steps < MAX_CATCHUP_STEPS) {
        accumulator -= MS_PER_FRAME;
        steps += 1;
        step(state, dir);
        if (!state.alive || state.frame >= MAX_FRAMES) {
          setScore(Math.floor(state.maxY));
          render();
          cancelAnimationFrame(frameHandle);
          finish();
          return;
        }
      }
      if (steps === MAX_CATCHUP_STEPS) accumulator = 0;

      setScore(Math.floor(state.maxY));
      render();
    };

    frameHandle = requestAnimationFrame(loop);

    /* ------------------------------------------------------------ input */

    const onKey = (event: KeyboardEvent, down: boolean) => {
      if (event.key === "ArrowLeft" || event.key === "a") held.left = down;
      else if (event.key === "ArrowRight" || event.key === "d") held.right = down;
      else return;
      event.preventDefault();
      applyHeld();
    };
    const keyDown = (e: KeyboardEvent) => onKey(e, true);
    const keyUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    /*
     * Touch steers by which half of the canvas is held, tracked per pointer id
     * so sliding a thumb across the middle switches direction cleanly and
     * lifting one of two fingers does not cancel the other.
     */
    const pointers = new Map<number, number>();
    const recompute = () => {
      held.left = [...pointers.values()].some((side) => side < 0);
      held.right = [...pointers.values()].some((side) => side > 0);
      applyHeld();
    };
    const sideOf = (event: PointerEvent) =>
      event.clientX - el.getBoundingClientRect().left < width / 2 ? -1 : 1;

    const pointerDown = (event: PointerEvent) => {
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, sideOf(event));
      recompute();
    };
    const pointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, sideOf(event));
      recompute();
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      recompute();
    };
    el.addEventListener("pointerdown", pointerDown);
    el.addEventListener("pointermove", pointerMove);
    el.addEventListener("pointerup", pointerUp);
    el.addEventListener("pointercancel", pointerUp);

    onCleanup(() => {
      cancelAnimationFrame(frameHandle);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      el.removeEventListener("pointerdown", pointerDown);
      el.removeEventListener("pointermove", pointerMove);
      el.removeEventListener("pointerup", pointerUp);
      el.removeEventListener("pointercancel", pointerUp);
    });
  });

  return (
    <div ref={(el) => (shell = el)} class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
          {score().toLocaleString("en-IN")} m
        </span>
        <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
          hold left / right
        </span>
      </div>

      <div class="relative mx-auto" style={{ "max-width": "min(100%, 26rem)" }}>
        <canvas
          ref={(el) => (canvas = el)}
          class="w-full"
          style={{
            "aspect-ratio": `${WORLD_W} / ${VIEW_H}`,
            "max-height": "68vh",
            display: "block",
            "touch-action": "none",
            background: "var(--paper)",
            border: "var(--ink-w-bold) solid var(--ink)",
            "border-radius": "var(--radius)",
          }}
        />

        <Show when={!started()}>
          <div
            class="absolute inset-0 grid place-items-center text-center"
            style={{ background: "rgb(34 32 43 / 0.55)", "border-radius": "var(--radius)" }}
          >
            <div class="space-y-1 px-4">
              <p class="shout" style={{ color: "var(--pop-yellow)" }}>
                HOLD A SIDE!
              </p>
              <p style={{ color: "var(--paper-2)" }}>
                Hold the left or right half of the board to steer. Maveli jumps by himself.
              </p>
            </div>
          </div>
        </Show>
      </div>

      <p class="comment">
        mint = safe · yellow = banana chip, breaks once · blue = keeps moving · pink = pookalam
        trampoline
      </p>
    </div>
  );
}
