/**
 * Scoring for "these two accounts are the same person".
 *
 * The block in `bindDeviceToUser` only catches the lazy version: signing up
 * again in the same browser without clearing anything. Anyone who clears site
 * data, opens a second browser, or uses a fresh profile gets a brand new
 * `device_hash` and walks straight through - while leaving behind a pile of
 * evidence the database was already storing and nobody was reading.
 *
 * So this is deliberately a *scorer*, not a gate. It does not stop anybody: it
 * says how strongly two accounts look like one person, and hands that number to
 * a human deciding who is eligible for a prize. A wrong block costs an honest
 * player their week; a wrong flag costs an admin thirty seconds.
 *
 * Kept pure and separate from the database so the weights can be tested - the
 * one part of anti-cheat where being wrong is expensive and silent.
 */

/** Evidence that two device records belong to one human, weakest first. */
export type LinkSignal =
  | "ip"
  | "screen"
  | "fonts"
  | "webgl"
  | "audio"
  | "localIp"
  | "canvas"
  | "hardware"
  | "fpVisitor";

/**
 * How much each match is worth, out of 100.
 *
 * The weights encode how hard each signal is to change by accident:
 *
 *   ip         a household shares one public address. Nearly worthless alone -
 *              siblings on the same wifi are not cheating - but it corroborates.
 *   screen     resolution + DPR. Thousands of people share the common ones.
 *   fonts      the installed font set. Fairly distinctive, survives a browser
 *              change, but common on stock phones.
 *   webgl      the GPU string. Same GPU across two browsers on one machine.
 *   audio      the audio stack's rendering quirks. Hardware and OS influenced,
 *              and it survives a cleared profile.
 *   localIp    the private LAN address, which belongs to the *machine* - two
 *              browsers on one phone report the same one. Not globally unique
 *              (half the routers on earth hand out 192.168.1.x), so it is
 *              priced to need company rather than to convict alone.
 *   canvas     rendering quirks: GPU *and* driver *and* browser. Distinctive.
 *   hardware   the composite hardware signature, already browser-independent.
 *   fpVisitor  FingerprintJS. The strongest single thing here: it is built to
 *              survive cleared storage and a fresh profile in the same browser,
 *              which is exactly the move being looked for.
 *
 * Nothing except `fpVisitor` alone crosses the flag line, and even it does not
 * reach the top band by itself - a match needs corroboration to be called
 * near-certain. Note the deliberate pairing: `ip` + `localIp` together (30)
 * reach review, because the same public *and* private address is one machine
 * on one network rather than two people in one house.
 *
 * A caveat the numbers cannot express: on iOS every browser is WebKit and the
 * GPU reports as a generic "Apple GPU", with no `deviceMemory`, no `vibrate`
 * and no client-hint model. `hardware` there carries far less entropy than on
 * Android, and two identical iPhones in one timezone can genuinely collide.
 * Read an iOS-only `hardware` match as a lead, not a conclusion.
 */
const WEIGHTS: Record<LinkSignal, number> = {
  ip: 10,
  screen: 5,
  fonts: 10,
  webgl: 20,
  audio: 20,
  localIp: 20,
  canvas: 25,
  hardware: 35,
  fpVisitor: 55,
};

export interface LinkVerdict {
  /** 0–100. Not a probability - a ranking for triage. */
  confidence: number;
  matched: LinkSignal[];
  severity: "info" | "warn" | "critical";
  /** How much trust to take off the newer account. */
  trustPenalty: number;
}

/** Above this, an admin should look before paying out. */
export const REVIEW_THRESHOLD = 30;
/** Above this, treat it as the same person unless they say otherwise. */
export const STRONG_THRESHOLD = 60;

export function scoreLink(matched: LinkSignal[]): LinkVerdict {
  const unique = [...new Set(matched)];
  const confidence = Math.min(
    100,
    unique.reduce((total, signal) => total + WEIGHTS[signal], 0),
  );
  if (confidence >= STRONG_THRESHOLD) {
    return { confidence, matched: unique, severity: "critical", trustPenalty: 30 };
  }
  if (confidence >= REVIEW_THRESHOLD) {
    return { confidence, matched: unique, severity: "warn", trustPenalty: 15 };
  }
  return { confidence, matched: unique, severity: "info", trustPenalty: 0 };
}

/** The columns a device row contributes to the comparison. */
export interface DeviceSignals {
  fpVisitorId: string | null;
  hardwareHash: string | null;
  canvasHash: string | null;
  webglHash: string | null;
  fontHash: string | null;
  screenHash: string | null;
  audioHash: string | null;
  localIp: string | null;
  lastIp: string | null;
}

/**
 * Which signals two device records agree on.
 *
 * Nulls never match: a browser that refused to give us a canvas hash agrees
 * with every other such browser, and treating that as evidence would flag
 * every privacy-conscious player against every other one.
 */
export function matchSignals(a: DeviceSignals, b: DeviceSignals): LinkSignal[] {
  const agree = (left: string | null, right: string | null) =>
    left !== null && left !== "" && left === right;
  const matched: LinkSignal[] = [];
  if (agree(a.fpVisitorId, b.fpVisitorId)) matched.push("fpVisitor");
  if (agree(a.hardwareHash, b.hardwareHash)) matched.push("hardware");
  if (agree(a.canvasHash, b.canvasHash)) matched.push("canvas");
  if (agree(a.audioHash, b.audioHash)) matched.push("audio");
  if (agree(a.localIp, b.localIp)) matched.push("localIp");
  if (agree(a.webglHash, b.webglHash)) matched.push("webgl");
  if (agree(a.fontHash, b.fontHash)) matched.push("fonts");
  if (agree(a.screenHash, b.screenHash)) matched.push("screen");
  if (agree(a.lastIp, b.lastIp)) matched.push("ip");
  return matched;
}
