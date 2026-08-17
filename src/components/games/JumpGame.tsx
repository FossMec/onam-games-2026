import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { jumpSprite } from "~/lib/img";
import {
  ENEMY_SPIKED_ORB,
  ENEMY_SPIKES,
  FPS,
  MAX_FRAMES,
  MAX_INPUTS,
  PLATFORM_BREAKABLE,
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
  INPUT_RESOLUTION,
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
  /** Optional target height in meters to finish practice trials early */
  targetY?: number;
}

const MS_PER_FRAME = 1000 / FPS;
const MAX_CATCHUP_STEPS = 5;

const JUMP_SPRITES = {
  bgA: jumpSprite("paathalam-bg-a.webp"),
  bgB: jumpSprite("paathalam-bg-b.webp"),
  maveliIdle: jumpSprite("maveli-idle.webp"),
  maveliJump: jumpSprite("maveli-jump.webp"),
  maveliFall: jumpSprite("maveli-fall.webp"),
  maveliUmbrella: jumpSprite("maveli-umbrella.webp"),
  maveliBalloon: jumpSprite("maveli-balloon.webp"),
  maveliWin: jumpSprite("maveli-win.webp"),
  maveliTumble: jumpSprite("maveli-tumble.webp"),
  itemBalloon: jumpSprite("item-balloon.webp"),
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
  const [gyroActive, setGyroActive] = createSignal(false);
  const [permissionError, setPermissionError] = createSignal(false);

  const state: SimState = initialState(props.view.seed);
  const inputs: number[] = [];
  let lastInputFrame = -1;
  let dir = 0;
  let finished = false;
  const held = { left: false, right: false };
  let gyroDir = 0;

  const setDir = (next: number) => {
    if (finished || next === dir) return;
    dir = next;
    if (!started()) {
      setStarted(true);
    }
    // Record for anti-cheat replay — but never let a full buffer freeze controls
    if (inputs.length >= MAX_INPUTS) return;
    inputs.push(packInput(state.frame - lastInputFrame, next));
    lastInputFrame = state.frame;
  };

  const applyControls = () => {
    if (held.left || held.right) {
      setDir(held.left === held.right ? 0 : held.left ? -INPUT_RESOLUTION : INPUT_RESOLUTION);
    } else if (gyroActive()) {
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

  const enableTilt = async () => {
    setPermissionError(false);
    if (
      typeof window !== "undefined" &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === "function"
    ) {
      try {
        const res = await (
          DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (res === "granted") {
          setGyroActive(true);
        } else {
          setPermissionError(true);
        }
      } catch (err) {
        console.error("DeviceMotion permission error:", err);
        setPermissionError(true);
      }
    } else if (
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
        } else {
          setPermissionError(true);
        }
      } catch (err) {
        console.error("DeviceOrientation permission error:", err);
        setPermissionError(true);
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

    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768);

    if (isTouch) {
      void enableTilt();
    }

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

      ctx.fillStyle = "#141026";
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = 0.38;
      const tileWorldH = 175;
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
      ctx.restore();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
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

        ctx.fillStyle = "#221c38";
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(8 * s, y - 16, 52 * s, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffd166";
        ctx.fillText(`${mark} m`, 12 * s, y - 4);
      }
      ctx.setLineDash([]);

      for (let i = state.floor; i < state.level.platforms.length; i += 1) {
        const platform = state.level.platforms[i];
        if (platform.y > state.cameraY + VIEW_H) break;
        if (state.broken.has(platform.id)) continue;

        const left = platformX(platform, state.frame) * s;
        const top = screenY(platform.y);
        const pWidth = PLATFORM_W * s;
        const pHeight = Math.max(8 * vs, 11);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.beginPath();
        ctx.roundRect(left, top + 4, pWidth, pHeight, 6);
        ctx.fill();

        let baseColor = "#00f090";
        let accentColor = "#00c878";
        let label = "";

        if (platform.type === PLATFORM_SPRING) {
          baseColor = "#ff2e63";
          accentColor = "#d61c4e";
          label = "spring";
        } else if (platform.type === PLATFORM_MOVING) {
          baseColor = "#00d2ff";
          accentColor = "#00a3cc";
          label = "moving";
        } else if (platform.type === PLATFORM_BREAKABLE) {
          baseColor = "#ffea00";
          accentColor = "#e6be00";
          label = "break";
        }

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.roundRect(left, top, pWidth, pHeight, 6);
        ctx.fill();

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.roundRect(left + 2, top + pHeight * 0.55, pWidth - 4, pHeight * 0.45, [0, 0, 4, 4]);
        ctx.fill();

        if (label === "moving") {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(left + pWidth * 0.3, top + pHeight * 0.25);
          ctx.lineTo(left + pWidth * 0.2, top + pHeight * 0.55);
          ctx.lineTo(left + pWidth * 0.3, top + pHeight * 0.85);
          ctx.moveTo(left + pWidth * 0.7, top + pHeight * 0.25);
          ctx.lineTo(left + pWidth * 0.8, top + pHeight * 0.55);
          ctx.lineTo(left + pWidth * 0.7, top + pHeight * 0.85);
          ctx.fill();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(left + pWidth * 0.28, top + pHeight * 0.55);
          ctx.lineTo(left + pWidth * 0.72, top + pHeight * 0.55);
          ctx.stroke();
        } else if (label === "break") {
          ctx.strokeStyle = "#221c38";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(left + pWidth * 0.25, top + 1);
          ctx.lineTo(left + pWidth * 0.35, top + pHeight * 0.6);
          ctx.lineTo(left + pWidth * 0.5, top + pHeight * 0.3);
          ctx.lineTo(left + pWidth * 0.65, top + pHeight * 0.8);
          ctx.lineTo(left + pWidth * 0.75, top + 1);
          ctx.stroke();
        } else if (label === "spring") {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(left + pWidth * 0.4, top + pHeight * 0.75);
          ctx.lineTo(left + pWidth * 0.5, top + pHeight * 0.25);
          ctx.lineTo(left + pWidth * 0.6, top + pHeight * 0.75);
          ctx.stroke();
        } else {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(left + pWidth * 0.35, top + 3);
          ctx.lineTo(left + pWidth * 0.35, top + pHeight - 3);
          ctx.moveTo(left + pWidth * 0.65, top + 3);
          ctx.lineTo(left + pWidth * 0.65, top + pHeight - 3);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.roundRect(left + 2, top + 1, pWidth - 4, Math.max(2.2, pHeight * 0.28), 3);
        ctx.fill();

        ctx.restore();

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
            ctx.fillStyle = "#3a86ff";
            ctx.strokeStyle = palette.ink;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(itemX, itemY - 1.5 * vs, 3 * s, 4.2 * vs, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#83b0ff";
            ctx.beginPath();
            ctx.ellipse(itemX - 1 * s, itemY - 2.8 * vs, 1 * s, 1.4 * vs, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(itemX, itemY + 2.8 * vs);
            ctx.lineTo(itemX - 0.6 * s, itemY + 6.5 * vs);
            ctx.stroke();
          }
        }

        if (platform.enemy && !state.defeatedEnemies.has(platform.enemy.id)) {
          const enemy = platform.enemy;
          const eX = enemyX(enemy, state.frame) * s;
          const eY = screenY(enemy.y);

          if (enemy.type === ENEMY_SPIKES) {
            const spikeW = 3.2 * s;
            const spikeH = 6.5 * vs;
            const baseX = eX - 4.8 * s;
            ctx.lineWidth = 2;
            for (let j = 0; j < 3; j += 1) {
              const sx = baseX + j * (spikeW + 1.6 * s);
              ctx.fillStyle = "#ef476f";
              ctx.strokeStyle = palette.ink;
              ctx.beginPath();
              ctx.moveTo(sx, eY);
              ctx.lineTo(sx + spikeW / 2, eY - spikeH);
              ctx.lineTo(sx + spikeW, eY);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = "#ffd166";
              ctx.beginPath();
              ctx.moveTo(sx + spikeW * 0.25, eY - spikeH * 0.45);
              ctx.lineTo(sx + spikeW / 2, eY - spikeH);
              ctx.lineTo(sx + spikeW * 0.75, eY - spikeH * 0.45);
              ctx.closePath();
              ctx.fill();
            }
          } else if (enemy.type === ENEMY_SPIKED_ORB) {
            const spikesActive = isSpikesExtended(enemy, state.frame);
            const at = (state.frame + enemy.phase) % enemy.period;
            const animExt = spikesActive
              ? Math.min(at / 8, 1)
              : Math.max(0, 1 - (at - enemy.period * 0.55) / 8);
            const orbR = 5.2 * s;
            const spikeLen = 5.5 * s * animExt;

            ctx.save();
            ctx.translate(eX, eY);

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

            ctx.fillStyle = spikesActive ? "#7209b7" : "#06d6a0";
            ctx.strokeStyle = palette.ink;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, orbR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

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
        if (started()) {
          applyControls();
          step(state, dir);
          if (
            !state.alive ||
            state.frame >= MAX_FRAMES ||
            (props.targetY && state.maxY >= props.targetY)
          ) {
            setScore(Math.floor(state.maxY));
            render();
            cancelAnimationFrame(frameHandle);
            finish();
            return;
          }
        }
      }
      if (steps === MAX_CATCHUP_STEPS) accumulator = 0;

      setScore(Math.floor(state.maxY));
      setBalloonSeconds(Math.ceil(state.balloonFrames / FPS));
      render();
    };

    frameHandle = requestAnimationFrame(loop);

    const onKey = (event: KeyboardEvent, isDown: boolean) => {
      if (props.disabled) return;
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") held.left = isDown;
      else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D")
        held.right = isDown;
      else return;
      event.preventDefault();
      applyControls();
    };
    const keyDown = (e: KeyboardEvent) => onKey(e, true);
    const keyUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // Tilt Steering — calibration-based pipeline
    // (Doodle Jump / Whirlybird pattern: calibrate → filter → relative → deadzone → clamp)
    const TILT_ALPHA = 0.35; // low-pass filter (lower = smoother, higher = more responsive)
    const TILT_DEADZONE = 2; // degrees near center ignored
    const TILT_MAX_ANGLE = 15; // degrees mapped to full speed
    const DRIFT_RATE = 0.0005; // slow neutral drift, only when near center
    const NEAR_CENTER = 5; // degrees threshold for drift compensation

    let neutralGamma: number | null = null;
    let filteredGamma = 0;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (!gyroActive()) return;
      if (e.gamma === null || e.gamma === undefined) return;

      let rawGamma = e.gamma;

      // Compensate for landscape screen orientations
      let screenAngle = 0;
      if (typeof window !== "undefined") {
        if (window.screen?.orientation?.angle !== undefined) {
          screenAngle = window.screen.orientation.angle;
        } else if (
          typeof (window as unknown as { orientation?: number }).orientation === "number"
        ) {
          screenAngle = (window as unknown as { orientation?: number }).orientation ?? 0;
        }
      }

      if (screenAngle === 90) {
        rawGamma = -(e.beta ?? 0);
      } else if (screenAngle === -90 || screenAngle === 270) {
        rawGamma = e.beta ?? 0;
      } else if (screenAngle === 180) {
        rawGamma = -rawGamma;
      }

      // 1. Low-pass filter on raw sensor value
      filteredGamma += TILT_ALPHA * (rawGamma - filteredGamma);

      // 2. Auto-calibrate on first filtered reading (captures the user's natural hand angle)
      if (neutralGamma === null) neutralGamma = filteredGamma;

      // 3. Relative tilt from calibrated neutral
      let rel = filteredGamma - neutralGamma;

      // 4. Slow drift compensation (only near center — never fights active steering)
      if (Math.abs(rel) < NEAR_CENTER) {
        neutralGamma += DRIFT_RATE * (filteredGamma - neutralGamma);
      }

      // 5. Deadzone
      if (Math.abs(rel) < TILT_DEADZONE) rel = 0;

      // 6. Clamp and map to game direction
      rel = Math.max(-TILT_MAX_ANGLE, Math.min(TILT_MAX_ANGLE, rel));
      gyroDir = Math.round((rel / TILT_MAX_ANGLE) * INPUT_RESOLUTION);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("deviceorientation", onOrientation);
    }

    // Tap to start — no touch steering, tilt handles all movement
    const onCanvasTap = (event: PointerEvent) => {
      event.preventDefault();
      if (!started()) setStarted(true);
    };
    el.addEventListener("pointerdown", onCanvasTap);

    onCleanup(() => {
      cancelAnimationFrame(frameHandle);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      if (typeof window !== "undefined") {
        window.removeEventListener("deviceorientation", onOrientation);
      }
      el.removeEventListener("pointerdown", onCanvasTap);
    });
  });

  return (
    <div ref={(el) => (shell = el)} class="space-y-2.5">
      {/* Top Status Bar */}
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <span class="badge font-black text-sm" style={{ "--pop": "var(--pop-yellow)" }}>
          {score().toLocaleString("en-IN")} m
        </span>
        <Show when={balloonSeconds() > 0}>
          <span class="badge animate-pulse font-extrabold" style={{ "--pop": "var(--pop-blue)" }}>
            Balloon Glide: {balloonSeconds()}s
          </span>
        </Show>

        <span
          class="badge text-xs"
          style={{ "--pop": gyroActive() ? "var(--pop-teal)" : "var(--paper-3)" }}
        >
          {gyroActive() ? "Tilt Active" : "Keyboard"}
        </span>
      </div>

      <Show when={permissionError()}>
        <p class="text-[11px] font-bold text-[var(--pop-red-deep)] text-center m-0">
          Motion sensor permission denied. Use arrow keys or A/D to steer.
        </p>
      </Show>

      {/* Canvas Board */}
      <div class="relative mx-auto" style={{ "max-width": "min(100%, 26rem)" }}>
        <canvas
          ref={(el) => (canvas = el)}
          class="w-full cursor-pointer"
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
            class="absolute inset-0 grid place-items-center text-center p-4 select-none pointer-events-none"
            style={{ background: "rgb(34 32 43 / 0.65)", "border-radius": "var(--radius)" }}
          >
            <div class="space-y-2 px-3 text-white">
              <p class="shout" style={{ color: "var(--pop-yellow)" }}>
                CLIMB TO ONAM
              </p>
              <p class="text-xs sm:text-sm font-semibold">
                Tilt your phone to steer · Tap to start
              </p>

              <p class="text-xs font-bold text-yellow-300 animate-pulse pt-1">
                Tap screen or press arrow keys to start
              </p>

              <div class="flex flex-wrap items-center justify-center gap-2 pt-2 text-[0.75rem]">
                <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
                  Safe Floor
                </span>
                <span class="badge" style={{ "--pop": "var(--pop-orange)" }}>
                  Spring Jump
                </span>
                <span class="badge" style={{ "--pop": "var(--pop-blue)" }}>
                  Auto-Glide
                </span>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-1 text-[0.75rem] text-muted">
        <p>Orange = Max Spring Jump · Balloon = Auto Climb · Stomp enemies on head</p>
      </div>
    </div>
  );
}
