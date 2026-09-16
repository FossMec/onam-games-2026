import { createHash } from "node:crypto";
import { getDb } from "~/server/db/client";
import type { Game, OrientationParticipant } from "~/server/db/schema";
import { HttpError } from "~/server/errors";
import { hashJumpSubmission } from "~/lib/jump-sim";
import type { GameAssets } from "~/server/games/registry";
import { getGameDefByType, requireGameDef } from "~/server/games/registry";
import { getSetting } from "~/server/settings/service";
import { getRequestMeta } from "~/server/request";
import { invalidateShared, sharedRead } from "~/server/cache";
import { readOrientationCookie, writeOrientationCookie } from "./cookie";
import { ORIENTATION_BATCHES, type OrientationBatch } from "~/lib/orientation";

export { ORIENTATION_BATCHES, type OrientationBatch };

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function getOrientationSettings(): Promise<{
  gameType: string;
  currentBatch: string;
  enabled: boolean;
}> {
  const gameType = (await getSetting<string>("orientation.game_type", ""))?.trim() ?? "";
  const currentBatch =
    (await getSetting<string>("orientation.current_batch", "CS A"))?.trim() ?? "CS A";
  const enabled = (await getSetting<boolean>("orientation.enabled", false)) as boolean;
  return { gameType, currentBatch, enabled: Boolean(enabled) };
}

export async function getOrientationParticipant(): Promise<OrientationParticipant | null> {
  const cookie = await readOrientationCookie();
  if (!cookie?.pid) return null;
  const db = getDb();
  const rows = await db<OrientationParticipant[]>`
    SELECT id, name, batch, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM orientation_participants WHERE id = ${cookie.pid} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function registerOrientationParticipant(
  name: string,
  batch: string,
): Promise<OrientationParticipant> {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    throw new HttpError(400, "Name must be 2-80 characters");
  }
  const normalizedBatch = batch.trim();
  if (!(ORIENTATION_BATCHES as readonly string[]).includes(normalizedBatch)) {
    throw new HttpError(400, `Batch must be one of ${ORIENTATION_BATCHES.join(", ")}`);
  }

  const db = getDb();

  // If already has cookie and participant exists, update batch/name? Keep id stable.
  const existingCookie = await readOrientationCookie();
  if (existingCookie?.pid) {
    const existingRows = await db<OrientationParticipant[]>`
      SELECT id, name, batch, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM orientation_participants WHERE id = ${existingCookie.pid} LIMIT 1
    `;
    if (existingRows[0]) {
      // Prevent changing batch after playing? Allow but if already attempted, block batch change?
      const attempts = await db<{ id: string }[]>`
        SELECT id FROM orientation_attempts WHERE participant_id = ${existingCookie.pid} LIMIT 1
      `;
      if (attempts.length > 0 && existingRows[0].batch !== normalizedBatch) {
        throw new HttpError(400, "Cannot change batch after you have started playing");
      }
      await db`
        UPDATE orientation_participants SET name = ${trimmedName}, batch = ${normalizedBatch}, updated_at = NOW()
        WHERE id = ${existingCookie.pid}
      `;
      return {
        ...existingRows[0],
        name: trimmedName,
        batch: normalizedBatch,
      } as OrientationParticipant;
    }
  }

  const created = await db<OrientationParticipant[]>`
    INSERT INTO orientation_participants (name, batch)
    VALUES (${trimmedName}, ${normalizedBatch})
    RETURNING id, name, batch, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const participant = created[0];
  await writeOrientationCookie({ pid: participant.id });
  return participant;
}

export async function getOrientationGameCard(): Promise<
  | (Game & {
      gameType: string;
      status: "live";
      tagline: string;
      teaser: string | null;
      howTo: string[];
      metric: string;
      maxAttempts: number;
      assets: unknown;
    })
  | null
> {
  const { gameType } = await getOrientationSettings();
  if (!gameType) return null;
  const def = getGameDefByType(gameType);
  if (!def) return null;
  const db = getDb();
  const rows = await db<Game[]>`
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
      status,
      assets_json AS "assetsJson",
      published,
      created_at AS "createdAt"
    FROM games
    WHERE game_type = ${gameType}
    LIMIT 1
  `;
  const game = rows[0];
  if (!game) return null;
  return {
    ...game,
    gameType: game.gameType,
    status: "live" as const,
    tagline: def.public.tagline,
    teaser: (game.hint as string | null) ?? def.public.teaser,
    howTo: def.public.howTo,
    metric: def.metric,
    maxAttempts: def.maxAttempts,
    assets: game.assetsJson,
  };
}

