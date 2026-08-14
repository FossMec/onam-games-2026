import {
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
} from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

export type ElementType = "leafPetal" | "tulipPetal" | "smallFlower" | "dot" | "woven" | "heart";

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

// Exact vector rendering of the mathematical canvas elements
function ShapeIcon(props: { type: ElementType }) {
  switch (props.type) {
    case "smallFlower":
      return (
        <svg viewBox="-12 -12 24 24" class="w-3.5 h-3.5 fill-current">
          <g>
            <ellipse cx="0" cy="-4.5" rx="2.2" ry="4.5" transform="rotate(0)" />
            <ellipse cx="0" cy="-4.5" rx="2.2" ry="4.5" transform="rotate(72)" />
            <ellipse cx="0" cy="-4.5" rx="2.2" ry="4.5" transform="rotate(144)" />
            <ellipse cx="0" cy="-4.5" rx="2.2" ry="4.5" transform="rotate(216)" />
            <ellipse cx="0" cy="-4.5" rx="2.2" ry="4.5" transform="rotate(288)" />
          </g>
        </svg>
      );
    case "tulipPetal":
      return (
        <svg viewBox="-10 -10 20 20" class="w-3.5 h-3.5 fill-current">
          <path d="M 0 -8 Q 6 0 0 8 Q -6 0 0 -8 Z" />
        </svg>
      );
    case "leafPetal":
      return (
        <svg viewBox="-10 -10 20 20" class="w-3.5 h-3.5 fill-current">
          <path d="M 0 -8 C 4.5 -4 4.5 4 0 8 C -4.5 4 -4.5 -4 0 -8 Z" />
        </svg>
      );
    case "dot":
      return (
        <svg viewBox="-10 -10 20 20" class="w-3.5 h-3.5 fill-current">
          <circle cx="0" cy="0" r="4.5" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="-10 -10 20 20" class="w-3.5 h-3.5 fill-current">
          <path d="M 0 -3.5 C 5 -8 7 0 0 6.5 C -7 0 -5 -8 0 -3.5 Z" />
        </svg>
      );
    case "woven":
      return (
        <svg
          viewBox="-12 -12 24 24"
          class="w-3.5 h-3.5 stroke-current fill-none"
          stroke-width="1.8"
        >
          <g transform="rotate(45)">
            <ellipse cx="0" cy="0" rx="4" ry="8" />
            <ellipse cx="0" cy="0" rx="8" ry="4" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

const SHAPES: { type: ElementType; label: string }[] = [
  { type: "smallFlower", label: "Rosette" },
  { type: "tulipPetal", label: "Tulip" },
  { type: "leafPetal", label: "Leaf" },
  { type: "dot", label: "Pearl" },
  { type: "heart", label: "Heart" },
  { type: "woven", label: "Mesh" },
];

const MOTIFS: { id: CenterMotif; label: string; icon: string }[] = [
  { id: "foss", label: "FOSS MEC", icon: "⚙️" },
  { id: "tux", label: "Tux Linux", icon: "🐧" },
  { id: "crab", label: "Ferris Rust", icon: "🦀" },
  { id: "lamp", label: "Nilavilakku", icon: "🪔" },
];

export function PookalamInteractiveCanvas() {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [activeTab, setActiveTab] = createSignal<"layers" | "quick">("layers");
  const [isPaused, setIsPaused] = createSignal(false);
  const [isComplete, setIsComplete] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);

  // Configurable options
  const [motif, setMotif] = createSignal<CenterMotif>("foss");
  const [speedMultiplier, setSpeedMultiplier] = createSignal<number>(1);
  const [rotationSpeedFactor, setRotationSpeedFactor] = createSignal<number>(1);
  const [countMultiplier, setCountMultiplier] = createSignal<number>(1);

  // Layer custom element shape slot overrides
  const [slotOverrides, setSlotOverrides] = createSignal<Record<string, ElementType>>({});
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

  const getSlot = (layerId: number, slotIdx: number, defaultShape: ElementType): ElementType => {
    return slotOverrides()[`${layerId}_${slotIdx}`] || defaultShape;
  };

  // Exact 2025 Multi-Spec Layer Blueprint
  const getLayers = (): Layer[] => {
    const scale = state.currentScaleFactor;
    const cMul = countMultiplier();
    const enabled = enabledLayers();

    const allLayers: Layer[] = [
      {
        id: 0,
        name: "Center Emblem",
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
            type: getSlot(1, 0, "dot"),
            size: 3 * scale,
            color: PALETTE.white,
          },
          {
            type: getSlot(1, 1, "smallFlower"),
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
            type: getSlot(2, 0, "smallFlower"),
            size: 18 * scale,
            color: PALETTE.white,
          },
          {
            type: getSlot(2, 1, "dot"),
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
            type: getSlot(3, 0, "dot"),
            size: 5 * scale,
            color: PALETTE.amber,
          },
          {
            type: getSlot(3, 0, "dot"),
            size: 5 * scale,
            color: PALETTE.deepOrange,
          },
          {
            type: getSlot(3, 1, "tulipPetal"),
            size: 22 * scale,
            color: PALETTE.offWhite,
          },
          {
            type: getSlot(3, 0, "dot"),
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
            type: getSlot(4, 0, "dot"),
            size: 8 * scale,
            color: PALETTE.amber,
          },
          {
            type: getSlot(4, 1, "dot"),
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
            type: getSlot(5, 0, "leafPetal"),
            size: 25 * scale,
            color: PALETTE.leafGreen,
          },
          {
            type: getSlot(5, 1, "heart"),
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
            type: getSlot(6, 0, "dot"),
            size: 6 * scale,
            color: PALETTE.orange,
          },
          {
            type: getSlot(6, 1, "leafPetal"),
            size: 30 * scale,
            color: PALETTE.white,
          },
          {
            type: getSlot(6, 0, "dot"),
            size: 3 * scale,
            color: PALETTE.orange,
          },
          {
            type: getSlot(6, 1, "leafPetal"),
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
            type: getSlot(7, 0, "smallFlower"),
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
    reinitializeCanvas();
  };

  const onSettingsChange = () => {
    buildPlan();
  };

  const setSlotShape = (layerId: number, slotIdx: number, shape: ElementType) => {
    setSlotOverrides((prev) => ({ ...prev, [`${layerId}_${slotIdx}`]: shape }));
    onSettingsChange();
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
              drawColor = PALETTE.shimmerWhite;
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
    onSettingsChange();
  };

  const resetToPeak = () => {
    setMotif("foss");
    setSpeedMultiplier(1);
    setRotationSpeedFactor(1);
    setCountMultiplier(1);
    setSlotOverrides({});
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
    onSettingsChange();
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

  const layerConfigs = [
    {
      id: 1,
      name: "Layer 1: Inner Rosette Ring",
      slots: [
        { idx: 0, label: "Pearl Dots", default: "dot" as ElementType },
        { idx: 1, label: "Mini Rosettes", default: "smallFlower" as ElementType },
      ],
    },
    {
      id: 2,
      name: "Layer 2: Star Flowers",
      slots: [
        { idx: 0, label: "Star Rosettes", default: "smallFlower" as ElementType },
        { idx: 1, label: "Orange Pearls", default: "dot" as ElementType },
      ],
    },
    {
      id: 3,
      name: "Layer 3: Tulip & Pearl Ring",
      slots: [
        { idx: 0, label: "Surrounding Pearls", default: "dot" as ElementType },
        { idx: 1, label: "Tulip Petals", default: "tulipPetal" as ElementType },
      ],
    },
    {
      id: 4,
      name: "Layer 4: Dual Pearl Ring",
      slots: [
        { idx: 0, label: "Amber Pearls", default: "dot" as ElementType },
        { idx: 1, label: "Orange Pearls", default: "dot" as ElementType },
      ],
    },
    {
      id: 5,
      name: "Layer 5: Foliage & Hearts",
      slots: [
        { idx: 0, label: "Green Leaves", default: "leafPetal" as ElementType },
        { idx: 1, label: "Gray Hearts", default: "heart" as ElementType },
      ],
    },
    {
      id: 6,
      name: "Layer 6: Grand White Petals",
      slots: [
        { idx: 0, label: "Pearl Spacers", default: "dot" as ElementType },
        { idx: 1, label: "Grand Petals", default: "leafPetal" as ElementType },
      ],
    },
    {
      id: 7,
      name: "Layer 7: Outer Perimeter",
      slots: [{ idx: 0, label: "Outer Rosettes", default: "smallFlower" as ElementType }],
    },
  ];

  return (
    <div
      class="relative w-full rounded-2xl overflow-hidden border-4 border-[var(--ink)] shadow-[8px_8px_0px_0px_var(--ink)] p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 transition-all duration-300"
      style={{ background: "#121b44" }}
    >
      {/* ---------------------------------------------------- LEFT / CENTER: LIVE CANVAS */}
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
      </div>

      {/* ---------------------------------------------------- RIGHT / BOTTOM: COLLAPSIBLE CONTROLS */}
      <Show
        when={!isCollapsed()}
        fallback={
          /* Collapsed Pill in regular layout flow */
          <div class="w-full lg:w-auto flex justify-center py-2">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              class="w-full lg:w-auto py-2.5 px-5 rounded-xl bg-[#1a2352] border-2 border-white/20 text-white font-black text-xs flex items-center justify-center gap-2 hover:border-white/40 cursor-pointer shadow-lg"
            >
              <Sliders size={14} class="text-[var(--pop-yellow)]" />
              <span>Open Studio Controls</span>
            </button>
          </div>
        }
      >
        <div class="w-full lg:w-[420px] rounded-xl p-4 sm:p-5 bg-[#1a2352] border-2 border-white/20 text-white flex flex-col justify-between space-y-4 shadow-xl shrink-0 transition-all duration-300">
          <div>
            {/* Header, Tabs & Collapse Toggle */}
            <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3">
              <div class="flex items-center gap-1.5">
                <Sparkles size={16} class="text-[var(--pop-yellow)]" />
                <h3 class="text-sm font-black text-white uppercase tracking-tight">
                  Studio Controls
                </h3>
              </div>

              <div class="flex items-center gap-1.5">
                {/* Inline Navigation Tabs */}
                <div class="flex items-center p-0.5 rounded-lg bg-[#121b44] border border-white/10 text-xs font-bold">
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
                    <span>Speed</span>
                  </button>
                </div>

                {/* Collapse Button (Desktop: ChevronRight, Mobile: ChevronDown) */}
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  class="p-1 rounded-lg bg-[#121b44] border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Collapse Controls Panel"
                >
                  <span class="hidden lg:inline-block">
                    <ChevronRight size={15} />
                  </span>
                  <span class="inline-block lg:hidden">
                    <ChevronDown size={15} />
                  </span>
                </button>
              </div>
            </div>

            {/* TAB 1: CENTER LOGO & LAYER ITEM SHAPE PICKERS */}
            <Show when={activeTab() === "layers"}>
              <div class="space-y-2.5 max-h-[310px] overflow-y-auto pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div class="flex items-center justify-between text-[11px] uppercase font-black text-gray-300 pb-1">
                  <span>Customise Motifs & Rings</span>
                  <button
                    type="button"
                    onClick={resetToPeak}
                    class="text-[10px] text-[var(--pop-yellow)] hover:underline cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>

                {/* 1. CENTER LOGO EMBLEM SELECTOR */}
                <div
                  class={`p-2.5 rounded-lg border transition-all space-y-2 ${
                    (enabledLayers()[0] ?? true)
                      ? "bg-[#25306d] border-white/25 text-white"
                      : "bg-[#141b40] border-white/10 text-gray-400 opacity-60"
                  }`}
                >
                  <div class="flex items-center justify-between text-xs font-bold">
                    <span class="text-[11px] font-black">Center Logo Emblem</span>
                    <button
                      type="button"
                      onClick={() => toggleLayer(0)}
                      class={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                        (enabledLayers()[0] ?? true)
                          ? "bg-[var(--pop-yellow)] text-[var(--ink)]"
                          : "bg-white/10 text-gray-400"
                      }`}
                    >
                      {(enabledLayers()[0] ?? true) ? "Active" : "Hidden"}
                    </button>
                  </div>

                  <Show when={enabledLayers()[0] ?? true}>
                    <div class="grid grid-cols-4 gap-1.5 pt-0.5">
                      <For each={MOTIFS}>
                        {(m) => {
                          const isSelected = () => motif() === m.id;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setMotif(m.id);
                                onSettingsChange();
                              }}
                              class={`py-1.5 px-1 rounded flex flex-col items-center justify-center transition-all cursor-pointer ${
                                isSelected()
                                  ? "bg-[var(--pop-teal)] text-[var(--ink)] font-black scale-105 shadow-sm"
                                  : "bg-[#121b44] hover:bg-[#202b66] text-gray-300 hover:text-white"
                              }`}
                            >
                              <span class="text-sm leading-none">{m.icon}</span>
                              <span class="text-[8px] font-bold leading-tight truncate mt-1">
                                {m.label.split(" ")[0]}
                              </span>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* 2. CONCENTRIC RINGS (1 to 7) */}
                <For each={layerConfigs}>
                  {(l) => {
                    const isEnabled = () => enabledLayers()[l.id] ?? true;

                    return (
                      <div
                        class={`p-2.5 rounded-lg border transition-all space-y-2 ${
                          isEnabled()
                            ? "bg-[#25306d] border-white/25 text-white"
                            : "bg-[#141b40] border-white/10 text-gray-400 opacity-60"
                        }`}
                      >
                        <div class="flex items-center justify-between text-xs font-bold">
                          <span class="text-[11px] font-black">{l.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleLayer(l.id)}
                            class={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                              isEnabled()
                                ? "bg-[var(--pop-yellow)] text-[var(--ink)]"
                                : "bg-white/10 text-gray-400"
                            }`}
                          >
                            {isEnabled() ? "Active" : "Hidden"}
                          </button>
                        </div>

                        {/* Repeating / Alternating Shape Slots */}
                        <Show when={isEnabled()}>
                          <div class="space-y-1.5 pt-0.5">
                            <For each={l.slots}>
                              {(slot) => {
                                const currentShape = () => getSlot(l.id, slot.idx, slot.default);

                                return (
                                  <div class="space-y-1 bg-[#18204d]/70 p-1.5 rounded-md border border-white/10">
                                    <div class="flex items-center justify-between text-[10px] font-bold text-gray-300">
                                      <span class="truncate">{slot.label}</span>
                                      <span class="font-mono text-[9px] text-[var(--pop-yellow)] uppercase">
                                        {currentShape()}
                                      </span>
                                    </div>

                                    {/* Shape Picker Row with Exact SVG Vectors */}
                                    <div class="grid grid-cols-6 gap-1">
                                      <For each={SHAPES}>
                                        {(s) => {
                                          const isSelected = () => currentShape() === s.type;
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => setSlotShape(l.id, slot.idx, s.type)}
                                              class={`py-1 px-0.5 rounded flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                isSelected()
                                                  ? "bg-[var(--pop-teal)] text-[var(--ink)] font-black scale-105 shadow-sm"
                                                  : "bg-[#121b44] hover:bg-[#202b66] text-gray-300 hover:text-white"
                                              }`}
                                              title={s.label}
                                            >
                                              <span class="flex items-center justify-center h-3.5 w-3.5">
                                                <ShapeIcon type={s.type} />
                                              </span>
                                              <span class="text-[7.5px] font-bold leading-tight truncate mt-0.5">
                                                {s.label}
                                              </span>
                                            </button>
                                          );
                                        }}
                                      </For>
                                    </div>
                                  </div>
                                );
                              }}
                            </For>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* TAB 2: SPEED & MOTIF */}
            <Show when={activeTab() === "quick"}>
              <div class="space-y-3.5 text-xs">
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
                          onSettingsChange();
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
                          onSettingsChange();
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
                        onClick={() => {
                          setRotationSpeedFactor(rot.val);
                          onSettingsChange();
                        }}
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
      </Show>
    </div>
  );
}
