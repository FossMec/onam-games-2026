export interface FingerprintSignals {
  persistentId: string;
  /** How stable the persistent id is: localStorage (persistent) > sessionStorage (session) > in-memory (ephemeral). */
  idStability: "persistent" | "session" | "ephemeral";
  userAgent: string;
  platform: string;
  language: string;
  languages: string;
  screen: string;
  timezone: string;
  timezoneOffset: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  maxTouchPoints: number;
  canvas: string | null;
  webgl: string | null;
  fonts: string | null;
  plugins: string;
  cookiesEnabled: boolean;
  doNotTrack: string;
  webdriver: boolean;
  audio: string | null;
  storageEstimate: number | null;
}

const PERSISTENT_ID_KEY = "og_device_id";
let ephemeralId: string | null = null;

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
 * Safari (esp. iOS private mode) throws on localStorage writes, and some
 * browsers block it entirely. Fall back through sessionStorage and finally an
 * in-memory id so we never return a shared "unknown" that collides across
 * devices (which would cause false multi-account flags).
 */
function persistentId(): { id: string; stability: FingerprintSignals["idStability"] } {
  try {
    let id = localStorage.getItem(PERSISTENT_ID_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(PERSISTENT_ID_KEY, id);
      try {
        indexedDB.open("og-device", 1);
      } catch {
        // best effort
      }
    }
    return { id, stability: "persistent" };
  } catch {
    // localStorage unavailable (Safari private mode etc.)
  }
  try {
    let id = sessionStorage.getItem(PERSISTENT_ID_KEY);
    if (!id) {
      id = newId();
      sessionStorage.setItem(PERSISTENT_ID_KEY, id);
    }
    return { id, stability: "session" };
  } catch {
    // sessionStorage unavailable too
  }
  if (!ephemeralId) ephemeralId = newId();
  return { id: ephemeralId, stability: "ephemeral" };
}

function canvasFingerprint(): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("FOSS-O", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("NAM", 4, 45);
    return canvas.toDataURL();
  } catch {
    return null;
  }
}

function webglFingerprint(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const vendor = info
      ? String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    return `${vendor}::${renderer}`;
  } catch {
    return null;
  }
}

function fontFingerprint(): string | null {
  try {
    const base = ["monospace", "sans-serif", "serif"];
    const test = [
      "Arial",
      "Verdana",
      "Tahoma",
      "Courier New",
      "Times New Roman",
      "Georgia",
      "Impact",
      "Comic Sans MS",
      "Trebuchet MS",
      "Segoe UI",
      "Roboto",
    ];
    const el = document.createElement("span");
    el.textContent = "mmmmmmmmmmlli";
    el.style.position = "absolute";
    el.style.left = "-9999px";
    el.style.fontSize = "72px";
    document.body.appendChild(el);
    const widths = new Map<string, number>();
    for (const b of base) {
      el.style.fontFamily = b;
      widths.set(b, el.offsetWidth);
    }
    const found: string[] = [];
    for (const font of test) {
      el.style.fontFamily = `'${font}', monospace`;
      if (el.offsetWidth !== widths.get("monospace")) found.push(font);
    }
    el.remove();
    return found.join(",");
  } catch {
    return null;
  }
}

async function audioFingerprint(): Promise<string | null> {
  try {
    // iOS Safari lacks OfflineAudioContext on older versions -> caught here
    const ctx = new OfflineAudioContext(1, 4410, 44100);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = 10000;
    gain.gain.value = 1;
    osc.start(0);
    osc.stop(0.1);
    const rendered = await ctx.startRendering();
    const data = rendered.getChannelData(0);
    return Array.from(data.slice(0, 32))
      .map((s) => Math.round(s * 1000))
      .join(",");
  } catch {
    return null;
  }
}

async function storageEstimate(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage ?? null;
  } catch {
    return null;
  }
}

export async function collectFingerprint(): Promise<FingerprintSignals> {
  const nav = navigator;
  let plugins = "";
  try {
    plugins = Array.from(nav.plugins)
      .map((p) => p.name)
      .join(",");
  } catch {
    plugins = "";
  }
  const screenStr = `${screen.width}x${screen.height}x${screen.colorDepth}@${window.devicePixelRatio ?? 1}`;
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    tz = "";
  }
  const [audio, storageUsage] = await Promise.all([audioFingerprint(), storageEstimate()]);
  const { id, stability } = persistentId();

  return {
    persistentId: id,
    idStability: stability,
    userAgent: nav.userAgent,
    platform: nav.platform ?? "",
    language: nav.language ?? "",
    languages: (nav.languages ?? []).join(","),
    screen: screenStr,
    timezone: tz,
    timezoneOffset: new Date().getTimezoneOffset(),
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    canvas: canvasFingerprint(),
    webgl: webglFingerprint(),
    fonts: fontFingerprint(),
    plugins,
    cookiesEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack ?? "",
    webdriver: nav.webdriver ?? false,
    audio,
    storageEstimate: storageUsage,
  };
}