export interface OrientationStartResult {
  attemptToken: string;
  gameId: string;
  view: unknown;
  startedAt: string;
  alreadyStarted: boolean;
}

export async function startOrientationAttempt(): Promise<OrientationStartResult> {
  const participant = await getOrientationParticipant();
  if (!participant) throw new HttpError(401, "Register your name and batch first");
  const { gameType, currentBatch, enabled } = await getOrientationSettings();
  if (!enabled) throw new HttpError(403, "Orientation play is currently closed by admin.");
  if (!gameType) throw new HttpError(400, "Orientation game not configured yet");
  if (participant.batch !== currentBatch) {
    throw new HttpError(
      403,
      `Only batch ${currentBatch} can play right now. Your batch is ${participant.batch}.`,
    );
  }
  const gameCard = await getOrientationGameCard();
  if (!gameCard) throw new HttpError(404, "Orientation game not found");
  const def = requireGameDef(gameCard.gameType);
  const db = getDb();

  // One attempt only per participant for orientation
  const existing = await db<
    {
      id: string;
      attempt_token: string;
      seed: string;
      started_at: Date;
      status: string;
    }[]
  >`
    SELECT id, attempt_token, seed, started_at, status
    FROM orientation_attempts
    WHERE participant_id = ${participant.id} AND game_id = ${gameCard.id}
    LIMIT 1
  `;
  const open = existing[0];
  if (open) {
    if (open.status === "submitted" || open.status === "void" || open.status === "expired") {
      throw new HttpError(409, "You have already played this game");
    }
    if (open.status === "in_progress") {
      // Check staleness
      const age = Date.now() - new Date(open.started_at).getTime();
      if (age > def.maxDurationMs) {
        await db`UPDATE orientation_attempts SET status='expired', duration_ms=${age} WHERE id=${open.id}`;
        throw new HttpError(410, "Your previous attempt expired. Contact admin if needed.");
      }
      const { view } = def.generate(
        open.seed,
        gameCard.difficulty,
        gameCard.assetsJson as GameAssets,
      );
      return {
        attemptToken: open.attempt_token,
        gameId: gameCard.id,
        view,
        startedAt: new Date(open.started_at).toISOString(),
        alreadyStarted: true,
      };
    }
  }

  const seed = `ori_${sha256(`orientation:${gameCard.gameType}:${participant.id}`)}`;
  const { view } = def.generate(seed, gameCard.difficulty, gameCard.assetsJson as GameAssets);
  const meta = getRequestMeta();
  const now = new Date();
  const created = await db<{ id: string; attempt_token: string; started_at: Date }[]>`
    INSERT INTO orientation_attempts (
      participant_id, game_id, seed, attempt_number, status, started_at, ip, user_agent
    )
    VALUES (
      ${participant.id}, ${gameCard.id}, ${seed}, 1, 'in_progress', ${now}, ${meta.ip}, ${meta.userAgent}
    )
    RETURNING id, attempt_token, started_at
  `;
  const attempt = created[0];
  return {
    attemptToken: attempt.attempt_token,
    gameId: gameCard.id,
    view,
    startedAt: new Date(attempt.started_at).toISOString(),
    alreadyStarted: false,
  };
}

export interface OrientationFinishInput {
  attemptToken: string;
  submittedState: unknown;
  claimedScore?: number;
}

export interface OrientationFinishResult {
  valid: boolean;
  durationMs: number;
  rawDurationMs: number;
  penaltyMs: number;
  score: number | null;
  metric: string;
  isPersonalBest: boolean;
  reason?: string;
}

async function upsertOrientationLeaderboard(params: {
  gameId: string;
  participantId: string;
  batch: string;
  metric: string;
  durationMs: number;
  score: number | null;
  startedAt: Date;
  submittedAt: Date;
}): Promise<boolean> {
  const db = getDb();
  const metricIsScore = params.metric === "score";
  const betterCondition = metricIsScore
    ? db`orientation_leaderboard.score IS NULL OR orientation_leaderboard.score < EXCLUDED.score`
    : db`orientation_leaderboard.duration_ms IS NULL OR orientation_leaderboard.duration_ms > EXCLUDED.duration_ms`;

  const rows = await db<{ id: string }[]>`
    INSERT INTO orientation_leaderboard (
      game_id, participant_id, batch, metric, duration_ms, score, started_at, submitted_at
    )
    VALUES (
      ${params.gameId}, ${params.participantId}, ${params.batch}, ${params.metric},
      ${params.durationMs}, ${params.score}, ${params.startedAt}, ${params.submittedAt}
    )
    ON CONFLICT (game_id, participant_id) DO UPDATE
    SET
      duration_ms = EXCLUDED.duration_ms,
      score = EXCLUDED.score,
      submitted_at = EXCLUDED.submitted_at,
      started_at = EXCLUDED.started_at,
      batch = EXCLUDED.batch
    WHERE ${betterCondition}
    RETURNING id
  `;
  if (rows.length > 0) {
    invalidateShared("orientation_leaderboard:");
    return true;
  }
  return false;
}

