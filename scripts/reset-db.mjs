import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Pass it in the terminal environment.");
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  console.error("This wipes ALL gameplay/test data on the target database.");
  console.error("Users, games, hunt questions and app settings are preserved.");
  console.error("Re-run with --yes to confirm.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const TEST_TABLES = [
  "game_attempts",
  "daily_leaderboard",
  "activity_logs",
  "suspicious_logs",
  "blocked_ips",
  "rate_limit_windows",
  "user_devices",
  "devices",
  "auth_sessions",
  "testers",
  "pookalam_submissions",
  "pookalam_reviews",
  "pookalam_standings",
  "pookalam_votes",
  "collab_pookalam",
  "collab_pookalam_diffs",
  "collab_messages",
  "collab_message_likes",
  "user_hunt_progress",
];

const SEED_USER_PATTERN = "pookalam-seed-%@example.invalid";

const countRows = async (client, table) => {
  const [row] = await client.unsafe(`select count(*)::int as n from "${table}"`);
  return row.n;
};

console.log("--- Resetting Database (test data only) ---");
console.log(`Target: ${new URL(databaseUrl).host}`);

const before = {};
for (const table of TEST_TABLES) before[table] = await countRows(sql, table);

await sql.begin(async (tx) => {
  console.log("Truncating gameplay, device, session, pookalam, collab and hunt-progress tables...");
  await tx.unsafe(
    `truncate table ${TEST_TABLES.map((t) => `"${t}"`).join(", ")} restart identity cascade`,
  );

  console.log("Removing seeded pookalam entrants...");
  const removed = await tx`delete from users where email like ${SEED_USER_PATTERN}`;
  console.log(`Removed ${removed.count} seeded fake users.`);

  console.log("Resetting user state (trust score, streaks, bans)...");
  await tx`
    update users
    set trust_score = 100,
        streak_count = 0,
        best_streak = 0,
        last_streak_day = null,
        ban_level = 0,
        ban_until = null,
        ban_reason = null,
        ban_acked_at = null
  `;
});

let failures = 0;
for (const table of TEST_TABLES) {
  const after = await countRows(sql, table);
  if (after !== 0) failures += 1;
  console.log(`${table}: ${before[table]} -> ${after}`);
}

const remaining = await sql`select email, name, role from users order by role, created_at`;
console.log(`Users kept (${remaining.length}):`);
for (const user of remaining) console.log(`  [${user.role}] ${user.email} — ${user.name}`);

const kept = ["users", "games", "hunt_questions", "app_settings"];
for (const table of kept) console.log(`${table}: ${await countRows(sql, table)} (preserved)`);

if (failures > 0) {
  console.error(`${failures} table(s) still non-empty — investigate before going live.`);
} else {
  console.log("All test tables are empty.");
}

console.log("Note: storage buckets are NOT cleaned. Clear orphaned uploads separately if any.");
console.log("--- Reset Complete ---");
await sql.end();
