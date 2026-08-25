#!/usr/bin/env node
/**
 * Rebuilds the missing stretch of pookalam history.
 *
 * The diff log (`collab_pookalam_diffs`) lost ~a day of strokes in production,
 * so the timelapse replay starts too late. This script replays the logged
 * diffs, finds cells that hold a flower today but were never logged, and
 * backfills exactly those BEFORE the first logged stroke — paced the way
 * people actually draw.
 *
 * Scope is deliberately narrow: cells whose logged history exists but lands
 * elsewhere are left untouched; recorded strokes are never "corrected".
 *
 * Pacing is synthesised, not evenly spaced: cells are grouped per flower,
 * clustered into blobs, walked as continuous drag paths and emitted in bursts
 * separated by jittered human-ish pauses, so the timelapse reads as hands at
 * work rather than a machine filling a spreadsheet.
 *
 * The live grid row is never touched — only past-dated inserts into the log —
 * and the script is idempotent: once history matches, it finds nothing to do.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-pookalam-diffs.mjs --dry-run        # local rehearsal
 *   node --env-file=.env scripts/backfill-pookalam-diffs.mjs                  # local apply
 *   node scripts/backfill-pookalam-diffs.mjs --prod --dry-run                 # prod, prompts for password
 *   node scripts/backfill-pookalam-diffs.mjs --prod                           # prod apply
 *   node scripts/backfill-pookalam-diffs.mjs --source "<url>" [--spread-hours 24]
 */

import postgres from "postgres";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

/*
 * Nibble math copied from src/lib/pookalam-grid.ts — high nibble first, cell 0
 * is the top four bits of byte 0. Keep the two in sync if that file changes.
 */
const PACKED_BYTES = 1250;
const CELL_COUNT = PACKED_BYTES * 2; // 2500 cells, two per byte
const GRID_SIZE = 50;

function readCell(bytes, index) {
  const shift = index % 2 === 0 ? 4 : 0;
  return ((bytes[index >> 1] ?? 0) >> shift) & 0x0f;
}

function writeCell(bytes, index, flowerId) {
  const shift = index % 2 === 0 ? 4 : 0;
  const mask = 0x0f << shift;
  const current = bytes[index >> 1] ?? 0;
  bytes[index >> 1] = (current & ~mask & 0xff) | ((flowerId & 0x0f) << shift);
}

/** Deterministic PRNG so repeated runs produce identical timestamps. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Turns bare cells into believable strokes.
 *
 * People draw one flower at a time, and a finger never teleports: it drags
 * through neighbouring squares. So bucket by flower, cluster each bucket into
 * touching blobs, walk every blob as a nearest-neighbour path, and cut the
 * path into finger-length drags.
 */
function synthesizeStrokes(missing, rand) {
  const byFlower = new Map();
  for (const m of missing) {
    let bucket = byFlower.get(m.flowerId);
    if (!bucket) byFlower.set(m.flowerId, (bucket = []));
    bucket.push(m.index);
  }

  const strokes = [];
  const claimed = new Set(); // guards across buckets too — a cell holds one flower
  for (const [flowerId, indices] of byFlower) {
    const members = new Set(indices);

    for (const start of indices) {
      if (claimed.has(start)) continue;

      // Flood-fill one blob of touching cells (8-connectivity).
      const blob = [];
      const queue = [start];
      claimed.add(start);
      for (let head = 0; head < queue.length; head++) {
        const cur = queue[head];
        blob.push(cur);
        const x = cur % GRID_SIZE;
        const y = (cur / GRID_SIZE) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
            const next = ny * GRID_SIZE + nx;
            if (members.has(next) && !claimed.has(next)) {
              claimed.add(next);
              queue.push(next);
            }
          }
        }
      }

      // Walk the blob as one continuous drag, nearest unvisited neighbour.
      let cur = blob[(rand() * blob.length) | 0];
      const remaining = new Set(blob);
      const path = [];
      while (remaining.size > 0) {
        remaining.delete(cur);
        path.push(cur);
        let best = null;
        let bestDist = Infinity;
        const cx = cur % GRID_SIZE;
        const cy = (cur / GRID_SIZE) | 0;
        for (const candidate of remaining) {
          const dist =
            Math.abs((candidate % GRID_SIZE) - cx) + Math.abs(((candidate / GRID_SIZE) | 0) - cy);
          if (dist < bestDist) {
            bestDist = dist;
            best = candidate;
          }
        }
        cur = best;
      }

      // Finger drags are short; vary their length stroke to stroke.
      for (let i = 0; i < path.length;) {
        const len = Math.min(path.length - i, 12 + ((rand() * 34) | 0));
        strokes.push({ flowerId, cells: path.slice(i, i + len) });
        i += len;
      }
    }
  }
  return strokes;
}

