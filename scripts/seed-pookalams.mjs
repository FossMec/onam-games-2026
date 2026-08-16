// Seeds fake Code-a-Pookalam entries so the day-7 arena can be exercised
// before anyone has actually submitted anything.
//
// The artwork is the existing game key art in public/images/games — already
// square, already served by the site, and unmistakably not a real entry, so
// there is no chance of a seeded row being mistaken for a contestant's work.
// They point at local paths rather than the storage bucket, which also means
// this script needs no Supabase credentials.
//
// Entries are attached to placeholder users on an @invalid domain (RFC 2606
// reserves it, so these addresses can never collide with a real sign-in) and
// land approved + shortlisted, which is the state the arena reads.
//
// Safe to re-run: it upserts by email and by user, and resets Elo each time.
//
// Usage: node --env-file=.env scripts/seed-pookalams.mjs
//        node --env-file=.env scripts/seed-pookalams.mjs --clean
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const ENTRIES = [
  ["Concentric Thumba", "code-a-pookalam", "Recursive rings, HTML canvas, no external deps."],
  ["Vallam Spiral", "escape-the-vallam", "Polar coordinates and a lot of trial and error."],
  ["Maveli's Lattice", "maveli-jump", "Python turtle. Yes, really."],
  [
    "Swipe Right Petals",
    "open-source-tinder",
    "SVG paths generated from a golden-angle phyllotaxis.",
  ],
  [
    "Jigsaw Mandala",
    "pookalam-jigsaw",
    "Voronoi cells clipped to a circle, then coloured by ring.",
  ],
  ["Classic Ten Ring", "pookalam", "The traditional layout, drawn entirely in CSS gradients."],
  ["Treasure Geometry", "treasure-hunt", "A GLSL shader. Runs at 60fps on a potato."],
  ["Wend Weave", "wend", "Lissajous curves layered into a flower carpet."],
];

const clean = process.argv.includes("--clean");

if (clean) {
  const removed = await sql`
    delete from users where email like 'pookalam-seed-%@example.invalid'
  `;
  console.log(`removed ${removed.count} seeded entrants (submissions cascade)`);
  await sql.end();
  process.exit(0);
}

let created = 0;
for (const [index, [title, slug, notes]] of ENTRIES.entries()) {
  const email = `pookalam-seed-${index + 1}@example.invalid`;
  const [user] = await sql`
    insert into users (supabase_uid, email, name, onboarding_completed)
    values (${`seed-pookalam-${index + 1}`}, ${email}, ${`Test Entrant ${index + 1}`}, true)
    on conflict (email) do update set name = excluded.name
    returning id
  `;

  await sql`
    insert into pookalam_submissions
      (user_id, title, source_url, image_url, notes, status, shortlisted, rating, matches, wins)
    values (
      ${user.id},
      ${title},
      ${`https://github.com/fossmec/seed-pookalam-${slug}`},
      ${`/images/games/${slug}.webp`},
      ${notes},
      'approved',
      true,
      1200,
      0,
      0
    )
    on conflict (user_id) do update set
      title = excluded.title,
      source_url = excluded.source_url,
      image_url = excluded.image_url,
      notes = excluded.notes,
      status = 'approved',
      shortlisted = true,
      -- Reset the ratings too. A re-run is how you start a clean test round,
      -- and leaving yesterday's Elo behind would make the first few pairings
      -- look wrong for no reason.
      rating = 1200,
      matches = 0,
      wins = 0,
      updated_at = now()
  `;
  created += 1;
}

// Votes reference the submissions, so old ones would score against ratings that
// have just been reset. The cached boards go too, or the first page load after
// this shows the previous round for a minute.
await sql`
  delete from pookalam_votes
  where winner_id in (
    select s.id from pookalam_submissions s
    join users u on u.id = s.user_id
    where u.email like 'pookalam-seed-%@example.invalid'
  )
`;
await sql`delete from pookalam_standings`;

console.log(`seeded ${created} shortlisted pookalams`);
console.log("open /admin → App Settings → force voting open, then /code-a-pookalam/vote");
await sql.end();
