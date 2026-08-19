import {
  Clock,
  Heart,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-solid";
import { For, Show, batch, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { EMPTY_BRUSH, FLOWERS, type Flower, drawFlower, flowerById } from "~/lib/pookalam-flowers";
import { CELL_COUNT, fromBase64, readCell, writeCell } from "~/lib/pookalam-grid";
import { PADDING_SCALE, SLOTS, slotAt } from "~/lib/pookalam-layout";
import { POOKALAM_CREDITS_EVENT, setPookalamDailyLimit } from "~/lib/pookalam-credits";
import type { CollabMessageItem } from "~/server/pookalam/comments";

const MAX_MESSAGE_CHARS = 100;
const MAX_CANVAS_PX_DESKTOP = 540;
const MAX_CANVAS_PX_MOBILE = 420;
const MIN_CANVAS_PX = 260;
const ZOOM_STEPS = [1, 1.6, 2.4, 3.2];
const GROUND = "#2b2733";

// Overwriting on top unlocks when <= 20% empty (i.e. >= 80% filled = 2000 cells)
const OVERWRITE_THRESHOLD = Math.floor(CELL_COUNT * 0.8);

// Client-side 20% limit per flower species across the whole pookalam
const MAX_FLOWER_PERCENT = 0.2;
const MAX_FLOWER_CELLS = Math.floor(CELL_COUNT * MAX_FLOWER_PERCENT); // 500 cells

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_BUCKET_KEY = "collab-pookalam:token-bucket";

type TokenBucket = {
  day: string;
  credits: number;
  lastCreditAt: number;
  balloonsToday: number;
};

export function CollabPookalam() {
  let canvas: HTMLCanvasElement | undefined;
  let shell: HTMLDivElement | undefined;
  let rootRef: HTMLDivElement | undefined;

  const [today, setToday] = createSignal<Uint8Array | null>(null);

  const [_dayKey, setDayKey] = createSignal("");
  const [placed, setPlaced] = createSignal(0);
  const [open, setOpen] = createSignal(true);
  const [canPlace, setCanPlace] = createSignal(false);
  const [isAdmin, setIsAdmin] = createSignal(false);
  const [allowance, setAllowance] = createSignal(30);
  const [bucket, setBucket] = createSignal<TokenBucket | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [picked, setPicked] = createSignal<Flower>(FLOWERS[0]);
  const [zoom, setZoom] = createSignal(1);
  const [fit, setFit] = createSignal(480);
  const [busy, setBusy] = createSignal(false);
  const [note, setNote] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [drawing, setDrawing] = createSignal(false);
  const [showHowTo, setShowHowTo] = createSignal(false);
  /** Canvas is view-only (admin killed drawing). */
  const [disableDrawing, setDisableDrawing] = createSignal(false);
  /** Wish bubbles + composer are hidden (admin killed comments). */
  const [disableComments, setDisableComments] = createSignal(false);

  // Wishes state (pool of up to 30 loaded once, smoothly rotated locally on client)
  const [messagePool, setMessagePool] = createSignal<CollabMessageItem[]>([]);
  const [displayedMessages, setDisplayedMessages] = createSignal<CollabMessageItem[]>([]);
  const [myMessage, setMyMessage] = createSignal<CollabMessageItem | null>(null);
  const [wishInput, setWishInput] = createSignal("");
  const [wishPosting, setWishPosting] = createSignal(false);
  const [wishNote, setWishNote] = createSignal("");

  const sampleMessages = (pool: CollabMessageItem[], myMsg: CollabMessageItem | null) => {
    if (pool.length === 0) return [];
    if (pool.length <= 6) return pool;

    const nowMs = Date.now();
    const weighted = pool.map((row) => {
      const ageMs = Math.max(0, nowMs - new Date(row.createdAt).getTime());
      const hoursOld = ageMs / (1000 * 60 * 60);
      const timeWeight = Math.exp(-hoursOld / 6) + 0.35;
      const likesWeight = 1 + row.likesCount * 0.85;
      const weight = timeWeight * likesWeight;
      return { row, weight };
    });

    const SAMPLE_SIZE = Math.min(6, pool.length);
    const selected: CollabMessageItem[] = [];
    const candidates = [...weighted];

    // Always include current user's message if present
    if (myMsg) {
      selected.push(myMsg);
      const myIdx = candidates.findIndex((c) => c.row.id === myMsg.id);
      if (myIdx >= 0) candidates.splice(myIdx, 1);
    }

    while (selected.length < SAMPLE_SIZE && candidates.length > 0) {
      const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
      let rand = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let i = 0; i < candidates.length; i++) {
        rand -= candidates[i].weight;
        if (rand <= 0) {
          chosenIdx = i;
          break;
        }
      }
      selected.push(candidates[chosenIdx].row);
      candidates.splice(chosenIdx, 1);
    }

    return selected;
  };

  const refreshDisplayed = () => {
    setDisplayedMessages(sampleMessages(messagePool(), myMessage()));
  };

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const saveBucket = (next: TokenBucket) => {
    setBucket(next);
    try {
      localStorage.setItem(TOKEN_BUCKET_KEY, JSON.stringify(next));
    } catch {
      /* storage disabled: state remains valid for this mount */
    }
    // Any bucket change (placement, refund, pop, or time refill) can cross the
    // "full vs collectable" boundary the balloon scheduler is gated on, so tell
    // it to re-check. The handler in this component only re-reads the stored
    // bucket, so this is idempotent - no loop.
    window.dispatchEvent(
      new CustomEvent<number>(POOKALAM_CREDITS_EVENT, { detail: Math.floor(next.credits) }),
    );
  };

  const refillBucket = (input: TokenBucket): TokenBucket => {
    const daily = Math.max(0, allowance());
    const cap = Math.min(Math.ceil(daily / 3), 100);
    const nowMs = Date.now();
    if (input.day !== todayKey()) {
      return {
        day: todayKey(),
        credits: cap,
        lastCreditAt: nowMs,
        balloonsToday: 0,
      };
    }
    const normalized: TokenBucket = {
      day: input.day,
      credits: Math.min(Math.max(0, input.credits), cap),
      balloonsToday: Math.min(Math.max(0, input.balloonsToday), Math.floor(daily / 5)),
      lastCreditAt: Math.min(input.lastCreditAt, nowMs),
    };
    if (daily <= 0) return normalized;
    const intervalMs = DAY_MS / daily;
    const generated = Math.floor(Math.max(0, nowMs - normalized.lastCreditAt) / intervalMs);
    if (generated === 0) return normalized;
    return {
      ...normalized,
      credits: Math.min(cap, normalized.credits + generated),
      lastCreditAt: normalized.lastCreditAt + generated * intervalMs,
    };
  };

  const refreshBucket = () => {
    const current = bucket();
    if (!current) return;
    const next = refillBucket(current);
    if (JSON.stringify(next) !== JSON.stringify(current)) saveBucket(next);
  };

  const recordPlacement = (count = 1) => {
    const current = bucket();
    if (!current) return;
    const refreshed = refillBucket(current);
    saveBucket({
      ...refreshed,
      credits: Math.max(0, refreshed.credits - count),
    });
  };

  const restoreCredits = (count: number) => {
    if (count <= 0) return;
    const current = bucket();
    if (!current) return;
    saveBucket({
      ...current,
      credits: Math.min(windowLimit(), current.credits + count),
    });
  };

  // Token bucket: daily tokens/3 maximum, with one token returning every 24h/dailyTokens.
  const windowLimit = () => Math.min(Math.ceil(allowance() / 3), 100);
  const dailyLimit = () => allowance();
  const availableTokens = () => {
    now();
    refreshBucket();
    const current = bucket();
    return current ? Math.floor(current.credits) : 0;
  };
  const windowRemaining = () => {
    refreshBucket();
    return Math.floor(bucket()?.credits ?? 0);
  };
  const left = () => availableTokens();
  const isWindowCapped = () => windowRemaining() <= 0;

  const nextDropIn = () => {
    now();
    refreshBucket();
    const current = bucket();
    if (!current || current.credits >= windowLimit() || allowance() <= 0) return null;
    const intervalMs = DAY_MS / allowance();
    const diffMs = Math.max(0, intervalMs - (Date.now() - current.lastCreditAt));
    const totalSeconds = Math.max(1, Math.ceil(diffMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${seconds}s`;
    if (mins > 0) return `${mins}m ${seconds}s`;
    return `${seconds}s`;
  };

  const initBucket = () => {
    try {
      const raw = localStorage.getItem(TOKEN_BUCKET_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<TokenBucket>) : null;
      const initial: TokenBucket = {
        day: typeof parsed?.day === "string" ? parsed.day : todayKey(),
        credits: typeof parsed?.credits === "number" ? parsed.credits : windowLimit(),
        lastCreditAt: typeof parsed?.lastCreditAt === "number" ? parsed.lastCreditAt : Date.now(),
        balloonsToday: typeof parsed?.balloonsToday === "number" ? parsed.balloonsToday : 0,
      };
      saveBucket(refillBucket(initial));
    } catch {
      saveBucket({
        day: todayKey(),
        credits: windowLimit(),
        lastCreditAt: Date.now(),
        balloonsToday: 0,
      });
    }
  };

  const howToSteps = () => [
    "Pick a poov from the catalogue — nine authentic Kerala flowers under their real Malayalam names.",
    "Tap a square to place it, or press and drag to lay a smooth line of petals at once.",
    `You can hold up to ${windowLimit()} credits. One credit returns every ${Math.round(DAY_MS / Math.max(1, allowance()) / 60000)} minutes, up to ${dailyLimit()} credits in a day.`,
    "Each flower species can occupy up to 20% of the pookalam to ensure a colorful, diverse carpet.",
    "Drawing on top of existing flowers unlocks once the canvas is 80% filled (less than 20% empty).",
    "Once you finish placing flowers in a window, you unlock the ability to post your daily Onam wish!",
    "Use the Eraser tool anytime if you want to clear a spot or adjust a section.",
    "The communal canvas lives forever — come back throughout the festival to create art together!",
  ];

  // Count occurrences of each flower on today's pookalam
  const flowerCounts = () => {
    const grid = today();
    const counts: Record<number, number> = {};
    for (const f of FLOWERS) counts[f.id] = 0;
    if (!grid) return counts;
    for (let i = 0; i < CELL_COUNT; i++) {
      const fid = readCell(grid, i);
      if (fid !== 0) counts[fid] = (counts[fid] || 0) + 1;
    }
    return counts;
  };

  const isFlowerCapped = (flowerId: number) => {
    return (flowerCounts()[flowerId] || 0) >= MAX_FLOWER_CELLS;
  };

  const canOverwrite = () => placed() >= OVERWRITE_THRESHOLD;

  const centerZoom = (nextZoom: number) => {
    if (nextZoom <= 1) return;
    requestAnimationFrame(() => {
      if (!shell) return;
      const targetScroll = (fit() * nextZoom - fit()) / 2;
      shell.scrollLeft = targetScroll;
      shell.scrollTop = targetScroll;
    });
  };

  const stepZoom = (direction: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom());
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + direction))] ?? 1;
    setZoom(next);
    centerZoom(next);
  };

  const loadMessages = async () => {
    try {
      const res = await fetch("/api/pookalam/messages");
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessagePool(data.messages);
        setMyMessage(data.myMessage || null);
        setIsAdmin(data.isAdmin || false);
        setDisplayedMessages(sampleMessages(data.messages, data.myMessage || null));
      }
    } catch {
      /* ignore message load error */
    }
  };

  const load = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/pookalam/state");
      const state = await res.json();
      setToday(fromBase64(state.today.cells));

      setDayKey(state.today.dayKey);
      setPlaced(state.today.placed);
      setOpen(state.open);
      setCanPlace(state.canPlace);
      setAllowance(state.dailyFlowers);
      setPookalamDailyLimit(state.dailyFlowers);
      setDisableDrawing(!!state.disableDrawing);
      setDisableComments(!!state.disableComments);
      initBucket();

      // If default picked flower is already capped, select first available
      if (isFlowerCapped(picked().id)) {
        const next = FLOWERS.find((f) => !isFlowerCapped(f.id));
        if (next) setPicked(next);
      }

      void loadMessages();
    } catch {
      setNote("Could not reach the pookalam. Try refresh.");
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  onMount(() => {
    const handleCredits = (event: Event) => {
      const amount = (event as CustomEvent<number>).detail;
      if (Number.isFinite(amount)) {
        const current = bucket();
        if (current) {
          try {
            const stored = JSON.parse(localStorage.getItem(TOKEN_BUCKET_KEY) ?? "null");
            if (stored?.day === todayKey()) setBucket(stored as TokenBucket);
          } catch {
            /* Keep the in-memory bucket when storage is unavailable. */
          }
        } else {
          // A global balloon can be popped before the pookalam API finishes loading.
          initBucket();
        }
      }
    };
    window.addEventListener(POOKALAM_CREDITS_EVENT, handleCredits);
    onCleanup(() => window.removeEventListener(POOKALAM_CREDITS_EVENT, handleCredits));
  });

  const toggleLike = async (messageId: string) => {
    const updateMsg = (m: CollabMessageItem) => {
      if (m.id !== messageId) return m;
      const nextLiked = !m.hasLiked;
      return {
        ...m,
        hasLiked: nextLiked,
        likesCount: nextLiked ? m.likesCount + 1 : Math.max(0, m.likesCount - 1),
      };
    };
    setMessagePool((prev) => prev.map(updateMsg));
    setDisplayedMessages((prev) => prev.map(updateMsg));
    if (myMessage()?.id === messageId) {
      setMyMessage((prev) => (prev ? updateMsg(prev) : null));
    }

    try {
      await fetch("/api/pookalam/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
    } catch {
      /* ignore */
    }
  };

  const deleteWish = async (messageId: string) => {
    setMessagePool((prev) => prev.filter((m) => m.id !== messageId));
    setDisplayedMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (myMessage()?.id === messageId) setMyMessage(null);
    try {
      await fetch("/api/pookalam/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
    } catch {
      /* ignore */
    }
  };

  const submitWish = async () => {
    const text = wishInput().trim();
    if (!text || wishPosting()) return;
    setWishPosting(true);
    setWishNote("");
    try {
      const res = await fetch("/api/pookalam/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const result = await res.json();
      if (result.ok && result.message) {
        setMyMessage(result.message);
        setMessagePool((prev) => [
          result.message,
          ...prev.filter((m) => m.id !== result.message.id),
        ]);
        setDisplayedMessages((prev) => [
          result.message,
          ...prev.filter((m) => m.id !== result.message.id),
        ]);
        setWishInput("");
        setWishNote("✨ Your Onam wish is now live beside the pookalam!");
      } else {
        setWishNote(result.reason || "Could not post your wish.");
      }
    } catch {
      setWishNote("Network error. Please try again.");
    } finally {
      setWishPosting(false);
    }
  };

  const measure = () => {
    if (typeof window === "undefined") return;
    const isDesktop = window.innerWidth >= 1024;
    const containerW =
      rootRef?.clientWidth ?? (isDesktop ? window.innerWidth - 64 : window.innerWidth - 24);
    const sideOverheadW = isDesktop ? 390 : 16;
    const availableW = Math.max(MIN_CANVAS_PX, containerW - sideOverheadW);
    const verticalOverhead = isDesktop ? 165 : 220;
    const availableH = window.innerHeight - verticalOverhead;
    const maxPx = isDesktop ? MAX_CANVAS_PX_DESKTOP : MAX_CANVAS_PX_MOBILE;
    const size = Math.min(maxPx, Math.max(MIN_CANVAS_PX, Math.min(availableW, availableH)));
    setFit(Math.floor(size));
  };

  onMount(() => {
    void load();
    measure();
    const observer = new ResizeObserver(measure);
    if (rootRef) observer.observe(rootRef);
    window.addEventListener("resize", measure);

    // Periodic live timer tick to update token refills and countdowns.
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    // Local client-side smooth rotation of displayed wishes every 15s (no server polling!)
    const rotateTimer = setInterval(refreshDisplayed, 15000);

    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      clearInterval(timer);
      clearInterval(rotateTimer);
      if (paintFrame !== undefined) cancelAnimationFrame(paintFrame);
      if (pinchFrame !== undefined) cancelAnimationFrame(pinchFrame);
      paintJob += 1;
      void flush();
    });
  });

  // A full pookalam can contain thousands of flowers across the current and
  // historical layers. Painting all of them in one task blocks navigation and
  // scrolling, especially on mobile. Keep only one render job alive and yield
  // between small batches so the page remains interactive while the artwork
  // fills in.
  let paintFrame: number | undefined;
  let paintJob = 0;

  /** Repaints canvas with crisp DPR without monopolising the main thread. */
  const paint = () => {
    const grid = today();
    if (!canvas || !grid || typeof window === "undefined") return;
    if (paintFrame !== undefined) cancelAnimationFrame(paintFrame);
    const job = ++paintJob;
    const css = fit();
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(css * dpr);
    canvas.height = Math.floor(css * dpr);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    // 1. Ground circular disc
    ctx.beginPath();
    ctx.arc(css / 2, css / 2, (css / 2) * PADDING_SCALE, 0, Math.PI * 2);
    ctx.fillStyle = GROUND;
    ctx.fill();

    // 2. Very subtle guideline outline with safe padding
    ctx.beginPath();
    ctx.arc(css / 2, css / 2, (css / 2) * PADDING_SCALE - 1, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(251, 243, 228, 0.08)";
    ctx.stroke();

    let cellIndex = 0;

    const drawBatch = (frameStart: number) => {
      if (!canvas || job !== paintJob) return;
      ctx.globalAlpha = 1;
      while (cellIndex < CELL_COUNT) {
        const i = cellIndex++;
        const id = readCell(grid, i);
        if (id !== 0) {
          const flower = flowerById(id);
          const slot = SLOTS[i];
          if (flower && slot) {
            const jitter = ((((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.12;
            const wobble = 0.98 + (((i * 40503) >>> 0) % 100) / 2500;
            drawFlower(
              ctx,
              slot.x * css,
              slot.y * css,
              slot.cellRadius * css * wobble,
              flower,
              slot.angle + jitter,
            );
          }
        }
        if (performance.now() - frameStart >= 5) {
          paintFrame = requestAnimationFrame(() => drawBatch(performance.now()));
          return;
        }
      }
      paintFrame = undefined;
    };

    paintFrame = requestAnimationFrame(() => drawBatch(performance.now()));
  };

  createEffect(() => {
    // Only re-paint when grid, history or fit size changes (not on every frame of zoom!)
    today();
    fit();
    paint();
  });

  const DEBOUNCE_MS = 350;
  const MAX_WAIT_MS = 1500;

  let stroke: number[] = [];
  let inFlight: Promise<void> = Promise.resolve();
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let maxWait: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (debounce) clearTimeout(debounce);
    if (maxWait) clearTimeout(maxWait);
    debounce = undefined;
    maxWait = undefined;
  };

  const scheduleFlush = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void flush(), DEBOUNCE_MS);
    if (!maxWait) maxWait = setTimeout(() => void flush(), MAX_WAIT_MS);
  };

  const allowanceLeftInStroke = () => left();

  /** Direct instant paint for 0ms latency during drawing */
  const drawCellDirect = (index: number, flower: Flower) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = fit();
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const slot = SLOTS[index];
    if (flower.id === 0) {
      ctx.beginPath();
      ctx.arc(slot.x * css, slot.y * css, slot.cellRadius * css * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = GROUND;
      ctx.fill();
      ctx.restore();
      return;
    }
    const jitter = ((((index * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.12;
    const wobble = 0.98 + (((index * 40503) >>> 0) % 100) / 2500;
    drawFlower(
      ctx,
      slot.x * css,
      slot.y * css,
      slot.cellRadius * css * wobble,
      flower,
      slot.angle + jitter,
    );
    ctx.restore();
  };

  const paintCell = (index: number): boolean => {
    const grid = today();
    if (!grid) return false;
    if (stroke.length >= allowanceLeftInStroke()) return false;

    const flower = picked();
    const existing = readCell(grid, index);

    // Prevent placing the same flower or erasing an already empty cell
    if (existing === flower.id) return false;

    // Check if square is already occupied and overwriting is not yet unlocked
    if (existing !== 0 && !canOverwrite() && flower.id !== 0) {
      setNote(
        `Square taken! Overwriting unlocks when the pookalam is 80% filled (${placed()}/${OVERWRITE_THRESHOLD}).`,
      );
      return false;
    }

    if (flower.id !== 0 && isFlowerCapped(flower.id)) {
      setNote(`${flower.name} reached the 20% limit. Pick another flower!`);
      const next = FLOWERS.find((f) => !isFlowerCapped(f.id));
      if (next) setPicked(next);
      return false;
    }

    // 1. Instant optimistic direct canvas draw (0ms lag!)
    drawCellDirect(index, flower);

    // 2. Update state in memory
    writeCell(grid, index, flower.id);
    stroke.push(index);
    recordPlacement(1);
    scheduleFlush();
    return true;
  };

  const flush = (): Promise<void> => {
    clearTimers();
    const cells = stroke;
    stroke = [];
    if (cells.length === 0) return inFlight;

    const flowerId = picked().id;
    inFlight = inFlight.then(async () => {
      try {
        const res = await fetch("/api/pookalam/stroke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cells: cells.map((index) => ({ index, flowerId })),
          }),
        });
        const result = (await res.json()) as {
          written: number[];
          placed: number;
          cells: string;
          reason?: string;
        };
        if (result && typeof result.placed === "number") {
          setPlaced(result.placed);
        }

        const kept = result?.written?.length ?? 0;
        if (kept < cells.length) {
          if (result?.reason) setNote(result.reason);
        }
        restoreCredits(cells.length - kept);
      } catch {
        restoreCredits(cells.length);
      }
    });
    return inFlight;
  };

  // Multi-touch pinch-to-zoom and stroke tracking
  const activePointers = new Map<number, { x: number; y: number }>();
  let initialPinchDist: number | null = null;
  let initialPinchZoom = 1;
  let initialPinchMidpoint: { x: number; y: number } | null = null;
  let initialPinchScroll = { left: 0, top: 0 };
  let latestPinchMidpoint: { x: number; y: number } | null = null;
  let pendingPinchZoom = 1;
  let pinchFrame: number | undefined;
  const [pinching, setPinching] = createSignal(false);
  let lastPointerPos: { x: number; y: number } | null = null;
  let lastPlacedIndex: number | null = null;

  const handlePointerDown = (event: PointerEvent) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size >= 2) {
      if (drawing()) endStroke();
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      if (p1 && p2 && shell) {
        setPinching(true);
        initialPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        initialPinchZoom = zoom();
        initialPinchMidpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        latestPinchMidpoint = initialPinchMidpoint;
        pendingPinchZoom = initialPinchZoom;
        initialPinchScroll = { left: shell.scrollLeft, top: shell.scrollTop };
      }
      return;
    }

    if (!canPlace() || busy() || !canvas) return;
    if (left() <= 0) {
      if (isWindowCapped()) {
        setNote(`No credits available. Next +1 credit in ${nextDropIn() ?? "soon"}.`);
      } else {
        setNote(`Daily limit reached (${dailyLimit()} flowers). Come back tomorrow for more!`);
      }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const index = slotAt(nx, ny);
    if (index === null) return;

    setNote("");
    stroke = [];
    setDrawing(true);
    lastPointerPos = { x: nx, y: ny };
    lastPlacedIndex = index;

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    paintCell(index);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // 2-finger pinch zoom
    if (activePointers.size >= 2 && initialPinchDist) {
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      if (p1 && p2) {
        const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const factor = currentDist / initialPinchDist;
        const nextZoom = Math.min(
          ZOOM_STEPS[ZOOM_STEPS.length - 1],
          Math.max(1, Math.round(initialPinchZoom * factor * 100) / 100),
        );
        setZoom(nextZoom);
        pendingPinchZoom = nextZoom;
        latestPinchMidpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        // Wait until Solid has applied the new transform and the browser has
        // expanded the scroll area. Assigning scrollLeft/Top in this pointer
        // event uses the old scroll bounds and causes the diagonal drift.
        if (pinchFrame === undefined) {
          pinchFrame = requestAnimationFrame(() => {
            pinchFrame = undefined;
            if (!shell || !initialPinchMidpoint || !latestPinchMidpoint) return;
            const shellRect = shell.getBoundingClientRect();
            const anchorX =
              (initialPinchScroll.left + initialPinchMidpoint.x - shellRect.left) /
              initialPinchZoom;
            const anchorY =
              (initialPinchScroll.top + initialPinchMidpoint.y - shellRect.top) / initialPinchZoom;
            shell.scrollLeft =
              anchorX * pendingPinchZoom - (latestPinchMidpoint.x - shellRect.left);
            shell.scrollTop = anchorY * pendingPinchZoom - (latestPinchMidpoint.y - shellRect.top);
          });
        }
      }
      return;
    }

    // 1-finger / mouse drawing with optimistic line interpolation
    if (!drawing() || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawEvents = (event as any).getCoalescedEvents
      ? ((event as any).getCoalescedEvents() as PointerEvent[])
      : [event];

    batch(() => {
      for (const ev of rawEvents) {
        const nx = (ev.clientX - rect.left) / rect.width;
        const ny = (ev.clientY - rect.top) / rect.height;

        if (lastPointerPos) {
          const dx = nx - lastPointerPos.x;
          const dy = ny - lastPointerPos.y;
          const dist = Math.hypot(dx, dy);
          const steps = Math.max(1, Math.ceil(dist / 0.0035));

          for (let s = 1; s <= steps; s++) {
            const px = lastPointerPos.x + dx * (s / steps);
            const py = lastPointerPos.y + dy * (s / steps);
            const cellIndex = slotAt(px, py);
            if (cellIndex !== null && cellIndex !== lastPlacedIndex) {
              const painted = paintCell(cellIndex);
              if (painted) {
                lastPlacedIndex = cellIndex;
              }
            }
          }
        } else {
          const cellIndex = slotAt(nx, ny);
          if (cellIndex !== null && cellIndex !== lastPlacedIndex) {
            const painted = paintCell(cellIndex);
            if (painted) lastPlacedIndex = cellIndex;
          }
        }
        lastPointerPos = { x: nx, y: ny };
      }
    });
  };

  const handlePointerUp = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) {
      initialPinchDist = null;
      initialPinchMidpoint = null;
      latestPinchMidpoint = null;
    }
    if (activePointers.size === 0) {
      setPinching(false);
      endStroke();
    }
  };

  const endStroke = () => {
    if (!drawing()) return;
    setDrawing(false);
    lastPointerPos = null;
    lastPlacedIndex = null;
  };

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      const next = Math.min(
        ZOOM_STEPS[ZOOM_STEPS.length - 1],
        Math.max(1, Math.round((zoom() + delta) * 10) / 10),
      );
      setZoom(next);
      centerZoom(next);
    }
  };

  // Split messages for outer left and outer right margins on desktop
  const leftOuterMessages = () =>
    displayedMessages()
      .filter((_, i) => i % 2 === 0)
      .slice(0, 2);
  const rightOuterMessages = () =>
    displayedMessages()
      .filter((_, i) => i % 2 === 1)
      .slice(0, 2);
  const mobileWishes = () => displayedMessages().slice(0, 3);

  return (
    <div
      ref={(el) => (rootRef = el)}
      class="w-full flex flex-col items-center justify-center space-y-2 relative"
    >
      {/* ---------------- Mobile Only Top Utility Bar ---------------- */}
      <div class="lg:hidden w-full flex items-center justify-between gap-1 px-1">
        <Show when={canPlace()}>
          <div class="flex items-center gap-1 shrink-0">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black"
              style={{
                background: windowRemaining() <= 0 ? "var(--paper-3)" : "var(--paper)",
                border: "var(--ink-w) solid var(--ink)",
                color: "var(--ink)",
              }}
              title="4-Hour Rolling Window Limit"
            >
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                classList={{
                  "bg-[var(--pop-teal)]": windowRemaining() > 0,
                  "bg-[var(--pop-red)]": windowRemaining() <= 0,
                }}
              />
              Credits:{" "}
              <strong>
                {windowRemaining()}/{windowLimit()}
              </strong>
            </span>
          </div>
        </Show>

        <div class="flex items-center gap-1 shrink-0 ml-auto">
          <button
            type="button"
            class="btn-ghost text-[10.5px] px-1.5 py-0.5 inline-flex items-center gap-1 font-extrabold cursor-pointer"
            onClick={() => setShowHowTo(true)}
            title="How to draw"
          >
            <HelpCircle size={12} strokeWidth={2.5} />
            <span class="hidden xs:inline">How to draw</span>
          </button>

          <div class="flex items-center gap-0.5">
            <button
              type="button"
              class="btn-ghost text-xs p-1 cursor-pointer"
              disabled={zoom() <= ZOOM_STEPS[0]}
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => stepZoom(-1)}
            >
              <ZoomOut size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              class="btn-ghost text-[10.5px] px-1.5 py-0.5 cursor-pointer font-bold"
              disabled={zoom() === 1}
              title="Fit"
              onClick={() => setZoom(1)}
            >
              Fit
            </button>
            <button
              type="button"
              class="btn-ghost text-xs p-1 cursor-pointer"
              disabled={zoom() >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => stepZoom(1)}
            >
              <ZoomIn size={12} strokeWidth={2.5} />
            </button>
          </div>

          <button
            type="button"
            class="btn-ghost text-xs p-1 inline-flex items-center justify-center cursor-pointer"
            disabled={busy()}
            onClick={() => void load()}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ---------------- Mobile Playful Scattered Mini Wishes (Non-overlapping) ---------------- */}
      <Show when={!disableComments() && mobileWishes().length > 0}>
        <div class="lg:hidden w-full flex items-center justify-center gap-2 py-0.5 px-1 overflow-x-auto scrollbar-none">
          <For each={mobileWishes()}>
            {(msg, idx) => (
              <WishBubble
                msg={msg}
                onLike={toggleLike}
                onDelete={deleteWish}
                isAdmin={isAdmin()}
                index={idx()}
                compact
              />
            )}
          </For>
        </div>
      </Show>

      {/* ---------------- Main Drawing Arena: Centered Canvas with Flank Toolbars & Outer Floating Wishes ---------------- */}
      <div class="flex items-center justify-center gap-2.5 lg:gap-3.5 w-full max-w-full relative">
        {/* Far Left Margin: Outer Floating Tilted Speech Bubbles (Desktop Only) */}
        <div class="hidden xl:flex flex-col items-end gap-3.5 shrink-0 w-44 self-center pointer-events-auto z-20 pr-1">
          <Show when={!disableComments()}>
            <For each={leftOuterMessages()}>
              {(msg, idx) => (
                <WishBubble
                  msg={msg}
                  onLike={toggleLike}
                  onDelete={deleteWish}
                  isAdmin={isAdmin()}
                  index={idx() * 2}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Left Toolbar: Desktop Vertical Poov Brushes */}
        <Show when={canPlace()}>
          <div
            class="hidden lg:flex flex-col card card-plain p-1.5 space-y-1 shrink-0 w-44 self-center transition-opacity"
            style={{
              border: "var(--ink-w) solid var(--ink)",
              background: "var(--paper)",
            }}
          >
            <div class="flex items-center justify-between px-0.5">
              <p class="font-black text-[10px] uppercase tracking-wider m-0 text-[var(--ink)]">
                Pick Poov
              </p>
              <Show when={left() <= 0}>
                <span class="text-[8.5px] font-black px-1 rounded bg-[var(--paper-3)] text-[var(--ink-soft)]">
                  {isWindowCapped() ? "Window limit" : "Daily limit"}
                </span>
              </Show>
            </div>

            <div
              class="flex flex-col gap-0.5 w-full transition-all"
              classList={{ "opacity-40 grayscale pointer-events-none": left() <= 0 }}
            >
              <For each={FLOWERS}>
                {(flower) => {
                  const capped = () => isFlowerCapped(flower.id);
                  return (
                    <button
                      type="button"
                      disabled={capped()}
                      title={
                        capped()
                          ? `${flower.name} (Max 20% reached)`
                          : `${flower.name} (${flower.english})`
                      }
                      onClick={() => setPicked(flower)}
                      class="flex items-center justify-between gap-1.5 px-2 py-1 rounded transition-all text-left w-full"
                      classList={{
                        "opacity-35 grayscale cursor-not-allowed": capped(),
                        "cursor-pointer": !capped(),
                      }}
                      style={{
                        border: "1.5px solid var(--ink)",
                        background:
                          picked().id === flower.id && !capped()
                            ? "var(--pop-yellow)"
                            : "var(--paper-2)",
                        transform:
                          picked().id === flower.id && !capped() ? "translateX(2px)" : undefined,
                      }}
                    >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <div class="w-5 h-5 shrink-0 flex items-center justify-center">
                          <FlowerSwatch flower={flower} size={20} />
                        </div>
                        <span class="text-[9px] font-black uppercase tracking-tight text-[var(--ink)] leading-tight whitespace-nowrap truncate">
                          {flower.name}
                        </span>
                      </div>
                      <Show when={capped()}>
                        <span class="text-[7px] font-black px-1 py-0.2 rounded bg-[var(--paper-3)] text-[var(--pop-red)] shrink-0">
                          20%
                        </span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>

            {/* Eraser Tool */}
            <button
              type="button"
              title="Eraser (Remove flower / clear square)"
              onClick={() => setPicked(EMPTY_BRUSH)}
              class="flex items-center gap-2 px-2 py-1 rounded transition-all cursor-pointer text-left w-full mt-0.5"
              style={{
                border: "1.5px dashed var(--ink)",
                background: picked().id === EMPTY_BRUSH.id ? "var(--pop-yellow)" : "var(--paper-2)",
                transform: picked().id === EMPTY_BRUSH.id ? "translateX(2px)" : undefined,
              }}
            >
              <div class="w-5 h-5 shrink-0 flex items-center justify-center rounded bg-[#2B2733] border border-[var(--ink)] text-[var(--pop-red)] font-black text-xs">
                ✕
              </div>
              <span class="text-[9px] font-black uppercase tracking-tight text-[var(--ink)] leading-tight whitespace-nowrap">
                Eraser (Empty)
              </span>
            </button>

            <Show when={left() <= 0}>
              <div class="text-[9px] font-bold text-center text-[var(--ink-soft)] pt-1 m-0 border-t border-[var(--ink)]/15 space-y-0.5">
                <Show
                  when={isWindowCapped()}
                  fallback={
                    <p class="m-0">Daily max ({dailyLimit()}) reached — resets at midnight!</p>
                  }
                >
                  <p class="m-0 flex items-center justify-center gap-1 text-[var(--pop-teal)] font-black">
                    <Clock size={10} strokeWidth={2.5} />
                    <span>Next +1 credit in {nextDropIn() ?? "soon"}</span>
                  </p>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* Center: Large Centered Canvas & Community Wish Box */}
        <div class="flex flex-col items-center justify-center shrink-0 max-w-full space-y-2">
          {/* Center Canvas Viewport (Fixed dimensions, never overflows surrounding layout) */}
          <div
            ref={(el) => (shell = el)}
            class="scrollbar-none relative rounded select-none"
            classList={{
              "overflow-auto": zoom() > 1,
              "overflow-hidden flex items-center justify-center": zoom() <= 1,
            }}
            style={{
              width: `${fit()}px`,
              height: `${fit()}px`,
              "max-width": "100%",
              "max-height": `${fit()}px`,
              border: "var(--ink-w-bold) solid var(--ink)",
              background: GROUND,
              "touch-action": zoom() > 1 ? "pan-x pan-y" : "none",
            }}
          >
            <div
              style={{
                width: `${fit() * zoom()}px`,
                height: `${fit() * zoom()}px`,
                position: "relative",
                transform: `scale(${zoom()})`,
                "transform-origin": "top left",
                transition: pinching() ? "none" : "transform 150ms cubic-bezier(0.2, 0, 0, 1)",
              }}
            >
              <canvas
                ref={(el) => (canvas = el)}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
                class="block select-none"
                style={{
                  width: `${fit()}px`,
                  height: `${fit()}px`,
                  "touch-action": canPlace() ? "none" : "pan-x pan-y",
                  cursor: canPlace()
                    ? 'url("/cursors/muthukuda-point.png") 6 2, crosshair'
                    : 'url("/cursors/muthukuda.png") 6 2, default',
                }}
              />
            </div>
          </div>

          <Show when={loaded() && !open()}>
            <p class="font-extrabold text-xs mt-1 text-center" style={{ color: "var(--pop-red)" }}>
              The shared pookalam is closed right now.
            </p>
          </Show>
          {/* Celebration banner shown when drawing is locked post-event */}
          <Show when={loaded() && disableDrawing()}>
            <div
              class="w-full max-w-[480px] text-center px-4 py-3 rounded space-y-0.5"
              style={{
                background: "var(--pop-yellow)",
                border: "var(--ink-w-bold) solid var(--ink)",
              }}
            >
              <p
                class="font-black text-sm leading-snug m-0"
                style={{ "font-family": "var(--font-stack-display)", color: "var(--ink)" }}
              >
                This pookalam was built together. 🌸
              </p>
              <p class="text-[11px] font-semibold m-0" style={{ color: "var(--ink)" }}>
                With your support, the community crafted this beautiful pookalam — every petal
                placed by a friend of FOSS MEC.
              </p>
            </div>
          </Show>
          <Show when={loaded() && open() && !disableDrawing() && !canPlace()}>
            <p class="font-semibold text-xs mt-1 text-center">
              <a
                href="/auth/signin"
                class="underline decoration-2 underline-offset-4 font-extrabold"
              >
                Sign in
              </a>{" "}
              to add your flowers.
            </p>
          </Show>
          <Show when={note()}>
            <p
              class="font-extrabold text-xs mt-1 text-center m-0"
              style={{ color: "var(--pop-red)" }}
            >
              {note()}
            </p>
          </Show>

          {/* ---------------- User Wish Composer / Status (Visible when window limit reached or for Admins) ---------------- */}
          <Show when={!disableComments() && canPlace() && (left() <= 0 || isAdmin())}>
            <div
              class="card card-plain p-2.5 rounded w-full max-w-[480px] space-y-1.5 transition-all text-left"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--paper)",
              }}
            >
              <Show
                when={!myMessage() || isAdmin()}
                fallback={
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 text-xs font-black text-[var(--ink)] min-w-0">
                      <Sparkles size={13} class="text-[var(--pop-yellow)] shrink-0" />
                      <span class="shrink-0">Your Wish:</span>
                      <span class="italic font-bold truncate">"{myMessage()!.message}"</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[10px] font-black text-[var(--pop-red)] flex items-center gap-1">
                        <Heart size={11} fill="var(--pop-red)" strokeWidth={2.5} />
                        {myMessage()!.likesCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteWish(myMessage()!.id)}
                        class="text-[var(--ink-soft)] hover:text-[var(--pop-red)] transition-colors p-0.5 cursor-pointer"
                        title="Delete your wish"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                }
              >
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[10.5px] font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1">
                      <MessageSquare size={12} class="text-[var(--pop-teal)]" />
                      <span>Leave an Onam Wish {isAdmin() ? "(Admin Mode)" : "(1 per day)"}</span>
                    </span>
                    <span class="text-[9px] font-black text-[var(--ink-soft)]">
                      {MAX_MESSAGE_CHARS - wishInput().length} chars left
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={MAX_MESSAGE_CHARS}
                      placeholder="Happy Onam from MEC! 🌸"
                      value={wishInput()}
                      onInput={(e) => setWishInput(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void submitWish();
                      }}
                      class="flex-1 text-xs px-2.5 py-1.5 rounded border border-[var(--ink)] bg-[var(--paper-2)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={wishPosting() || wishInput().trim().length < 2}
                      onClick={submitWish}
                      class="btn-brand text-[11px] px-3 py-1.5 font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Send size={11} />
                      <span>{wishPosting() ? "Posting..." : "Share"}</span>
                    </button>
                  </div>
                  <Show when={wishNote()}>
                    <p class="text-[9.5px] font-bold text-[var(--pop-red)] m-0 leading-tight">
                      {wishNote()}
                    </p>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Right Toolbar: Desktop Action & Status Controls */}
        <div class="hidden lg:flex flex-col space-y-1.5 shrink-0 w-40 self-center">
          {/* Status Card */}
          <Show when={canPlace()}>
            <div
              class="card card-plain p-2 space-y-1 text-center w-full"
              style={{
                border: "var(--ink-w) solid var(--ink)",
                background: "var(--paper)",
              }}
            >
              <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[var(--ink)]">
                <span>Credits:</span>
                <span class="text-[var(--pop-teal)] font-extrabold">
                  {windowRemaining()} / {windowLimit()}
                </span>
              </div>
              <Show when={windowRemaining() < windowLimit()}>
                <p class="text-[8.5px] font-black text-[var(--pop-teal)] m-0 pt-0.5 flex items-center justify-center gap-1">
                  <Clock size={9} strokeWidth={2.5} />
                  <span>+1 credit in {nextDropIn() ?? "soon"}</span>
                </p>
              </Show>
              <p
                class="text-[9.5px] font-extrabold m-0 pt-0.5 border-t border-[var(--ink)]/15"
                style={{ color: "var(--ink)" }}
              >
                {placed()} / {CELL_COUNT} filled
              </p>
            </div>
          </Show>

          {/* Action Tools Card */}
          <div
            class="card card-plain p-1.5 space-y-1 w-full"
            style={{
              border: "var(--ink-w) solid var(--ink)",
              background: "var(--paper)",
            }}
          >
            <button
              type="button"
              class="btn-ghost text-[11px] px-2 py-1 w-full inline-flex items-center justify-center gap-1 font-black cursor-pointer"
              onClick={() => setShowHowTo(true)}
              title="How to draw"
            >
              <HelpCircle size={13} strokeWidth={2.5} />
              <span>How to draw</span>
            </button>

            <div class="flex items-center justify-between gap-1 pt-1 border-t border-[var(--ink)]/20">
              <button
                type="button"
                class="btn-ghost text-xs p-1 flex-1 inline-flex items-center justify-center cursor-pointer"
                disabled={zoom() <= ZOOM_STEPS[0]}
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => stepZoom(-1)}
              >
                <ZoomOut size={13} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                class="btn-ghost text-[11px] px-1.5 py-1 flex-1 inline-flex items-center justify-center font-bold cursor-pointer"
                disabled={zoom() === 1}
                title="Fit whole pookalam"
                onClick={() => setZoom(1)}
              >
                Fit
              </button>
              <button
                type="button"
                class="btn-ghost text-xs p-1 flex-1 inline-flex items-center justify-center cursor-pointer"
                disabled={zoom() >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => stepZoom(1)}
              >
                <ZoomIn size={13} strokeWidth={2.5} />
              </button>
            </div>

            <button
              type="button"
              class="btn-ghost text-[11px] px-2 py-1 w-full inline-flex items-center justify-center gap-1 font-extrabold cursor-pointer"
              disabled={busy()}
              onClick={() => void load()}
            >
              <RefreshCw size={12} strokeWidth={2.5} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Far Right Margin: Outer Floating Tilted Speech Bubbles (Desktop Only) */}
        <div class="hidden xl:flex flex-col items-start gap-3.5 shrink-0 w-44 self-center pointer-events-auto z-20 pl-1">
          <Show when={!disableComments()}>
            <For each={rightOuterMessages()}>
              {(msg, idx) => (
                <WishBubble
                  msg={msg}
                  onLike={toggleLike}
                  onDelete={deleteWish}
                  isAdmin={isAdmin()}
                  index={idx() * 2 + 1}
                />
              )}
            </For>
          </Show>
        </div>
      </div>

      {/* Mobile Poov Palette (< 1024px) - Clean 2-row layout */}
      <Show when={canPlace()}>
        <div
          class="lg:hidden card card-plain space-y-1 p-1.5 sm:p-2 w-full max-w-md mx-auto"
          style={{
            border: "var(--ink-w) solid var(--ink)",
            background: "var(--paper)",
          }}
        >
          <div class="space-y-0.5">
            <div
              class="grid grid-cols-5 gap-1 sm:gap-1.5 transition-all"
              classList={{ "opacity-40 grayscale pointer-events-none": left() <= 0 }}
            >
              <For each={FLOWERS.slice(0, 5)}>
                {(flower) => {
                  const capped = () => isFlowerCapped(flower.id);
                  return (
                    <button
                      type="button"
                      disabled={capped()}
                      title={
                        capped()
                          ? `${flower.name} (Max 20% reached)`
                          : `${flower.name} (${flower.english})`
                      }
                      onClick={() => setPicked(flower)}
                      class="flex flex-col items-center justify-center p-0.5 rounded transition-all min-w-0 relative"
                      classList={{
                        "opacity-35 grayscale cursor-not-allowed": capped(),
                        "cursor-pointer": !capped(),
                      }}
                      style={{
                        border: "var(--ink-w) solid var(--ink)",
                        background:
                          picked().id === flower.id && !capped()
                            ? "var(--pop-yellow)"
                            : "var(--paper-2)",
                        transform:
                          picked().id === flower.id && !capped() ? "translateY(-1px)" : undefined,
                      }}
                    >
                      <FlowerSwatch flower={flower} size={18} />
                      <span class="block text-[7px] sm:text-[8px] font-black uppercase tracking-tight text-center pt-0.5 text-[var(--ink)] leading-none truncate w-full">
                        {flower.name}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
            <div
              class="grid grid-cols-5 gap-1 sm:gap-1.5 transition-all"
              classList={{ "opacity-40 grayscale pointer-events-none": left() <= 0 }}
            >
              <For each={[...FLOWERS.slice(5), EMPTY_BRUSH]}>
                {(flower) => {
                  const isEraser = flower.id === 0;
                  const capped = () => !isEraser && isFlowerCapped(flower.id);
                  return (
                    <button
                      type="button"
                      disabled={capped()}
                      title={
                        capped()
                          ? `${flower.name} (Max 20% reached)`
                          : isEraser
                            ? "Eraser (Clear square)"
                            : `${flower.name} (${flower.english})`
                      }
                      onClick={() => setPicked(flower)}
                      class="flex flex-col items-center justify-center p-0.5 rounded transition-all min-w-0 relative"
                      classList={{
                        "opacity-35 grayscale cursor-not-allowed": capped(),
                        "cursor-pointer": !capped(),
                      }}
                      style={{
                        border: isEraser
                          ? "1.5px dashed var(--ink)"
                          : "var(--ink-w) solid var(--ink)",
                        background:
                          picked().id === flower.id && !capped()
                            ? isEraser
                              ? "var(--paper-3)"
                              : "var(--pop-yellow)"
                            : "var(--paper-2)",
                        transform:
                          picked().id === flower.id && !capped() ? "translateY(-1px)" : undefined,
                      }}
                    >
                      <Show
                        when={!isEraser}
                        fallback={
                          <div class="w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded bg-[#2B2733] border border-[var(--ink)] text-[var(--pop-red)] font-black text-[9px] leading-none">
                            ✕
                          </div>
                        }
                      >
                        <FlowerSwatch flower={flower} size={18} />
                      </Show>
                      <span class="block text-[7px] sm:text-[8px] font-black uppercase tracking-tight text-center pt-0.5 text-[var(--ink)] leading-none truncate w-full">
                        {isEraser ? "Eraser" : flower.name}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>

            <Show when={left() <= 0}>
              <div class="text-[9px] font-bold text-center text-[var(--ink-soft)] pt-1 m-0 border-t border-[var(--ink)]/15">
                <Show
                  when={isWindowCapped()}
                  fallback={
                    <p class="m-0">Daily max ({dailyLimit()}) reached — resets at midnight!</p>
                  }
                >
                  <p class="m-0 flex items-center justify-center gap-1 text-[var(--pop-teal)] font-black">
                    <Clock size={11} strokeWidth={2.5} />
                    <span>No credits available · Next +1 in {nextDropIn() ?? "soon"}</span>
                  </p>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* ---------------- How To Draw Dialog Popup Modal */}
      <Show when={showHowTo()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHowTo(false);
          }}
        >
          <div
            class="card card-plain max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-150"
            style={{
              background: "var(--paper)",
              border: "var(--ink-w-bold) solid var(--ink)",
            }}
          >
            <div class="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
              <h3
                class="text-xl font-black m-0"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                How to draw
              </h3>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--paper-3)] font-black text-sm hover:bg-[var(--pop-red)] hover:text-white transition-colors cursor-pointer"
                onClick={() => setShowHowTo(false)}
                title="Close"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <StrokeDemo />

            <ol class="space-y-2.5 m-0 p-0 list-none">
              <For each={howToSteps()}>
                {(step, i) => (
                  <li class="flex items-start gap-3">
                    <span
                      class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black tabular-nums"
                      style={{
                        background: "var(--pop-yellow)",
                        border: "2px solid var(--ink)",
                        "font-family": "var(--font-stack-display)",
                      }}
                    >
                      {i() + 1}
                    </span>
                    <span class="text-xs sm:text-sm font-semibold leading-snug text-[var(--ink)]">
                      {step}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </div>
        </div>
      </Show>
    </div>
  );
}

const TILT_ANGLES = ["-2.5deg", "2.5deg", "-1.5deg", "3deg", "-2deg", "1.5deg"];
const WISH_POPS = [
  "var(--pop-yellow)",
  "var(--pop-pink)",
  "var(--pop-teal)",
  "var(--paper)",
  "var(--pop-purple)",
];

/**
 * Speech Bubble with external avatar:
 * - Circular avatar profile sits outside on the left.
 * - Distinct speech bubble with multi-line natural text wrapping (no "..." truncation).
 * - Inside bubble: bold message text, heart like counter, and delete button.
 */
function WishBubble(props: {
  msg: CollabMessageItem;
  onLike: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  index?: number;
  compact?: boolean;
}) {
  const [showAuthor, setShowAuthor] = createSignal(false);
  const tilt = () => TILT_ANGLES[(props.index ?? 0) % TILT_ANGLES.length];
  const bg = () =>
    props.msg.isMine ? "var(--pop-yellow)" : WISH_POPS[(props.index ?? 0) % WISH_POPS.length];

  return (
    <div
      class="inline-flex items-start gap-1 select-none relative max-w-full z-10"
      style={{
        transform: `rotate(${tilt()})`,
      }}
    >
      {/* 1. Outside Circular Avatar Profile */}
      <div
        class="relative shrink-0 cursor-pointer pt-0.5"
        onClick={() => setShowAuthor((v) => !v)}
        onMouseEnter={() => setShowAuthor(true)}
        onMouseLeave={() => setShowAuthor(false)}
        title={props.msg.userName}
      >
        <Show
          when={props.msg.userAvatar}
          fallback={
            <div
              class="rounded-full flex items-center justify-center font-black text-[var(--ink)] border-2 border-[var(--ink)] bg-[var(--paper)] shadow-xs"
              classList={{
                "w-6 h-6 text-[9px]": !props.compact,
                "w-5 h-5 text-[8px]": props.compact,
              }}
            >
              {props.msg.userName.charAt(0).toUpperCase()}
            </div>
          }
        >
          <img
            src={props.msg.userAvatar!}
            alt={props.msg.userName}
            class="rounded-full border-2 border-[var(--ink)] object-cover shadow-xs bg-[var(--paper)]"
            classList={{
              "w-6 h-6": !props.compact,
              "w-5 h-5": props.compact,
            }}
          />
        </Show>

        {/* Hover / Click Author Name Tooltip */}
        <Show when={showAuthor()}>
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-40 px-1.5 py-0.5 rounded text-[9px] font-black text-[var(--ink)] whitespace-nowrap pointer-events-none shadow-sm"
            style={{
              background: "var(--paper)",
              border: "1.5px solid var(--ink)",
            }}
          >
            {props.msg.userName}
          </div>
        </Show>
      </div>

      {/* 2. Message Speech Bubble (Distinct bubble with multi-line text wrapping) */}
      <div
        class="relative flex flex-col justify-between gap-1 rounded-2xl rounded-tl-xs border-2 border-[var(--ink)] shadow-xs min-w-0"
        classList={{
          "px-2.5 py-1 text-xs sm:text-[12.5px] max-w-[150px] sm:max-w-[175px]": !props.compact,
          "px-1.5 py-0.5 text-[10px] max-w-[115px]": props.compact,
        }}
        style={{
          background: bg(),
          "word-break": "break-word",
          "overflow-wrap": "anywhere",
        }}
      >
        {/* Full Message Text with character-level breaking */}
        <span
          class="font-black text-[var(--ink)] leading-snug break-all min-w-0 block w-full"
          classList={{
            "text-xs sm:text-[12px]": !props.compact,
            "text-[9.5px]": props.compact,
          }}
          style={{
            "word-break": "break-word",
            "overflow-wrap": "anywhere",
          }}
        >
          "{props.msg.message}"
        </span>

        {/* Inlined Heart Like & Delete Controls */}
        <span class="inline-flex items-center gap-1 shrink-0 ml-auto pt-0.5">
          <button
            type="button"
            onClick={() => props.onLike(props.msg.id)}
            class="inline-flex items-center gap-0.5 font-black cursor-pointer leading-none shrink-0"
            classList={{
              "text-[var(--pop-red)]": props.msg.hasLiked,
              "text-[var(--ink-soft)]": !props.msg.hasLiked,
              "text-xs": !props.compact,
              "text-[9px]": props.compact,
            }}
            title={props.msg.hasLiked ? "Unlike" : "Like"}
          >
            <Heart
              size={props.compact ? 9 : 10.5}
              fill={props.msg.hasLiked ? "var(--pop-red)" : "none"}
              strokeWidth={2.5}
            />
            <span>{props.msg.likesCount}</span>
          </button>

          {/* Inlined Delete Button for Admins / Author */}
          <Show when={(props.isAdmin || props.msg.isMine) && props.onDelete}>
            <button
              type="button"
              onClick={() => props.onDelete!(props.msg.id)}
              class="text-[var(--ink-soft)] hover:text-[var(--pop-red)] transition-colors p-0.5 cursor-pointer leading-none shrink-0"
              title="Delete wish"
            >
              <Trash2 size={props.compact ? 9 : 10.5} />
            </button>
          </Show>
        </span>
      </div>
    </div>
  );
}

const StrokeDemo = () => {
  let el: HTMLCanvasElement | undefined;
  const [step, setStep] = createSignal(0);
  const TOTAL = 14;

  onMount(() => {
    const timer = setInterval(() => setStep((n) => (n + 1) % (TOTAL + 4)), 190);
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    const drawn = Math.min(step(), TOTAL);
    if (!el) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const w = el.clientWidth || 280;
    const h = 110;
    el.width = Math.floor(w * dpr);
    el.height = Math.floor(h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const r = 10;
    for (let i = 0; i < drawn; i++) {
      const t = i / (TOTAL - 1);
      const x = w * 0.12 + t * w * 0.76;
      const y = h * 0.58 - Math.sin(t * Math.PI) * h * 0.24;
      drawFlower(ctx, x, y, r, FLOWERS[i % FLOWERS.length]);
    }
  });

  return (
    <div
      class="relative w-full overflow-hidden rounded"
      style={{
        height: "110px",
        border: "var(--ink-w) solid var(--ink)",
        background: "var(--paper-3)",
      }}
    >
      <canvas ref={(node) => (el = node)} class="block w-full" style={{ height: "110px" }} />
      <p class="absolute inset-x-0 bottom-1 text-center text-[0.65rem] font-extrabold uppercase tracking-wider text-muted m-0">
        press and drag to lay a line
      </p>
    </div>
  );
};

/** One flower on its own tiny canvas, centered with crisp DPR. */
function FlowerSwatch(props: { flower: Flower; size?: number }) {
  let el: HTMLCanvasElement | undefined;
  const size = props.size || 26;
  const paint = () => {
    if (!el) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    el.width = Math.floor(size * dpr);
    el.height = Math.floor(size * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawFlower(ctx, size / 2, size / 2, size * 0.44, props.flower);
  };
  createEffect(paint);
  onMount(paint);
  return (
    <canvas
      ref={(node) => (el = node)}
      style={{ width: `${size}px`, height: `${size}px` }}
      class="block shrink-0"
    />
  );
}