export async function finishOrientationAttempt(
  input: OrientationFinishInput,
): Promise<OrientationFinishResult> {
  const participant = await getOrientationParticipant();
  if (!participant) throw new HttpError(401, "Register first");
  const db = getDb();
  const rows = await db<
    {
      id: string;
      participant_id: string;
      game_id: string;
      seed: string;
      started_at: Date;
      status: string;
    }[]
  >`
    SELECT id, participant_id, game_id, seed, started_at, status
    FROM orientation_attempts WHERE attempt_token = ${input.attemptToken} LIMIT 1
  `;
  const attempt = rows[0];
  if (!attempt) throw new HttpError(404, "Attempt not found");
  if (attempt.participant_id !== participant.id) throw new HttpError(403, "Forbidden");
  if (attempt.status !== "in_progress")
    throw new HttpError(409, "This attempt has already been submitted");

  const gameRows = await db<Game[]>`
    SELECT id, slug, day, title, hint, game_type AS "gameType", difficulty,
           release_at AS "releaseAt", end_at AS "endAt", preview_at AS "previewAt",
           tester_early_hours AS "testerEarlyHours", assets_json AS "assetsJson", published, created_at AS "createdAt"
    FROM games WHERE id = ${attempt.game_id} LIMIT 1
  `;
  const game = gameRows[0];
  if (!game) throw new HttpError(404, "Game not found");
  const def = requireGameDef(game.gameType);
  const now = new Date();
  const rawDurationMs = now.getTime() - new Date(attempt.started_at).getTime();
  if (rawDurationMs > def.maxDurationMs) {
    await db`UPDATE orientation_attempts SET status='expired', duration_ms=${rawDurationMs}, submitted_at=${now} WHERE id=${attempt.id} AND status='in_progress'`;
    return {
      valid: false,
      durationMs: rawDurationMs,
      rawDurationMs,
      penaltyMs: 0,
      score: null,
      metric: def.metric,
      isPersonalBest: false,
      reason: "This attempt was open too long and expired.",
    };
  }

  // Score-metric fast path similar to main attempts
  if (def.metric === "score" && typeof input.claimedScore === "number") {
    const claimed = input.claimedScore;
    const sub = input.submittedState as {
      inputs?: unknown;
      traceFrames?: unknown;
      hash?: unknown;
    } | null;
    const traceFramesRaw = sub?.traceFrames;
    const traceFrames =
      typeof traceFramesRaw === "number" && Number.isFinite(traceFramesRaw)
        ? Math.floor(traceFramesRaw)
        : null;
    const inputsLen = Array.isArray(sub?.inputs) ? (sub.inputs as unknown[]).length : 0;
    if (claimed < 0 || !Number.isInteger(claimed)) {
      await db`UPDATE orientation_attempts SET submitted_at=${now}, duration_ms=${rawDurationMs}, score=${claimed}, status='submitted' WHERE id=${attempt.id} AND status='in_progress'`;
      return {
        valid: false,
        durationMs: rawDurationMs,
        rawDurationMs,
        penaltyMs: 0,
        score: null,
        metric: def.metric,
        isPersonalBest: false,
        reason: "Score out of bounds.",
      };
    }
    if (inputsLen > 20_000) {
      await db`UPDATE orientation_attempts SET submitted_at=${now}, duration_ms=${rawDurationMs}, score=${claimed}, status='submitted' WHERE id=${attempt.id}`;
      return {
        valid: false,
        durationMs: rawDurationMs,
        rawDurationMs,
        penaltyMs: 0,
        score: null,
        metric: def.metric,
        isPersonalBest: false,
        reason: "Too many inputs.",
      };
    }
    if (traceFrames !== null) {
      const impliedMs = (traceFrames / 60) * 1000;
      if (impliedMs > rawDurationMs * 1.1 + 3000) {
        await db`UPDATE orientation_attempts SET submitted_at=${now}, duration_ms=${rawDurationMs}, score=${claimed}, status='submitted' WHERE id=${attempt.id}`;
        return {
          valid: false,
          durationMs: rawDurationMs,
          rawDurationMs,
          penaltyMs: 0,
          score: null,
          metric: def.metric,
          isPersonalBest: false,
          reason: "Trace longer than clock.",
        };
      }
      if (traceFrames < 0) {
        await db`UPDATE orientation_attempts SET submitted_at=${now}, duration_ms=${rawDurationMs}, score=${claimed}, status='submitted' WHERE id=${attempt.id}`;
        return {
          valid: false,
          durationMs: rawDurationMs,
          rawDurationMs,
          penaltyMs: 0,
          score: null,
          metric: def.metric,
          isPersonalBest: false,
          reason: "Invalid trace.",
        };
      }
    }
    // hash check for PB
    const bestRows = await db<
      { score: number | null }[]
    >`SELECT score FROM orientation_leaderboard WHERE game_id=${attempt.game_id} AND participant_id=${participant.id} LIMIT 1`;
    const currentBest = bestRows[0]?.score != null ? Number(bestRows[0].score) : null;
    const isPbCandidate = currentBest === null || claimed > currentBest;
    if (isPbCandidate && typeof (sub as { hash?: unknown } | null)?.hash === "string") {
      const clientHash = (sub as { hash: string }).hash;
      const inputs = Array.isArray(sub?.inputs) ? (sub.inputs as number[]) : [];
      const expected = hashJumpSubmission(attempt.seed, inputs, traceFrames ?? 0);
      if (clientHash !== expected) {
        await db`UPDATE orientation_attempts SET submitted_at=${now}, duration_ms=${rawDurationMs}, score=${claimed}, status='submitted' WHERE id=${attempt.id}`;
        return {
          valid: false,
          durationMs: rawDurationMs,
          rawDurationMs,
          penaltyMs: 0,
          score: null,
          metric: def.metric,
          isPersonalBest: false,
          reason: "Score verification failed.",
        };
      }
    }
    await db`UPDATE orientation_attempts SET submitted_at=${now}, duration_ms=${rawDurationMs}, score=${claimed}, status='submitted', moves_count=${inputsLen} WHERE id=${attempt.id} AND status='in_progress'`;
    const isPb = await upsertOrientationLeaderboard({
      gameId: attempt.game_id,
      participantId: participant.id,
      batch: participant.batch,
      metric: def.metric,
      durationMs: rawDurationMs,
      score: claimed,
      startedAt: new Date(attempt.started_at),
      submittedAt: now,
    });
    return {
      valid: true,
      durationMs: rawDurationMs,
      rawDurationMs,
      penaltyMs: 0,
      score: claimed,
      metric: def.metric,
      isPersonalBest: isPb,
    };
  }

  const result = await def.verify({
    seed: attempt.seed,
    difficulty: game.difficulty,
    submission: input.submittedState,
    durationMs: rawDurationMs,
    userId: participant.id,
    startedAt: new Date(attempt.started_at),
  });

  const penaltyMs = result.valid ? Math.max(0, result.durationPenaltyMs ?? 0) : 0;
  const durationMs = rawDurationMs + penaltyMs;
  const score = def.metric === "score" ? (result.score ?? 0) : null;

  const updated = await db<{ id: string }[]>`
    UPDATE orientation_attempts
    SET submitted_at=${now}, duration_ms=${durationMs}, score=${score}, status='submitted', moves_count=${result.movesCount ?? null}
    WHERE id=${attempt.id} AND status='in_progress'
    RETURNING id
  `;
  if (updated.length === 0) throw new HttpError(409, "This attempt has already been submitted");

  let isPersonalBest = false;
  if (result.valid) {
    isPersonalBest = await upsertOrientationLeaderboard({
      gameId: attempt.game_id,
      participantId: participant.id,
      batch: participant.batch,
      metric: def.metric,
      durationMs,
      score,
      startedAt: new Date(attempt.started_at),
      submittedAt: now,
    });
  }

  return {
    valid: result.valid,
    durationMs,
    rawDurationMs,
    penaltyMs,
    score,
    metric: def.metric,
    isPersonalBest,
    reason: result.valid ? undefined : result.reason,
  };
}

