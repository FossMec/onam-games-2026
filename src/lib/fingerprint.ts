import FingerprintJS, { type Agent } from "@fingerprintjs/fingerprintjs";

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
  /** Device capability, browser-independent (mobile/touch vs desktop). */
  pointer: string;
  hover: string;
  colorGamut: string;
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

/** Loads FingerprintJS once; returns null on failure (never throws). */
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

    return {
      visitorId,
      signals: {
        ...base,
        canvas: val<{ fingerprint: string }>(c, "canvas")?.fingerprint ?? null,
        webgl: val<string>(c, "webglVendorAndRenderer") ?? null,
        audio: val<string>(c, "audio") ?? null,
        fonts: Array.isArray(fontsVal) ? fontsVal.join(",") : (fontsVal ?? null),
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
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    tz = "";
  }
  const [storageUsage, ipResult] = await Promise.all([
    (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        return est?.usage ?? null;
      } catch {
        return null;
      }
    })(),
    collectLocalIp(),
  ]);
  const { id, stability } = persistentId();

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
    timezone: tz,
    timezoneOffset: new Date().getTimezoneOffset(),
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    canvas: null,
    webgl: null,
    fonts: null,
    plugins: "",
    cookiesEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack ?? "",
    webdriver: nav.webdriver ?? false,
    audio: null,
    storageEstimate: storageUsage,
    pointer: capability("(any-pointer: fine)", "fine", "coarse"),
    hover: capability("(any-hover: hover)", "hover", "none"),
    colorGamut: "srgb",
    localIp: ipResult.ip,
    mdnsProtected: ipResult.mdns,
    uaModel,
    uaPlatformVersion,
    vibrate: "vibrate" in nav,
    orientation,
  };

  return collectWithFingerprintJS(base);
}
