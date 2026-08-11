import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { authSessions, users } from "~/server/db/schema";
import { getRequestMeta } from "~/server/request";
import { getSupabaseAdmin, getSupabaseAnon } from "~/server/supabase/client";
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
  college: users.college,
  branch: users.branch,
  batch: users.batch,
  div: users.div,
  role: users.role,
  isBlocked: users.isBlocked,
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
  college: "mec" | "other" | null;
  branch: "cs" | "cu" | "ee" | "eb" | "ec" | "ev" | "me" | "other" | null;
  batch: "27" | "28" | "29" | "30" | "<=26" | null;
  div: "none" | "a" | "b" | "c";
  role: "player" | "tester" | "admin";
  isBlocked: boolean;
  trustScore: number;
  streakCount: number;
  bestStreak: number;
  onboardingCompleted: boolean;
}

/**
 * Called after a Google OAuth sign-in completes on the client.
 * Validates the Supabase session, upserts our user row, creates a DB-backed
 * auth session and sets the HttpOnly session cookie.
 */
export async function completeOAuthSignIn(
  session: OAuthSession,
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
  const avatarUrl = sbUser.user_metadata?.avatar_url ?? sbUser.user_metadata?.picture ?? null;

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.supabaseUid, sbUser.id)).limit(1);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({
        email,
        name,
        avatarUrl: avatarUrl ?? existing.avatarUrl,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, existing.id));
  } else {
    const [created] = await db
      .insert(users)
      .values({ supabaseUid: sbUser.id, email, name, avatarUrl })
      .returning({ id: users.id });
    userId = created.id;
  }

  const meta = getRequestMeta();
  const [sess] = await db
    .insert(authSessions)
    .values({
      userId,
      refreshToken: session.refresh_token,
      accessToken: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      country: meta.country,
      city: meta.city,
    })
    .returning({ id: authSessions.id });

  await writeAuthCookie(sess.id);
  return { userId, onboardingCompleted: existing?.onboardingCompleted ?? false };
}

/** Returns the signed-in user's DB row, or null. No token refresh. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const data = await readAuthCookie();
  if (!data?.sid) return null;
  const db = getDb();
  const [row] = await db
    .select(USER_SELECT)
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, data.sid), isNull(authSessions.revokedAt)))
    .limit(1);
  if (!row) return null;
  void refreshSessionIfNeeded(data.sid);
  return (row ?? null) as PublicUser | null;
}

/** Returns the signed-in user or throws. Used by protected actions. */
export async function requireCurrentUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  if (user.isBlocked) throw new Error("Account blocked");
  return user;
}

/** Refresh the stored Supabase access token if it is near expiry. */
async function refreshSessionIfNeeded(sessionId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)))
    .limit(1);
  if (!row) return;
  const expiresAt = row.expiresAt?.getTime() ?? 0;
  if (expiresAt > Date.now() + 60_000) return;

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
