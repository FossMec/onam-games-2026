import { and, eq, ne, or, sql } from "drizzle-orm";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { getDb } from "~/server/db/client";
import { devices, userDevices, users } from "~/server/db/schema";
import { getRequestMeta } from "~/server/request";
import { getSetting } from "~/server/settings/service";
import { computeDeviceIdentity } from "./fingerprint";
import {
  REVIEW_THRESHOLD,
  matchSignals,
  scoreLink,
  type DeviceSignals,
  type LinkSignal,
} from "./link";
import { logSuspicious } from "./log";

export interface BindResult {
  deviceId: string;
  deviceHash: string;
  allowed: boolean;
  reason?: string;
}

/**
 * Upserts a device by its peppered hash and binds it to a user. Enforces
 * "one user per device" only when the device id is persistent, so private-mode
 * (Safari) or storage-blocked browsers never cause false multi-account blocks.
 *
 * Every new (user, device) link is then scored against the accounts already on
 * record — see `detectLinkedAccounts`. That pass only ever flags: the block
 * above is the only thing here that turns anybody away.
 */
export async function bindDeviceToUser(
  userId: string,
  signals: FingerprintSignals,
  fpVisitorId?: string | null,
): Promise<BindResult> {
  const identity = computeDeviceIdentity(signals);
  const db = getDb();
  const meta = getRequestMeta();
  const stable = signals.idStability === "persistent";

  const [existing] = await db
    .select()
    .from(devices)
    .where(eq(devices.deviceHash, identity.deviceHash))
    .limit(1);

  let deviceId: string;
  if (existing) {
    deviceId = existing.id;
    await db
      .update(devices)
      .set({
        lastIp: meta.ip,
        lastSeenAt: new Date(),
        hardwareHash: identity.hardwareHash ?? existing.hardwareHash,
        fpVisitorId: fpVisitorId ?? existing.fpVisitorId,
        canvasHash: identity.canvasHash ?? existing.canvasHash,
        webglHash: identity.webglHash ?? existing.webglHash,
        fontHash: identity.fontHash ?? existing.fontHash,
        screenHash: identity.screenHash ?? existing.screenHash,
        audioHash: identity.audioHash ?? existing.audioHash,
        localIp: identity.localIp ?? existing.localIp,
        fingerprintJson: signals as never,
        userAgent: meta.userAgent || existing.userAgent,
        platform: signals.platform || existing.platform,
        lastCountry: meta.country ?? existing.lastCountry,
        lastCity: meta.city ?? existing.lastCity,
      })
      .where(eq(devices.id, existing.id));
  } else {
    const [created] = await db
      .insert(devices)
      .values({
        deviceHash: identity.deviceHash,
        hardwareHash: identity.hardwareHash,
        fpVisitorId: fpVisitorId ?? null,
        fingerprintJson: signals as never,
        canvasHash: identity.canvasHash,
        webglHash: identity.webglHash,
        fontHash: identity.fontHash,
        screenHash: identity.screenHash,
        audioHash: identity.audioHash,
        localIp: identity.localIp,
        userAgent: meta.userAgent,
        platform: signals.platform,
        firstIp: meta.ip,
        lastIp: meta.ip,
        firstCountry: meta.country,
        firstCity: meta.city,
        lastCountry: meta.country,
        lastCity: meta.city,
      })
      .returning({ id: devices.id });
    deviceId = created.id;

    if (identity.isVm) {
      await logSuspicious({
        userId,
        deviceId,
        ip: meta.ip,
        eventType: "vm_or_headless",
        severity: "info",
        details: { webgl: signals.webgl },
      });
    }
  }

  const [binding] = await db
    .select()
    .from(userDevices)
    .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)))
    .limit(1);

  if (binding) {
    await db
      .update(userDevices)
      .set({ lastUsedAt: new Date(), usageCount: binding.usageCount + 1 })
      .where(eq(userDevices.id, binding.id));
    return { deviceId, deviceHash: identity.deviceHash, allowed: true };
  }

  // New (user, device) link.
  if (stable) {
    const enforce = await getSetting<boolean>("enforce_one_user_per_device", true);
    if (enforce) {
      const [other] = await db
        .select({ userId: userDevices.userId })
        .from(userDevices)
        .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.isPrimary, true)))
        .limit(1);
      if (other && other.userId !== userId) {
        const [otherUser] = await db
          .select({ banLevel: users.banLevel })
          .from(users)
          .where(eq(users.id, other.userId))
          .limit(1);
        // A hard-banned prior owner does not get to lock the device forever.
        if (otherUser && otherUser.banLevel < 4) {
          await logSuspicious({
            userId,
            deviceId,
            eventType: "multi_account_device",
            severity: "critical",
            details: { otherUserId: other.userId, deviceHash: identity.deviceHash },
            actionTaken: "block",
          });
          await logSuspicious({
            userId: other.userId,
            deviceId,
            eventType: "multi_account_device_second_user",
            severity: "warn",
            details: { newUserId: userId },
            actionTaken: "none",
          });
          return {
            deviceId,
            deviceHash: identity.deviceHash,
            allowed: false,
            reason: "This device is already linked to another account.",
          };
        }
      }
    }
  } else {
    await logSuspicious({
      userId,
      deviceId,
      eventType: "unstable_device_identity",
      severity: "info",
      details: { idStability: signals.idStability },
    });
  }

  await db.insert(userDevices).values({
    userId,
    deviceId,
    isPrimary: stable,
    usageCount: 1,
  });

  await detectLinkedAccounts(
    db,
    {
      id: deviceId,
      deviceHash: identity.deviceHash,
      fpVisitorId: fpVisitorId ?? existing?.fpVisitorId ?? null,
      hardwareHash: identity.hardwareHash ?? existing?.hardwareHash ?? null,
      canvasHash: identity.canvasHash ?? existing?.canvasHash ?? null,
      webglHash: identity.webglHash ?? existing?.webglHash ?? null,
      fontHash: identity.fontHash ?? existing?.fontHash ?? null,
      screenHash: identity.screenHash ?? existing?.screenHash ?? null,
      audioHash: identity.audioHash ?? existing?.audioHash ?? null,
      localIp: identity.localIp ?? existing?.localIp ?? null,
      lastIp: meta.ip || null,
    },
    userId,
    signals,
  );

  return { deviceId, deviceHash: identity.deviceHash, allowed: true };
}

