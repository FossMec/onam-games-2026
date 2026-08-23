import { getDb } from "~/server/db/client";

interface BaseEvent {
  userId?: string;
  deviceId?: string;
  ip?: string;
  eventType: string;
}

export async function logActivity(event: BaseEvent & { meta?: unknown }): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO activity_logs (user_id, device_id, ip, event_type, meta_json)
    VALUES (
      ${event.userId ?? null},
      ${event.deviceId ?? null},
      ${event.ip ?? null},
      ${event.eventType},
      ${JSON.stringify(event.meta ?? {})}::jsonb
    )
  `;
}

type Severity = "info" | "warn" | "critical";
type ActionTaken = "none" | "flag" | "block";

export async function logSuspicious(
  event: BaseEvent & {
    severity: Severity;
    details?: unknown;
    actionTaken?: ActionTaken;
  },
): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO suspicious_logs (user_id, device_id, ip, event_type, severity, details_json, action_taken)
    VALUES (
      ${event.userId ?? null},
      ${event.deviceId ?? null},
      ${event.ip ?? null},
      ${event.eventType},
      ${event.severity},
      ${JSON.stringify(event.details ?? {})}::jsonb,
      ${event.actionTaken ?? "none"}
    )
  `;
}
