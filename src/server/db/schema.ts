import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Raw bytes. Drizzle's pg-core has no `bytea`, so this is the standard escape
 * hatch — used by the collaborative pookalam, which is one packed bit array
 * rather than anything a column type could describe.
 */
const customBytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const collegeEnum = pgEnum("college", ["mec", "other"]);
export const branchEnum = pgEnum("branch", ["cs", "cu", "ee", "eb", "ec", "ev", "me", "other"]);
export const batchEnum = pgEnum("batch", ["26", "27", "28", "29", "30", "<=26", "na"]);
export const divEnum = pgEnum("div", ["none", "a", "b", "c"]);
export const roleEnum = pgEnum("role", ["player", "tester", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supabaseUid: text("supabase_uid").notNull().unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    instagramHandle: text("instagram_handle"),
    whatsappNumber: text("whatsapp_number"),
    occupation: text("occupation"),
    college: collegeEnum("college"),
    /** Free text when `college = 'other'`; shown on public boards, so moderated. */
    collegeOther: text("college_other"),
    branch: branchEnum("branch"),
    /** Free text when `branch = 'other'`. */
    branchOther: text("branch_other"),
    batch: batchEnum("batch"),
    div: divEnum("div").default("none"),
    role: roleEnum("role").default("player"),
    /**
     * Graduated enforcement, replacing the old boolean block:
     *   0 none · 1 warning (must acknowledge) · 2 soft 3h · 3 soft 24h · 4 hard
     * Levels 2 and 3 set `banUntil` and only gate *playing* - browsing and the
     * leaderboard stay open, so a benched player still has a reason to return.
     */
    banLevel: integer("ban_level").notNull().default(0),
    banUntil: timestamp("ban_until", { withTimezone: true }),
    banReason: text("ban_reason"),
    /** When the player dismissed the level-1 warning; re-armed on a new incident. */
    banAckedAt: timestamp("ban_acked_at", { withTimezone: true }),
    trustScore: integer("trust_score").notNull().default(100),
    streakCount: integer("streak_count").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    lastStreakDay: date("last_streak_day"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [index("users_created_at_idx").on(t.createdAt)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceHash: text("device_hash").notNull().unique(),
    hardwareHash: text("hardware_hash"),
    fpVisitorId: text("fp_visitor_id"),
    fingerprintJson: jsonb("fingerprint_json"),
    fingerprintVersion: integer("fingerprint_version").notNull().default(1),
    canvasHash: text("canvas_hash"),
    webglHash: text("webgl_hash"),
    fontHash: text("font_hash"),
    screenHash: text("screen_hash"),
    audioHash: text("audio_hash"),
    /** WebRTC-leaked LAN address. Identical across browsers on one machine. */
    localIp: text("local_ip"),
    userAgent: text("user_agent"),
    platform: text("platform"),
    firstIp: text("first_ip"),
    lastIp: text("last_ip"),
    firstCountry: text("first_country"),
    firstCity: text("first_city"),
    lastCountry: text("last_country"),
    lastCity: text("last_city"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    isFlagged: boolean("is_flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    flagConfidence: doublePrecision("flag_confidence"),
    flaggedAt: timestamp("flagged_at", { withTimezone: true }),
    attemptsCount: integer("attempts_count").notNull().default(0),
  },
  (t) => [
    index("devices_last_seen_idx").on(t.lastSeenAt),
    /*
     * One index per signal the account-linking pass ORs over. Postgres can
     * combine them with a bitmap OR, so looking up "every device sharing any
     * signal with this one" stays an index scan instead of degrading into a
     * full table scan once the festival fills this table up.
     */
    index("devices_hardware_hash_idx").on(t.hardwareHash),
    index("devices_fp_visitor_idx").on(t.fpVisitorId),
    index("devices_canvas_hash_idx").on(t.canvasHash),
    index("devices_webgl_hash_idx").on(t.webglHash),
    index("devices_font_hash_idx").on(t.fontHash),
    index("devices_audio_hash_idx").on(t.audioHash),
    index("devices_local_ip_idx").on(t.localIp),
    index("devices_last_ip_idx").on(t.lastIp),
  ],
);

export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    firstUsedAt: timestamp("first_used_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    usageCount: integer("usage_count").notNull().default(0),
  },
  (t) => [
    unique("user_devices_user_device_key").on(t.userId, t.deviceId),
    index("user_devices_device_idx").on(t.deviceId),
  ],
);

export const gameStatusEnum = pgEnum("game_status", ["upcoming", "tester", "live", "closed"]);

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    day: integer("day").notNull(),
    title: text("title").notNull(),
    hint: text("hint"),
    gameType: text("game_type").notNull(),
    difficulty: text("difficulty").notNull().default("normal"),
    releaseAt: timestamp("release_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    /**
     * When the game stops being a "???" and starts showing its title, art and
     * rules - while still refusing to be played. Null means "derive it from
     * `schedule.preview_hours` before the release", which is how every game
     * runs unless somebody sets a one-off.
     */
    previewAt: timestamp("preview_at", { withTimezone: true }),
    testerEarlyHours: integer("tester_early_hours").notNull().default(24),
    status: gameStatusEnum("status").notNull().default("upcoming"),
    /**
     * Public asset references only (pookalam image URL, sprite sheet). Anything
     * that would spoil a puzzle belongs in the registry, not here - this column
     * is reachable from the browser for every published game.
     */
    assetsJson: jsonb("assets_json"),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("games_day_idx").on(t.day),
    index("games_published_day_idx").on(t.published, t.day),
  ],
);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "expired",
  "void",
]);

