// Seeds local dev data: default settings + the 7-day schedule (day 1 = live,
// the braindead demo game) into the DATABASE_URL from .env.
// Usage: node --env-file=.env scripts/seed.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

function istDate(daysAgo) {
  const shifted = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const d = new Date(shifted.getTime() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

const settings = [
  ["schedule.event_start_date", istDate(1), "schedule"],
  ["schedule.release_time", "19:00", "schedule"],
  ["schedule.game_duration_hours", 24, "schedule"],
  ["enforce_one_user_per_device", true, "anti-cheat"],
  ["anti_cheat.speed_p99_factor", 0.1, "anti-cheat"],
  ["anti_cheat.min_plausible_ms", 1000, "anti-cheat"],
  ["ui.leaderboard_poll_ms", 120000, "ui"],
  ["ui.refresh_cooldown_ms", 10000, "ui"],
  ["social.whatsapp_group_link", "", "social"],
  ["scoring.percentile_anchor", 99, "scoring"],
];

for (const [key, value, group] of settings) {
  await sql`
    insert into app_settings ("key", value, "group")
    values (${key}, ${JSON.stringify(value)}::jsonb, ${group})
    on conflict ("key") do update set value = excluded.value, "group" = excluded.group
  `;
}

const games = [
  {
    day: 1,
    slug: "button",
    title: "The Button",
    hint: "It is a button. That is all. Do not overthink it.",
    game_type: "braindead",
    difficulty: "trivial",
  },
];

for (const g of games) {
  await sql`
    insert into games (slug, day, title, hint, game_type, difficulty, published)
    values (${g.slug}, ${g.day}, ${g.title}, ${g.hint}, ${g.game_type}, ${g.difficulty}, true)
    on conflict (slug) do update set
      title = excluded.title,
      hint = excluded.hint,
      game_type = excluded.game_type,
      published = excluded.published
  `;
}

console.log("Seeded settings +", games.length, "game ('button', braindead) — the only demo game.");
await sql.end();
