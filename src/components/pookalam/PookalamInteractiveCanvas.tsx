import { Check, Download, Play, RotateCcw, Sliders, Sparkles, X } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

export type ElementType = "leafPetal" | "tulipPetal" | "smallFlower" | "dot" | "woven" | "heart";

export type CenterMotif = "foss" | "tux" | "crab" | "lamp";

export interface LayerConfig {
  id: number;
  name: string;
  enabled: boolean;
  primaryType: ElementType;
  secondaryType?: ElementType;
  elements: number;
  radius: number; // base radius at scale 1
  size: number;
  color1: string;
  color2?: string;
  strokeColor?: string;
  hasPulse?: boolean;
}

type DrawInstruction = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
  endTime: number;
  type: ElementType;
  size: number;
  color: string;
  strokeColor?: string;
};

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

const DEFAULT_LAYERS: LayerConfig[] = [
  {
    id: 0,
    name: "Center Medallion",
    enabled: true,
    primaryType: "woven",
    elements: 1,
    radius: 0,
    size: 35,
    color1: PALETTE.darkBlue,
    strokeColor: PALETTE.white,
  },
  {
    id: 1,
    name: "Layer 1: Inner Rosette",
    enabled: true,
    primaryType: "smallFlower",
    secondaryType: "dot",
    elements: 8,
    radius: 28,
    size: 4,
    color1: PALETTE.amber,
    color2: PALETTE.white,
  },
  {
    id: 2,
    name: "Layer 2: Star Ring",
    enabled: true,
    primaryType: "smallFlower",
    secondaryType: "dot",
    elements: 16,
    radius: 50,
    size: 18,
    color1: PALETTE.white,
    color2: PALETTE.deepOrange,
  },
  {
    id: 3,
    name: "Layer 3: Tulip Bloom",
    enabled: true,
    primaryType: "tulipPetal",
    secondaryType: "dot",
    elements: 32,
    radius: 75,
    size: 22,
    color1: PALETTE.offWhite,
    color2: PALETTE.leafGreen,
    hasPulse: true,
  },
  {
    id: 4,
    name: "Layer 4: Pearl Dots",
    enabled: true,
    primaryType: "dot",
    elements: 36,
    radius: 100,
    size: 8,
    color1: PALETTE.amber,
    color2: PALETTE.orange,
  },
  {
    id: 5,
    name: "Layer 5: Foliage & Hearts",
    enabled: true,
    primaryType: "leafPetal",
    secondaryType: "heart",
    elements: 32,
    radius: 130,
    size: 25,
    color1: PALETTE.leafGreen,
    color2: PALETTE.lightGray,
  },
  {
    id: 6,
    name: "Layer 6: Grand Petals",
    enabled: true,
    primaryType: "leafPetal",
    secondaryType: "dot",
    elements: 64,
    radius: 165,
    size: 30,
    color1: PALETTE.white,
    color2: PALETTE.orange,
  },
  {
    id: 7,
    name: "Layer 7: Border Rosettes",
    enabled: true,
    primaryType: "smallFlower",
    elements: 32,
    radius: 190,
    size: 12,
    color1: PALETTE.deepOrange,
    hasPulse: true,
  },
];

const ELEMENT_OPTIONS: { type: ElementType; label: string; icon: string }[] = [
  { type: "leafPetal", label: "Leaf Petal", icon: "🍃" },
  { type: "tulipPetal", label: "Tulip Petal", icon: "🌷" },
  { type: "smallFlower", label: "Rosette Flower", icon: "🌸" },
  { type: "dot", label: "Pearl Dot", icon: "⚪" },
  { type: "heart", label: "Heart Petal", icon: "💛" },
  { type: "woven", label: "Woven Mesh", icon: "🕸️" },
];

