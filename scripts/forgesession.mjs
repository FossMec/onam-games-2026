// Creates a test user + device + session in the local DB and prints a valid
// `og_session` cookie (sealed exactly like the app does) for curl testing.
// Usage: node --env-file=.env scripts/forgesession.mjs [email]
import { seal } from "iron-webcrypto";
import postgres from "postgres";

const email = (process.argv[2] ?? "test@example.com").toLowerCase();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const [existing] = await sql`select id from users where email = ${email} limit 1`;
let userId;
if (existing) {
  userId = existing.id;
} else {
  const [u] = await sql`
    insert into users (supabase_uid, email, name, role, onboarding_completed)
    values (${`forge-${email}`}, ${email}, ${"Test Player"}, ${"admin"}, true)
    returning id
  `;
  userId = u.id;
}

const [dev] = await sql`
  insert into devices (device_hash, user_agent)
  values (${"forge-hash"}, ${"forge"})
  on conflict (device_hash) do update set last_seen_at = now()
  returning id
`;
await sql`
  insert into user_devices (user_id, device_id, is_primary)
  values (${userId}, ${dev.id}, true)
  on conflict (user_id, device_id) do nothing
`;

// `expires_at` must be set and far out. Left null, `isRefreshDue` is true on
// the very first request, the app tries to refresh "forge-refresh" against
// Supabase, fails, and revokes the session - so the forged cookie works
// exactly once and then silently stops.
const [sess] = await sql`
  insert into auth_sessions (user_id, device_id, refresh_token, access_token, ip, expires_at)
  values (${userId}, ${dev.id}, ${"forge-refresh"}, ${"forge-access"}, ${"127.0.0.1"},
          now() + interval '30 days')
  returning id
`;

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) throw new Error("SESSION_SECRET missing");

const options = {
  ttl: 2592000000, // matches the app's 30-day cookie
  timestampSkewSec: 60,
  localtimeOffsetMsec: 0,
  encryption: {
    saltBits: 256,
    algorithm: "aes-256-cbc",
    iterations: 8192,
    minPasswordlength: 32,
  },
  integrity: {
    saltBits: 256,
    algorithm: "sha256",
    iterations: 8192,
    minPasswordlength: 32,
  },
};

// h3 v2 seals the whole session envelope, not just the payload: `data` is
// where `readAuthCookie` looks, and a missing `id` makes h3 treat the cookie as
// a fresh anonymous session and silently discard it.
const sealed = await seal(
  { id: crypto.randomUUID(), createdAt: Date.now(), data: { sid: sess.id, deviceId: dev.id } },
  secret,
  { ...options, encode: JSON.stringify },
);
console.log(`og_session=${sealed}`);
console.log(`USER_ID=${userId}`);
await sql.end();
