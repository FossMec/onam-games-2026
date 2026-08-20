import FingerprintJS, { type Agent } from "@fingerprintjs/fingerprintjs";
import { getMultiStoreSync, setMultiStoreSync } from "./multi-store";

export interface FingerprintSignals {
  persistentId: string;
  /** How stable the persistent id is: localStorage (persistent) > sessionStorage (session) > in-memory (ephemeral). */
  idStability: "persistent" | "session" | "ephemeral";
  userAgent: string;
  platform: string;
  language: string;
  languages: string;
  screen: string;
  availScreen: string;
  timezone: string;
  timezoneOffset: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  maxTouchPoints: number;
  canvas: string | null;
  webgl: string | null;
  webglVendor: string | null;
  webglRenderer: string | null;
  fonts: string | null;
  plugins: string;
  cookiesEnabled: boolean;
  doNotTrack: string;
  webdriver: boolean;
  audio: string | null;
  mathFingerprint: string | null;
  storageEstimate: number | null;
  /** Device capability, browser-independent (mobile/touch vs desktop). */
  pointer: string;
  hover: string;
  colorGamut: string;
  hdrSupport: boolean;
  /** Real local IP leaked via WebRTC (null when mDNS-obfuscated). */
  localIp: string | null;
  /** True when the browser obfuscated its ICE host candidate (mDNS). */
  mdnsProtected: boolean;
  /** Device model from Client Hints (Android; absent on iOS). */
  uaModel: string | null;
  /** Android platform version from Client Hints. */
  uaPlatformVersion: string | null;
  /** navigator.vibrate presence (Android yes, iOS no). */
  vibrate: boolean;
  /** Current screen.orientation.type, e.g. portrait-primary. */
  orientation: string;
}

export interface FingerprintResult {
  signals: FingerprintSignals;
  /** FingerprintJS visitor id (stable per browser; null if the lib failed). */
  visitorId: string | null;
}

const PERSISTENT_ID_KEY = "og_device_id";
let ephemeralId: string | null = null;

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function fallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return fallbackUuid();
  }
}

/**
 * Resilient multi-storage ID lookup and recovery across localStorage,
 * sessionStorage, document.cookie, and IndexedDB.
 */
function persistentId(): { id: string; stability: FingerprintSignals["idStability"] } {
  let id = getMultiStoreSync(PERSISTENT_ID_KEY);
  if (id && id.length >= 10) {
    // Re-heal across all available stores
    setMultiStoreSync(PERSISTENT_ID_KEY, id);
    return { id, stability: "persistent" };
  }

  id = newId();
  try {
    setMultiStoreSync(PERSISTENT_ID_KEY, id);
    return { id, stability: "persistent" };
  } catch {
    // fallback
  }

  if (!ephemeralId) ephemeralId = newId();
  return { id: ephemeralId, stability: "ephemeral" };
}

/**
 * Direct Canvas fingerprint combining text metrics, gradients, shadows, and emoji rendering.
 */
function generateDirectCanvasFingerprint(): string | null {
  try {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(10, 1, 62, 20);

    ctx.fillStyle = "#069";
    ctx.font = "11pt no-real-font-123";
    ctx.fillText("FOSS Onam 2026 🌸 \ud83d\ude03 \ud83c\uddee\ud83c\uddf3", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.font = "14pt Arial, sans-serif";
    ctx.fillText("Kerala Open Source <canvas>", 4, 45);

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, "rgba(255,0,0,0.5)");
    grad.addColorStop(0.5, "rgba(0,255,0,0.5)");
    grad.addColorStop(1, "rgba(0,0,255,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 50, canvas.width, 10);

    return fnv1a(canvas.toDataURL());
  } catch {
    return null;
  }
}

/**
 * Direct WebGL probing for unmasked hardware renderer strings.
 */
function probeWebGL(): { vendor: string | null; renderer: string | null; combined: string | null } {
  try {
    if (typeof document === "undefined") return { vendor: null, renderer: null, combined: null };
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { vendor: null, renderer: null, combined: null };

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);

    const vStr = typeof vendor === "string" ? vendor : null;
    const rStr = typeof renderer === "string" ? renderer : null;
    const combined = vStr || rStr ? `${vStr || "unknown"}~${rStr || "unknown"}` : null;
    return { vendor: vStr, renderer: rStr, combined };
  } catch {
    return { vendor: null, renderer: null, combined: null };
  }
}

