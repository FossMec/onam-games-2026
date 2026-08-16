import { and, eq, isNull, or } from "drizzle-orm";
import type { FingerprintSignals } from "~/lib/fingerprint";
import { bindDeviceToUser } from "~/server/anti-cheat/device";
import { logActivity, logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { authSessions, testers, users } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { getRequestMeta } from "~/server/request";
import { getSupabaseAdmin, getSupabaseAnon } from "~/server/supabase/client";
import { getRequestEvent } from "solid-js/web";
import { clearAuthCookie, readAuthCookie, writeAuthCookie } from "./session";

export interface OAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

const USER_SELECT = {
  id: users.id,
  supabaseUid: users.supabaseUid,
  email: users.email,
  name: users.name,
  avatarUrl: users.avatarUrl,
  instagramHandle: users.instagramHandle,
  whatsappNumber: users.whatsappNumber,
  occupation: users.occupation,
  college: users.college,
  collegeOther: users.collegeOther,
  branch: users.branch,
  branchOther: users.branchOther,
  batch: users.batch,
  div: users.div,
  role: users.role,
  banLevel: users.banLevel,
  banUntil: users.banUntil,
  banReason: users.banReason,
  banAckedAt: users.banAckedAt,
  trustScore: users.trustScore,
  streakCount: users.streakCount,
  bestStreak: users.bestStreak,
  onboardingCompleted: users.onboardingCompleted,
} as const;

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
  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.supabaseUid, sbUser.id), eq(users.email, email)))
    .limit(1);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({
        supabaseUid: sbUser.id,
        email,
        name: existing.name || name,
        avatarUrl: existing.avatarUrl ?? googleAvatar,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, existing.id));
  } else {
    const [created] = await db
      .insert(users)
      .values({ supabaseUid: sbUser.id, email, name, avatarUrl: googleAvatar })
      .returning({ id: users.id });
    userId = created.id;
  }

  // Tester promotion (added by email via /admin). Testers go through the exact
  // same fingerprint + device binding as everyone else.
  const [tester] = await db
    .select({ id: testers.id })
    .from(testers)
    .where(and(eq(testers.email, email), eq(testers.active, true)))
    .limit(1);
  if (tester) {
    await db.update(users).set({ role: "tester" }).where(eq(users.id, userId));
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
   * Signing in anywhere revokes everywhere else, so an account cannot be played
   * from two places at once - the shared-login case that device binding alone
   * does not cover, because a borrowed account on a second phone is a second
   * *device*, not a second user.
   *
   * The log is deliberately noisy. Most entries will be somebody moving from
   * their phone to their laptop, which is innocent and expected; that is an
   * acceptable price for catching the ones that are not, since nothing here
   * blocks or bans on its own and a human reads the list before prizes go out.
   */
  const displaced = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
    .returning({ id: authSessions.id, deviceId: authSessions.deviceId, ip: authSessions.ip });

  const otherDevices = [
    ...new Set(displaced.map((row) => row.deviceId).filter((id) => id && id !== bind.deviceId)),
  ];
  if (displaced.length > 0) {
    await logSuspicious({
      userId,
      deviceId: bind.deviceId,
      ip: meta.ip,
      eventType: otherDevices.length > 0 ? "session_moved_device" : "session_replaced",
      severity: otherDevices.length > 0 ? "warn" : "info",
      actionTaken: "flag",
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

  const [sess] = await db
    .insert(authSessions)
    .values({
      userId,
      deviceId: bind.deviceId,
      refreshToken: session.refresh_token,
      accessToken: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      country: meta.country,
      city: meta.city,
    })
    .returning({ id: authSessions.id });

  await writeAuthCookie({ sid: sess.id, deviceId: bind.deviceId });

  /*
   * The whole signal set, every sign-in, not just the two fields a rule
   * happens to read today.
   *
   * `devices.fingerprint_json` only ever holds the *latest* fingerprint for a
   * device - each sign-in overwrites it. Keeping a copy per login turns that
   * into a history, which is where the interesting shapes live: a hardware
   * signature that changes under one account, a canvas hash that appears under
   * two, a visitor id that migrates between accounts. None of that is
   * recoverable later from a column that was overwritten.
   */
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
      isTester: !!tester,
      sessionId: sess.id,
      revokedOtherSessions: displaced.length,
      ip: meta.ip,
      userAgent: meta.userAgent,
      country: meta.country,
      city: meta.city,
      signals,
    },
  });

  return { userId, onboardingCompleted: existing?.onboardingCompleted ?? false };
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
  if (!data?.sid) return null;
  const db = getDb();
  const [row] = await db
    // `expiresAt` rides along on the row we are already fetching. Without it,
    // every request from a signed-in visitor paid for a second select on
    // `auth_sessions` purely to discover that the token was nowhere near
    // expiry - which is the answer 99 times out of 100.
    .select({ ...USER_SELECT, sessionExpiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, data.sid), isNull(authSessions.revokedAt)))
    .limit(1);
  if (!row) return null;
  const { sessionExpiresAt, ...user } = row;
  if (isRefreshDue(sessionExpiresAt)) void refreshSessionIfNeeded(data.sid);
  return user as PublicUser;
}

/** A session is worth refreshing once it is within a minute of expiring. */
function isRefreshDue(expiresAt: Date | null): boolean {
  return (expiresAt?.getTime() ?? 0) <= Date.now() + 60_000;
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
 *
 * Callers gate this on `isRefreshDue` with the expiry they already hold, so
 * reaching here means a refresh is expected. The row is re-read anyway because
 * this runs detached from the request that triggered it, and it needs the
 * refresh token - and the expiry is re-checked in case a concurrent request
 * got there first.
 */
async function refreshSessionIfNeeded(sessionId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)))
    .limit(1);
  if (!row) return;
  if (!isRefreshDue(row.expiresAt)) return;

  const { data, error } = await getSupabaseAnon().auth.refreshSession({
    refresh_token: row.refreshToken,
  });
  if (error || !data.session) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.id, sessionId));
    return;
  }
  await db
    .update(authSessions)
    .set({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000) : null,
      lastSeenAt: new Date(),
    })
    .where(eq(authSessions.id, sessionId));
}

export async function signOut(): Promise<void> {
  const data = await readAuthCookie();
  if (data?.sid) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, data.sid))
      .limit(1);
    if (row) {
      try {
        await getSupabaseAdmin().auth.admin.signOut(row.refreshToken);
      } catch {
        // local revocation is the source of truth regardless
      }
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authSessions.id, data.sid));
    }
  }
  await clearAuthCookie();
}