/**
 * Does this new account look like an account we already have?
 *
 * Runs whenever a user is linked to a device for the first time — which is
 * exactly the moment a second account appears, however it got there. The
 * `device_hash` block upstream only catches signing up twice in one browser
 * with storage intact; everything past that (cleared site data, a second
 * browser, a fresh profile, incognito promoted to persistent) produces a new
 * device row that sails through. Those rows still carry the FingerprintJS
 * visitor id, the canvas and WebGL hashes, the font set and the address they
 * came from, all of which this database has been dutifully storing and never
 * once comparing.
 *
 * It never blocks. The output is a scored, human-readable `suspicious_logs`
 * row naming both accounts and the evidence, so the daily prize list can be
 * checked against it. Blocking on a probabilistic match would eventually cost
 * an honest player their week; a flag costs an admin a moment.
 */
async function detectLinkedAccounts(
  db: ReturnType<typeof getDb>,
  device: DeviceSignals & { id: string; deviceHash: string },
  userId: string,
  signals: FingerprintSignals,
): Promise<void> {
  /*
   * One query, one pass over every device that shares *any* signal with this
   * one. Per-signal queries would be six round trips to answer a question that
   * an OR answers once.
   */
  const filters = [
    device.fpVisitorId ? eq(devices.fpVisitorId, device.fpVisitorId) : undefined,
    device.hardwareHash ? eq(devices.hardwareHash, device.hardwareHash) : undefined,
    device.canvasHash ? eq(devices.canvasHash, device.canvasHash) : undefined,
    device.audioHash ? eq(devices.audioHash, device.audioHash) : undefined,
    device.localIp ? eq(devices.localIp, device.localIp) : undefined,
    device.webglHash ? eq(devices.webglHash, device.webglHash) : undefined,
    device.fontHash ? eq(devices.fontHash, device.fontHash) : undefined,
    device.lastIp ? eq(devices.lastIp, device.lastIp) : undefined,
  ].filter((filter) => filter !== undefined);
  if (filters.length === 0) return;

  const shared = await db
    .select({
      deviceId: devices.id,
      linkedUserId: userDevices.userId,
      userAgent: devices.userAgent,
      banLevel: users.banLevel,
      fpVisitorId: devices.fpVisitorId,
      hardwareHash: devices.hardwareHash,
      canvasHash: devices.canvasHash,
      webglHash: devices.webglHash,
      fontHash: devices.fontHash,
      screenHash: devices.screenHash,
      audioHash: devices.audioHash,
      localIp: devices.localIp,
      lastIp: devices.lastIp,
    })
    .from(devices)
    .innerJoin(userDevices, eq(userDevices.deviceId, devices.id))
    .innerJoin(users, eq(users.id, userDevices.userId))
    .where(and(ne(devices.deviceHash, device.deviceHash), or(...filters)));

  /*
   * Strongest evidence per *account*, not per device row. Somebody with four
   * browsers on one laptop should read as one linked account with a canvas
   * match, not as four separate accusations.
   */
  const perUser = new Map<string, { matched: LinkSignal[]; deviceIds: string[] }>();
  for (const row of shared) {
    // A hard-banned prior account is already dealt with, and counting it would
    // re-punish whoever legitimately owns the device next.
    if (row.linkedUserId === userId || row.banLevel >= 4) continue;
    const matched = matchSignals(device, row);
    if (matched.length === 0) continue;
    const existing = perUser.get(row.linkedUserId);
    if (existing) {
      existing.matched.push(...matched);
      existing.deviceIds.push(row.deviceId);
    } else {
      perUser.set(row.linkedUserId, { matched, deviceIds: [row.deviceId] });
    }
  }
  if (perUser.size === 0) return;

  const links = [...perUser.entries()]
    .map(([linkedUserId, evidence]) => ({
      linkedUserId,
      deviceIds: evidence.deviceIds,
      ...scoreLink(evidence.matched),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  /*
   * An address on its own is not evidence and must not be recorded as if it
   * were. Indian mobile networks put whole cities behind carrier-grade NAT, so
   * a shared public IP would otherwise write a "suspected" row for a large
   * share of honest sign-ups and bury the real matches in noise. It still
   * counts once something else agrees — that is what the weights are for.
   */
  const strongest = links[0];
  if (strongest.matched.length === 1 && strongest.matched[0] === "ip") return;
  // More than one other account on the same hardware is its own argument.
  const severity =
    links.length >= 2 && strongest.confidence >= REVIEW_THRESHOLD ? "critical" : strongest.severity;

  await logSuspicious({
    userId,
    deviceId: device.id,
    ip: device.lastIp ?? undefined,
    eventType: "multi_account_suspected",
    severity,
    actionTaken: strongest.confidence >= REVIEW_THRESHOLD ? "flag" : "none",
    details: {
      confidence: strongest.confidence,
      matched: strongest.matched,
      linkedUserIds: links.map((link) => link.linkedUserId),
      links,
      browsers: shared.map((row) => row.userAgent),
      localIp: signals.localIp,
      uaModel: signals.uaModel,
      mdnsProtected: signals.mdnsProtected,
    },
  });

  if (strongest.confidence < REVIEW_THRESHOLD) return;

  /*
   * The other side of the link gets its own row. The pair only exists in one
   * direction otherwise — whoever signed up second — and an admin looking at
   * the first account would see nothing at all.
   */
  for (const link of links) {
    if (link.confidence < REVIEW_THRESHOLD) continue;
    await logSuspicious({
      userId: link.linkedUserId,
      deviceId: link.deviceIds[0],
      eventType: "multi_account_suspected_other_side",
      severity: link.severity,
      actionTaken: "flag",
      details: { newUserId: userId, confidence: link.confidence, matched: link.matched },
    });
  }

  await db
    .update(devices)
    .set({
      isFlagged: true,
      flagReason: `Linked to ${links.length} other account(s): ${strongest.matched.join(", ")}`,
      flagConfidence: strongest.confidence,
      flaggedAt: new Date(),
    })
    .where(eq(devices.id, device.id));

  await db
    .update(users)
    .set({ trustScore: sql`greatest(0, ${users.trustScore} - ${strongest.trustPenalty})` })
    .where(eq(users.id, userId));
}
