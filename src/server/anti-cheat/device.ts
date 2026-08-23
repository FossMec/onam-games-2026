import type { FingerprintSignals } from "~/lib/fingerprint";
import { getDb, type Db } from "~/server/db/client";
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

  const existingDevices = await db<
    {
      id: string;
      hardware_hash: string | null;
      fp_visitor_id: string | null;
      canvas_hash: string | null;
      webgl_hash: string | null;
      font_hash: string | null;
      screen_hash: string | null;
      audio_hash: string | null;
      local_ip: string | null;
      user_agent: string | null;
      platform: string | null;
      last_country: string | null;
      last_city: string | null;
    }[]
  >`
    SELECT
      id, hardware_hash, fp_visitor_id, canvas_hash, webgl_hash, font_hash,
      screen_hash, audio_hash, local_ip, user_agent, platform, last_country, last_city
    FROM devices
    WHERE device_hash = ${identity.deviceHash}
    LIMIT 1
  `;

  const existing = existingDevices[0];
  let deviceId: string;
  if (existing) {
    deviceId = existing.id;
    await db`
      UPDATE devices
      SET
        last_ip = ${meta.ip ?? null},
        last_seen_at = NOW(),
        hardware_hash = ${identity.hardwareHash ?? existing.hardware_hash},
        fp_visitor_id = ${fpVisitorId ?? existing.fp_visitor_id},
        canvas_hash = ${identity.canvasHash ?? existing.canvas_hash},
        webgl_hash = ${identity.webglHash ?? existing.webgl_hash},
        font_hash = ${identity.fontHash ?? existing.font_hash},
        screen_hash = ${identity.screenHash ?? existing.screen_hash},
        audio_hash = ${identity.audioHash ?? existing.audio_hash},
        local_ip = ${identity.localIp ?? existing.local_ip},
        fingerprint_json = ${JSON.stringify(signals)}::jsonb,
        user_agent = ${meta.userAgent || existing.user_agent},
        platform = ${signals.platform || existing.platform},
        last_country = ${meta.country ?? existing.last_country},
        last_city = ${meta.city ?? existing.last_city}
      WHERE id = ${existing.id}
    `;
  } else {
    const createdDevices = await db<{ id: string }[]>`
      INSERT INTO devices (
        device_hash,
        hardware_hash,
        fp_visitor_id,
        fingerprint_json,
        canvas_hash,
        webgl_hash,
        font_hash,
        screen_hash,
        audio_hash,
        local_ip,
        user_agent,
        platform,
        first_ip,
        last_ip,
        first_country,
        first_city,
        last_country,
        last_city
      )
      VALUES (
        ${identity.deviceHash},
        ${identity.hardwareHash ?? null},
        ${fpVisitorId ?? null},
        ${JSON.stringify(signals)}::jsonb,
        ${identity.canvasHash ?? null},
        ${identity.webglHash ?? null},
        ${identity.fontHash ?? null},
        ${identity.screenHash ?? null},
        ${identity.audioHash ?? null},
        ${identity.localIp ?? null},
        ${meta.userAgent ?? null},
        ${signals.platform ?? null},
        ${meta.ip ?? null},
        ${meta.ip ?? null},
        ${meta.country ?? null},
        ${meta.city ?? null},
        ${meta.country ?? null},
        ${meta.city ?? null}
      )
      RETURNING id
    `;
    deviceId = createdDevices[0].id;

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

  const bindings = await db<{ id: string; usage_count: number }[]>`
    SELECT id, usage_count
    FROM user_devices
    WHERE user_id = ${userId} AND device_id = ${deviceId}
    LIMIT 1
  `;

  const binding = bindings[0];
  if (binding) {
    await db`
      UPDATE user_devices
      SET last_used_at = NOW(), usage_count = ${binding.usage_count + 1}
      WHERE id = ${binding.id}
    `;
    return { deviceId, deviceHash: identity.deviceHash, allowed: true };
  }

  // New (user, device) link.
  if (stable) {
    const enforce = await getSetting<boolean>("enforce_one_user_per_device", true);
    if (enforce) {
      const otherUserDevices = await db<{ user_id: string }[]>`
        SELECT user_id
        FROM user_devices
        WHERE device_id = ${deviceId} AND is_primary = true
        LIMIT 1
      `;
      const other = otherUserDevices[0];
      if (other && other.user_id !== userId) {
        const otherUsers = await db<{ ban_level: number }[]>`
          SELECT ban_level FROM users WHERE id = ${other.user_id} LIMIT 1
        `;
        const otherUser = otherUsers[0];
        // A hard-banned prior owner does not get to lock the device forever.
        if (otherUser && otherUser.ban_level < 4) {
          await logSuspicious({
            userId,
            deviceId,
            eventType: "multi_account_device",
            severity: "critical",
            details: { otherUserId: other.user_id, deviceHash: identity.deviceHash },
            actionTaken: "block",
          });
          await logSuspicious({
            userId: other.user_id,
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

  await db`
    INSERT INTO user_devices (user_id, device_id, is_primary, usage_count)
    VALUES (${userId}, ${deviceId}, ${stable}, 1)
  `;

  await detectLinkedAccounts(
    db,
    {
      id: deviceId,
      deviceHash: identity.deviceHash,
      fpVisitorId: fpVisitorId ?? existing?.fp_visitor_id ?? null,
      hardwareHash: identity.hardwareHash ?? existing?.hardware_hash ?? null,
      canvasHash: identity.canvasHash ?? existing?.canvas_hash ?? null,
      webglHash: identity.webglHash ?? existing?.webgl_hash ?? null,
      fontHash: identity.fontHash ?? existing?.font_hash ?? null,
      screenHash: identity.screenHash ?? existing?.screen_hash ?? null,
      audioHash: identity.audioHash ?? existing?.audio_hash ?? null,
      localIp: identity.localIp ?? existing?.local_ip ?? null,
      lastIp: meta.ip || null,
    },
    userId,
    signals,
  );

  return { deviceId, deviceHash: identity.deviceHash, allowed: true };
}

/**
 * Detect linked accounts sharing hardware/canvas/IP signals.
 */
async function detectLinkedAccounts(
  db: Db,
  device: DeviceSignals & { id: string; deviceHash: string },
  userId: string,
  signals: FingerprintSignals,
): Promise<void> {
  const conds = [];
  if (device.fpVisitorId) conds.push(db`d.fp_visitor_id = ${device.fpVisitorId}`);
  if (device.hardwareHash) conds.push(db`d.hardware_hash = ${device.hardwareHash}`);
  if (device.canvasHash) conds.push(db`d.canvas_hash = ${device.canvasHash}`);
  if (device.audioHash) conds.push(db`d.audio_hash = ${device.audioHash}`);
  if (device.localIp) conds.push(db`d.local_ip = ${device.localIp}`);
  if (device.webglHash) conds.push(db`d.webgl_hash = ${device.webglHash}`);
  if (device.fontHash) conds.push(db`d.font_hash = ${device.fontHash}`);
  if (device.lastIp) conds.push(db`d.last_ip = ${device.lastIp}`);

  if (conds.length === 0) return;

  // Build OR condition
  const orFilter = conds.reduce((acc, curr) => db`${acc} OR ${curr}`);

  const shared = await db<
    {
      deviceId: string;
      linkedUserId: string;
      userAgent: string | null;
      banLevel: number;
      fpVisitorId: string | null;
      hardwareHash: string | null;
      canvasHash: string | null;
      webglHash: string | null;
      fontHash: string | null;
      screenHash: string | null;
      audioHash: string | null;
      localIp: string | null;
      lastIp: string | null;
    }[]
  >`
    SELECT
      d.id AS "deviceId",
      ud.user_id AS "linkedUserId",
      d.user_agent AS "userAgent",
      u.ban_level AS "banLevel",
      d.fp_visitor_id AS "fpVisitorId",
      d.hardware_hash AS "hardwareHash",
      d.canvas_hash AS "canvasHash",
      d.webgl_hash AS "webglHash",
      d.font_hash AS "fontHash",
      d.screen_hash AS "screenHash",
      d.audio_hash AS "audioHash",
      d.local_ip AS "localIp",
      d.last_ip AS "lastIp"
    FROM devices d
    INNER JOIN user_devices ud ON ud.device_id = d.id
    INNER JOIN users u ON u.id = ud.user_id
    WHERE d.device_hash != ${device.deviceHash} AND (${orFilter})
  `;

  const perUser = new Map<string, { matched: LinkSignal[]; deviceIds: string[] }>();
  for (const row of shared) {
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

  const strongest = links[0];
  if (strongest.matched.length === 1 && strongest.matched[0] === "ip") return;
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

  const flagReason = `Linked to ${links.length} other account(s): ${strongest.matched.join(", ")}`;
  await db`
    UPDATE devices
    SET
      is_flagged = true,
      flag_reason = ${flagReason},
      flag_confidence = ${strongest.confidence},
      flagged_at = NOW()
    WHERE id = ${device.id}
  `;

  await db`
    UPDATE users
    SET trust_score = GREATEST(0, trust_score - ${strongest.trustPenalty})
    WHERE id = ${userId}
  `;
}