export function PookalamInteractiveCanvas() {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [isPaused, setIsPaused] = createSignal(false);
  const [isComplete, setIsComplete] = createSignal(false);
  const [progressPercent, setProgressPercent] = createSignal(0);
  const [showConfigModal, setShowConfigModal] = createSignal(false);

  // Configurable settings
  const [layers, setLayers] = createSignal<LayerConfig[]>(
    JSON.parse(JSON.stringify(DEFAULT_LAYERS)),
  );
  const [motif, setMotif] = createSignal<CenterMotif>("foss");
  const [speedMultiplier, setSpeedMultiplier] = createSignal<number>(1); // 1 = ~13s, 2 = 6.5s, 0.5 = 26s
  const [rotationSpeedFactor, setRotationSpeedFactor] = createSignal<number>(1); // 0 = off, 1 = normal, 2 = fast

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

  const drawCenterMotif = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const m = motif();
    ctx.save();
    ctx.translate(x, y);

    if (m === "tux") {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.36, size * 0.46, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#1F2937";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, size * 0.05, size * 0.22, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -size * 0.16, size * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.amber;
      ctx.fill();
    } else if (m === "crab") {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.4, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#E65100";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-size * 0.35, -size * 0.18, size * 0.13, 0, Math.PI * 2);
      ctx.arc(size * 0.35, -size * 0.18, size * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = "#E65100";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-size * 0.12, -size * 0.1, size * 0.06, 0, Math.PI * 2);
      ctx.arc(size * 0.12, -size * 0.1, size * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    } else if (m === "lamp") {
      ctx.beginPath();
      ctx.ellipse(0, size * 0.18, size * 0.4, size * 0.16, 0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.amber;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.45);
      ctx.quadraticCurveTo(size * 0.2, -size * 0.18, 0, size * 0.08);
      ctx.quadraticCurveTo(-size * 0.2, -size * 0.18, 0, -size * 0.45);
      ctx.fillStyle = PALETTE.deepOrange;
      ctx.fill();
    } else if (state.logoImage) {
      const logoWidth = size * 0.8;
      const logoHeight = logoWidth * 0.83;
      ctx.drawImage(state.logoImage, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
    } else {
      ctx.font = `900 ${Math.round(size * 0.7)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = PALETTE.white;
      ctx.fillText("⚙", 0, -1);
    }
    ctx.restore();
  };

  const createSymmetricDrawOrder = (n: number) => {
    const order: number[] = [];
    const half = Math.ceil(n / 2);
    for (let i = 0; i < half; i++) {
      order.push(i);
      if (i + half < n) order.push(i + half);
    }
    return order;
  };

  const buildPlan = () => {
    const activeLayers = layers().filter((l) => l.enabled);
    const newPlan: DrawInstruction[] = [];
    let currentTime = 0;
    const speed = Math.max(0.2, speedMultiplier());

    activeLayers.forEach((layer) => {
      const baseDuration = (layer.elements * 45) / speed;
      const timePerElement = baseDuration / layer.elements;
      const drawOrder = createSymmetricDrawOrder(layer.elements);

      drawOrder.forEach((elementIndex, drawIndex) => {
        const isSecondary = layer.secondaryType && elementIndex % 2 === 1;
        const type = isSecondary && layer.secondaryType ? layer.secondaryType : layer.primaryType;
        const color = isSecondary && layer.color2 ? layer.color2 : layer.color1;
        const size = layer.size * state.currentScaleFactor;

        const angle = ((2 * Math.PI) / layer.elements) * elementIndex;
        const r = layer.radius * state.currentScaleFactor;
        const x = state.currentCenterX + Math.cos(angle) * r;
        const y = state.currentCenterY + Math.sin(angle) * r;
        const startTime = currentTime + drawIndex * timePerElement;
        const endTime = startTime + timePerElement;

        newPlan.push({
          type,
          size,
          color,
          strokeColor: layer.strokeColor,
          x,
          y,
          angle: angle + Math.PI / 2,
          startTime,
          endTime,
        });
      });
      currentTime += baseDuration;
    });

    state.drawingPlan = newPlan;
    state.totalDrawingDuration = currentTime;
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

    buildPlan();
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
      setProgressPercent(Math.round((elapsed / Math.max(1, state.totalDrawingDuration)) * 100));

      state.drawingPlan.forEach((instr, index) => {
        if (elapsed >= instr.startTime) {
          const phaseProgress = Math.min(
            (elapsed - instr.startTime) / Math.max(1, instr.endTime - instr.startTime),
            1,
          );
          ctx.globalAlpha = Math.pow(phaseProgress, 2);
          drawElement(ctx, instr);

          if (index === 0) {
            drawCenterMotif(ctx, instr.x, instr.y, instr.size * 0.85);
          }
          ctx.globalAlpha = 1;
        }
      });
    } else {
      setIsComplete(true);
      setProgressPercent(100);

      const rotFactor = rotationSpeedFactor();
      const rotationSpeed = 0.000002 * rotFactor;
      const rotationAngle = (elapsed - state.totalDrawingDuration) * rotationSpeed * Math.PI * 2;

      ctx.save();
      ctx.translate(state.currentCenterX, state.currentCenterY);
      ctx.rotate(rotationAngle);
      ctx.translate(-state.currentCenterX, -state.currentCenterY);

      const activeLayers = layers().filter((l) => l.enabled);
      activeLayers.forEach((layer) => {
        const animatableLayers = activeLayers.filter((l) => l.hasPulse);
        const currentPulseLayerIndex = animatableLayers.indexOf(layer);

        for (let i = 0; i < layer.elements; i++) {
          const isSecondary = layer.secondaryType && i % 2 === 1;
          const type = isSecondary && layer.secondaryType ? layer.secondaryType : layer.primaryType;
          let drawColor = isSecondary && layer.color2 ? layer.color2 : layer.color1;
          const size = layer.size * state.currentScaleFactor;

          if (
            layer.hasPulse &&
            currentPulseLayerIndex !== -1 &&
            Math.floor(elapsed / 2000) % animatableLayers.length === currentPulseLayerIndex
          ) {
            const pulseDuration = 8000;
            const pulseProgress = (elapsed % pulseDuration) / pulseDuration;
            const activeElementIndex = Math.floor(pulseProgress * layer.elements);
            if (i === activeElementIndex) {
              drawColor = PALETTE.shimmerWhite;
            }
          }

          const angle = ((2 * Math.PI) / layer.elements) * i;
          const r = layer.radius * state.currentScaleFactor;
          const x = state.currentCenterX + Math.cos(angle) * r;
          const y = state.currentCenterY + Math.sin(angle) * r;

          drawElement(ctx, {
            type,
            size,
            x,
            y,
            angle: angle + Math.PI / 2,
            color: drawColor,
            strokeColor: layer.strokeColor,
          });

          if (layer.id === 0 && i === 0) {
            drawCenterMotif(ctx, x, y, size * 0.85);
          }
        }
      });

      ctx.restore();
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

  const updateLayer = (id: number, updater: (prev: LayerConfig) => LayerConfig) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? updater(l) : l)));
    restart();
  };

  const resetToDefault = () => {
    setLayers(JSON.parse(JSON.stringify(DEFAULT_LAYERS)));
    setMotif("foss");
    setSpeedMultiplier(1);
    setRotationSpeedFactor(1);
    restart();
  };

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

    const activeLayers = layers().filter((l) => l.enabled);

    activeLayers.forEach((layer) => {
      for (let i = 0; i < layer.elements; i++) {
        const isSecondary = layer.secondaryType && i % 2 === 1;
        const type = isSecondary && layer.secondaryType ? layer.secondaryType : layer.primaryType;
        const drawColor = isSecondary && layer.color2 ? layer.color2 : layer.color1;
        const elemSize = layer.size * scale;

        const angle = ((2 * Math.PI) / layer.elements) * i;
        const r = layer.radius * scale;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        drawElement(ctx, {
          type,
          size: elemSize,
          x,
          y,
          angle: angle + Math.PI / 2,
          color: drawColor,
          strokeColor: layer.strokeColor,
        });

        if (layer.id === 0 && i === 0) {
          drawCenterMotif(ctx, x, y, elemSize * 0.85);
        }
      }
    });

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

      {/* Control Strip & Config Button */}
      <div class="w-full md:w-72 rounded-xl p-5 bg-[#1a2352] border-2 border-white/20 text-white flex flex-col justify-between space-y-4 shadow-xl">
        <div class="space-y-2.5">
          <div class="inline-flex items-center gap-1.5 text-xs font-black uppercase px-2.5 py-0.5 rounded bg-[var(--pop-yellow)] text-[var(--ink)] border border-[var(--ink)]">
            <Sparkles size={12} />
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

          {/* Configurable Layer Options Button */}
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            class="w-full py-2 px-3 rounded-xl bg-[var(--pop-yellow)] text-[var(--ink)] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_var(--ink)] hover:bg-[var(--pop-teal)] transition-all cursor-pointer"
          >
            <Sliders size={14} strokeWidth={2.5} />
            <span>Customize Layers & Speed</span>
          </button>

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

      {/* ---------------------------------------------------- CONFIGURATION MODAL / DRAWER */}
      <Show when={showConfigModal()}>
        <div
          class="fixed inset-0 z-50 bg-[#121b44]/80 backdrop-blur-md p-4 flex items-center justify-center overflow-y-auto"
          onClick={() => setShowConfigModal(false)}
        >
          <div
            class="relative max-w-2xl w-full rounded-2xl bg-[var(--paper)] text-[var(--ink)] border-4 border-[var(--ink)] shadow-[8px_8px_0px_0px_var(--ink)] p-5 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div class="flex items-center justify-between border-b-2 border-[var(--ink)] pb-3">
              <div class="flex items-center gap-2">
                <Sliders size={20} class="text-[var(--pop-pink)]" />
                <h3
                  class="text-xl sm:text-2xl font-black"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  Pookalam Studio Customizer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                class="w-8 h-8 rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center hover:bg-[var(--pop-red)] hover:text-white transition-colors cursor-pointer shadow-[2px_2px_0px_0px_var(--ink)]"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            {/* Global Speed & Center Motif */}
            <div class="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)]">
              {/* Draw Speed */}
              <div class="space-y-1.5">
                <label class="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                  <span>Draw / Bloom Speed</span>
                  <span class="font-mono text-[var(--pop-pink)]">{speedMultiplier()}x</span>
                </label>
                <div class="grid grid-cols-4 gap-1.5 text-xs font-bold">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedMultiplier(spd);
                        restart();
                      }}
                      class={`py-1 rounded border border-[var(--ink)] ${
                        speedMultiplier() === spd
                          ? "bg-[var(--pop-yellow)] font-black"
                          : "bg-[var(--paper)] opacity-80"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Center Motif */}
              <div class="space-y-1.5">
                <label class="text-xs font-black uppercase tracking-wider">Center Motif</label>
                <div class="grid grid-cols-4 gap-1.5 text-xs font-bold">
                  {[
                    { id: "foss", label: "FOSS" },
                    { id: "tux", label: "Tux" },
                    { id: "crab", label: "Rust" },
                    { id: "lamp", label: "Lamp" },
                  ].map((m) => (
                    <button
                      type="button"
                      onClick={() => {
                        setMotif(m.id as CenterMotif);
                        restart();
                      }}
                      class={`py-1 rounded border border-[var(--ink)] ${
                        motif() === m.id
                          ? "bg-[var(--pop-teal)] font-black"
                          : "bg-[var(--paper)] opacity-80"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Layer by Layer Customizer */}
            <div class="space-y-3">
              <h4 class="text-xs font-black uppercase tracking-wider text-[var(--ink-soft)]">
                Concentric Layer Elements & Counts
              </h4>

              <div class="space-y-2.5">
                <For each={layers()}>
                  {(layer) => (
                    <div class="p-3 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] space-y-2 text-xs">
                      <div class="flex items-center justify-between font-black">
                        <label class="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={layer.enabled}
                            onChange={(e) =>
                              updateLayer(layer.id, (l) => ({
                                ...l,
                                enabled: e.currentTarget.checked,
                              }))
                            }
                            class="accent-[var(--pop-teal)] w-4 h-4 cursor-pointer"
                          />
                          <span>{layer.name}</span>
                        </label>
                        <span class="font-mono text-[var(--ink-soft)]">{layer.elements} items</span>
                      </div>

                      <Show when={layer.enabled && layer.id > 0}>
                        <div class="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--ink)]/10">
                          {/* Element Type Picker */}
                          <div class="space-y-1">
                            <span class="text-[10px] uppercase font-bold text-[var(--ink-soft)]">
                              Element Shape
                            </span>
                            <select
                              value={layer.primaryType}
                              onChange={(e) =>
                                updateLayer(layer.id, (l) => ({
                                  ...l,
                                  primaryType: e.currentTarget.value as ElementType,
                                }))
                              }
                              class="w-full p-1.5 rounded bg-[var(--paper)] border border-[var(--ink)] font-bold text-xs cursor-pointer"
                            >
                              <For each={ELEMENT_OPTIONS}>
                                {(opt) => (
                                  <option value={opt.type}>
                                    {opt.icon} {opt.label}
                                  </option>
                                )}
                              </For>
                            </select>
                          </div>

                          {/* Element Count Slider */}
                          <div class="space-y-1">
                            <span class="text-[10px] uppercase font-bold text-[var(--ink-soft)]">
                              Count: {layer.elements}
                            </span>
                            <input
                              type="range"
                              min="4"
                              max="64"
                              step="4"
                              value={layer.elements}
                              onInput={(e) =>
                                updateLayer(layer.id, (l) => ({
                                  ...l,
                                  elements: Number(e.currentTarget.value),
                                }))
                              }
                              class="w-full accent-[var(--pop-pink)] cursor-pointer"
                            />
                          </div>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Footer Actions */}
            <div class="flex items-center justify-between gap-3 pt-3 border-t-2 border-[var(--ink)]">
              <button
                type="button"
                onClick={resetToDefault}
                class="px-4 py-2 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] font-black text-xs hover:bg-[var(--pop-red)] hover:text-white transition-colors cursor-pointer"
              >
                Reset to 2025 Peak
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  restart();
                }}
                class="btn-brand py-2 px-6 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[2px_2px_0px_0px_var(--ink)] cursor-pointer"
              >
                <Check size={14} strokeWidth={3} />
                <span>Apply & Rebloom</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
