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

const [sess] = await sql`
  insert into auth_sessions (user_id, device_id, refresh_token, access_token, ip)
  values (${userId}, ${dev.id}, ${"forge-refresh"}, ${"forge-access"}, ${"127.0.0.1"})
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

const sealed = await seal({ sid: sess.id, deviceId: dev.id }, secret, options);
console.log(`og_session=${sealed}`);
console.log(`USER_ID=${userId}`);
await sql.end();
