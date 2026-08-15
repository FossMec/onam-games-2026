import { Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  ENEMY_SPIKED_ORB,
  ENEMY_SPIKES,
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
  enemyX,
  initialState,
  isSpikesExtended,
  packInput,
  platformX,
  step,
} from "~/lib/jump-sim";

export interface JumpViewData {
  kind: "jump";
  seed: string;
  fps: number;
  maxFrames: number;
}

export interface JumpGameProps {
  view: JumpViewData;
  onFinish: (submission: { inputs: number[] }) => void;
  disabled?: boolean;
}

const MS_PER_FRAME = 1000 / FPS;
const MAX_CATCHUP_STEPS = 5;

const JUMP_SPRITES = {
  bgA: "/sprites/jump/paathalam-bg-a.webp",
  bgB: "/sprites/jump/paathalam-bg-b.webp",
  maveliIdle: "/sprites/jump/maveli-idle.webp",
  maveliJump: "/sprites/jump/maveli-jump.webp",
  maveliFall: "/sprites/jump/maveli-fall.webp",
  maveliUmbrella: "/sprites/jump/maveli-umbrella.webp",
  maveliBalloon: "/sprites/jump/maveli-balloon.webp",
  maveliWin: "/sprites/jump/maveli-win.webp",
  maveliTumble: "/sprites/jump/maveli-tumble.webp",
  itemBalloon: "/sprites/jump/item-balloon.webp",
  platformNormal: "/sprites/jump/platform-normal.webp",
  platformSpring: "/sprites/jump/platform-spring.webp",
  platformMoving: "/sprites/jump/platform-moving.webp",
  platformBreakable: "/sprites/jump/platform-breakable.webp",
};

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

