import { getCurrentUser } from "~/server/auth/service";
import { getDb } from "~/server/db/client";
import { sharedRead, invalidateShared } from "~/server/cache";
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

interface CollabMessageRow {
  id: string;
  day_key: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  message: string;
  likes_count: number;
  created_at: Date;
}

let tableInitPromise: Promise<void> | null = null;

export async function ensureMessageTables(): Promise<void> {
  if (tableInitPromise) return tableInitPromise;
  const db = getDb();
  tableInitPromise = (async () => {
    try {
      await db`
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
        ALTER TABLE collab_messages DROP CONSTRAINT IF EXISTS collab_messages_user_day_uniq;
        CREATE INDEX IF NOT EXISTS collab_messages_day_key_idx ON collab_messages(day_key);
        CREATE INDEX IF NOT EXISTS collab_messages_user_day_idx ON collab_messages(day_key, user_id);

        CREATE TABLE IF NOT EXISTS collab_message_likes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES collab_messages(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT collab_message_likes_user_msg_uniq UNIQUE(message_id, user_id)
        );
      `;
    } catch {
      /* ignore if already created */
    }
  })();
  return tableInitPromise;
}

function loadCollabMessageRows(dayKey: string) {
  const db = getDb();
  return db<CollabMessageRow[]>`
    SELECT id, day_key, user_id, user_name, user_avatar, message, likes_count, created_at
    FROM collab_messages
    WHERE day_key = ${dayKey}
    ORDER BY likes_count DESC, created_at DESC
    LIMIT 30
  `;
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
  const [user, allRows] = await Promise.all([
    getCurrentUser().catch(() => null),
    sharedRead(`collab:messages:${dayKey}`, () => loadCollabMessageRows(dayKey), 30_000),
  ]);
  const db = getDb();
  const isAdmin = user?.role === "admin";

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
    const ids = allRows.map((r) => r.id);
    const likes = await db<{ message_id: string }[]>`
      SELECT message_id FROM collab_message_likes
      WHERE user_id = ${user.id} AND message_id = ANY(${ids})
    `;
    userLikedSet = new Set(likes.map((l) => l.message_id));
  }

  const myRow = user ? allRows.find((r) => r.user_id === user.id) : null;

  const formatItem = (row: CollabMessageRow): CollabMessageItem => ({
    id: row.id,
    dayKey: row.day_key,
    userId: row.user_id,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    message: row.message,
    likesCount: Number(row.likes_count),
    hasLiked: userLikedSet.has(row.id),
    isMine: user ? row.user_id === user.id : false,
    createdAt: new Date(row.created_at).toISOString(),
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
    const existing = await db<{ id: string }[]>`
      SELECT id FROM collab_messages WHERE day_key = ${dayKey} AND user_id = ${user.id} LIMIT 1
    `;

    if (existing[0]) {
      return { ok: false, reason: "You have already shared a wish today! Come back tomorrow." };
    }
  }

  const userName = user.name || "Player";
  const userAvatar = user.avatarUrl || null;
  const inserted = await db<CollabMessageRow[]>`
    INSERT INTO collab_messages (day_key, user_id, user_name, user_avatar, message, likes_count)
    VALUES (${dayKey}, ${user.id}, ${userName}, ${userAvatar}, ${clean}, 0)
    RETURNING *
  `;
  const row = inserted[0];

  invalidateShared("collab:messages");

  return {
    ok: true,
    message: {
      id: row.id,
      dayKey: row.day_key,
      userId: row.user_id,
      userName: row.user_name,
      userAvatar: row.user_avatar,
      message: row.message,
      likesCount: Number(row.likes_count),
      hasLiked: false,
      isMine: true,
      createdAt: new Date(row.created_at).toISOString(),
    },
  };
}

/**
 * Delete a collaborative message (allowed for Admins only).
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
  if (!isAdmin) {
    return { ok: false, reason: "Community wishes cannot be deleted once posted." };
  }

  const db = getDb();
  await db`DELETE FROM collab_messages WHERE id = ${messageId}`;
  invalidateShared("collab:messages");
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

  const existingLikes = await db<{ id: string }[]>`
    SELECT id FROM collab_message_likes WHERE message_id = ${messageId} AND user_id = ${user.id} LIMIT 1
  `;
  const existing = existingLikes[0];

  if (existing) {
    // Unlike
    await db`DELETE FROM collab_message_likes WHERE id = ${existing.id}`;

    const updated = await db<{ likes_count: number }[]>`
      UPDATE collab_messages
      SET likes_count = GREATEST(0, likes_count - 1)
      WHERE id = ${messageId}
      RETURNING likes_count
    `;

    invalidateShared("collab:messages");
    return { ok: true, likesCount: Number(updated[0]?.likes_count ?? 0), hasLiked: false };
  } else {
    // Like
    await db`
      INSERT INTO collab_message_likes (message_id, user_id)
      VALUES (${messageId}, ${user.id})
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;

    const updated = await db<{ likes_count: number }[]>`
      UPDATE collab_messages
      SET likes_count = likes_count + 1
      WHERE id = ${messageId}
      RETURNING likes_count
    `;

    invalidateShared("collab:messages");
    return { ok: true, likesCount: Number(updated[0]?.likes_count ?? 1), hasLiked: true };
  }
}