export interface OrientationMyAttempt {
  status: "none" | "in_progress" | "submitted" | "expired" | "void";
  metric: string;
  durationMs: number | null;
  score: number | null;
  startedAt: string | null;
  submittedAt: string | null;
}

export async function getOrientationMyAttempt(): Promise<OrientationMyAttempt | null> {
  const participant = await getOrientationParticipant();
  if (!participant) return null;
  const gameCard = await getOrientationGameCard();
  if (!gameCard) return null;
  const def = getGameDefByType(gameCard.gameType);
  if (!def) return null;
  const db = getDb();
  const rows = await db<
    {
      status: string;
      duration_ms: number | null;
      score: number | null;
      started_at: Date;
      submitted_at: Date | null;
    }[]
  >`
    SELECT status, duration_ms, score, started_at, submitted_at
    FROM orientation_attempts
    WHERE participant_id = ${participant.id} AND game_id = ${gameCard.id}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) {
    return {
      status: "none",
      metric: def.metric,
      durationMs: null,
      score: null,
      startedAt: null,
      submittedAt: null,
    };
  }
  return {
    status: r.status as OrientationMyAttempt["status"],
    metric: def.metric,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    score: r.score != null ? Number(r.score) : null,
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
  };
}

export interface OrientationLeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  batch: string;
  durationMs: number | null;
  score: number | null;
  metric: string;
  submittedAt: string;
  isMe: boolean;
}

export interface OrientationBoard {
  entries: OrientationLeaderboardEntry[];
  myEntry: OrientationLeaderboardEntry | null;
  total: number;
  batch: string;
  metric: string;
  gameType: string;
  /** Title of the game this class actually played (falls back to the active one). */
  gameTitle: string;
}

export async function getOrientationLeaderboard(
  batch: string,
  page = 1,
  pageSize = 50,
): Promise<OrientationBoard> {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safeSize;

  /*
   * Which game is this class playing?
   *
   * This board used to be pinned to whatever `orientation.game_type` is set to
   * right now. But a class plays exactly one game, and the admin moves that
   * setting on when the next class takes the stage - so the moment they did,
   * every earlier class's board went blank. The game is a property of the
   * class, not of the current setting: read it off the class's own results.
   *
   * Falls back to the currently-configured game when the class has no results
   * yet, so the empty state still names something sensible.
   */
  const resolvedGame = await sharedRead(
    `orientation_leaderboard:game:${batch}`,
    async () => {
      const rows = await db<{ gameId: string; gameType: string; title: string }[]>`
        SELECT
          ol.game_id AS "gameId",
          g.game_type AS "gameType",
          g.title AS "title"
        FROM orientation_leaderboard ol
        INNER JOIN games g ON g.id = ol.game_id
        WHERE ol.batch = ${batch}
        GROUP BY ol.game_id, g.game_type, g.title
        ORDER BY MAX(ol.submitted_at) DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    },
    30_000,
  );

  const fallbackCard = resolvedGame ? null : await getOrientationGameCard();
  const gameId = resolvedGame?.gameId ?? fallbackCard?.id ?? null;
  const gameType = resolvedGame?.gameType ?? fallbackCard?.gameType ?? "";
  const gameTitle = resolvedGame?.title ?? fallbackCard?.title ?? "";
  const metric = getGameDefByType(gameType)?.metric ?? "time";

  if (!gameId) {
    return { entries: [], myEntry: null, total: 0, batch, metric, gameType, gameTitle: "" };
  }

  const participant = await getOrientationParticipant();

  const orderSql = (() => {
    if (gameType === "hunt") return "score DESC, submitted_at ASC, duration_ms ASC";
    if (metric === "score") return "score DESC, submitted_at ASC";
    if (metric === "fcfs") return "submitted_at ASC, started_at ASC";
    return "duration_ms ASC, started_at ASC";
  })();

  const batchFilter = batch ? db`AND ol.batch = ${batch}` : db``;

  const cachedKey = `orientation_leaderboard:${gameId}:${batch}:${safePage}:${safeSize}`;
  const result = await sharedRead(
    cachedKey,
    async () => {
      const rows = await db<
        {
          participantId: string;
          name: string;
          batch: string;
          durationMs: number | null;
          score: number | null;
          submittedAt: Date;
          startedAt: Date;
          rank: number | string;
          fieldSize: number | string;
        }[]
      >`
        WITH ranked AS (
          SELECT
            ol.participant_id AS "participantId",
            op.name AS "name",
            ol.batch AS "batch",
            ol.duration_ms AS "durationMs",
            ol.score AS "score",
            ol.submitted_at AS "submittedAt",
            ol.started_at AS "startedAt",
            ROW_NUMBER() OVER (ORDER BY ${db.unsafe(orderSql)}) AS "rank",
            COUNT(*) OVER () AS "fieldSize"
          FROM orientation_leaderboard ol
          INNER JOIN orientation_participants op ON op.id = ol.participant_id
          WHERE ol.game_id = ${gameId} ${batchFilter}
        )
        SELECT * FROM ranked
        WHERE "rank" > ${offset} AND "rank" <= ${offset + safeSize}
        ORDER BY "rank" ASC
      `;
      const total = Number(rows[0]?.fieldSize ?? 0);
      // If no rows, count total via separate query (since fieldSize null)
      let fieldSize = total;
      if (rows.length === 0) {
        const cnt = await db<
          { cnt: string }[]
        >`SELECT COUNT(*)::text AS cnt FROM orientation_leaderboard ol WHERE ol.game_id=${gameId} ${batchFilter}`;
        fieldSize = Number(cnt[0]?.cnt ?? 0);
      }
      return { rows, fieldSize };
    },
    30_000,
  );

  const entries: OrientationLeaderboardEntry[] = result.rows.map((r) => ({
    rank: Number(r.rank),
    participantId: r.participantId,
    name: r.name,
    batch: r.batch,
    durationMs: r.durationMs != null ? Number(r.durationMs) : null,
    score: r.score != null ? Number(r.score) : null,
    metric,
    submittedAt: new Date(r.submittedAt).toISOString(),
    isMe: participant ? r.participantId === participant.id : false,
  }));

  let myEntry: OrientationLeaderboardEntry | null = null;
  if (participant) {
    const found = entries.find((e) => e.participantId === participant.id);
    if (found) myEntry = found;
    else {
      const myRows = await db<
        {
          participantId: string;
          name: string;
          batch: string;
          durationMs: number | null;
          score: number | null;
          submittedAt: Date;
          rank: number | string;
        }[]
      >`
        WITH ranked AS (
          SELECT
            ol.participant_id AS "participantId",
            op.name AS "name",
            ol.batch AS "batch",
            ol.duration_ms AS "durationMs",
            ol.score AS "score",
            ol.submitted_at AS "submittedAt",
            ROW_NUMBER() OVER (ORDER BY ${db.unsafe(orderSql)}) AS "rank"
          FROM orientation_leaderboard ol
          INNER JOIN orientation_participants op ON op.id = ol.participant_id
          WHERE ol.game_id = ${gameId} ${batchFilter}
        )
        SELECT * FROM ranked WHERE "participantId" = ${participant.id} LIMIT 1
      `;
      const r = myRows[0];
      if (r) {
        myEntry = {
          rank: Number(r.rank),
          participantId: r.participantId,
          name: r.name,
          batch: r.batch,
          durationMs: r.durationMs != null ? Number(r.durationMs) : null,
          score: r.score != null ? Number(r.score) : null,
          metric,
          submittedAt: new Date(r.submittedAt).toISOString(),
          isMe: true,
        };
      }
    }
  }

  return { entries, myEntry, total: result.fieldSize, batch, metric, gameType, gameTitle };
}

