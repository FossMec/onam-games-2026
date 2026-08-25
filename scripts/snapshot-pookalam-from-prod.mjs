#!/usr/bin/env node
/**
 * Copies the collaborative pookalam state from PRODUCTION into the LOCAL db
 * so the diff-backfill can be rehearsed safely before touching prod.
 *
 * Reads (source, read-only):
 *   - collab_pookalam      -> the single 'community' canvas row
 *   - collab_pookalam_diffs-> every logged stroke with its original timestamp
 *
 * Writes (target = DATABASE_URL from .env):
 *   - ensures both tables exist, upserts the community row, replaces the
 *     local diff log with an exact mirror (original ids + placed_at kept).
 *
 * Usage:
 *   node --env-file=.env scripts/snapshot-pookalam-from-prod.mjs
 *
 * The source defaults to the FossMEC Supabase pooler and prompts for the
 * database password (hidden input, URL-encoded before connecting).
 * Override with: --source "postgresql://user:pass@host:5432/postgres"
 *           or:  PROD_DATABASE_URL / SOURCE_DATABASE_URL env vars.
 */

import readline from "node:readline";
import postgres from "postgres";

const DEFAULT_SOURCE =
  "postgresql://app_user.zejotrgmxdawjlurukpg@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

const PLACEHOLDER_PASSWORDS = new Set(["", "[YOUR-PASSWORD]", "YOUR-PASSWORD", "your-password"]);

/** Hidden-input password prompt; falls back to plain readline when piped. */
function askHidden(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    let input = "";
    const stdin = process.stdin;
    process.stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();

    const onData = (chunk) => {
      for (const ch of chunk.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(input);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Aborted."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          input = input.slice(0, -1);
          continue;
        }
        if (ch >= " ") {
          input += ch;
          process.stdout.write("*");
        }
      }
    };

    function cleanup() {
      stdin.setRawMode(false);
      stdin.removeListener("data", onData);
      stdin.pause();
    }

    stdin.on("data", onData);
  });
}

/**
 * Resolves the source connection as plain parts — never a URL string.
 * postgres.js re-parses URL strings with its own decodeURIComponent calls,
 * which explode on passwords containing '%'. Options objects skip all of that.
 */
async function resolveSource() {
  const flagIndex = process.argv.indexOf("--source");
  const cliUrl = flagIndex !== -1 ? process.argv[flagIndex + 1]?.trim() : null;
  const raw =
    cliUrl || process.env.PROD_DATABASE_URL || process.env.SOURCE_DATABASE_URL || DEFAULT_SOURCE;

  const url = new URL(raw);
  const parts = {
    username: url.username ? decodeURIComponent(url.username) : "app_user",
    password: url.password ? decodeURIComponent(url.password) : "",
    host: url.hostname,
    port: Number(url.port) || 5432,
    database: url.pathname.replace(/^\//, "") || "postgres",
  };

  if (!parts.password || PLACEHOLDER_PASSWORDS.has(parts.password)) {
    parts.password = await askHidden(`🔑 Password for ${parts.username}@${parts.host}: `);
    if (!parts.password) {
      console.error("❌ No password entered.");
      process.exit(1);
    }
  }
  return parts;
}

function dbIdentity(parts) {
  return `${parts.username}@${parts.host}:${parts.port}/${parts.database}`;
}

function connect(parts, label, { ssl }) {
  if (!parts?.host) {
    console.error(`❌ ${label} connection is not configured.`);
    process.exit(1);
  }
  return postgres({
    host: parts.host,
    port: parts.port,
    database: parts.database,
    username: parts.username,
    password: parts.password,
    max: 1,
    connect_timeout: 15,
    ssl,
    onnotice: () => {},
  });
}

const MAX_DIFFS = 1_000_000;

if (!process.env.DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not set — the local target db is unknown.\n   Run with: node --env-file=.env scripts/snapshot-pookalam-from-prod.mjs",
  );
  process.exit(1);
}

