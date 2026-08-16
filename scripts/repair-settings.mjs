// Repairs app_settings rows that were written with the wrong JSON encoding.
//
// TWO DISTINCT DAMAGE PATTERNS, both from `JSON.stringify(value)::jsonb` in the
// old seed script. postgres.js already encodes a value bound to a jsonb column,
// so pre-stringifying encoded everything a second time:
//
//   double-encoded   "19:00" was stored as a JSON string whose contents are
//                    "19:00" — quotes and all. Every regex parser fails on it,
//                    silently, and the schedule never starts.
//
//   wrong type       24 was stored as the JSON string "24" rather than the
//                    number 24, and true as "true". These mostly work by
//                    accident through JS coercion, which is worse than failing:
//                    a boolean read back as the string "false" is truthy.
//
// Only keys listed in TYPED below are retyped, so a token that happens to look
// like a number is never silently turned into one. Idempotent — safe to re-run,
// and a no-op on a database that was seeded after the fix.
//
// Usage: node --env-file=.env scripts/repair-settings.mjs [--dry]
//        DATABASE_URL=... node scripts/repair-settings.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const dry = process.argv.includes("--dry");

/** Keys whose stored value must be a number or a boolean, per the registry. */
const TYPED = {
  "schedule.game_duration_hours": "number",
  "schedule.preview_hours": "number",
  "anti_cheat.min_plausible_ms": "number",
  "ui.leaderboard_poll_ms": "number",
  "ui.refresh_cooldown_ms": "number",
  "scoring.percentile_anchor": "number",
  "pookalam.shortlist_size": "number",
  "pookalam.voter_target_pct": "number",
  "pookalam.leaderboard_delay_ms": "number",
  "pookalam.aspect_tolerance_pct": "number",
  "access.closed_beta": "boolean",
  enforce_one_user_per_device: "boolean",
  "pookalam.submissions_open": "boolean",
  "pookalam.voting_open": "boolean",
  "pookalam.results_public": "boolean",
};

const rows = await sql`select key, value from app_settings order by key`;
const fixes = [];

for (const { key, value } of rows) {
  let next = value;

  // 1. Unwrap a value that was encoded twice.
  if (typeof next === "string") {
    const trimmed = next.trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        next = JSON.parse(trimmed);
      } catch {
        // not actually JSON; leave it exactly as it is
      }
    }
  }

  // 2. Restore the intended type, for the keys that have one.
  const want = TYPED[key];
  if (want && typeof next === "string") {
    const trimmed = next.trim();
    if (want === "number" && trimmed !== "" && Number.isFinite(Number(trimmed))) {
      next = Number(trimmed);
    } else if (want === "boolean" && (trimmed === "true" || trimmed === "false")) {
      next = trimmed === "true";
    }
  }

  if (JSON.stringify(next) !== JSON.stringify(value)) {
    fixes.push({ key, from: value, to: next });
  }
}

if (fixes.length === 0) {
  console.log("nothing to repair — every setting is encoded correctly");
} else {
  for (const fix of fixes) {
    console.log(
      `${dry ? "would fix" : "fixing"}  ${fix.key}\n` +
        `    ${JSON.stringify(fix.from)} (${typeof fix.from})` +
        `  ->  ${JSON.stringify(fix.to)} (${typeof fix.to})`,
    );
    if (!dry) {
      await sql`update app_settings set value = ${sql.json(fix.to)}, updated_at = now() where key = ${fix.key}`;
    }
  }
  console.log(`\n${dry ? "would repair" : "repaired"} ${fixes.length} setting(s)`);
}

await sql.end();
