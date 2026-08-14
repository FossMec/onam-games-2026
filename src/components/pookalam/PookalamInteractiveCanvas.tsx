import { Download, Play, RotateCcw } from "lucide-solid";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

type ElementType = "leafPetal" | "tulipPetal" | "smallFlower" | "dot" | "woven" | "heart";

type ElementSpec = {
  type: ElementType;
  size: number;
  color: string;
  strokeColor?: string;
};

type Layer = {
  spec: ElementSpec[];
  radius: number;
  elements: number;
  duration: number;
  rotationOffset?: number;
  finalAnimation?: { type: "pulse"; color: string };
};

type DrawInstruction = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
  endTime: number;
} & ElementSpec;

const PALETTE = {
  orange: "#F7A01E",
  amber: "#FFBF00",
  deepOrange: "#D95F02",
  lightGray: "#CED1D3",
  white: "#FFFFFF",
  offWhite: "#EAEAEA",
  leafGreen: "#66a36d",
  shimmerGreen: "#a3d4a8",
  shimmerWhite: "#ffffff",
  darkBlue: "#121b44",
};

export function PookalamInteractiveCanvas() {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [isPaused, setIsPaused] = createSignal(false);
  const [isComplete, setIsComplete] = createSignal(false);
  const [progressPercent, setProgressPercent] = createSignal(0);

  const state = {
    animationFrameId: 0,
    startTime: 0,
    pausedTimeTotal: 0,
    lastPauseStart: 0,
    logoImage: null as HTMLImageElement | null,
    drawingPlan: [] as DrawInstruction[],
    totalDrawingDuration: 0,
    currentDisplaySize: 0,
    currentScaleFactor: 1,
    currentCenterX: 0,
    currentCenterY: 0,
  };

  const drawElement = (
    ctx: CanvasRenderingContext2D,
    props: {
      type: ElementType;
      x: number;
      y: number;
      size: number;
      angle: number;
      color: string;
      strokeColor?: string;
    },
  ) => {
    ctx.save();
    ctx.fillStyle = props.color;
    ctx.strokeStyle = props.strokeColor || props.color;
    ctx.translate(props.x, props.y);
    ctx.rotate(props.angle);
    ctx.beginPath();

    switch (props.type) {
      case "woven":
        ctx.rotate(Math.PI / 4);
        for (let i = 0; i < 2; i++) {
          ctx.ellipse(0, 0, props.size / 2, props.size, 0, 0, 2 * Math.PI);
          ctx.rotate(Math.PI / 2);
        }
        ctx.stroke();
        break;
      case "heart": {
        ctx.rotate(Math.PI);
        const top = -props.size / 2.5;
        const bottom = props.size / 2;
        ctx.moveTo(0, top);
        ctx.bezierCurveTo(
          props.size / 1.8,
          top - props.size / 2,
          props.size / 1.8,
          bottom,
          0,
          bottom,
        );
        ctx.bezierCurveTo(
          -props.size / 1.8,
          bottom,
          -props.size / 1.8,
          top - props.size / 2,
          0,
          top,
        );
        break;
      }
      case "leafPetal":
        ctx.moveTo(0, -props.size / 2);
        ctx.bezierCurveTo(
          props.size / 4,
          -props.size / 4,
          props.size / 4,
          props.size / 4,
          0,
          props.size / 2,
        );
        ctx.bezierCurveTo(
          -props.size / 4,
          props.size / 4,
          -props.size / 4,
          -props.size / 4,
          0,
          -props.size / 2,
        );
        break;
      case "tulipPetal":
        ctx.moveTo(0, -props.size / 2);
        ctx.quadraticCurveTo(props.size / 2, 0, 0, props.size / 2);
        ctx.quadraticCurveTo(-props.size / 2, 0, 0, -props.size / 2);
        break;
      case "smallFlower":
        for (let i = 0; i < 5; i++) {
          ctx.ellipse(0, -props.size / 2.5, props.size / 4, props.size / 2, 0, 0, 2 * Math.PI);
          ctx.rotate((Math.PI * 2) / 5);
        }
        break;
      case "dot":
        ctx.arc(0, 0, props.size / 2, 0, 2 * Math.PI);
        break;
    }
    ctx.fill();
    ctx.restore();
  };

  const getLayers = (): Layer[] => [
    {
      spec: [
        {
          type: "woven",
          size: 35 * state.currentScaleFactor,
          color: PALETTE.darkBlue,
          strokeColor: PALETTE.white,
        },
      ],
      radius: 0,
      elements: 1,
      duration: 200,
    },
    {
      spec: [
        {
          type: "dot",
          size: 3 * state.currentScaleFactor,
          color: PALETTE.white,
        },
        {
          type: "smallFlower",
          size: 4 * state.currentScaleFactor,
          color: PALETTE.amber,
        },
      ],
      radius: 28 * state.currentScaleFactor,
      elements: 8,
      duration: 400,
    },
    {
      spec: [
        {
          type: "smallFlower",
          size: 18 * state.currentScaleFactor,
          color: PALETTE.white,
        },
        {
          type: "dot",
          size: 4 * state.currentScaleFactor,
          color: PALETTE.deepOrange,
        },
      ],
      radius: 50 * state.currentScaleFactor,
      elements: 16,
      duration: 1600,
    },
    {
      spec: [
        {
          type: "dot",
          size: 5 * state.currentScaleFactor,
          color: PALETTE.amber,
        },
        {
          type: "dot",
          size: 5 * state.currentScaleFactor,
          color: PALETTE.deepOrange,
        },
        {
          type: "tulipPetal",
          size: 22 * state.currentScaleFactor,
          color: PALETTE.offWhite,
        },
        {
          type: "dot",
          size: 5 * state.currentScaleFactor,
          color: PALETTE.leafGreen,
        },
      ],
      radius: 75 * state.currentScaleFactor,
      elements: 32,
      duration: 1600,
      finalAnimation: { type: "pulse", color: PALETTE.shimmerWhite },
    },
    {
      spec: [
        {
          type: "dot",
          size: 8 * state.currentScaleFactor,
          color: PALETTE.amber,
        },
        {
          type: "dot",
          size: 8 * state.currentScaleFactor,
          color: PALETTE.orange,
        },
      ],
      radius: 100 * state.currentScaleFactor,
      elements: 36,
      duration: 1800,
    },
    {
      spec: [
        {
          type: "leafPetal",
          size: 25 * state.currentScaleFactor,
          color: PALETTE.leafGreen,
        },
        {
          type: "heart",
          size: 15 * state.currentScaleFactor,
          color: PALETTE.lightGray,
        },
      ],
      radius: 130 * state.currentScaleFactor,
      elements: 32,
      duration: 2200,
    },
    {
      spec: [
        {
          type: "dot",
          size: 6 * state.currentScaleFactor,
          color: PALETTE.orange,
        },
        {
          type: "leafPetal",
          size: 30 * state.currentScaleFactor,
          color: PALETTE.white,
        },
        {
          type: "dot",
          size: 3 * state.currentScaleFactor,
          color: PALETTE.orange,
        },
        {
          type: "leafPetal",
          size: 30 * state.currentScaleFactor,
          color: PALETTE.white,
        },
      ],
      radius: 165 * state.currentScaleFactor,
      elements: 64,
      duration: 2800,
    },
    {
      spec: [
        {
          type: "smallFlower",
          size: 12 * state.currentScaleFactor,
          color: PALETTE.deepOrange,
        },
      ],
      radius: 190 * state.currentScaleFactor,
      elements: 32,
      duration: 2400,
      finalAnimation: { type: "pulse", color: PALETTE.orange },
    },
  ];

  const createSymmetricDrawOrder = (n: number) => {
    const order: number[] = [];
    const half = Math.ceil(n / 2);
    for (let i = 0; i < half; i++) {
      order.push(i);
      if (i + half < n) order.push(i + half);
    }
    return order;
  };

  const reinitializeCanvas = () => {
    if (!canvasRef || !containerRef) return;

    const containerWidth = containerRef.clientWidth;
    const displaySize = Math.min(containerWidth * 0.94, 520);

    if (Math.abs(displaySize - state.currentDisplaySize) < 2 && state.drawingPlan.length > 0)
      return;

    state.currentDisplaySize = displaySize;
    state.currentScaleFactor = displaySize / 400;
    state.currentCenterX = displaySize / 2;
    state.currentCenterY = displaySize / 2;

    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = displaySize * dpr;
    canvasRef.height = displaySize * dpr;
    canvasRef.style.width = `${displaySize}px`;
    canvasRef.style.height = `${displaySize}px`;

    const ctx = canvasRef.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const layers = getLayers();
    const newDrawingPlan: DrawInstruction[] = [];
    let currentTime = 0;

    layers.forEach((layer) => {
      const timePerElement = layer.duration / layer.elements;
      const drawOrder = createSymmetricDrawOrder(layer.elements);

      drawOrder.forEach((elementIndex, drawIndex) => {
        const elementSpec = layer.spec[elementIndex % layer.spec.length];
        const angle = ((2 * Math.PI) / layer.elements) * elementIndex + (layer.rotationOffset || 0);
        const x = state.currentCenterX + Math.cos(angle) * layer.radius;
        const y = state.currentCenterY + Math.sin(angle) * layer.radius;
        const startTime = currentTime + drawIndex * timePerElement;
        const endTime = startTime + timePerElement;
        newDrawingPlan.push({
          ...elementSpec,
          x,
          y,
          angle: angle + Math.PI / 2,
          startTime,
          endTime,
        });
      });
      currentTime += layer.duration;
    });

    state.drawingPlan = newDrawingPlan;
    state.totalDrawingDuration = currentTime;
  };

  const restart = () => {
    state.startTime = 0;
    state.pausedTimeTotal = 0;
    state.lastPauseStart = 0;
    setIsComplete(false);
    setProgressPercent(0);
    reinitializeCanvas();
  };

  const animate = (timestamp: number) => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    if (state.startTime === 0) state.startTime = timestamp;

    if (isPaused()) {
      if (state.lastPauseStart === 0) state.lastPauseStart = timestamp;
      state.animationFrameId = requestAnimationFrame(animate);
      return;
    }

    if (state.lastPauseStart > 0) {
      state.pausedTimeTotal += timestamp - state.lastPauseStart;
      state.lastPauseStart = 0;
    }

    const elapsed = Math.max(0, timestamp - state.startTime - state.pausedTimeTotal);

    ctx.clearRect(0, 0, state.currentDisplaySize, state.currentDisplaySize);

    if (elapsed < state.totalDrawingDuration) {
      setIsComplete(false);
      setProgressPercent(Math.round((elapsed / state.totalDrawingDuration) * 100));

      state.drawingPlan.forEach((instr, index) => {
        if (elapsed >= instr.startTime) {
          const phaseProgress = Math.min(
            (elapsed - instr.startTime) / Math.max(1, instr.endTime - instr.startTime),
            1,
          );
          ctx.globalAlpha = Math.pow(phaseProgress, 2);
          drawElement(ctx, instr);

          if (index === 0 && state.logoImage) {
            const logoWidth = instr.size * 0.8;
            const logoHeight = logoWidth * 0.83;
            ctx.drawImage(
              state.logoImage,
              instr.x - logoWidth / 2,
              instr.y - logoHeight / 2,
              logoWidth,
              logoHeight,
            );
          }
          ctx.globalAlpha = 1;
        }
      });
    } else {
      setIsComplete(true);
      setProgressPercent(100);

      const rotationSpeed = 0.000002;
      const rotationAngle = (elapsed - state.totalDrawingDuration) * rotationSpeed * Math.PI * 2;

      ctx.save();
      ctx.translate(state.currentCenterX, state.currentCenterY);
      ctx.rotate(rotationAngle);
      ctx.translate(-state.currentCenterX, -state.currentCenterY);

      const layers = getLayers();
      layers.forEach((layer) => {
        const animatableLayers = layers.filter((l) => l.finalAnimation);
        const currentPulseLayerIndex = animatableLayers.indexOf(layer);

        for (let i = 0; i < layer.elements; i++) {
          const elementSpec = layer.spec[i % layer.spec.length];
          let drawColor = elementSpec.color;

          if (
            layer.finalAnimation &&
            currentPulseLayerIndex !== -1 &&
            Math.floor(elapsed / 2000) % animatableLayers.length === currentPulseLayerIndex
          ) {
            const pulseDuration = 8000;
            const pulseProgress = (elapsed % pulseDuration) / pulseDuration;
            const activeElementIndex = Math.floor(pulseProgress * layer.elements);
            if (i === activeElementIndex) {
              drawColor = layer.finalAnimation.color;
            }
          }

          const angle = ((2 * Math.PI) / layer.elements) * i + (layer.rotationOffset || 0);
          const x = state.currentCenterX + Math.cos(angle) * layer.radius;
          const y = state.currentCenterY + Math.sin(angle) * layer.radius;

          drawElement(ctx, {
            ...elementSpec,
            x,
            y,
            angle: angle + Math.PI / 2,
            color: drawColor,
          });
        }
      });

      ctx.restore();

      if (state.logoImage) {
        const centerSpec = getLayers()[0].spec[0];
        const logoWidth = centerSpec.size * 0.8;
        const logoHeight = logoWidth * 0.83;
        ctx.drawImage(
          state.logoImage,
          state.currentCenterX - logoWidth / 2,
          state.currentCenterY - logoHeight / 2,
          logoWidth,
          logoHeight,
        );
      }
    }

    state.animationFrameId = requestAnimationFrame(animate);
  };

  onMount(() => {
    const logo = new Image();
    logo.src = "/logo.svg";
    logo.onload = () => {
      state.logoImage = logo;
    };

    reinitializeCanvas();
    state.animationFrameId = requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(() => {
      reinitializeCanvas();
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }

    onCleanup(() => {
      cancelAnimationFrame(state.animationFrameId);
      resizeObserver.disconnect();
    });
  });

  const downloadPNG = () => {
    const size = 1600;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = size;
    exportCanvas.height = size;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#121b44";
    ctx.fillRect(0, 0, size, size);

    const scale = size / 400;
    const cx = size / 2;
    const cy = size / 2;

    const layers: Layer[] = [
      {
        spec: [
          {
            type: "woven",
            size: 35 * scale,
            color: PALETTE.darkBlue,
            strokeColor: PALETTE.white,
          },
        ],
        radius: 0,
        elements: 1,
        duration: 200,
      },
      {
        spec: [
          { type: "dot", size: 3 * scale, color: PALETTE.white },
          { type: "smallFlower", size: 4 * scale, color: PALETTE.amber },
        ],
        radius: 28 * scale,
        elements: 8,
        duration: 400,
      },
      {
        spec: [
          { type: "smallFlower", size: 18 * scale, color: PALETTE.white },
          { type: "dot", size: 4 * scale, color: PALETTE.deepOrange },
        ],
        radius: 50 * scale,
        elements: 16,
        duration: 1600,
      },
      {
        spec: [
          { type: "dot", size: 5 * scale, color: PALETTE.amber },
          { type: "dot", size: 5 * scale, color: PALETTE.deepOrange },
          { type: "tulipPetal", size: 22 * scale, color: PALETTE.offWhite },
          { type: "dot", size: 5 * scale, color: PALETTE.leafGreen },
        ],
        radius: 75 * scale,
        elements: 32,
        duration: 1600,
      },
      {
        spec: [
          { type: "dot", size: 8 * scale, color: PALETTE.amber },
          { type: "dot", size: 8 * scale, color: PALETTE.orange },
        ],
        radius: 100 * scale,
        elements: 36,
        duration: 1800,
      },
      {
        spec: [
          { type: "leafPetal", size: 25 * scale, color: PALETTE.leafGreen },
          { type: "heart", size: 15 * scale, color: PALETTE.lightGray },
        ],
        radius: 130 * scale,
        elements: 32,
        duration: 2200,
      },
      {
        spec: [
          { type: "dot", size: 6 * scale, color: PALETTE.orange },
          { type: "leafPetal", size: 30 * scale, color: PALETTE.white },
          { type: "dot", size: 3 * scale, color: PALETTE.orange },
          { type: "leafPetal", size: 30 * scale, color: PALETTE.white },
        ],
        radius: 165 * scale,
        elements: 64,
        duration: 2800,
      },
      {
        spec: [{ type: "smallFlower", size: 12 * scale, color: PALETTE.deepOrange }],
        radius: 190 * scale,
        elements: 32,
        duration: 2400,
      },
    ];

    layers.forEach((layer) => {
      for (let i = 0; i < layer.elements; i++) {
        const elementSpec = layer.spec[i % layer.spec.length];
        const angle = ((2 * Math.PI) / layer.elements) * i + (layer.rotationOffset || 0);
        const x = cx + Math.cos(angle) * layer.radius;
        const y = cy + Math.sin(angle) * layer.radius;

        drawElement(ctx, {
          ...elementSpec,
          x,
          y,
          angle: angle + Math.PI / 2,
        });
      }
    });

    if (state.logoImage) {
      const centerSpec = layers[0].spec[0];
      const logoWidth = centerSpec.size * 0.8;
      const logoHeight = logoWidth * 0.83;
      ctx.drawImage(
        state.logoImage,
        cx - logoWidth / 2,
        cy - logoHeight / 2,
        logoWidth,
        logoHeight,
      );
    }

    const dataUrl = exportCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `code-a-pookalam-foss-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      class="relative w-full rounded-2xl overflow-hidden border-4 border-[var(--ink)] shadow-[8px_8px_0px_0px_var(--ink)] p-4 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6"
      style={{ background: "#121b44" }}
    >
      {/* Canvas Frame */}
      <div
        ref={(el) => (containerRef = el)}
        class="relative flex-1 flex items-center justify-center w-full max-w-[500px] aspect-square mx-auto"
      >
        <canvas
          ref={(el) => (canvasRef = el)}
          class="object-contain cursor-pointer select-none rounded-full transition-transform hover:scale-[1.01]"
          onClick={() => setIsPaused((prev) => !prev)}
          title="Click to Pause / Resume"
        />

        {/* Progress pill on top */}
        <Show when={!isComplete()}>
          <div class="absolute top-2 left-2 right-2 flex items-center gap-2 px-3 py-1 rounded-full bg-[#121b44]/90 backdrop-blur border border-white/20 text-[11px] font-bold text-white shadow">
            <span>Drawing Pookalam:</span>
            <div class="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                class="h-full bg-[var(--pop-yellow)] transition-all duration-150"
                style={{ width: `${progressPercent()}%` }}
              />
            </div>
            <span>{progressPercent()}%</span>
          </div>
        </Show>
      </div>

      {/* Control Strip & Download */}
      <div class="w-full md:w-72 rounded-xl p-5 bg-[#1a2352] border-2 border-white/20 text-white flex flex-col justify-between space-y-4 shadow-xl">
        <div class="space-y-2.5">
          <div class="inline-flex items-center gap-1.5 text-xs font-black uppercase px-2.5 py-0.5 rounded bg-[var(--pop-yellow)] text-[var(--ink)] border border-[var(--ink)]">
            <span>Live Canvas Engine</span>
          </div>
          <h3
            class="text-lg font-black text-white"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Mathematical Pookalam
          </h3>
          <p class="text-xs text-gray-300 leading-relaxed">
            Multi-layer radial geometry with 8 concentric rings, 220+ petals & motifs, symmetric
            organic blooming, and serene continuous rotation.
          </p>
        </div>

        <div class="space-y-2 pt-2 border-t border-white/10">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              class="flex-1 py-2 px-3 rounded-lg bg-[#25306d] hover:bg-[#32408a] border border-white/20 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Show when={!isPaused()} fallback={<Play size={12} fill="currentColor" />}>
                <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </Show>
              <span>{isPaused() ? "Resume" : isComplete() ? "Mesmerize" : "Pause"}</span>
            </button>

            <button
              type="button"
              onClick={restart}
              class="py-2 px-3 rounded-lg bg-[#25306d] hover:bg-[#32408a] border border-white/20 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Replay drawing animation"
            >
              <RotateCcw size={13} strokeWidth={2.5} />
              <span>Replay</span>
            </button>
          </div>

          <button
            type="button"
            onClick={downloadPNG}
            class="w-full btn-brand py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_var(--ink)]"
          >
            <Download size={15} strokeWidth={2.5} />
            <span>Download 1600px PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
