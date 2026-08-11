import { createHmac } from "node:crypto";
import type { FingerprintSignals } from "~/lib/fingerprint";

function hmac(value: string, salt = ""): string {
  const key = process.env.DEVICE_PEPPER ?? process.env.SESSION_SECRET ?? "dev-pepper";
  return createHmac("sha256", `${key}${salt}`).update(value).digest("hex");
}

export interface DeviceIdentity {
  deviceHash: string;
  canvasHash: string | null;
  webglHash: string | null;
  fontHash: string | null;
  screenHash: string | null;
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
    canvasHash: signals.canvas ? hmac(signals.canvas, ":canvas") : null,
    webglHash: signals.webgl ? hmac(signals.webgl, ":webgl") : null,
    fontHash: signals.fonts ? hmac(signals.fonts, ":fonts") : null,
    screenHash: signals.screen ? hmac(signals.screen, ":screen") : null,
  };
}
