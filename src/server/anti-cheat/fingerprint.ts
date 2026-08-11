import { createHmac } from "node:crypto";
import type { FingerprintSignals } from "~/lib/fingerprint";

function hmac(value: string, salt = ""): string {
  const key = process.env.DEVICE_PEPPER ?? process.env.SESSION_SECRET ?? "dev-pepper";
  return createHmac("sha256", `${key}${salt}`).update(value).digest("hex");
}

export interface DeviceIdentity {
  deviceHash: string;
  hardwareHash: string | null;
  canvasHash: string | null;
  webglHash: string | null;
  fontHash: string | null;
  screenHash: string | null;
  isVm: boolean;
}

export function computeDeviceIdentity(signals: FingerprintSignals): DeviceIdentity {
  const core = JSON.stringify({
    pid: signals.persistentId,
    st: signals.idStability,
    ua: signals.userAgent,
    p: signals.platform,
    l: signals.language,
    s: signals.screen,
    tz: signals.timezone,
    tzo: signals.timezoneOffset,
    hc: signals.hardwareConcurrency,
    dm: signals.deviceMemory,
    mtp: signals.maxTouchPoints,
    c: signals.cookiesEnabled,
    dnt: signals.doNotTrack,
    wd: signals.webdriver,
  });
  return {
    deviceHash: hmac(core),
    hardwareHash: computeHardwareHash(signals),
    canvasHash: signals.canvas ? hmac(signals.canvas, ":canvas") : null,
    webglHash: signals.webgl ? hmac(signals.webgl, ":webgl") : null,
    fontHash: signals.fonts ? hmac(signals.fonts, ":fonts") : null,
    screenHash: signals.screen ? hmac(signals.screen, ":screen") : null,
    isVm: isVmWebgl(signals.webgl),
  };
}

/**
 * Browser-independent hardware signature: identifies the physical device
 * across different browsers (Chrome vs Firefox vs Safari on the same phone).
 * Uses only signals that describe the hardware, not the browser:
 * GPU (webgl), screen+DPR, timezone, CPU cores, memory, touch, pointer/hover
 * capability, color gamut, vibrate support and the Android model hint.
 * Excludes localIp (network-dependent) and orientation (rotation-dependent).
 */
export function computeHardwareHash(signals: FingerprintSignals): string | null {
  const parts = [
    signals.webgl,
    signals.screen,
    signals.timezone,
    String(signals.timezoneOffset),
    signals.hardwareConcurrency,
    signals.deviceMemory,
    signals.maxTouchPoints,
    signals.pointer,
    signals.hover,
    signals.colorGamut,
    signals.vibrate,
    signals.uaModel,
  ].filter((v) => v !== null && v !== undefined && v !== "");
  if (parts.length < 4) return null;
  return hmac(parts.join("|"), ":hardware");
}

/** Software-rendered WebGL strongly implies a VM / headless / automation env. */
export function isVmWebgl(webgl: string | null): boolean {
  if (!webgl) return false;
  const lower = webgl.toLowerCase();
  return (
    lower.includes("llvmpipe") ||
    lower.includes("swiftshader") ||
    lower.includes("mesa offscreen") ||
    lower.includes("software rasterizer")
  );
}
