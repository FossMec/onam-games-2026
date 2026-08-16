// Seeds settings + the 7-day schedule into the DATABASE_URL from .env.
//
// The `games` rows carry schedule and operational state only. How each game
// behaves — attempts, limits, generation, verification — lives in
// src/server/games/registry.ts, joined on `game_type`. Keep the types below in
// sync with that file or the game will refuse to start.
//
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
  ["ui.leaderboard_poll_ms", 120000, "ui"],
  ["ui.refresh_cooldown_ms", 10000, "ui"],
  ["social.whatsapp_group_link", "", "social"],
  // Left blank on purpose: the hunt verifier fails closed until an admin sets
  // the real token, so a seeded database can never accept a guess.
  ["hunt.final_token", "", "hunt"],
  ["hunt.token_query_param", "token", "hunt"],
];

for (const [key, value, group] of settings) {
  await sql`
    insert into app_settings ("key", value, "group")
    -- sql.json(), NOT JSON.stringify(...)::jsonb. postgres.js already encodes a
    -- value bound to a jsonb column, so pre-stringifying encodes it twice and
    -- "19:00" lands in the database as a JSON string containing "19:00" with
    -- the quotes. Nothing errors; the schedule parsers just fail their regex
    -- and every game sits at "upcoming" forever.
    values (${key}, ${sql.json(value)}, ${group})
    on conflict ("key") do update set value = excluded.value, "group" = excluded.group
  `;
}

/**
 * Order is chosen for retention, not difficulty:
 *   day 1 is the lowest-friction, most shareable game (hook),
 *   day 3 is the hardest (mid-week, committed players),
 *   day 5 is the retry game on Onam eve (highest time-on-site),
 *   day 6 sends everyone back through the whole site.
 */
const games = [
  {
    day: 1,
    slug: "open-source-tinder",
    title: "Open Source Tinder",
    hint: "Some of these logos are lying to you.",
    game_type: "tinder",
    difficulty: "normal",
  },
  {
    day: 2,
    slug: "pookalam-jigsaw",
    title: "Pookalam Jigsaw",
    hint: "Every piece looks like every other piece. That is the joke.",
    game_type: "jigsaw",
    difficulty: "hard",
    // THE ARTWORK SWAP POINT. The jigsaw only uses this as a texture inside
    // its clip paths, so dropping in the real pookalam means changing this URL
    // — no deploy, no code change. Requirements: square aspect ratio, and busy
    // near the edges (a plain border makes the corner pieces pure guesswork).
    // A more symmetric design is a HARDER puzzle, so revisit `minPlausibleMs`
    // for the jigsaw in src/server/games/registry.ts when you change it.
    assets: { imageUrl: "/images/games/pookalam.webp" },
  },
  {
    day: 3,
    slug: "wend",
    title: "Wend",
    hint: "Four groups. One of them is not what you think it is.",
    game_type: "wend",
    difficulty: "hard",
  },
  {
    day: 4,
    slug: "escape-the-vallam",
    title: "Escape the Vallam",
    hint: "The snake boat only moves the long way. Everything else is in the way.",
    game_type: "unblock",
    difficulty: "hard",
  },
  {
    day: 5,
    slug: "maveli-jump",
    title: "Maveli Jump",
    hint: "Paathalam is below. Kerala is above. Start climbing.",
    game_type: "jump",
    difficulty: "normal",
  },
  {
    day: 6,
    slug: "treasure-hunt",
    title: "The Hunt",
    hint: "Clue one is here. The rest are not.",
    game_type: "hunt",
    difficulty: "hard",
  },
];

for (const g of games) {
  const assets = g.assets ? JSON.stringify(g.assets) : null;
  await sql`
    insert into games (slug, day, title, hint, game_type, difficulty, published, assets_json)
    values (
      ${g.slug}, ${g.day}, ${g.title}, ${g.hint}, ${g.game_type}, ${g.difficulty}, true,
      ${assets}::jsonb
    )
    on conflict (slug) do update set
      day = excluded.day,
      title = excluded.title,
      hint = excluded.hint,
      game_type = excluded.game_type,
      difficulty = excluded.difficulty,
      published = excluded.published,
      -- Never clobber artwork an admin swapped in by hand.
      assets_json = coalesce(excluded.assets_json, games.assets_json)
  `;
}

console.log(`Seeded ${settings.length} settings + ${games.length} games (days 1-6).`);
console.log("Day 7 (pookalam ELO voting) is not a timed game and has no `games` row.");
await sql.end();
