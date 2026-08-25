import { getDb } from "~/server/db/client";
import { invalidateShared } from "~/server/cache";
import { requireAdmin } from "~/server/auth/service";
import type { BanLevel } from "~/server/auth/bans";
import { setBanLevel } from "~/server/auth/bans";
import { ensureDefaultSettings } from "~/server/settings/defaults";
import { ensureMessageTables } from "~/server/pookalam/comments";

export async function adminListUsers(limit?: number, offset = 0) {
  await requireAdmin();
  const db = getDb();
  if (limit && limit > 0) {
    return db<
      {
        id: string;
        email: string;
        name: string;
        role: "player" | "tester" | "admin" | null;
        college: string | null;
        collegeOther: string | null;
        branch: string | null;
        branchOther: string | null;
        batch: string | null;
        div: string | null;
        occupation: string | null;
        instagramHandle: string | null;
        whatsappNumber: string | null;
        avatarUrl: string | null;
        banLevel: number;
        banUntil: Date | null;
        banReason: string | null;
        trustScore: number;
        streakCount: number;
        onboardingCompleted: boolean;
        createdAt: Date;
        lastLoginAt: Date | null;
      }[]
    >`
      SELECT
        id,
        email,
        name,
        role,
        college,
        college_other AS "collegeOther",
        branch,
        branch_other AS "branchOther",
        batch,
        div,
        occupation,
        instagram_handle AS "instagramHandle",
        whatsapp_number AS "whatsappNumber",
        avatar_url AS "avatarUrl",
        ban_level AS "banLevel",
        ban_until AS "banUntil",
        ban_reason AS "banReason",
        trust_score AS "trustScore",
        streak_count AS "streakCount",
        onboarding_completed AS "onboardingCompleted",
        created_at AS "createdAt",
        last_login_at AS "lastLoginAt"
      FROM users
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return db<
    {
      id: string;
      email: string;
      name: string;
      role: "player" | "tester" | "admin" | null;
      college: string | null;
      collegeOther: string | null;
      branch: string | null;
      branchOther: string | null;
      batch: string | null;
      div: string | null;
      occupation: string | null;
      instagramHandle: string | null;
      whatsappNumber: string | null;
      avatarUrl: string | null;
      banLevel: number;
      banUntil: Date | null;
      banReason: string | null;
      trustScore: number;
      streakCount: number;
      onboardingCompleted: boolean;
      createdAt: Date;
      lastLoginAt: Date | null;
    }[]
  >`
    SELECT
      id,
      email,
      name,
      role,
      college,
      college_other AS "collegeOther",
      branch,
      branch_other AS "branchOther",
      batch,
      div,
      occupation,
      instagram_handle AS "instagramHandle",
      whatsapp_number AS "whatsappNumber",
      avatar_url AS "avatarUrl",
      ban_level AS "banLevel",
      ban_until AS "banUntil",
      ban_reason AS "banReason",
      trust_score AS "trustScore",
      streak_count AS "streakCount",
      onboarding_completed AS "onboardingCompleted",
      created_at AS "createdAt",
      last_login_at AS "lastLoginAt"
    FROM users
    ORDER BY created_at DESC
  `;
}

export async function adminSetUserRole(userId: string, role: "player" | "tester" | "admin") {
  await requireAdmin();
  const db = getDb();
  const rows = await db<{ email: string }[]>`
    UPDATE users SET role = ${role}::role, updated_at = NOW() WHERE id = ${userId} RETURNING email
  `;
  const email = rows[0]?.email?.trim().toLowerCase();
  if (email) {
    if (role === "player") {
      // Demoted to player: also mark inactive in testers table so they don't remain as an active tester
      await db`UPDATE testers SET active = false WHERE email = ${email}`;
    } else if (role === "tester") {
      // Promoted to tester: also insert or activate in testers table
      await db`
        INSERT INTO testers (email, early_hours)
        VALUES (${email}, 24)
        ON CONFLICT (email) DO UPDATE
        SET active = true, activated_at = NOW()
      `;
    }
  }
  invalidateShared("user:");
  invalidateShared("games:");
}

export async function adminSetUserBanLevel(userId: string, level: BanLevel, reason?: string) {
  await requireAdmin();
  await setBanLevel(userId, level, level === 0 ? null : (reason ?? "set by admin"));
}

export async function adminListTesters(limit = 100, offset = 0) {
  await requireAdmin();
  const db = getDb();
  return db<
    {
      id: string;
      email: string;
      earlyHours: number;
      active: boolean;
      activatedAt: Date | null;
      createdAt: Date;
    }[]
  >`
    SELECT
      id,
      email,
      early_hours AS "earlyHours",
      active,
      activated_at AS "activatedAt",
      created_at AS "createdAt"
    FROM testers
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function adminAddTester(email: string, earlyHours = 24) {
  await requireAdmin();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Invalid email");
  const db = getDb();
  await db`
    INSERT INTO testers (email, early_hours)
    VALUES (${normalized}, ${earlyHours})
    ON CONFLICT (email) DO UPDATE
    SET active = true, early_hours = ${earlyHours}, activated_at = NOW()
  `;
  // Sync users table if user already exists
  await db`UPDATE users SET role = 'tester', updated_at = NOW() WHERE email = ${normalized} AND role = 'player'`;
}

export async function adminSetTesterActive(id: string, active: boolean) {
  await requireAdmin();
  const db = getDb();
  const rows = await db<{ email: string }[]>`
    UPDATE testers SET active = ${active} WHERE id = ${id} RETURNING email
  `;
  const email = rows[0]?.email?.trim().toLowerCase();
  if (email) {
    if (!active) {
      await db`UPDATE users SET role = 'player', updated_at = NOW() WHERE email = ${email} AND role = 'tester'`;
    } else {
      await db`UPDATE users SET role = 'tester', updated_at = NOW() WHERE email = ${email} AND role = 'player'`;
    }
  }
}

export async function adminDeleteTester(id: string) {
  await requireAdmin();
  const db = getDb();
  const rows = await db<{ email: string }[]>`
    DELETE FROM testers WHERE id = ${id} RETURNING email
  `;
  const email = rows[0]?.email?.trim().toLowerCase();
  if (email) {
    await db`UPDATE users SET role = 'player', updated_at = NOW() WHERE email = ${email} AND role = 'tester'`;
  }
}

export async function adminListSuspicious(limit = 100, offset = 0) {
  await requireAdmin();
  const db = getDb();
  return db<
    {
      id: string;
      eventType: string;
      severity: string;
      actionTaken: string;
      details: unknown;
      ip: string | null;
      userEmail: string | null;
      deviceHash: string | null;
      createdAt: Date;
    }[]
  >`
    SELECT
      s.id,
      s.event_type AS "eventType",
      s.severity,
      s.action_taken AS "actionTaken",
      s.details_json AS "details",
      s.ip,
      u.email AS "userEmail",
      d.device_hash AS "deviceHash",
      s.created_at AS "createdAt"
    FROM suspicious_logs s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN devices d ON d.id = s.device_id
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function adminListActivity(limit = 100, offset = 0) {
  await requireAdmin();
  const db = getDb();
  return db<
    {
      id: string;
      eventType: string;
      meta: unknown;
      ip: string | null;
      userEmail: string | null;
      createdAt: Date;
    }[]
  >`
    SELECT
      a.id,
      a.event_type AS "eventType",
      a.meta_json AS "meta",
      a.ip,
      u.email AS "userEmail",
      a.created_at AS "createdAt"
    FROM activity_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function unwrapDoubleEncoded(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export async function adminListSettings() {
  await requireAdmin();
  await ensureDefaultSettings();
  const db = getDb();
  const rows = await db<
    {
      key: string;
      value: unknown;
      group: string;
      description: string | null;
    }[]
  >`
    SELECT key, value, "group", description FROM app_settings ORDER BY "group" ASC, key ASC
  `;
  return rows.map((r) => ({
    ...r,
    value: unwrapDoubleEncoded(r.value),
  }));
}

export async function adminUpdateSetting(
  key: string,
  value: unknown,
  group?: string,
  description?: string,
) {
  await requireAdmin();
  const { setSetting } = await import("~/server/settings/service");
  const db = getDb();
  const rows = await db<{ group: string; description: string | null }[]>`
    SELECT "group", description FROM app_settings WHERE key = ${key} LIMIT 1
  `;
  const row = rows[0];
  await setSetting(key, value, {
    group: group ?? row?.group ?? "general",
    description: description ?? row?.description ?? undefined,
  });
}

export async function adminDeviceCount(userId: string): Promise<number> {
  await requireAdmin();
  const db = getDb();
  const rows = await db<{ count: number }[]>`
    SELECT count(*)::int AS count FROM user_devices WHERE user_id = ${userId}
  `;
  return rows[0]?.count ?? 0;
}

export async function adminListGames() {
  await requireAdmin();
  const db = getDb();
  return db<
    {
      id: string;
      slug: string;
      day: number;
      title: string;
      hint: string | null;
      gameType: string;
      difficulty: string;
      releaseAt: Date | null;
      endAt: Date | null;
      previewAt: Date | null;
      testerEarlyHours: number;
      published: boolean;
      status: string;
      createdAt: Date;
    }[]
  >`
    SELECT
      id,
      slug,
      day,
      title,
      hint,
      game_type AS "gameType",
      difficulty,
      release_at AS "releaseAt",
      end_at AS "endAt",
      preview_at AS "previewAt",
      tester_early_hours AS "testerEarlyHours",
      published,
      'upcoming' AS status,
      created_at AS "createdAt"
    FROM games
    ORDER BY day ASC
  `;
}

export async function adminCreateGame(input: {
  slug: string;
  day: number;
  title: string;
  hint?: string;
  gameType: string;
  difficulty?: string;
  releaseAt?: string | null;
  endAt?: string | null;
  previewAt?: string | null;
  testerEarlyHours?: number;
  published?: boolean;
}) {
  await requireAdmin();
  const db = getDb();
  const slug = input.slug.trim().toLowerCase();
  const hint = input.hint ?? null;
  const difficulty = input.difficulty ?? "normal";
  const releaseAt = input.releaseAt ? new Date(input.releaseAt) : null;
  const endAt = input.endAt ? new Date(input.endAt) : null;
  const previewAt = input.previewAt ? new Date(input.previewAt) : null;
  const testerEarlyHours = input.testerEarlyHours ?? 24;
  const published = input.published ?? false;

  await db`
    INSERT INTO games (
      slug, day, title, hint, game_type, difficulty, release_at, end_at, preview_at, tester_early_hours, published
    )
    VALUES (
      ${slug}, ${input.day}, ${input.title}, ${hint}, ${input.gameType},
      ${difficulty}, ${releaseAt}, ${endAt}, ${previewAt}, ${testerEarlyHours}, ${published}
    )
  `;
  invalidateShared("games:");
}

export async function adminUpdateGame(
  id: string,
  patch: Partial<{
    slug: string;
    day: number;
    title: string;
    hint: string | null;
    gameType: string;
    difficulty: string;
    releaseAt: string | null;
    endAt: string | null;
    previewAt: string | null;
    testerEarlyHours: number;
    published: boolean;
  }>,
) {
  await requireAdmin();
  const db = getDb();
  const existing = await db<
    {
      slug: string;
      day: number;
      title: string;
      hint: string | null;
      game_type: string;
      difficulty: string;
      release_at: Date | null;
      end_at: Date | null;
      preview_at: Date | null;
      tester_early_hours: number;
      published: boolean;
    }[]
  >`
    SELECT slug, day, title, hint, game_type, difficulty, release_at, end_at, preview_at, tester_early_hours, published
    FROM games WHERE id = ${id} LIMIT 1
  `;
  const curr = existing[0];
  if (!curr) return;

  const slug = patch.slug !== undefined ? patch.slug : curr.slug;
  const day = patch.day !== undefined ? patch.day : curr.day;
  const title = patch.title !== undefined ? patch.title : curr.title;
  const hint = patch.hint !== undefined ? patch.hint : curr.hint;
  const gameType = patch.gameType !== undefined ? patch.gameType : curr.game_type;
  const difficulty = patch.difficulty !== undefined ? patch.difficulty : curr.difficulty;
  const releaseAt =
    patch.releaseAt !== undefined
      ? patch.releaseAt
        ? new Date(patch.releaseAt)
        : null
      : curr.release_at;
  const endAt =
    patch.endAt !== undefined ? (patch.endAt ? new Date(patch.endAt) : null) : curr.end_at;
  const previewAt =
    patch.previewAt !== undefined
      ? patch.previewAt
        ? new Date(patch.previewAt)
        : null
      : curr.preview_at;
  const testerEarlyHours =
    patch.testerEarlyHours !== undefined ? patch.testerEarlyHours : curr.tester_early_hours;
  const published = patch.published !== undefined ? patch.published : curr.published;

  await db`
    UPDATE games
    SET
      slug = ${slug},
      day = ${day},
      title = ${title},
      hint = ${hint},
      game_type = ${gameType},
      difficulty = ${difficulty},
      release_at = ${releaseAt},
      end_at = ${endAt},
      preview_at = ${previewAt},
      tester_early_hours = ${testerEarlyHours},
      published = ${published}
    WHERE id = ${id}
  `;
  invalidateShared("games:");
}

export async function adminDeleteGame(id: string) {
  await requireAdmin();
  const db = getDb();
  await db`DELETE FROM games WHERE id = ${id}`;
  invalidateShared("games:");
}

export async function adminGetMetrics() {
  await requireAdmin();
  const db = getDb();
  const [userCount, testerCount, gameCount, suspiciousCount, attemptCount, pookalamCount] =
    await Promise.all([
      db<{ count: number }[]>`SELECT count(*)::int AS count FROM users`,
      db<{ count: number }[]>`SELECT count(*)::int AS count FROM testers WHERE active = true`,
      db<{ count: number }[]>`SELECT count(*)::int AS count FROM games`,
      db<{ count: number }[]>`SELECT count(*)::int AS count FROM suspicious_logs`,
      db<{ count: number }[]>`SELECT count(*)::int AS count FROM game_attempts`,
      db<{ count: number }[]>`SELECT count(*)::int AS count FROM pookalam_submissions`,
    ]);

  return {
    totalUsers: userCount[0]?.count ?? 0,
    activeTesters: testerCount[0]?.count ?? 0,
    totalGames: gameCount[0]?.count ?? 0,
    suspiciousEvents: suspiciousCount[0]?.count ?? 0,
    totalAttempts: attemptCount[0]?.count ?? 0,
    pookalamSubmissions: pookalamCount[0]?.count ?? 0,
  };
}

export async function adminListAttempts(limit = 100, offset = 0) {
  await requireAdmin();
  const db = getDb();
  return db<
    {
      id: string;
      gameId: string;
      gameTitle: string;
      gameSlug: string;
      gameDay: number;
      userId: string;
      userName: string;
      userEmail: string;
      attemptNumber: number;
      status: string;
      durationMs: number | null;
      score: number | null;
      movesCount: number | null;
      serverValid: boolean;
      isAnomalous: boolean;
      afterDeadline: boolean;
      ip: string | null;
      deviceHash: string | null;
      startedAt: Date;
      submittedAt: Date | null;
      createdAt: Date;
    }[]
  >`
    SELECT
      ga.id,
      ga.game_id AS "gameId",
      g.title AS "gameTitle",
      g.slug AS "gameSlug",
      g.day AS "gameDay",
      ga.user_id AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      ga.attempt_number AS "attemptNumber",
      ga.status,
      ga.duration_ms AS "durationMs",
      ga.score,
      ga.moves_count AS "movesCount",
      ga.server_valid AS "serverValid",
      ga.is_anomalous AS "isAnomalous",
      ga.after_deadline AS "afterDeadline",
      ga.ip,
      d.device_hash AS "deviceHash",
      ga.started_at AS "startedAt",
      ga.submitted_at AS "submittedAt",
      ga.created_at AS "createdAt"
    FROM game_attempts ga
    INNER JOIN games g ON g.id = ga.game_id
    INNER JOIN users u ON u.id = ga.user_id
    LEFT JOIN devices d ON d.id = ga.device_id
    ORDER BY ga.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function adminVoidAttempt(attemptId: string) {
  await requireAdmin();
  const db = getDb();
  const attempts = await db<{ id: string; game_id: string; user_id: string }[]>`
    SELECT id, game_id, user_id FROM game_attempts WHERE id = ${attemptId} LIMIT 1
  `;
  const attempt = attempts[0];
  if (!attempt) throw new Error("Attempt not found");

  await db`
    UPDATE game_attempts SET status = 'void', server_valid = false WHERE id = ${attemptId}
  `;

  const boardEntries = await db<{ id: string }[]>`
    SELECT id FROM daily_leaderboard
    WHERE game_id = ${attempt.game_id} AND user_id = ${attempt.user_id} AND attempt_id = ${attemptId}
    LIMIT 1
  `;
  const boardEntry = boardEntries[0];

  if (boardEntry) {
    const nextBests = await db<
      {
        id: string;
        duration_ms: number | null;
        score: number | null;
        started_at: Date;
        submitted_at: Date | null;
      }[]
    >`
      SELECT id, duration_ms, score, started_at, submitted_at
      FROM game_attempts
      WHERE game_id = ${attempt.game_id} AND user_id = ${attempt.user_id} AND status = 'submitted' AND server_valid = true
      ORDER BY duration_ms ASC
      LIMIT 1
    `;
    const nextBest = nextBests[0];

    if (nextBest) {
      await db`
        UPDATE daily_leaderboard
        SET
          attempt_id = ${nextBest.id},
          duration_ms = ${nextBest.duration_ms},
          score = ${nextBest.score},
          started_at = ${nextBest.started_at},
          submitted_at = ${nextBest.submitted_at ?? nextBest.started_at}
        WHERE id = ${boardEntry.id}
      `;
    } else {
      await db`DELETE FROM daily_leaderboard WHERE id = ${boardEntry.id}`;
    }
  }
}

export async function adminRemoveLeaderboardEntry(leaderboardId: string) {
  await requireAdmin();
  const db = getDb();
  await db`DELETE FROM daily_leaderboard WHERE id = ${leaderboardId}`;
}

export async function adminResetTesterAttempts(input: {
  allTesters?: boolean;
  testerEmails?: string[];
  gameIds?: string[];
}) {
  await requireAdmin();
  const emails = (input.testerEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!input.allTesters && emails.length === 0) {
    throw new Error("Select at least one tester or choose all testers");
  }

  const db = getDb();
  let testerUsers: { id: string }[];
  if (input.allTesters) {
    testerUsers = await db<{ id: string }[]>`
      SELECT u.id FROM users u
      INNER JOIN testers t ON t.email = u.email
      WHERE u.role = 'tester'
    `;
  } else {
    testerUsers = await db<{ id: string }[]>`
      SELECT u.id FROM users u
      INNER JOIN testers t ON t.email = u.email
      WHERE u.role = 'tester' AND u.email = ANY(${emails})
    `;
  }
  const userIds = testerUsers.map((user) => user.id);
  if (userIds.length === 0) return 0;

  let matching: { id: string }[];
  if (input.gameIds?.length) {
    matching = await db<{ id: string }[]>`
      SELECT id FROM game_attempts
      WHERE user_id = ANY(${userIds}) AND game_id = ANY(${input.gameIds})
    `;
  } else {
    matching = await db<{ id: string }[]>`
      SELECT id FROM game_attempts WHERE user_id = ANY(${userIds})
    `;
  }
  if (matching.length === 0) return 0;

  const attemptIds = matching.map((attempt) => attempt.id);
  await db`DELETE FROM daily_leaderboard WHERE attempt_id = ANY(${attemptIds})`;
  await db`DELETE FROM game_attempts WHERE id = ANY(${attemptIds})`;
  return matching.length;
}

export async function adminResetGameAttempts(gameIds: string[]) {
  await requireAdmin();
  if (gameIds.length === 0) throw new Error("Select at least one game");
  const db = getDb();
  const matching = await db<{ id: string }[]>`
    SELECT ga.id FROM game_attempts ga
    INNER JOIN users u ON u.id = ga.user_id
    WHERE ga.game_id = ANY(${gameIds}) AND (u.role = 'tester' OR u.role = 'admin')
  `;
  if (matching.length === 0) return 0;
  const attemptIds = matching.map((attempt) => attempt.id);
  await db`DELETE FROM daily_leaderboard WHERE attempt_id = ANY(${attemptIds})`;
  await db`DELETE FROM game_attempts WHERE id = ANY(${attemptIds})`;
  return matching.length;
}

export async function adminResetUserAttempts(userId: string, gameId?: string) {
  await requireAdmin();
  const db = getDb();
  const usersRows = await db<{ role: string }[]>`
    SELECT role FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = usersRows[0];
  if (!user || (user.role !== "tester" && user.role !== "admin")) {
    throw new Error("Only tester or admin data can be reset here");
  }

  let matching: { id: string }[];
  if (gameId) {
    matching = await db<{ id: string }[]>`
      SELECT id FROM game_attempts WHERE user_id = ${userId} AND game_id = ${gameId}
    `;
  } else {
    matching = await db<{ id: string }[]>`
      SELECT id FROM game_attempts WHERE user_id = ${userId}
    `;
  }
  if (matching.length === 0) return 0;
  const attemptIds = matching.map((attempt) => attempt.id);
  await db`DELETE FROM daily_leaderboard WHERE attempt_id = ANY(${attemptIds})`;
  await db`DELETE FROM game_attempts WHERE id = ANY(${attemptIds})`;
  return matching.length;
}

export async function adminListCollabMessages(limit = 30, offset = 0) {
  await requireAdmin();
  await ensureMessageTables();
  const db = getDb();

  return db<
    {
      id: string;
      dayKey: string;
      userId: string;
      userName: string;
      userAvatar: string | null;
      message: string;
      likesCount: number;
      createdAt: Date;
    }[]
  >`
    SELECT
      id,
      day_key AS "dayKey",
      user_id AS "userId",
      user_name AS "userName",
      user_avatar AS "userAvatar",
      message,
      likes_count AS "likesCount",
      created_at AS "createdAt"
    FROM collab_messages
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export interface AdminHuntQuestionStat {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  orderIndex: number;
  hintHtml: string;
  answer: string;
  active: boolean;
  stuckPlayersCount: number;
  solvedPlayersCount: number;
}

export interface AdminHuntPlayer {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  college: string | null;
  branch: string | null;
  batch: string | null;
  role: string;
  currentQuestionId: string | null;
  currentQuestionTitle: string;
  currentQuestionIndex: number | null;
  solvedCount: number;
  solvedQuestionIds: string[];
  completed: boolean;
  completedAt: string | null;
  lastSubmittedAt: string | null;
  updatedAt: string;
}

export interface AdminHuntOverview {
  totalParticipants: number;
  completedCount: number;
  inProgressCount: number;
  questions: AdminHuntQuestionStat[];
  players: AdminHuntPlayer[];
}

export async function adminGetHuntOverview(): Promise<AdminHuntOverview> {
  await requireAdmin();
  const db = getDb();

  const [questions, progressRows] = await Promise.all([
    db<
      {
        id: string;
        slug: string;
        title: string;
        difficulty: string;
        orderIndex: number;
        hintHtml: string;
        answer: string;
        active: boolean;
      }[]
    >`
      SELECT
        id,
        slug,
        title,
        difficulty,
        order_index AS "orderIndex",
        hint_html AS "hintHtml",
        answer,
        active
      FROM hunt_questions
      ORDER BY order_index ASC
    `,
    db<
      {
        progressId: string;
        userId: string;
        currentQuestionId: string | null;
        solvedQuestionIds: string[];
        solvedCount: number;
        lastSubmittedAt: Date | null;
        completedAt: Date | null;
        updatedAt: Date;
        name: string;
        email: string;
        avatarUrl: string | null;
        college: string | null;
        branch: string | null;
        batch: string | null;
        role: string;
      }[]
    >`
      SELECT
        uhp.id AS "progressId",
        uhp.user_id AS "userId",
        uhp.current_question_id AS "currentQuestionId",
        uhp.solved_question_ids AS "solvedQuestionIds",
        uhp.solved_count AS "solvedCount",
        uhp.last_submitted_at AS "lastSubmittedAt",
        uhp.completed_at AS "completedAt",
        uhp.updated_at AS "updatedAt",
        u.name,
        u.email,
        u.avatar_url AS "avatarUrl",
        u.college,
        u.branch,
        u.batch,
        u.role
      FROM user_hunt_progress uhp
      INNER JOIN users u ON u.id = uhp.user_id
      ORDER BY uhp.solved_count DESC, uhp.completed_at ASC NULLS LAST, uhp.updated_at DESC
    `,
  ]);

  const questionsMap = new Map(questions.map((q) => [q.id, q]));

  const questionStats: AdminHuntQuestionStat[] = questions.map((q) => {
    let stuckCount = 0;
    let solvedCount = 0;

    for (const p of progressRows) {
      if (!p.completedAt && p.currentQuestionId === q.id) {
        stuckCount++;
      }
      if (p.solvedQuestionIds?.includes(q.id)) {
        solvedCount++;
      }
    }

    return {
      id: q.id,
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      orderIndex: q.orderIndex,
      hintHtml: q.hintHtml,
      answer: q.answer,
      active: q.active,
      stuckPlayersCount: stuckCount,
      solvedPlayersCount: solvedCount,
    };
  });

  const completedCount = progressRows.filter((p) => !!p.completedAt).length;

  const players: AdminHuntPlayer[] = progressRows.map((p): AdminHuntPlayer => {
    const curQ = p.currentQuestionId ? questionsMap.get(p.currentQuestionId) : null;
    return {
      userId: p.userId,
      name: p.name,
      email: p.email,
      avatarUrl: p.avatarUrl,
      college: p.college,
      branch: p.branch,
      batch: p.batch,
      role: p.role ?? "player",
      currentQuestionId: p.currentQuestionId,
      currentQuestionTitle: curQ?.title ?? (p.completedAt ? "Finished Hunt 👑" : "Not Started"),
      currentQuestionIndex: curQ?.orderIndex ?? (p.completedAt ? questions.length : null),
      solvedCount:
        typeof p.solvedCount === "number"
          ? p.solvedCount
          : Array.isArray(p.solvedQuestionIds)
            ? p.solvedQuestionIds.length
            : 0,
      solvedQuestionIds: Array.isArray(p.solvedQuestionIds)
        ? (p.solvedQuestionIds as string[])
        : [],
      completed: !!p.completedAt,
      completedAt: p.completedAt ? new Date(p.completedAt).toISOString() : null,
      lastSubmittedAt: p.lastSubmittedAt ? new Date(p.lastSubmittedAt).toISOString() : null,
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    };
  });

  return {
    totalParticipants: progressRows.length,
    completedCount,
    inProgressCount: progressRows.length - completedCount,
    questions: questionStats,
    players,
  };
}