/** Pauses between strokes: quick petals, glances away, and the odd chai run. */
function nextPause(rand) {
  const roll = rand();
  if (roll < 0.66) return 2_000 + rand() * 16_000; // next few cells
  if (roll < 0.92) return 20_000 + rand() * 260_000; // looked around
  return 300_000 + rand() * 1_800_000; // went away for a bit
}

/**
 * Lays strokes across the window with organic rhythm: fast inside a stroke
 * (drag speed plus the occasional hesitation), varied pauses between them.
 *
 * The natural pace rarely matches the window exactly, so: overshoot gets a
 * uniform slow-down, undershoot stretches only the pauses — drag speed stays
 * human no matter what, it's just that the artist takes longer strolls.
 */
function scheduleStrokes(strokes, windowStart, windowEnd, rand) {
  const available = (windowEnd - windowStart) * 0.97;

  // Pass 1: lay everything out at natural pace.
  const layout = [];
  let intraSum = 0;
  let pauseSum = 0;
  let naturalEnd = 0;
  for (let s = 0; s < strokes.length; s++) {
    if (s > 0) {
      const pause = nextPause(rand);
      layout.push({ pause });
      pauseSum += pause;
      naturalEnd += pause;
    }
    const offsets = strokes[s].cells.map(() => {
      let delta = 26 + rand() * 58; // drag speed, ms per cell
      if (rand() < 0.08) delta += 180 + rand() * 340; // mid-drag hesitation
      intraSum += delta;
      naturalEnd += delta;
      return delta;
    });
    layout.push({ offsets });
  }

  let pauseScale = 1;
  let globalScale = 1;
  if (strokes.length === 1) {
    // One lonely stroke belongs near the end of the window, not the start.
    windowStart = windowEnd - naturalEnd - (2 + rand() * 18) * 60_000;
  } else if (naturalEnd > available) {
    globalScale = available / naturalEnd;
  } else if (pauseSum > 0) {
    pauseScale = Math.min(15, (available - intraSum) / pauseSum);
  }

  // Pass 2: emit timestamps, zipping each stroke's cells with its offsets.
  let at = windowStart;
  let strokeAt = 0;
  const rows = [];
  for (const part of layout) {
    if (part.pause !== undefined) {
      at += part.pause * pauseScale * globalScale;
      continue;
    }
    const { cells, flowerId } = strokes[strokeAt++];
    part.offsets.forEach((delta, i) => {
      at += delta * globalScale;
      rows.push({ index: cells[i], flowerId, placed_at: new Date(at) });
    });
  }
  return rows;
}

export { synthesizeStrokes, scheduleStrokes, mulberry32 };

const PROD_DEFAULT =
  "postgresql://app_user.zejotrgmxdawjlurukpg@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
const PLACEHOLDER_PASSWORDS = new Set(["", "[YOUR-PASSWORD]", "YOUR-PASSWORD", "your-password"]);

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
 * Resolves where to run as plain parts — never a URL string, so passwords
 * containing '%' survive postgres.js's own parsing.
 *
 *   --prod              the production pooler, prompts for the password
 *   --source <url>      explicit target, prompts when the password is missing
 *   DATABASE_URL env    local rehearsal (default)
 */