export async function clearOrientationBatch(batch: string): Promise<number> {
  if (!(ORIENTATION_BATCHES as readonly string[]).includes(batch)) {
    throw new HttpError(400, "Invalid batch");
  }
  const db = getDb();
  // Find participant ids in batch
  const participants = await db<
    { id: string }[]
  >`SELECT id FROM orientation_participants WHERE batch=${batch}`;
  if (participants.length === 0) return 0;
  const ids = participants.map((p) => p.id);
  /*
   * Clear by batch, not by the currently-configured game.
   *
   * A class plays one game, but by the time an admin clears it the active
   * `orientation.game_type` may have moved on to the next class - and the old
   * filter would then silently delete nothing.
   */
  await db`DELETE FROM orientation_leaderboard WHERE batch=${batch}`;
  // Delete attempts
  const del = await db<
    { id: string }[]
  >`DELETE FROM orientation_attempts WHERE participant_id = ANY(${ids}) RETURNING id`;
  invalidateShared("orientation_leaderboard:");
  return del.length;
}

export async function clearAllOrientation(): Promise<number> {
  const db = getDb();
  await db`DELETE FROM orientation_leaderboard`;
  const del = await db<{ id: string }[]>`DELETE FROM orientation_attempts RETURNING id`;
  await db`DELETE FROM orientation_participants`;
  invalidateShared("orientation_leaderboard:");
  return del.length;
}
