import { Download, Layers, Play, RotateCcw, Sliders, Sparkles } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

type ElementType = "leafPetal" | "tulipPetal" | "smallFlower" | "dot" | "woven" | "heart";

type ElementSpec = {
  type: ElementType;
  size: number;
  color: string;
  strokeColor?: string;
};

type Layer = {
  id: number;
  name: string;
  enabled: boolean;
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

export type CenterMotif = "foss" | "tux" | "crab" | "lamp";

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

  const [activeTab, setActiveTab] = createSignal<"quick" | "layers">("quick");
  const [isPaused, setIsPaused] = createSignal(false);
  const [isComplete, setIsComplete] = createSignal(false);
  const [progressPercent, setProgressPercent] = createSignal(0);

  // Configurable options
  const [motif, setMotif] = createSignal<CenterMotif>("foss");
  const [speedMultiplier, setSpeedMultiplier] = createSignal<number>(1);
  const [rotationSpeedFactor, setRotationSpeedFactor] = createSignal<number>(1);
  const [countMultiplier, setCountMultiplier] = createSignal<number>(1);
  const [enabledLayers, setEnabledLayers] = createSignal<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
  });

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

  // Exact 2025 Peak Layer Blueprint
  const getLayers = (): Layer[] => {
    const scale = state.currentScaleFactor;
    const cMul = countMultiplier();
    const enabled = enabledLayers();

    const allLayers: Layer[] = [
      {
        id: 0,
        name: "Center Medallion",
        enabled: enabled[0] ?? true,
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
        id: 1,
        name: "Inner Rosette Ring",
        enabled: enabled[1] ?? true,
        spec: [
          {
            type: "dot",
            size: 3 * scale,
            color: PALETTE.white,
          },
          {
            type: "smallFlower",
            size: 4 * scale,
            color: PALETTE.amber,
          },
        ],
        radius: 28 * scale,
        elements: Math.max(4, Math.round(8 * cMul)),
        duration: 400,
      },
      {
        id: 2,
        name: "White Star Flowers",
        enabled: enabled[2] ?? true,
        spec: [
          {
            type: "smallFlower",
            size: 18 * scale,
            color: PALETTE.white,
          },
          {
            type: "dot",
            size: 4 * scale,
            color: PALETTE.deepOrange,
          },
        ],
        radius: 50 * scale,
        elements: Math.max(8, Math.round(16 * cMul)),
        duration: 1600,
      },
      {
        id: 3,
        name: "Tulip & Green Bloom",
        enabled: enabled[3] ?? true,
        spec: [
          {
            type: "dot",
            size: 5 * scale,
            color: PALETTE.amber,
          },
          {
            type: "dot",
            size: 5 * scale,
            color: PALETTE.deepOrange,
          },
          {
            type: "tulipPetal",
            size: 22 * scale,
            color: PALETTE.offWhite,
          },
          {
            type: "dot",
            size: 5 * scale,
            color: PALETTE.leafGreen,
          },
        ],
        radius: 75 * scale,
        elements: Math.max(12, Math.round(32 * cMul)),
        duration: 1600,
        finalAnimation: { type: "pulse", color: PALETTE.shimmerWhite },
      },
      {
        id: 4,
        name: "Amber Pearl Dots",
        enabled: enabled[4] ?? true,
        spec: [
          {
            type: "dot",
            size: 8 * scale,
            color: PALETTE.amber,
          },
          {
            type: "dot",
            size: 8 * scale,
            color: PALETTE.orange,
          },
        ],
        radius: 100 * scale,
        elements: Math.max(12, Math.round(36 * cMul)),
        duration: 1800,
      },
      {
        id: 5,
        name: "Foliage & Hearts",
        enabled: enabled[5] ?? true,
        spec: [
          {
            type: "leafPetal",
            size: 25 * scale,
            color: PALETTE.leafGreen,
          },
          {
            type: "heart",
            size: 15 * scale,
            color: PALETTE.lightGray,
          },
        ],
        radius: 130 * scale,
        elements: Math.max(12, Math.round(32 * cMul)),
        duration: 2200,
      },
      {
        id: 6,
        name: "Grand White Petals",
        enabled: enabled[6] ?? true,
        spec: [
          {
            type: "dot",
            size: 6 * scale,
            color: PALETTE.orange,
          },
          {
            type: "leafPetal",
            size: 30 * scale,
            color: PALETTE.white,
          },
          {
            type: "dot",
            size: 3 * scale,
            color: PALETTE.orange,
          },
          {
            type: "leafPetal",
            size: 30 * scale,
            color: PALETTE.white,
          },
        ],
        radius: 165 * scale,
        elements: Math.max(16, Math.round(64 * cMul)),
        duration: 2800,
      },
      {
        id: 7,
        name: "Outer Rosette Perimeter",
        enabled: enabled[7] ?? true,
        spec: [
          {
            type: "smallFlower",
            size: 12 * scale,
            color: PALETTE.deepOrange,
          },
        ],
        radius: 190 * scale,
        elements: Math.max(12, Math.round(32 * cMul)),
        duration: 2400,
        finalAnimation: { type: "pulse", color: PALETTE.orange },
      },
    ];

    return allLayers.filter((l) => l.enabled);
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
    const layers = getLayers();
    const newDrawingPlan: DrawInstruction[] = [];
    let currentTime = 0;
    const speed = Math.max(0.25, speedMultiplier());

    layers.forEach((layer) => {
      const layerDuration = layer.duration / speed;
      const timePerElement = layerDuration / layer.elements;
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
      currentTime += layerDuration;
    });

    state.drawingPlan = newDrawingPlan;
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

          if (layer.id === 0 && i === 0) {
            drawCenterMotif(ctx, x, y, elementSpec.size * 0.85);
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

  const toggleLayer = (id: number) => {
    setEnabledLayers((prev) => ({ ...prev, [id]: !prev[id] }));
    restart();
  };

  const resetToPeak = () => {
    setMotif("foss");
    setSpeedMultiplier(1);
    setRotationSpeedFactor(1);
    setCountMultiplier(1);
    setEnabledLayers({
      0: true,
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true,
    });
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

    const layers = getLayers();

    layers.forEach((layer) => {
      const scaledRadius = (layer.radius / state.currentScaleFactor) * scale;
      for (let i = 0; i < layer.elements; i++) {
        const elementSpec = layer.spec[i % layer.spec.length];
        const scaledSize = (elementSpec.size / state.currentScaleFactor) * scale;
        const angle = ((2 * Math.PI) / layer.elements) * i + (layer.rotationOffset || 0);
        const x = cx + Math.cos(angle) * scaledRadius;
        const y = cy + Math.sin(angle) * scaledRadius;

        drawElement(ctx, {
          ...elementSpec,
          size: scaledSize,
          x,
          y,
          angle: angle + Math.PI / 2,
        });

        if (layer.id === 0 && i === 0) {
          drawCenterMotif(ctx, x, y, scaledSize * 0.85);
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

  const layerNames = [
    { id: 0, name: "Center Logo Medallion" },
    { id: 1, name: "Layer 1: Amber Mini Rosettes" },
    { id: 2, name: "Layer 2: White Star Rosettes" },
    { id: 3, name: "Layer 3: Tulip & Leaf Pearls" },
    { id: 4, name: "Layer 4: Dual Amber/Orange Pearls" },
    { id: 5, name: "Layer 5: Green Leaves & Gray Hearts" },
    { id: 6, name: "Layer 6: Grand White Petals" },
    { id: 7, name: "Layer 7: Outer Deep Orange Rosettes" },
  ];

  return (
    <div
      class="relative w-full rounded-2xl overflow-hidden border-4 border-[var(--ink)] shadow-[8px_8px_0px_0px_var(--ink)] p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6"
      style={{ background: "#121b44" }}
    >
      {/* ---------------------------------------------------- LEFT: LIVE CANVAS (No hover transform, zero obstruction) */}
      <div
        ref={(el) => (containerRef = el)}
        class="relative flex-1 flex items-center justify-center w-full min-w-0 max-w-[500px] aspect-square mx-auto"
      >
        <canvas
          ref={(el) => (canvasRef = el)}
          class="object-contain cursor-pointer select-none rounded-full"
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

      {/* ---------------------------------------------------- RIGHT: INLINE CONTROLS */}
      <div class="w-full lg:w-[380px] rounded-xl p-4 sm:p-5 bg-[#1a2352] border-2 border-white/20 text-white flex flex-col justify-between space-y-4 shadow-xl shrink-0">
        <div>
          {/* Header & Tabs */}
          <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3">
            <div class="flex items-center gap-1.5">
              <Sparkles size={16} class="text-[var(--pop-yellow)]" />
              <h3 class="text-sm font-black text-white uppercase tracking-tight">
                Studio Controls
              </h3>
            </div>

            {/* Inline Navigation Tabs */}
            <div class="flex items-center p-0.5 rounded-lg bg-[#121b44] border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("quick")}
                class={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab() === "quick"
                    ? "bg-[var(--pop-yellow)] text-[var(--ink)] font-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <Sliders size={12} />
                <span>Controls</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("layers")}
                class={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab() === "layers"
                    ? "bg-[var(--pop-yellow)] text-[var(--ink)] font-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <Layers size={12} />
                <span>Layers</span>
              </button>
            </div>
          </div>

          {/* TAB 1: QUICK CONTROLS */}
          <Show when={activeTab() === "quick"}>
            <div class="space-y-3.5 text-xs">
              <p class="text-gray-300 leading-relaxed text-[11px]">
                Watch the mathematical 2025 pookalam bloom in real time. Adjust speed, density, or
                center emblems.
              </p>

              {/* Center Motif Selector */}
              <div class="space-y-1.5">
                <label class="text-[11px] uppercase font-black text-gray-300 tracking-wider">
                  Center Motif Emblem
                </label>
                <div class="grid grid-cols-4 gap-1.5 font-bold">
                  {[
                    { id: "foss", label: "⚙️ FOSS" },
                    { id: "tux", label: "🐧 Tux" },
                    { id: "crab", label: "🦀 Rust" },
                    { id: "lamp", label: "🪔 Lamp" },
                  ].map((m) => (
                    <button
                      type="button"
                      onClick={() => {
                        setMotif(m.id as CenterMotif);
                        restart();
                      }}
                      class={`py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer text-xs ${
                        motif() === m.id
                          ? "bg-[var(--pop-teal)] text-[var(--ink)] border-[var(--ink)] font-black shadow-sm"
                          : "bg-[#25306d] border-white/20 text-gray-200 hover:border-white/40"
                      }`}
                    >
                      <span class="truncate block">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Draw Speed */}
              <div class="space-y-1.5">
                <div class="flex justify-between text-[11px] uppercase font-black text-gray-300">
                  <span>Draw / Bloom Speed</span>
                  <span class="font-mono text-[var(--pop-yellow)]">{speedMultiplier()}x</span>
                </div>
                <div class="grid grid-cols-4 gap-1.5 font-bold">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedMultiplier(spd);
                        restart();
                      }}
                      class={`py-1 rounded-lg border text-center transition-all cursor-pointer ${
                        speedMultiplier() === spd
                          ? "bg-[var(--pop-yellow)] text-[var(--ink)] border-[var(--ink)] font-black"
                          : "bg-[#25306d] border-white/20 text-gray-200"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Petal Density Multiplier */}
              <div class="space-y-1.5">
                <div class="flex justify-between text-[11px] uppercase font-black text-gray-300">
                  <span>Petal Density Multiplier</span>
                  <span class="font-mono text-[var(--pop-yellow)]">{countMultiplier()}x</span>
                </div>
                <div class="grid grid-cols-4 gap-1.5 font-bold">
                  {[0.5, 1, 1.5, 2].map((mul) => (
                    <button
                      type="button"
                      onClick={() => {
                        setCountMultiplier(mul);
                        restart();
                      }}
                      class={`py-1 rounded-lg border text-center transition-all cursor-pointer ${
                        countMultiplier() === mul
                          ? "bg-[var(--pop-pink)] text-white border-[var(--ink)] font-black"
                          : "bg-[#25306d] border-white/20 text-gray-200"
                      }`}
                    >
                      {mul}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Spin Mode */}
              <div class="space-y-1.5">
                <div class="flex justify-between text-[11px] uppercase font-black text-gray-300">
                  <span>Harmonic Rotation</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5 font-bold">
                  {[
                    { val: 0, label: "Off" },
                    { val: 1, label: "Serene" },
                    { val: 3, label: "Brisk" },
                  ].map((rot) => (
                    <button
                      type="button"
                      onClick={() => setRotationSpeedFactor(rot.val)}
                      class={`py-1 rounded-lg border text-center transition-all cursor-pointer ${
                        rotationSpeedFactor() === rot.val
                          ? "bg-[var(--pop-yellow)] text-[var(--ink)] border-[var(--ink)] font-black"
                          : "bg-[#25306d] border-white/20 text-gray-200"
                      }`}
                    >
                      {rot.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Show>

          {/* TAB 2: INLINE LAYER TOGGLES */}
          <Show when={activeTab() === "layers"}>
            <div class="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
              <div class="flex items-center justify-between text-[11px] uppercase font-black text-gray-300 pb-1">
                <span>Toggle 8 Peak Layers</span>
                <button
                  type="button"
                  onClick={resetToPeak}
                  class="text-[10px] text-[var(--pop-yellow)] hover:underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <For each={layerNames}>
                {(l) => {
                  const isEnabled = () => enabledLayers()[l.id] ?? true;
                  return (
                    <div
                      class={`p-2.5 rounded-lg border transition-all flex items-center justify-between text-xs cursor-pointer ${
                        isEnabled()
                          ? "bg-[#25306d] border-white/25 text-white"
                          : "bg-[#141b40] border-white/10 text-gray-400 opacity-60"
                      }`}
                      onClick={() => toggleLayer(l.id)}
                    >
                      <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isEnabled()}
                          onChange={() => toggleLayer(l.id)}
                          class="accent-[var(--pop-yellow)] w-3.5 h-3.5 cursor-pointer"
                        />
                        <span class="font-bold text-[11px]">{l.name}</span>
                      </label>
                      <span class="text-[10px] font-mono font-bold text-[var(--pop-yellow)]">
                        {isEnabled() ? "Active" : "Hidden"}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* Action Buttons */}
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
