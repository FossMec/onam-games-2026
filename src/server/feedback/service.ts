import { getDb } from "~/server/db/client";
import type { UserFeedback } from "~/server/db/schema";

let tableEnsured = false;

export async function ensureFeedbackTable() {
  if (tableEnsured) return;
  const db = getDb();
  try {
    await db`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        device_id text,
        enjoyed_games text,
        favorite_thing text,
        changes_next_year text,
        code_pookalam_experience text,
        code_pookalam_roadmap text,
        open_source_learning text,
        want_more_foss_events text,
        next_event_suggestions text,
        learn_topics text,
        community_pookalam_experience text,
        batch text,
        college text,
        additional_notes text,
        answers_json jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await db`
      CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON user_feedback (user_id);
    `;
    await db`
      CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON user_feedback (created_at DESC);
    `;
    tableEnsured = true;
  } catch (err) {
    console.warn("[feedback] table init notice:", err);
  }
}

export interface SaveFeedbackPayload {
  enjoyedGames?: string | null;
  favoriteThing?: string | null;
  changesNextYear?: string | null;
  codePookalamExperience?: string | null;
  codePookalamRoadmap?: string | null;
  openSourceLearning?: string | null;
  wantMoreFossEvents?: string | null;
  nextEventSuggestions?: string | null;
  learnTopics?: string | null;
  communityPookalamExperience?: string | null;
  batch?: string | null;
  college?: string | null;
  additionalNotes?: string | null;
  answersJson?: Record<string, unknown> | null;
}

export async function saveFeedback(
  userId: string | null,
  deviceId: string | null,
  payload: SaveFeedbackPayload,
): Promise<{ id: string; success: boolean }> {
  await ensureFeedbackTable();
  const db = getDb();

  const answersJson = payload.answersJson ? JSON.stringify(payload.answersJson) : "{}";

  // Check if a feedback row already exists for this user or device
  let existingId: string | null = null;
  if (userId) {
    const existing = await db<{ id: string }[]>`
      SELECT id FROM user_feedback WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 1
    `;
    if (existing.length > 0) {
      existingId = existing[0].id;
    }
  } else if (deviceId) {
    const existing = await db<{ id: string }[]>`
      SELECT id FROM user_feedback WHERE device_id = ${deviceId} AND user_id IS NULL ORDER BY updated_at DESC LIMIT 1
    `;
    if (existing.length > 0) {
      existingId = existing[0].id;
    }
  }

  if (existingId) {
    await db`
      UPDATE user_feedback
      SET
        user_id = COALESCE(${userId}, user_id),
        device_id = COALESCE(${deviceId}, device_id),
        enjoyed_games = ${payload.enjoyedGames ?? null},
        favorite_thing = ${payload.favoriteThing ?? null},
        changes_next_year = ${payload.changesNextYear ?? null},
        code_pookalam_experience = ${payload.codePookalamExperience ?? null},
        code_pookalam_roadmap = ${payload.codePookalamRoadmap ?? null},
        open_source_learning = ${payload.openSourceLearning ?? null},
        want_more_foss_events = ${payload.wantMoreFossEvents ?? null},
        next_event_suggestions = ${payload.nextEventSuggestions ?? null},
        learn_topics = ${payload.learnTopics ?? null},
        community_pookalam_experience = ${payload.communityPookalamExperience ?? null},
        batch = ${payload.batch ?? null},
        college = ${payload.college ?? null},
        additional_notes = ${payload.additionalNotes ?? null},
        answers_json = ${answersJson}::jsonb,
        updated_at = NOW()
      WHERE id = ${existingId}
    `;
    return { id: existingId, success: true };
  }

  const inserted = await db<{ id: string }[]>`
    INSERT INTO user_feedback (
      user_id,
      device_id,
      enjoyed_games,
      favorite_thing,
      changes_next_year,
      code_pookalam_experience,
      code_pookalam_roadmap,
      open_source_learning,
      want_more_foss_events,
      next_event_suggestions,
      learn_topics,
      community_pookalam_experience,
      batch,
      college,
      additional_notes,
      answers_json,
      created_at,
      updated_at
    ) VALUES (
      ${userId},
      ${deviceId},
      ${payload.enjoyedGames ?? null},
      ${payload.favoriteThing ?? null},
      ${payload.changesNextYear ?? null},
      ${payload.codePookalamExperience ?? null},
      ${payload.codePookalamRoadmap ?? null},
      ${payload.openSourceLearning ?? null},
      ${payload.wantMoreFossEvents ?? null},
      ${payload.nextEventSuggestions ?? null},
      ${payload.learnTopics ?? null},
      ${payload.communityPookalamExperience ?? null},
      ${payload.batch ?? null},
      ${payload.college ?? null},
      ${payload.additionalNotes ?? null},
      ${answersJson}::jsonb,
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  return { id: inserted[0]?.id ?? "", success: true };
}

export async function getFeedbackForUser(
  userId: string | null,
  deviceId: string | null,
): Promise<UserFeedback | null> {
  await ensureFeedbackTable();
  const db = getDb();

  let rows: (UserFeedback & { answers_json: unknown })[] = [];

  if (userId) {
    rows = await db<any[]>`
      SELECT
        id,
        user_id AS "userId",
        device_id AS "deviceId",
        enjoyed_games AS "enjoyedGames",
        favorite_thing AS "favoriteThing",
        changes_next_year AS "changesNextYear",
        code_pookalam_experience AS "codePookalamExperience",
        code_pookalam_roadmap AS "codePookalamRoadmap",
        open_source_learning AS "openSourceLearning",
        want_more_foss_events AS "wantMoreFossEvents",
        next_event_suggestions AS "nextEventSuggestions",
        learn_topics AS "learnTopics",
        community_pookalam_experience AS "communityPookalamExperience",
        batch,
        college,
        additional_notes AS "additionalNotes",
        answers_json AS "answersJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_feedback
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
  } else if (deviceId) {
    rows = await db<any[]>`
      SELECT
        id,
        user_id AS "userId",
        device_id AS "deviceId",
        enjoyed_games AS "enjoyedGames",
        favorite_thing AS "favoriteThing",
        changes_next_year AS "changesNextYear",
        code_pookalam_experience AS "codePookalamExperience",
        code_pookalam_roadmap AS "codePookalamRoadmap",
        open_source_learning AS "openSourceLearning",
        want_more_foss_events AS "wantMoreFossEvents",
        next_event_suggestions AS "nextEventSuggestions",
        learn_topics AS "learnTopics",
        community_pookalam_experience AS "communityPookalamExperience",
        batch,
        college,
        additional_notes AS "additionalNotes",
        answers_json AS "answersJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_feedback
      WHERE device_id = ${deviceId} AND user_id IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;
  }

  return rows[0] ?? null;
}

export interface FeedbackWithUserInfo extends UserFeedback {
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
}

export async function getAllFeedbackList(params?: {
  batch?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: FeedbackWithUserInfo[]; total: number }> {
  await ensureFeedbackTable();
  const db = getDb();
  const limit = Math.min(params?.limit ?? 50, 100);
  const offset = params?.offset ?? 0;
  const batchFilter = params?.batch && params.batch !== "all" ? params.batch : null;

  const countRows = await db<{ count: string }[]>`
    SELECT COUNT(*) as count
    FROM user_feedback f
    WHERE (${batchFilter}::text IS NULL OR f.batch = ${batchFilter})
  `;
  const total = parseInt(countRows[0]?.count ?? "0", 10);

  const rows = await db<any[]>`
    SELECT
      f.id,
      f.user_id AS "userId",
      f.device_id AS "deviceId",
      f.enjoyed_games AS "enjoyedGames",
      f.favorite_thing AS "favoriteThing",
      f.changes_next_year AS "changesNextYear",
      f.code_pookalam_experience AS "codePookalamExperience",
      f.code_pookalam_roadmap AS "codePookalamRoadmap",
      f.open_source_learning AS "openSourceLearning",
      f.want_more_foss_events AS "wantMoreFossEvents",
      f.next_event_suggestions AS "nextEventSuggestions",
      f.learn_topics AS "learnTopics",
      f.community_pookalam_experience AS "communityPookalamExperience",
      f.batch,
      f.college,
      f.additional_notes AS "additionalNotes",
      f.answers_json AS "answersJson",
      f.created_at AS "createdAt",
      f.updated_at AS "updatedAt",
      u.name AS "userName",
      u.email AS "userEmail",
      u.avatar_url AS "userAvatar"
    FROM user_feedback f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE (${batchFilter}::text IS NULL OR f.batch = ${batchFilter})
    ORDER BY f.updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return {
    items: rows,
    total,
  };
}

export async function getFeedbackSummaryStats(): Promise<{
  totalCount: number;
  mec30Count: number;
  batchCounts: Record<string, number>;
}> {
  await ensureFeedbackTable();
  const db = getDb();

  const rows = await db<{ batch: string | null; count: string }[]>`
    SELECT batch, COUNT(*) as count
    FROM user_feedback
    GROUP BY batch
  `;

  let totalCount = 0;
  let mec30Count = 0;
  const batchCounts: Record<string, number> = {};

  for (const r of rows) {
    const c = parseInt(r.count, 10);
    totalCount += c;
    const b = r.batch ?? "unspecified";
    batchCounts[b] = c;
    if (r.batch === "30") {
      mec30Count += c;
    }
  }

  return {
    totalCount,
    mec30Count,
    batchCounts,
  };
}