try {
  console.log("🌸 Pookalam snapshot: production → local\n");

  const sourceParts = await resolveSource();
  const targetUrl = new URL(process.env.DATABASE_URL);
  const targetParts = {
    username: decodeURIComponent(targetUrl.username),
    password: decodeURIComponent(targetUrl.password),
    host: targetUrl.hostname,
    port: Number(targetUrl.port) || 5432,
    database: targetUrl.pathname.replace(/^\//, "") || "postgres",
  };

  if (dbIdentity(sourceParts) === dbIdentity(targetParts)) {
    console.error("❌ Source and target are the same database — refusing.");
    process.exit(1);
  }

  const isRemote = !/127\.0\.0\.1|localhost/.test(sourceParts.host);
  const source = connect(sourceParts, "Source (prod)", { ssl: isRemote ? "require" : false });
  const target = connect(targetParts, "Target (local)", { ssl: false });

  console.log("⬇️  Reading from production…");
  const [gridRow] = await source`
    SELECT day_key, cells, placed, created_at, updated_at
    FROM collab_pookalam
    WHERE day_key = 'community'
    LIMIT 1
  `;
  if (!gridRow) {
    console.error("❌ No 'community' pookalam row found in production.");
    process.exit(1);
  }

  const diffs = await source`
    SELECT id, cell_index, flower_id, placed_at
    FROM collab_pookalam_diffs
    ORDER BY placed_at ASC, id ASC
    LIMIT ${MAX_DIFFS}
  `;
  await source.end();

  const first = diffs[0]?.placed_at ? new Date(diffs[0].placed_at).toISOString() : "—";
  const last = diffs.at(-1)?.placed_at ? new Date(diffs.at(-1).placed_at).toISOString() : "—";
  console.log(`   🖼️  Canvas: ${gridRow.placed} flowers placed`);
  console.log(`   📜 Diffs:  ${diffs.length} strokes (${first} → ${last})`);

  console.log("\n🧱 Ensuring local tables exist…");
  await target.unsafe(`
    CREATE TABLE IF NOT EXISTS collab_pookalam (
      day_key text PRIMARY KEY,
      cells bytea NOT NULL,
      placed integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS collab_pookalam_diffs (
      id bigserial PRIMARY KEY,
      cell_index smallint NOT NULL,
      flower_id smallint NOT NULL,
      placed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS collab_pookalam_diffs_placed_at_idx
      ON collab_pookalam_diffs (placed_at);
  `);

  console.log("💾 Writing snapshot to local db…");
  await target.begin(async (tx) => {
    await tx`
      INSERT INTO collab_pookalam (day_key, cells, placed, created_at, updated_at)
      VALUES (${gridRow.day_key}, ${gridRow.cells}, ${gridRow.placed},
              ${gridRow.created_at}, ${gridRow.updated_at})
      ON CONFLICT (day_key) DO UPDATE SET
        cells = EXCLUDED.cells,
        placed = EXCLUDED.placed,
        updated_at = EXCLUDED.updated_at
    `;

    await tx`DELETE FROM collab_pookalam_diffs`;

    const CHUNK = 1000;
    for (let i = 0; i < diffs.length; i += CHUNK) {
      const rows = diffs.slice(i, i + CHUNK).map((d) => ({
        id: d.id,
        cell_index: d.cell_index,
        flower_id: d.flower_id,
        placed_at: d.placed_at,
      }));
      await tx`INSERT INTO collab_pookalam_diffs ${tx(rows)}`;
    }

    await tx.unsafe(`
      SELECT setval(
        pg_get_serial_sequence('collab_pookalam_diffs', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM collab_pookalam_diffs), 1)
      )
    `);
  });

  const [check] = await target`
    SELECT count(*)::int AS n FROM collab_pookalam_diffs
  `;
  console.log(`\n✅ Snapshot complete — local now mirrors production (${check.n} diffs).`);
  console.log("➡️  Next: node --env-file=.env scripts/backfill-pookalam-diffs.mjs --dry-run");
} catch (err) {
  console.error("❌ Snapshot failed:", err?.message ?? err);
  if (err?.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
} finally {
  process.exit(0);
}
