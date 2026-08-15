import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

console.log("--- Resetting Database Tables (Preserving Dijith Admin Accounts) ---");

// 1. Clear game attempts, pookalams, votes, anticheat logs
console.log("Clearing gameplay and submission tables...");
await sql`TRUNCATE TABLE game_attempts, pookalam_submissions, pookalam_votes, daily_leaderboard, activity_logs, suspicious_logs, blocked_ips CASCADE`;

// 2. Clear devices and sessions
console.log("Clearing devices and sessions...");
await sql`TRUNCATE TABLE user_devices, devices, auth_sessions, testers CASCADE`;

// 3. Remove non-Dijith test users and ensure Dijith accounts are admins with clean streak state
console.log("Cleaning users table...");
await sql`DELETE FROM users WHERE email NOT ILIKE '%dijith%'`;

await sql`
  UPDATE users
  SET role = 'admin',
      ban_level = 0,
      ban_until = NULL,
      ban_reason = NULL,
      trust_score = 100,
      streak_count = 0,
      best_streak = 0,
      last_streak_day = NULL
  WHERE email ILIKE '%dijith%'
`;

const remainingUsers = await sql`SELECT id, email, name, role FROM users`;
console.log("Remaining Preserved Users:", remainingUsers);

console.log("--- Reset Complete ---");
await sql.end();