export const gameAttempts = pgTable(
  "game_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptToken: uuid("attempt_token").defaultRandom().notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    seed: text("seed").notNull(),
    /**
     * 1-based, per (user, game). One-shot games cap this at 1 via the registry's
     * `maxAttempts` rather than a DB constraint, so retry games (Maveli Jump)
     * share the exact same code path.
     */
    attemptNumber: integer("attempt_number").notNull().default(1),
    initialStateHash: text("initial_state_hash"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    /**
     * Server-derived score for `metric: "score"` games - the value returned by
     * the registry's `verify`, never the number the client claimed.
     */
    score: integer("score"),
    submittedStateHash: text("submitted_state_hash"),
    serverValid: boolean("server_valid").notNull().default(false),
    isAnomalous: boolean("is_anomalous").notNull().default(false),
    afterDeadline: boolean("after_deadline").notNull().default(false),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    movesCount: integer("moves_count"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    country: text("country"),
    city: text("city"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Replaces the old unique(user, game): retry games need many rows, and the
    // per-day cap now comes from the registry. This still makes a duplicate
    // attempt number impossible, so a raced double-start cannot mint two rows.
    unique("game_attempts_user_game_number_key").on(t.userId, t.gameId, t.attemptNumber),
    index("game_attempts_user_game_idx").on(t.userId, t.gameId),
    index("game_attempts_user_game_status_idx").on(t.userId, t.gameId, t.status),
    index("game_attempts_game_idx").on(t.gameId),
    index("game_attempts_started_at_idx").on(t.startedAt),
  ],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    ip: text("ip"),
    eventType: text("event_type").notNull(),
    metaJson: jsonb("meta_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_logs_user_idx").on(t.userId),
    index("activity_logs_created_at_idx").on(t.createdAt),
  ],
);

export const severityEnum = pgEnum("severity", ["info", "warn", "critical"]);
export const actionTakenEnum = pgEnum("action_taken", ["none", "flag", "block"]);

export const suspiciousLogs = pgTable(
  "suspicious_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    ip: text("ip"),
    eventType: text("event_type").notNull(),
    severity: severityEnum("severity").notNull().default("info"),
    detailsJson: jsonb("details_json"),
    actionTaken: actionTakenEnum("action_taken").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("suspicious_logs_created_at_idx").on(t.createdAt),
    index("suspicious_logs_ip_idx").on(t.ip),
    index("suspicious_logs_user_idx").on(t.userId),
  ],
);

export const blockScopeEnum = pgEnum("block_scope", ["auth", "game", "all"]);

