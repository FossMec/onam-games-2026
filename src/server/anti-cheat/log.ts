import { getDb } from "~/server/db/client";
import { activityLogs, suspiciousLogs } from "~/server/db/schema";

interface BaseEvent {
  userId?: string;
  deviceId?: string;
  ip?: string;
  eventType: string;
}

export async function logActivity(event: BaseEvent & { meta?: unknown }): Promise<void> {
  await getDb()
    .insert(activityLogs)
    .values({
      userId: event.userId,
      deviceId: event.deviceId,
      ip: event.ip,
      eventType: event.eventType,
      metaJson: event.meta ?? {},
    });
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
  await getDb()
    .insert(suspiciousLogs)
    .values({
      userId: event.userId,
      deviceId: event.deviceId,
      ip: event.ip,
      eventType: event.eventType,
      severity: event.severity,
      detailsJson: event.details ?? {},
      actionTaken: event.actionTaken ?? "none",
    });
}