async function resolveTarget(args) {
  const sourceIndex = args.indexOf("--source");
  const cliUrl = sourceIndex !== -1 ? args[sourceIndex + 1]?.trim() : null;

  let raw = null;
  if (cliUrl) {
    raw = cliUrl;
  } else if (args.includes("--prod")) {
    raw = process.env.PROD_DATABASE_URL || PROD_DEFAULT;
  } else if (process.env.DATABASE_URL) {
    raw = process.env.DATABASE_URL;
  } else {
    console.error(
      "❌ No database target. Use --prod, --source <url>, or DATABASE_URL (--env-file=.env).",
    );
    process.exit(1);
  }

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

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const spreadIndex = args.indexOf("--spread-hours");
  const spreadMs =
    spreadIndex !== -1
      ? Math.max(0.1, Number(args[spreadIndex + 1]) || 24) * 3600_000
      : 24 * 3600_000;

  const parts = await resolveTarget(args);
  console.log(`🎯 Target: ${parts.username}@${parts.host}:${parts.port}/${parts.database}`);
  const sql = postgres({
    host: parts.host,
    port: parts.port,
    database: parts.database,
    username: parts.username,
    password: parts.password,
    max: 1,
    connect_timeout: 15,
    ssl: /127\.0\.0\.1|localhost/.test(parts.host) ? false : "require",
    onnotice: () => {},
  });

  try {
    console.log("🌸 Pookalam diff backfill");
    if (isDryRun) console.log("🔍 Running in DRY RUN mode (no rows will be written)\n");

    const [gridRow] = await sql`
    SELECT cells, placed FROM collab_pookalam WHERE day_key = 'community' LIMIT 1
  `;
    if (!gridRow) {
      console.error("❌ No 'community' pookalam row found.");
      process.exit(1);
    }
    const liveGrid = new Uint8Array(gridRow.cells);

    const diffs = await sql`
    SELECT id, cell_index, flower_id, placed_at
    FROM collab_pookalam_diffs
    ORDER BY placed_at ASC, id ASC
  `;

    // Replay the existing log exactly like the timelapse does.
    const replayed = new Uint8Array(PACKED_BYTES);
    const everLogged = new Uint8Array(CELL_COUNT);
    let tMin = null;
    let tMax = null;
    for (const d of diffs) {
      writeCell(replayed, d.cell_index, d.flower_id);
      everLogged[d.cell_index] = 1;
      const at = new Date(d.placed_at).getTime();
      if (tMin === null || at < tMin) tMin = at;
      if (tMax === null || at > tMax) tMax = at;
    }

    const missing = [];
    let divergent = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      const cur = readCell(liveGrid, i);
      if (cur !== readCell(replayed, i)) {
        // Out of scope by design: recorded strokes are never rewritten.
        if (everLogged[i]) divergent++;
        // A stroke from the unlogged window: filled today, never logged.
        else if (cur !== 0) missing.push({ index: i, flowerId: cur });
      }
    }

    const iso = (ms) => new Date(ms).toISOString();
    console.log(`📜 Logged strokes : ${diffs.length}`);
    if (diffs.length > 0) console.log(`🕒 Log window     : ${iso(tMin)} → ${iso(tMax)}`);
    console.log(`🖼️  Live canvas    : ${gridRow.placed} flowers`);
    console.log(`➕ Missing fills  : ${missing.length} cells never logged`);
    if (divergent > 0) {
      console.log(
        `ℹ️  Divergent cells: ${divergent} (logged history kept as recorded — not touched)`,
      );
    }

    if (missing.length === 0) {
      console.log("\n✅ Nothing to backfill.");
      process.exit(0);
    }

    /* Backfills land just before logging began, paced like a drawing session. */
    const anchor = tMin ?? Date.now() - 60_000;
    const windowStart = anchor - spreadMs;
    const rand = mulberry32(20260825);

    const strokes = synthesizeStrokes(missing, rand);
    const rows = scheduleStrokes(strokes, windowStart, anchor, rand).map((r) => ({
      cell_index: r.index,
      flower_id: r.flowerId,
      placed_at: r.placed_at,
    }));

    if (!isDryRun) {
      await sql.begin(async (tx) => {
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await tx`INSERT INTO collab_pookalam_diffs ${tx(rows.slice(i, i + CHUNK))}`;
        }
      });
      console.log(
        `\n💾 Inserted ${rows.length} backfill rows across ${strokes.length} hand-paced strokes.`,
      );
    } else {
      console.log("\n[DRY RUN] Would insert:");
      if (rows.length > 0) {
        console.log(
          `   • ${rows.length} backfill cells as ${strokes.length} hand-paced strokes\n     ${iso(Number(rows[0].placed_at))} → ${iso(Number(rows.at(-1).placed_at))}`,
        );
      }
      console.log("\n[DRY RUN] Divergence vs live canvas is expected until the rows are inserted.");
    }

    if (isDryRun) process.exit(0);

    // Verify: replay the log and report how close it lands to the live canvas.
    const freshGridRow = await sql`
    SELECT cells FROM collab_pookalam WHERE day_key = 'community' LIMIT 1
  `.then((r) => r[0]);
    const freshDiffs = await sql`
    SELECT cell_index, flower_id FROM collab_pookalam_diffs ORDER BY placed_at ASC, id ASC
  `;
    const finalGrid = new Uint8Array(PACKED_BYTES);
    for (const d of freshDiffs) writeCell(finalGrid, d.cell_index, d.flower_id);

    const freshLive = new Uint8Array(freshGridRow.cells);
    let driftCells = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (readCell(finalGrid, i) !== readCell(freshLive, i)) driftCells++;
    }

    if (driftCells === 0) {
      console.log(
        `✅ Verified: replay of all ${freshDiffs.length} strokes now ends at the exact live canvas.`,
      );
    } else {
      console.log(
        `ℹ️  Replay ends ${driftCells} cells away from the live canvas — recorded strokes were kept as-is by design.`,
      );
    }
  } catch (err) {
    console.error("❌ Backfill failed:", err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  });
}