/**
 * Math precision differences across CPU architectures and JS engines.
 */
function computeMathFingerprint(): string {
  try {
    const samples = [
      Math.tan(-1e300),
      Math.sinh(1),
      Math.exp(1),
      Math.cos(1e10),
      Math.sin(1e10),
      Math.log(1.5),
      Math.sqrt(2),
    ];
    return fnv1a(samples.map(String).join(","));
  } catch {
    return "default";
  }
}

/**
 * AudioContext oscillator and dynamics compressor frequency response fingerprint.
 */
function computeAudioFingerprint(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
      if (!AudioCtx) return resolve(null);

      const ctx = new AudioCtx(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(10000, ctx.currentTime);

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, ctx.currentTime);
      compressor.knee.setValueAtTime(40, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      osc.connect(compressor);
      compressor.connect(ctx.destination);
      osc.start(0);

      ctx
        .startRendering()
        .then((buffer) => {
          let hash = 0;
          const channel = buffer.getChannelData(0);
          for (let i = 4500; i < 5000; i++) {
            hash += Math.abs(channel[i] || 0);
          }
          resolve(hash.toString(16));
        })
        .catch(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

function collectLocalIp(): Promise<{ ip: string | null; mdns: boolean }> {
  return new Promise((resolve) => {
    const done = (ip: string | null, mdns: boolean) => resolve({ ip, mdns });
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("ip");
      const timeout = setTimeout(() => {
        pc.close();
        done(null, false);
      }, 1000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const mdns = e.candidate.candidate.includes(".local");
        const match = /(\d+\.\d+\.\d+\.\d+|\[[0-9a-f:]+\])/.exec(e.candidate.candidate);
        if (match) {
          clearTimeout(timeout);
          pc.close();
          done(match[1], mdns);
        }
      };
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => undefined);
    } catch {
      done(null, false);
    }
  });
}

function capability(query: string, fine: string, coarse: string): string {
  try {
    if (window.matchMedia(query).matches) return fine;
  } catch {
    // ignore
  }
  return coarse;
}

interface FpComponents {
  [key: string]: { value: unknown };
}

function val<T>(components: FpComponents, key: string): T | undefined {
  return components[key]?.value as T | undefined;
}

let fpPromise: Promise<Agent | null> | null = null;

async function loadFingerprintJS(): Promise<Agent | null> {
  if (!fpPromise) fpPromise = FingerprintJS.load().catch(() => null);
  return fpPromise;
}

async function collectWithFingerprintJS(
  base: FingerprintSignals,
): Promise<{ signals: FingerprintSignals; visitorId: string | null }> {
  let visitorId: string | null = null;
  try {
    const fp = await loadFingerprintJS();
    if (!fp) return { signals: base, visitorId: null };
    const result = await fp.get();
    visitorId = result.visitorId;
    const c = result.components as unknown as FpComponents;

    const screenResolution = val<[number, number]>(c, "screenResolution");
    const colorDepth = val<number>(c, "colorDepth");
    const dpr = window.devicePixelRatio ?? 1;
    const screen = screenResolution
      ? `${screenResolution[0]}x${screenResolution[1]}x${colorDepth ?? window.screen.colorDepth}@${dpr}`
      : `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}@${dpr}`;

    const pluginsVal = val<Array<{ name: string }>>(c, "plugins");
    const fontsVal = val<string | string[]>(c, "fonts");

    const fpCanvas =
      val<{ fingerprint: string }>(c, "canvas")?.fingerprint ??
      (typeof c.canvas?.value === "string" ? c.canvas.value : null);
    const fpWebgl =
      val<string>(c, "webglVendorAndRenderer") ??
      (typeof c.webglVendorAndRenderer?.value === "string" ? c.webglVendorAndRenderer.value : null);
    const fpAudio =
      typeof c.audio?.value === "string"
        ? c.audio.value
        : typeof c.audio?.value === "number"
          ? String(c.audio.value)
          : (val<string>(c, "audio") ?? null);

    return {
      visitorId,
      signals: {
        ...base,
        canvas: base.canvas || fpCanvas,
        webgl: base.webgl || fpWebgl,
        audio: base.audio || fpAudio,
        fonts: Array.isArray(fontsVal)
          ? fontsVal.join(",")
          : typeof fontsVal === "string"
            ? fontsVal
            : null,
        plugins: Array.isArray(pluginsVal) ? pluginsVal.map((p) => p.name).join(",") : "",
        screen,
        platform: val<string>(c, "platform") ?? base.platform,
        languages: Array.isArray(val(c, "languages"))
          ? (val(c, "languages") as string[]).join(",")
          : base.languages,
        deviceMemory: val<number>(c, "deviceMemory") ?? base.deviceMemory,
        hardwareConcurrency: val<number>(c, "hardwareConcurrency") ?? base.hardwareConcurrency,
        maxTouchPoints:
          val<{ maxTouchPoints: number }>(c, "touchSupport")?.maxTouchPoints ?? base.maxTouchPoints,
        timezone: val<string>(c, "timezone") ?? base.timezone,
        colorGamut: val<string>(c, "colorGamut") ?? base.colorGamut,
        cookiesEnabled: val<boolean>(c, "cookiesEnabled") ?? base.cookiesEnabled,
      },
    };
  } catch {
    return { signals: base, visitorId: null };
  }
}

export async function collectFingerprint(): Promise<FingerprintResult> {
  const nav = navigator;
  const screenStr = `${screen.width}x${screen.height}x${screen.colorDepth}@${window.devicePixelRatio ?? 1}`;
  const availScreenStr = `${screen.availWidth}x${screen.availHeight}`;

  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    tz = "";
  }

  const [storageUsage, ipResult, directAudio] = await Promise.all([
    (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        return est?.usage ?? null;
      } catch {
        return null;
      }
    })(),
    collectLocalIp(),
    computeAudioFingerprint(),
  ]);

  const { id, stability } = persistentId();
  const directCanvas = generateDirectCanvasFingerprint();
  const directWebgl = probeWebGL();
  const mathFingerprint = computeMathFingerprint();

  let uaModel: string | null = null;
  let uaPlatformVersion: string | null = null;
  const uad = (
    nav as unknown as {
      userAgentData?: {
        platform?: string;
        getHighEntropyValues?: (
          hints: string[],
        ) => Promise<{ model?: string; platformVersion?: string }>;
      };
    }
  ).userAgentData;
  if (uad) {
    try {
      if (uad.getHighEntropyValues) {
        const he = await uad.getHighEntropyValues(["model", "platformVersion"]);
        uaModel = he.model ?? null;
        uaPlatformVersion = he.platformVersion ?? null;
      } else {
        uaModel = uad.platform ?? null;
      }
    } catch {
      uaModel = uad.platform ?? null;
    }
  }

  let orientation = "";
  try {
    orientation = screen.orientation?.type ?? "";
  } catch {
    orientation = "";
  }

  const base: FingerprintSignals = {
    persistentId: id,
    idStability: stability,
    userAgent: nav.userAgent,
    platform: nav.platform ?? "",
    language: nav.language ?? "",
    languages: (nav.languages ?? []).join(","),
    screen: screenStr,
    availScreen: availScreenStr,
    timezone: tz,
    timezoneOffset: new Date().getTimezoneOffset(),
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    canvas: directCanvas,
    webgl: directWebgl.combined,
    webglVendor: directWebgl.vendor,
    webglRenderer: directWebgl.renderer,
    fonts: null,
    plugins: "",
    cookiesEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack ?? "",
    webdriver: nav.webdriver ?? false,
    audio: directAudio,
    mathFingerprint,
    storageEstimate: storageUsage,
    pointer: capability("(any-pointer: fine)", "fine", "coarse"),
    hover: capability("(any-hover: hover)", "hover", "none"),
    colorGamut: capability("(color-gamut: p3)", "p3", "srgb"),
    hdrSupport: capability("(dynamic-range: high)", "high", "standard") === "high",
    localIp: ipResult.ip,
    mdnsProtected: ipResult.mdns,
    uaModel,
    uaPlatformVersion,
    vibrate: "vibrate" in nav,
    orientation,
  };

  return collectWithFingerprintJS(base);
}
