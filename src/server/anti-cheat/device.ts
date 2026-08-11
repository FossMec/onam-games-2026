import { and, eq, ne, sql } from "drizzle-orm";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { getDb } from "~/server/db/client";
import { devices, userDevices, users } from "~/server/db/schema";
import { getRequestMeta } from "~/server/request";
import { getSetting } from "~/server/settings/service";
import { computeDeviceIdentity } from "./fingerprint";
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
 * Also detects cross-browser/same-hardware multi-accounting (log + flag only):
 * if this new (user, device) link shares a browser-independent hardware
 * signature with another active account, it is logged as suspicious.
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
          .select({ isBlocked: users.isBlocked })
          .from(users)
          .where(eq(users.id, other.userId))
          .limit(1);
        if (otherUser && !otherUser.isBlocked) {
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

  if (identity.hardwareHash) {
    await detectHardwareCorrelation(
      db,
      identity.hardwareHash,
      identity.deviceHash,
      userId,
      deviceId,
      signals,
    );
  }

  return { deviceId, deviceHash: identity.deviceHash, allowed: true };
}

/**
 * Cross-browser / same-device detection. Different browsers (or cleared-storage
 * identities) on the same physical device share the browser-independent
 * hardware signature but have different device_hashes. If another ACTIVE user
 * is linked to a device with the same hardware signature, log it. Log + flag
 * only — never blocks (avoids false positives on genuinely shared computers).
 */
async function detectHardwareCorrelation(
  db: ReturnType<typeof getDb>,
  hardwareHash: string,
  deviceHash: string,
  userId: string,
  deviceId: string,
  signals: FingerprintSignals,
): Promise<void> {
  const shared = await db
    .select({
      deviceId: devices.id,
      linkedUserId: userDevices.userId,
      userAgent: devices.userAgent,
    })
    .from(devices)
    .innerJoin(userDevices, eq(userDevices.deviceId, devices.id))
    .where(and(eq(devices.hardwareHash, hardwareHash), ne(devices.deviceHash, deviceHash)));

  const otherUserIds = new Set<string>();
  for (const row of shared) {
    if (row.linkedUserId === userId) continue;
    const [linked] = await db
      .select({ isBlocked: users.isBlocked })
      .from(users)
      .where(eq(users.id, row.linkedUserId))
      .limit(1);
    if (linked && !linked.isBlocked) otherUserIds.add(row.linkedUserId);
  }

  if (otherUserIds.size === 0) return;

  const distinctLinkedUsers = new Set(shared.map((r) => r.linkedUserId));
  const critical = distinctLinkedUsers.size >= 2;
  await logSuspicious({
    userId,
    deviceId,
    eventType: "cross_browser_same_device",
    severity: critical ? "critical" : "warn",
    actionTaken: critical ? "flag" : "none",
    details: {
      hardwareHash,
      otherUserIds: [...otherUserIds],
      otherDeviceIds: shared.map((r) => r.deviceId),
      browsers: shared.map((r) => r.userAgent),
      localIp: signals.localIp,
      uaModel: signals.uaModel,
      mdnsProtected: signals.mdnsProtected,
    },
  });

  await db
    .update(users)
    .set({
      trustScore: sql`greatest(0, ${users.trustScore} - ${critical ? 20 : 10})`,
    })
    .where(eq(users.id, userId));
}
