import type { FingerprintSignals } from "~/lib/fingerprint";
import { bindDeviceToUser } from "~/server/anti-cheat/device";
import { logActivity, logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { HttpError } from "~/server/errors";
import { getRequestMeta } from "~/server/request";
import { getSupabaseAdmin, getSupabaseAnon } from "~/server/supabase/client";
import { getRequestEvent } from "solid-js/web";
import { clearAuthCookie, readAuthCookie, writeAuthCookie } from "./session";
import { sharedRead, invalidateShared } from "~/server/cache";

export interface OAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface PublicUser {
  id: string;
  supabaseUid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  instagramHandle: string | null;
  whatsappNumber: string | null;
  occupation: string | null;
  college: "mec" | "other" | null;
  collegeOther: string | null;
  branch: "cs" | "cu" | "ee" | "eb" | "ec" | "ev" | "me" | "other" | null;
  branchOther: string | null;
  batch: "26" | "27" | "28" | "29" | "30" | "<=26" | "na" | null;
  div: "none" | "a" | "b" | "c";
  role: "player" | "tester" | "admin";
  banLevel: number;
  banUntil: Date | null;
  banReason: string | null;
  banAckedAt: Date | null;
  trustScore: number;
  streakCount: number;
  bestStreak: number;
  onboardingCompleted: boolean;
}

/**
 * Called after a Google OAuth sign-in completes on the client.
 * Validates the Supabase session, upserts our user row, binds the device
 * (one-user-per-device enforcement), creates a DB-backed auth session and sets
 * the HttpOnly session cookie. Testers added by email are promoted here.
 */
export async function completeOAuthSignIn(
  session: OAuthSession,
  signals: FingerprintSignals,
  fpVisitorId?: string | null,
): Promise<{ userId: string; onboardingCompleted: boolean }> {
  const sb = getSupabaseAnon();
  const { data, error } = await sb.auth.getUser(session.access_token);
  if (error || !data.user) {
    throw new Error("Invalid Supabase session");
  }
  const sbUser = data.user;
  const email = sbUser.email?.toLowerCase() ?? "";
  if (!email) throw new Error("Google account has no email");

  const name =
    sbUser.user_metadata?.full_name ??
    sbUser.user_metadata?.name ??
    email.split("@")[0] ??
    "Player";
  const googleAvatar =
    (sbUser.user_metadata?.avatar_url as string | undefined) ??
    (sbUser.user_metadata?.picture as string | undefined) ??
    (sbUser.identities?.[0]?.identity_data?.avatar_url as string | undefined) ??
    (sbUser.identities?.[0]?.identity_data?.picture as string | undefined) ??
    null;

  const db = getDb();
  const existingUsers = await db<
    {
      id: string;
      name: string;
      avatar_url: string | null;
      onboarding_completed: boolean;
      role: string;
    }[]
  >`
    SELECT id, name, avatar_url, onboarding_completed, role
    FROM users
    WHERE supabase_uid = ${sbUser.id} OR email = ${email}
    LIMIT 1
  `;

  const existing = existingUsers[0];
  let userId: string;
  if (existing) {
    userId = existing.id;
    await db`
      UPDATE users
      SET
        supabase_uid = ${sbUser.id},
        email = ${email},
        name = ${existing.name || name},
        avatar_url = ${existing.avatar_url ?? googleAvatar},
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = ${existing.id}
    `;
  } else {
    const createdUsers = await db<{ id: string }[]>`
      INSERT INTO users (supabase_uid, email, name, avatar_url)
      VALUES (${sbUser.id}, ${email}, ${name}, ${googleAvatar})
      RETURNING id
    `;
    userId = createdUsers[0].id;
  }

  // Device binding + one-user-per-device enforcement.
  const bind = await bindDeviceToUser(userId, signals, fpVisitorId);
  if (!bind.allowed) {
    throw new Error(bind.reason ?? "Device not allowed");
  }

  const meta = getRequestMeta();

  /*
   * One live session per account, and a record of every account that needed
   * more than one.
   *
   * Signing in anywhere revokes everywhere else.
   */
  const displaced = await db<{ id: string; device_id: string | null; ip: string | null }[]>`
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE user_id = ${userId} AND revoked_at IS NULL
    RETURNING id, device_id, ip
  `;

  const otherDevices = [
    ...new Set(displaced.map((row) => row.device_id).filter((id) => id && id !== bind.deviceId)),
  ];
  if (displaced.length > 0) {
    await logSuspicious({
      userId,
      deviceId: bind.deviceId,
      ip: meta.ip,
      eventType: otherDevices.length > 0 ? "session_moved_device" : "session_replaced",
      severity: "info",
      actionTaken: "none",
      details: {
        revokedSessions: displaced.length,
        previousDeviceIds: otherDevices,
        previousIps: [...new Set(displaced.map((row) => row.ip).filter(Boolean))],
        newDeviceId: bind.deviceId,
        newIp: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
  const newSessions = await db<{ id: string }[]>`
    INSERT INTO auth_sessions (
      user_id,
      device_id,
      refresh_token,
      access_token,
      expires_at,
      ip,
      user_agent,
      country,
      city
    )
    VALUES (
      ${userId},
      ${bind.deviceId},
      ${session.refresh_token},
      ${session.access_token},
      ${expiresAt},
      ${meta.ip ?? null},
      ${meta.userAgent ?? null},
      ${meta.country ?? null},
      ${meta.city ?? null}
    )
    RETURNING id
  `;

  const sess = newSessions[0];
  await writeAuthCookie({ sid: sess.id, deviceId: bind.deviceId });

  await logActivity({
    userId,
    deviceId: bind.deviceId,
    ip: meta.ip,
    eventType: existing ? "login" : "signup",
    meta: {
      deviceHash: bind.deviceHash,
      fpVisitorId: fpVisitorId ?? null,
      email,
      isNewUser: !existing,
      isTester: existing?.role === "tester",
      sessionId: sess.id,
      revokedOtherSessions: displaced.length,
      ip: meta.ip,
      userAgent: meta.userAgent,
      country: meta.country,
      city: meta.city,
      signals,
    },
  });

  return { userId, onboardingCompleted: existing?.onboarding_completed ?? false };
}

/** Returns the signed-in user's DB row, or null. No token refresh. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const event = getRequestEvent();
  if (event?.locals.currentUserPromise) return event.locals.currentUserPromise;

  const lookup = getCurrentUserUncached();
  if (event) event.locals.currentUserPromise = lookup;
  return lookup;
}

async function getCurrentUserUncached(): Promise<PublicUser | null> {
  const data = await readAuthCookie();
  const sid = data?.sid;
  if (!sid) return null;
  return sharedRead(
    `session:${sid}`,
    async () => {
      const db = getDb();
      const rows = await db<(PublicUser & { sessionExpiresAt: Date | null })[]>`
        SELECT
          u.id,
          u.supabase_uid AS "supabaseUid",
          u.email,
          u.name,
          u.avatar_url AS "avatarUrl",
          u.instagram_handle AS "instagramHandle",
          u.whatsapp_number AS "whatsappNumber",
          u.occupation,
          u.college,
          u.college_other AS "collegeOther",
          u.branch,
          u.branch_other AS "branchOther",
          u.batch,
          u.div,
          u.role,
          u.ban_level AS "banLevel",
          u.ban_until AS "banUntil",
          u.ban_reason AS "banReason",
          u.ban_acked_at AS "banAckedAt",
          u.trust_score AS "trustScore",
          u.streak_count AS "streakCount",
          u.best_streak AS "bestStreak",
          u.onboarding_completed AS "onboardingCompleted",
          s.expires_at AS "sessionExpiresAt"
        FROM auth_sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.id = ${sid} AND s.revoked_at IS NULL
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return null;
      const { sessionExpiresAt, ...user } = row;
      if (isRefreshDue(sessionExpiresAt)) void refreshSessionIfNeeded(sid);
      return user as PublicUser;
    },
    15_000,
  );
}

/** A session is worth refreshing once it is within a minute of expiring. */
function isRefreshDue(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now() + 60_000;
}

/** Device id bound to the current session, if any. */
export async function getCurrentDeviceId(): Promise<string | null> {
  const data = await readAuthCookie();
  return data?.deviceId ?? null;
}

/**
 * Returns the signed-in user or throws.
 *
 * Only a hard ban (level 4) closes the account here. Soft bans are enforced at
 * the point of *play* by `assertCanPlay`, so a benched player keeps their
 * profile, the leaderboard and the schedule.
 */
export async function requireCurrentUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  if (user.banLevel >= 4) {
    throw new HttpError(403, user.banReason ?? "Account blocked");
  }
  return user;
}

/** Returns the bound device id or throws. Used by protected actions. */
export async function requireCurrentDevice(): Promise<string> {
  const deviceId = await getCurrentDeviceId();
  if (!deviceId) throw new HttpError(401, "No device bound to this session");
  return deviceId;
}

/** Returns the current user if they are an admin, else throws. */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireCurrentUser();
  if (user.role !== "admin") throw new HttpError(403, "Forbidden");
  return user;
}

/**
 * Testers and admins. Used by the pookalam shortlisting gallery, which shows
 * every entry before the public round - trusted eyes only, but not admin-only,
 * since the point is to get more than one person's opinion.
 */
export async function requireReviewer(): Promise<PublicUser> {
  const user = await requireCurrentUser();
  if (user.role !== "tester" && user.role !== "admin") throw new HttpError(403, "Forbidden");
  return user;
}

/**
 * Refresh the stored Supabase access token.
 */
async function refreshSessionIfNeeded(sessionId: string): Promise<void> {
  try {
    const db = getDb();
    const rows = await db<{ refresh_token: string | null; expires_at: Date | null }[]>`
      SELECT refresh_token, expires_at
      FROM auth_sessions
      WHERE id = ${sessionId} AND revoked_at IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || !row.refresh_token) return;
    if (!isRefreshDue(row.expires_at)) return;

    const { data, error } = await getSupabaseAnon().auth.refreshSession({
      refresh_token: row.refresh_token,
    });
    if (error || !data.session) {
      console.warn("[auth] background refreshSession failed:", error?.message);
      return;
    }
    const newExpiresAt = data.session.expires_at ? new Date(data.session.expires_at * 1000) : null;
    await db`
      UPDATE auth_sessions
      SET
        access_token = ${data.session.access_token},
        refresh_token = ${data.session.refresh_token},
        expires_at = ${newExpiresAt},
        last_seen_at = NOW()
      WHERE id = ${sessionId}
    `;
  } catch (err) {
    console.warn("[auth] refreshSession error:", err);
  }
}

export async function signOut(): Promise<void> {
  const data = await readAuthCookie();
  if (data?.sid) {
    invalidateShared(`session:${data.sid}`);
    const db = getDb();
    const rows = await db<{ refresh_token: string }[]>`
      SELECT refresh_token FROM auth_sessions WHERE id = ${data.sid} LIMIT 1
    `;
    const row = rows[0];
    if (row) {
      try {
        await getSupabaseAdmin().auth.admin.signOut(row.refresh_token);
      } catch {
        // local revocation is the source of truth regardless
      }
      await db`UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ${data.sid}`;
    }
  }
  await clearAuthCookie();
}
