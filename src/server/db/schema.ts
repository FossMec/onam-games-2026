import {
  boolean,
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

export const collegeEnum = pgEnum("college", ["mec", "other"]);
export const branchEnum = pgEnum("branch", ["cs", "cu", "ee", "eb", "ec", "ev", "me", "other"]);
export const batchEnum = pgEnum("batch", ["27", "28", "29", "30", "<=26"]);
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
    college: collegeEnum("college"),
    branch: branchEnum("branch"),
    batch: batchEnum("batch"),
    div: divEnum("div").default("none"),
    role: roleEnum("role").default("player"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    blockReason: text("block_reason"),
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
    fingerprintJson: jsonb("fingerprint_json"),
    fingerprintVersion: integer("fingerprint_version").notNull().default(1),
    canvasHash: text("canvas_hash"),
    webglHash: text("webgl_hash"),
    fontHash: text("font_hash"),
    screenHash: text("screen_hash"),
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
  (t) => [index("devices_last_seen_idx").on(t.lastSeenAt)],
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
    testerEarlyHours: integer("tester_early_hours").notNull().default(24),
    status: gameStatusEnum("status").notNull().default("upcoming"),
    configJson: jsonb("config_json"),
    assetsJson: jsonb("assets_json"),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("games_day_idx").on(t.day)],
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
    initialStateHash: text("initial_state_hash"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
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
    unique("game_attempts_user_game_key").on(t.userId, t.gameId),
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
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => gameAttempts.id, { onDelete: "cascade" }),
    durationMs: integer("duration_ms").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    percentileScore: doublePrecision("percentile_score"),
    isFlagged: boolean("is_flagged").notNull().default(false),
  },
  (t) => [
    unique("daily_leaderboard_game_user_key").on(t.gameId, t.userId),
    index("daily_leaderboard_duration_idx").on(t.durationMs),
  ],
);

export const globalScores = pgTable("global_scores", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  gamesCompleted: integer("games_completed").notNull().default(0),
  weightedTotal: doublePrecision("weighted_total").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type Game = typeof games.$inferSelect;
export type GameAttempt = typeof gameAttempts.$inferSelect;
