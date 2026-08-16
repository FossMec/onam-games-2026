import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentUser } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { collabMessageLikes, collabMessages } from "~/server/db/schema";
import { censorMessageServer, MAX_MESSAGE_CHARS } from "./censor";
import { istDayKey } from "./collab";

export interface CollabMessageItem {
  id: string;
  dayKey: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  message: string;
  likesCount: number;
  hasLiked: boolean;
  isMine: boolean;
  createdAt: string;
}

let tableInitPromise: Promise<void> | null = null;

export async function ensureMessageTables(): Promise<void> {
  if (tableInitPromise) return tableInitPromise;
  const db = getDb();
  tableInitPromise = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS collab_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          day_key TEXT NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_name TEXT NOT NULL,
          user_avatar TEXT,
          message TEXT NOT NULL,
          likes_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS collab_messages_day_key_idx ON collab_messages(day_key);

        CREATE TABLE IF NOT EXISTS collab_message_likes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES collab_messages(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT collab_message_likes_user_msg_uniq UNIQUE(message_id, user_id)
        );
      `);
    } catch {
      /* ignore if already created */
    }
  })();
  return tableInitPromise;
}

/**
 * Returns up to 30 messages for today so the client can perform smooth
 * local weighted rotations without recurring network polling.
 */
export async function getCollabMessages(dayKey: string = istDayKey()): Promise<{
  messages: CollabMessageItem[];
  myMessage: CollabMessageItem | null;
  canPost: boolean;
  signedIn: boolean;
  isAdmin: boolean;
}> {
  await ensureMessageTables();
  const user = await getCurrentUser();
  const db = getDb();
  const isAdmin = user?.role === "admin";

  const allRows = await db
    .select()
    .from(collabMessages)
    .where(eq(collabMessages.dayKey, dayKey))
    .orderBy(desc(collabMessages.likesCount), desc(collabMessages.createdAt))
    .limit(30);

  if (allRows.length === 0) {
    return {
      messages: [],
      myMessage: null,
      canPost: !!user,
      signedIn: !!user,
      isAdmin,
    };
  }

  // Get user's liked message ids
  let userLikedSet = new Set<string>();
  if (user) {
    const likes = await db
      .select({ messageId: collabMessageLikes.messageId })
      .from(collabMessageLikes)
      .where(
        and(
          eq(collabMessageLikes.userId, user.id),
          inArray(
            collabMessageLikes.messageId,
            allRows.map((r) => r.id),
          ),
        ),
      );
    userLikedSet = new Set(likes.map((l) => l.messageId));
  }

  const myRow = user ? allRows.find((r) => r.userId === user.id) : null;

  const formatItem = (row: (typeof allRows)[0]): CollabMessageItem => ({
    id: row.id,
    dayKey: row.dayKey,
    userId: row.userId,
    userName: row.userName,
    userAvatar: row.userAvatar,
    message: row.message,
    likesCount: row.likesCount,
    hasLiked: userLikedSet.has(row.id),
    isMine: user ? row.userId === user.id : false,
    createdAt: row.createdAt.toISOString(),
  });

  return {
    messages: allRows.map(formatItem),
    myMessage: myRow ? formatItem(myRow) : null,
    canPost: !!user && (isAdmin || !myRow),
    signedIn: !!user,
    isAdmin,
  };
}

/**
 * Post an Onam wish.
 * Enforces 1 message per user per calendar day (bypassed for admins) & max 100 characters.
 */
export async function postCollabMessage(
  rawText: string,
): Promise<{ ok: boolean; message?: CollabMessageItem; reason?: string }> {
  await ensureMessageTables();
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "Please sign in to share your Onam wish." };
  }

  const isAdmin = user.role === "admin";
  const trimmed = (rawText || "").trim();
  if (trimmed.length < 2) {
    return { ok: false, reason: "Your wish is too short (min 2 characters)." };
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    return { ok: false, reason: `Your wish must be at most ${MAX_MESSAGE_CHARS} characters.` };
  }

  const { clean } = censorMessageServer(trimmed);
  const dayKey = istDayKey();
  const db = getDb();

  // Check if user already posted today (only for non-admins)
  if (!isAdmin) {
    const [existing] = await db
      .select({ id: collabMessages.id })
      .from(collabMessages)
      .where(and(eq(collabMessages.dayKey, dayKey), eq(collabMessages.userId, user.id)))
      .limit(1);

    if (existing) {
      return { ok: false, reason: "You have already shared a wish today! Come back tomorrow." };
    }
  }

  const [inserted] = await db
    .insert(collabMessages)
    .values({
      dayKey,
      userId: user.id,
      userName: user.name || "Player",
      userAvatar: user.avatarUrl || null,
      message: clean,
      likesCount: 0,
    })
    .returning();

  return {
    ok: true,
    message: {
      id: inserted.id,
      dayKey: inserted.dayKey,
      userId: inserted.userId,
      userName: inserted.userName,
      userAvatar: inserted.userAvatar,
      message: inserted.message,
      likesCount: inserted.likesCount,
      hasLiked: false,
      isMine: true,
      createdAt: inserted.createdAt.toISOString(),
    },
  };
}

/**
 * Delete a collaborative message (allowed for Admins or the author).
 */
export async function deleteCollabMessage(
  messageId: string,
): Promise<{ ok: boolean; reason?: string }> {
  await ensureMessageTables();
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "Unauthorized" };
  }

  const isAdmin = user.role === "admin";
  const db = getDb();

  if (isAdmin) {
    await db.delete(collabMessages).where(eq(collabMessages.id, messageId));
    return { ok: true };
  }

  const deleted = await db
    .delete(collabMessages)
    .where(and(eq(collabMessages.id, messageId), eq(collabMessages.userId, user.id)))
    .returning({ id: collabMessages.id });

  if (deleted.length === 0) {
    return { ok: false, reason: "You can only delete your own message." };
  }

  return { ok: true };
}

/**
 * Like or unlike a collaborative message.
 */
export async function toggleCollabMessageLike(
  messageId: string,
): Promise<{ ok: boolean; likesCount: number; hasLiked: boolean; reason?: string }> {
  await ensureMessageTables();
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, likesCount: 0, hasLiked: false, reason: "Sign in to like wishes." };
  }

  const db = getDb();

  // Check if like exists
  const [existing] = await db
    .select({ id: collabMessageLikes.id })
    .from(collabMessageLikes)
    .where(and(eq(collabMessageLikes.messageId, messageId), eq(collabMessageLikes.userId, user.id)))
    .limit(1);

  if (existing) {
    // Unlike
    await db.delete(collabMessageLikes).where(eq(collabMessageLikes.id, existing.id));

    const [updated] = await db
      .update(collabMessages)
      .set({
        likesCount: sql`greatest(0, ${collabMessages.likesCount} - 1)`,
      })
      .where(eq(collabMessages.id, messageId))
      .returning({ likesCount: collabMessages.likesCount });

    return { ok: true, likesCount: updated?.likesCount ?? 0, hasLiked: false };
  } else {
    // Like
    await db
      .insert(collabMessageLikes)
      .values({ messageId, userId: user.id })
      .onConflictDoNothing();

    const [updated] = await db
      .update(collabMessages)
      .set({
        likesCount: sql`${collabMessages.likesCount} + 1`,
      })
      .where(eq(collabMessages.id, messageId))
      .returning({ likesCount: collabMessages.likesCount });

    return { ok: true, likesCount: updated?.likesCount ?? 1, hasLiked: true };
  }
}