export const blockedIps = pgTable("blocked_ips", {
  ip: text("ip").primaryKey(),
  reason: text("reason"),
  scope: blockScopeEnum("scope").notNull().default("all"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limit_windows_expires_idx").on(t.expiresAt)],
);

export const testers = pgTable(
  "testers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    earlyHours: integer("early_hours").notNull().default(24),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("testers_active_idx").on(t.active)],
);

export const appSettings = pgTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    group: text("group").notNull().default("general"),
    description: text("description"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("app_settings_group_idx").on(t.group)],
);

export const metricEnum = pgEnum("metric", ["time", "score", "fcfs"]);

/**
 * One row per (game, user): the player's *best* result for that day.
 *
 * `durationMs` and `score` are both nullable because the games are not
 * commensurable in their raw units - a time game has no score and Maveli Jump
 * has no meaningful completion time. `metric` says which column ranks this row.
 * Cross-game comparison happens only through `points`, never through raw units.
 */
export const dailyLeaderboard = pgTable(
  "daily_leaderboard",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The specific attempt that produced this best result. */
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => gameAttempts.id, { onDelete: "cascade" }),
    metric: metricEnum("metric").notNull().default("time"),
    /** Ranking value for `time` games; also the tiebreak for `fcfs`. */
    durationMs: integer("duration_ms"),
    /** Ranking value for `score` games (best run of the day). */
    score: integer("score"),
    /** Runs used today. Display only - never affects ranking. */
    attemptsUsed: integer("attempts_used").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    isFlagged: boolean("is_flagged").notNull().default(false),
  },
  (t) => [
    unique("daily_leaderboard_game_user_key").on(t.gameId, t.userId),
    index("daily_leaderboard_game_duration_idx").on(t.gameId, t.isFlagged, t.durationMs),
    index("daily_leaderboard_game_score_idx").on(t.gameId, t.isFlagged, t.score),
    index("daily_leaderboard_game_submitted_idx").on(t.gameId, t.isFlagged, t.submittedAt),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    country: text("country"),
    city: text("city"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auth_sessions_user_idx").on(t.userId),
    index("auth_sessions_device_idx").on(t.deviceId),
    index("auth_sessions_revoked_idx").on(t.revokedAt),
  ],
);

/* --------------------------------------------------------------- day 7 */

export const pookalamStatusEnum = pgEnum("pookalam_status", ["pending", "approved", "rejected"]);

/**
 * Code-a-Pookalam entries. One per person, hence the unique on `userId` - the
 * contest is judged by head-to-head voting and letting one person field three
 * entries would let them farm the pairing.
 *
 * Artwork is uploaded to our own bucket rather than linked. A borrowed URL rots
 * between review and voting, can be swapped for something else after approval,
 * and leaks the author's identity through the hosting path - which would defeat
 * the anonymous round entirely. `status` gates whether an entry is *valid*;
 * `shortlisted` gates whether it enters the day-7 pairing.
 */
export const pookalamSubmissions = pgTable(
  "pookalam_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Where the code lives. The whole point of the contest. */
    sourceUrl: text("source_url").notNull(),
    /** Public URL of the stored render. Shown to voters; the source URL is not. */
    imageUrl: text("image_url").notNull(),
    /** Object key inside the bucket, so a replaced image can be cleaned up. */
    imagePath: text("image_path"),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    notes: text("notes"),
    status: pookalamStatusEnum("status").notNull().default("pending"),
    /**
     * Picked by an admin for the public Elo round.
     *
     * Separate from `status` because they answer different questions: `approved`
     * means the entry is real, on-brief and safe to show, while `shortlisted`
     * means it is one of the top N the crowd will actually vote between. Every
     * shortlisted entry is approved; most approved entries are not shortlisted.
     */
    shortlisted: boolean("shortlisted").notNull().default(false),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /**
     * Elo. Starts at 1200 by convention; `matches` drives the K-factor so a new
     * entry converges fast and a settled one stops swinging on one vote.
     */
    rating: doublePrecision("rating").notNull().default(1200),
    matches: integer("matches").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    /**
     * Admin correction, added to `rating` to produce the score that ranks.
     *
     * Deliberately a *separate* column rather than an edit to `rating`. A
     * public contest that lets a human quietly rewrite a number has no result
     * worth announcing - keeping the correction beside the Elo means the raw
     * crowd verdict survives, the intervention is visible, and setting it back
     * to zero fully undoes it. It exists for the cases the maths cannot see:
     * a brigade of sockpuppets downvoting one entry, or a friend group farming
     * one up. `adjustmentNote` is required by the service, not by the column,
     * so the reason is always recorded next to the number.
     */
    adjustment: doublePrecision("adjustment").notNull().default(0),
    adjustmentNote: text("adjustment_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("pookalam_submissions_user_key").on(t.userId),
    index("pookalam_submissions_status_idx").on(t.status, t.matches, t.id),
    index("pookalam_submissions_rating_idx").on(t.rating),
    // The pairing query's exact predicate: shortlisted entries, least-seen
    // first. Small table, but this runs on every single tap during day 7.
    index("pookalam_submissions_shortlist_idx").on(t.shortlisted, t.status, t.matches),
  ],
);

