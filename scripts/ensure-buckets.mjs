// Creates the storage buckets the app expects, if they are missing.
//
// SETUP.md has always said "create two public buckets", which is a step a human
// does once per environment and therefore a step a human forgets. When
// `pookalams` is missing, every entry upload fails with a generic "could not
// save that image" and nothing in the browser says why - so this exists to make
// the setup step runnable instead of remembered.
//
// Idempotent: existing buckets are left exactly as they are, never reconfigured.
//
// Usage: node --env-file=.env scripts/ensure-buckets.mjs

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role, not anon).");
  process.exit(1);
}

/** Public read, service-role write - matching what the app assumes. */
const BUCKETS = [
  { id: "avatars", public: true },
  { id: "pookalams", public: true },
];

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const listed = await fetch(`${url}/storage/v1/bucket`, { headers });
if (!listed.ok) {
  console.error(`Could not list buckets (${listed.status}): ${await listed.text()}`);
  process.exit(1);
}
const existing = new Set((await listed.json()).map((bucket) => bucket.id));

for (const bucket of BUCKETS) {
  if (existing.has(bucket.id)) {
    console.log(`ok       ${bucket.id} (already exists, untouched)`);
    continue;
  }
  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: bucket.id, name: bucket.id, public: bucket.public }),
  });
  if (!created.ok) {
    console.error(`failed   ${bucket.id} (${created.status}): ${await created.text()}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`created  ${bucket.id} (public)`);
}