export function JumpGame(props: JumpGameProps) {
  let canvas: HTMLCanvasElement | undefined;
  let shell: HTMLDivElement | undefined;

  const [score, setScore] = createSignal(0);
  const [started, setStarted] = createSignal(false);
  const [balloonSeconds, setBalloonSeconds] = createSignal(0);
  const [hasGyro, setHasGyro] = createSignal(false);
  const [gyroActive, setGyroActive] = createSignal(false);

  const state: SimState = initialState(props.view.seed);
  const inputs: number[] = [];
  let lastInputFrame = -1;
  let dir = 0;
  let finished = false;
  const held = { left: false, right: false };
  let gyroDir = 0;

  const setDir = (next: number) => {
    if (finished || next === dir) return;
    if (inputs.length >= MAX_INPUTS) return;
    dir = next;
    inputs.push(packInput(state.frame - lastInputFrame, next));
    lastInputFrame = state.frame;
    if (!started()) setStarted(true);
  };

  const applyControls = () => {
    if (held.left || held.right) {
      setDir(held.left === held.right ? 0 : held.left ? -1 : 1);
    } else if (gyroActive() && gyroDir !== 0) {
      setDir(gyroDir);
    } else {
      setDir(0);
    }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    props.onFinish({ inputs: [...inputs] });
  };

  // Request gyroscope permission on iOS
  const enableTilt = async () => {
    if (
      typeof window !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === "function"
    ) {
      try {
        const res = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (res === "granted") {
          setGyroActive(true);
        }
      } catch (err) {
        console.error("Gyroscope error:", err);
      }
    } else {
      setGyroActive(true);
    }
  };

  onMount(() => {
    if (!canvas || !shell) return;
    const el = canvas;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const palette = readPalette(shell);

    // Preload image sprites
    const images: Record<string, HTMLImageElement> = {};
    for (const [k, src] of Object.entries(JUMP_SPRITES)) {
      const img = new Image();
      img.src = src;
      images[k] = img;
    }

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

    const scale = () => width / WORLD_W;
    const screenY = (worldY: number) => height - (worldY - state.cameraY) * (height / VIEW_H);

    const render = () => {
      const s = scale();
      const vs = height / VIEW_H;

      // 1. Infinite Seamless Paathalam Cavern Background (Alternating X-flipped tiles)
      const tileWorldH = 175; // aspect ratio height for 768x1376 image
      const firstTile = Math.floor((state.cameraY - 20) / tileWorldH);
      for (let t = firstTile; t <= firstTile + 3; t += 1) {
        const tileTopWorld = t * tileWorldH + tileWorldH;
        const canvasTop = screenY(tileTopWorld);
        const canvasH = tileWorldH * vs;
        const bgImg = Math.abs(t) % 2 === 0 ? images.bgA : images.bgB;
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
          ctx.drawImage(bgImg, 0, canvasTop, width, canvasH + 1);
        }
      }

      // 2. Height markers every 100 units
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.font = `800 ${Math.round(11)}px var(--font-stack-mono), monospace`;
      const firstRung = Math.floor(state.cameraY / 100) * 100;
      for (let mark = firstRung; mark < state.cameraY + VIEW_H; mark += 100) {
        if (mark <= 0) continue;
        const y = screenY(mark);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // High contrast comic badge for height marker
        ctx.fillStyle = "rgba(34, 32, 43, 0.75)";
        ctx.beginPath();
        ctx.roundRect(8 * s, y - 14, 48 * s, 14, 4);
        ctx.fill();
        ctx.fillStyle = "#ffd166";
        ctx.fillText(`${mark} m`, 12 * s, y - 4);
      }
      ctx.setLineDash([]);

      // Platforms
      for (let i = state.floor; i < state.level.platforms.length; i += 1) {
        const platform = state.level.platforms[i];
        if (platform.y > state.cameraY + VIEW_H) break;
        if (state.broken.has(platform.id)) continue;

        const left = platformX(platform, state.frame) * s;
        const top = screenY(platform.y);
        const pWidth = PLATFORM_W * s;
        const pHeight = PLATFORM_H * vs;

        let spriteImg: HTMLImageElement | undefined;
        if (platform.type === PLATFORM_SPRING) spriteImg = images.platformSpring;
        else if (platform.type === PLATFORM_MOVING) spriteImg = images.platformMoving;
        else if (platform.type === PLATFORM_BREAKABLE) spriteImg = images.platformBreakable;
        else spriteImg = images.platformNormal;

        if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
          ctx.drawImage(spriteImg, left, top - 2, pWidth, pHeight + 4);
        } else {
          ctx.fillStyle =
            platform.type === PLATFORM_SPRING
              ? palette.pink
              : platform.type === PLATFORM_MOVING
                ? palette.blue
                : platform.type === PLATFORM_BREAKABLE
                  ? palette.yellow
                  : palette.teal;
          ctx.beginPath();
          ctx.roundRect(left, top, pWidth, pHeight, 999);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = palette.ink;
          ctx.stroke();
        }

        // Render Collectible Balloon (compact, cute size)
        if (platform.item && !state.collectedItems.has(platform.id)) {
          const item = platform.item;
          const itemX = (platformX(platform, state.frame) + PLATFORM_W / 2) * s;
          const bob = Math.sin(state.frame * 0.08 + platform.id) * 1.8 * vs;
          const itemY = screenY(item.y) + bob;
          const itemW = 6.5 * s;
          const itemH = 9.5 * vs;
          const itemImg = images.itemBalloon;

          if (itemImg && itemImg.complete && itemImg.naturalWidth > 0) {
            ctx.drawImage(itemImg, itemX - itemW / 2, itemY - itemH / 2, itemW, itemH);
          } else {
            // Crisp comic balloon fallback
            ctx.fillStyle = "#3a86ff";
            ctx.strokeStyle = palette.ink;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(itemX, itemY - 1.5 * vs, 3 * s, 4.2 * vs, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Highlight
            ctx.fillStyle = "#83b0ff";
            ctx.beginPath();
            ctx.ellipse(itemX - 1 * s, itemY - 2.8 * vs, 1 * s, 1.4 * vs, -0.3, 0, Math.PI * 2);
            ctx.fill();
            // String
            ctx.beginPath();
            ctx.moveTo(itemX, itemY + 2.8 * vs);
            ctx.lineTo(itemX - 0.6 * s, itemY + 6.5 * vs);
            ctx.stroke();
          }
        }

        // Render Underworld Geometric Obstacles (Spikes & Spiky Orbs)
        if (platform.enemy && !state.defeatedEnemies.has(platform.enemy.id)) {
          const enemy = platform.enemy;
          const eX = enemyX(enemy, state.frame) * s;
          const eY = screenY(enemy.y);

          if (enemy.type === ENEMY_SPIKES) {
            // Pointy ground with 3 sharp spikes on platform
            const spikeW = 3.2 * s;
            const spikeH = 6.5 * vs;
            const baseX = eX - 4.8 * s;
            ctx.lineWidth = 2;
            for (let j = 0; j < 3; j += 1) {
              const sx = baseX + j * (spikeW + 1.6 * s);
              // Main spike body
              ctx.fillStyle = "#ef476f";
              ctx.strokeStyle = palette.ink;
              ctx.beginPath();
              ctx.moveTo(sx, eY);
              ctx.lineTo(sx + spikeW / 2, eY - spikeH);
              ctx.lineTo(sx + spikeW, eY);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              // Bright yellow tip
              ctx.fillStyle = "#ffd166";
              ctx.beginPath();
              ctx.moveTo(sx + spikeW * 0.25, eY - spikeH * 0.45);
              ctx.lineTo(sx + spikeW / 2, eY - spikeH);
              ctx.lineTo(sx + spikeW * 0.75, eY - spikeH * 0.45);
              ctx.closePath();
              ctx.fill();
            }
          } else if (enemy.type === ENEMY_SPIKED_ORB) {
            // Moving circular orb with retracting/extending spikes
            const spikesActive = isSpikesExtended(enemy, state.frame);
            const at = (state.frame + enemy.phase) % enemy.period;
            const animExt = spikesActive
              ? Math.min(at / 8, 1) // extend out
              : Math.max(0, 1 - (at - enemy.period * 0.55) / 8); // retract inside
            const orbR = 5.2 * s;
            const spikeLen = 5.5 * s * animExt;

            ctx.save();
            ctx.translate(eX, eY);

            // Draw 8 radial pointy spikes (only when extending/extended)
            if (spikeLen > 0.5) {
              ctx.fillStyle = "#ef476f";
              ctx.strokeStyle = palette.ink;
              ctx.lineWidth = 1.5;
              for (let a = 0; a < 8; a += 1) {
                const angle = (a * Math.PI) / 4 + state.frame * 0.04;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                ctx.beginPath();
                ctx.moveTo(cos * orbR - sin * 2, sin * orbR + cos * 2);
                ctx.lineTo(cos * (orbR + spikeLen), sin * (orbR + spikeLen));
                ctx.lineTo(cos * orbR + sin * 2, sin * orbR - cos * 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }
            }

            // Central orb core (Purple when spiky/deadly, Mint Green when retracted/safe)
            ctx.fillStyle = spikesActive ? "#7209b7" : "#06d6a0";
            ctx.strokeStyle = palette.ink;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, orbR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Comic center eye
            ctx.fillStyle = spikesActive ? "#ffd166" : "#ffffff";
            ctx.beginPath();
            ctx.arc(0, 0, orbR * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = palette.ink;
            ctx.beginPath();
            ctx.arc(0, 0, orbR * 0.25, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }
        }
      }

      // Render Maveli
      const isTall = state.umbrellaFrames > 0 || state.balloonFrames > 0;
      const mw = PLAYER_W * s * (isTall ? 1.6 : 1.35);
      const mh = PLAYER_H * vs * (isTall ? 1.7 : 1.35);
      const py = screenY(state.py) - mh;

      let maveliSprite = images.maveliJump;
      if (state.balloonFrames > 0) maveliSprite = images.maveliBalloon;
      else if (!state.alive) maveliSprite = images.maveliTumble;
      else if (state.umbrellaFrames > 0) maveliSprite = images.maveliUmbrella;
      else if (state.vy < -0.5) maveliSprite = images.maveliFall;
      else if (state.vy > 0.5) maveliSprite = images.maveliJump;
      else maveliSprite = images.maveliIdle;

      for (const offset of [-WORLD_W, 0, WORLD_W]) {
        const px = (state.px + offset) * s - mw / 2;
        if (px < -mw || px > width + mw) continue;

        ctx.save();
        if (state.vx < -0.1) {
          // Facing left: flip horizontally
          ctx.translate(px + mw, py);
          ctx.scale(-1, 1);
          if (maveliSprite && maveliSprite.complete && maveliSprite.naturalWidth > 0) {
            ctx.drawImage(maveliSprite, 0, 0, mw, mh);
          }
        } else {
          ctx.translate(px, py);
          if (maveliSprite && maveliSprite.complete && maveliSprite.naturalWidth > 0) {
            ctx.drawImage(maveliSprite, 0, 0, mw, mh);
          }
        }
        ctx.restore();
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
      setBalloonSeconds(Math.ceil(state.balloonFrames / FPS));
      render();
    };

    frameHandle = requestAnimationFrame(loop);

    // Keyboard Input
    const onKey = (event: KeyboardEvent, down: boolean) => {
      if (event.key === "ArrowLeft" || event.key === "a") held.left = down;
      else if (event.key === "ArrowRight" || event.key === "d") held.right = down;
      else return;
      event.preventDefault();
      applyControls();
    };
    const keyDown = (e: KeyboardEvent) => onKey(e, true);
    const keyUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // Gyroscope / DeviceOrientation tilt
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.gamma !== undefined) {
        setHasGyro(true);
        if (gyroActive()) {
          if (e.gamma < -6) gyroDir = -1;
          else if (e.gamma > 6) gyroDir = 1;
          else gyroDir = 0;
          applyControls();
        }
      }
    };
    if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", onOrientation);
    }

    // Touch Controls
    const pointers = new Map<number, number>();
    const recompute = () => {
      held.left = [...pointers.values()].some((side) => side < 0);
      held.right = [...pointers.values()].some((side) => side > 0);
      applyControls();
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
      if (typeof window !== "undefined") {
        window.removeEventListener("deviceorientation", onOrientation);
      }
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
        <Show when={balloonSeconds() > 0}>
          <span class="badge animate-pulse" style={{ "--pop": "var(--pop-blue)" }}>
            🎈 Balloon Glide: {balloonSeconds()}s
          </span>
        </Show>
        <Show
          when={hasGyro() && !gyroActive()}
          fallback={
            <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
              {gyroActive() ? "📱 Tilt Enabled" : "hold left / right"}
            </span>
          }
        >
          <button
            type="button"
            class="badge text-xs underline cursor-pointer"
            style={{ "--pop": "var(--pop-teal)" }}
            onClick={enableTilt}
          >
            📱 Enable Tilt Mode
          </button>
        </Show>
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
            class="absolute inset-0 grid place-items-center text-center p-4 select-none"
            style={{ background: "rgb(34 32 43 / 0.65)", "border-radius": "var(--radius)" }}
          >
            <div class="space-y-2 px-3 text-white">
              <p class="shout" style={{ color: "var(--pop-yellow)" }}>
                CLIMB TO ONAM!
              </p>
              <p class="text-xs sm:text-sm font-semibold">
                Hold left/right side or tilt your phone to steer.
              </p>
              <div class="flex flex-wrap items-center justify-center gap-2 pt-2 text-[0.75rem]">
                <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
                  🌿 Safe Floor
                </span>
                <span class="badge" style={{ "--pop": "var(--pop-orange)" }}>
                  ☂️ Max Jump
                </span>
                <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
                  🎈 Auto-Glide
                </span>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-1 text-[0.75rem] text-muted">
        <p>☂️ Orange = Max Spring Jump · 🎈 Balloon = Auto Climb · Stomp enemies on head!</p>
      </div>
    </div>
  );
}