export const pookalamVerdictEnum = pgEnum("pookalam_verdict", ["like", "dislike"]);

/**
 * Tester and admin feedback on an entry, before the public round.
 *
 * This is the shortlisting instrument, not a score: the admin picks the top N
 * by hand, and these give them something to pick *on* besides their own taste.
 * A verdict without a reason is nearly useless for that, which is why the
 * comment sits on the same row rather than in a separate table - one row per
 * (reviewer, entry), rewritten when they change their mind.
 *
 * Kept strictly apart from `pookalam_votes`. These are named opinions from a
 * handful of trusted people used to *choose* the field; those are anonymous
 * head-to-heads from the crowd used to *rank* it. Merging them would let a
 * tester's like leak into an Elo rating.
 */
export const pookalamReviews = pgTable(
  "pookalam_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => pookalamSubmissions.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verdict: pookalamVerdictEnum("verdict").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("pookalam_reviews_submission_reviewer_key").on(t.submissionId, t.reviewerId),
    index("pookalam_reviews_submission_idx").on(t.submissionId),
  ],
);

/**
 * Deliberately stale copies of the two day-7 boards.
 *
 * Both leaderboards are recomputed on read and cached here for a configurable
 * delay. The lag is a feature, not an optimisation: a board that updates the
 * instant you vote turns the round into a bandwagon, where late voters see
 * which pookalam is winning and vote for it. A minute of staleness breaks that
 * feedback loop while still feeling live.
 *
 * It happens to be the cheap option too - the voter board is an aggregate over
 * every vote ever cast, and day 7 is the one day everybody is refreshing it.
 * A table rather than process memory because serverless instances do not share
 * one, so an in-process cache would show a different lag per instance.
 */
export const pookalamStandings = pgTable("pookalam_standings", {
  /** `entries` or `voters`. */
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The shared pookalam everybody draws on together — one row per day.
 *
 * `cells` is a fixed 1250-byte `bytea`: 2500 grid squares at four bits each,
 * where 0 is bare ground and 1–15 index the flower catalogue. The whole canvas
 * therefore fits in a single column and a single round trip, which is what lets
 * the page just re-read the lot instead of syncing deltas.
 *
 * A row per *placement* was the other option and is worse in every direction:
 * thousands of rows a day, a query that grows with how well the thing goes, and
 * an audit trail of who put which marigold where that nobody will ever read.
 *
 * `dayKey` is an IST calendar date, `YYYY-MM-DD`. Days accumulate rather than
 * reset — yesterday's rows are still here, and the page paints them underneath
 * today's, so by the end of the week the canvas is a stack of pookalams laid
 * one on another exactly as they are at home.
 *
 * There is deliberately no per-user column anywhere. How many flowers someone
 * has left today is counted in their own browser: enforcing it here would mean
 * a row per placement after all, and the worst a forged counter buys you is
 * more flowers on a communal drawing.
 */
export const collabPookalam = pgTable("collab_pookalam", {
  /** IST calendar date, `YYYY-MM-DD`. */
  dayKey: text("day_key").primaryKey(),
  /** 1250 bytes: 2500 cells x 4 bits. See `server/pookalam/grid.ts`. */
  cells: customBytea("cells").notNull(),
  /** Denormalised count, so the header does not decode 1250 bytes to say "412". */
  placed: integer("placed").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per judged pair.
 *
 * `pairKey` is the two submission ids sorted and joined, which makes "this
 * voter has already judged this pair" a unique constraint rather than
 * application logic. Without it a voter could refresh their way to voting the
 * same matchup repeatedly and move a rating on their own.
 */
export const pookalamVotes = pgTable(
  "pookalam_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    winnerId: uuid("winner_id")
      .notNull()
      .references(() => pookalamSubmissions.id, { onDelete: "cascade" }),
    loserId: uuid("loser_id")
      .notNull()
      .references(() => pookalamSubmissions.id, { onDelete: "cascade" }),
    /** Sorted `${a}:${b}` of the two submission ids. */
    pairKey: text("pair_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("pookalam_votes_voter_pair_key").on(t.voterId, t.pairKey),
    index("pookalam_votes_voter_idx").on(t.voterId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type Game = typeof games.$inferSelect;
export type GameAttempt = typeof gameAttempts.$inferSelect;
export type PookalamSubmission = typeof pookalamSubmissions.$inferSelect;
export type PookalamReview = typeof pookalamReviews.$inferSelect;
