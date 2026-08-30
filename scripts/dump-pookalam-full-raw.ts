import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

// Auto-load .env same as analyze-cheaters.ts - read-only, no writes
for (const envFile of [".env", ".env.local", ".dev.vars"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    try {
      const lines = readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed
            .slice(idx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
    } catch {
      /* ignore */
    }
  }
}

import { getDb } from "../src/server/db/client";

async function run() {
  console.log("📦 Full pookalam raw dump - READ ONLY (SELECT only, no DELETE/UPDATE/INSERT)");
  const db = getDb();

  // -- All SELECTs - descriptive only, no mutations --
  console.log("  fetching users...");
  const users = await db<any[]>`
    SELECT id, email, name, college, college_other AS "collegeOther", branch, batch, div, role,
           whatsapp_number AS "whatsappNumber", trust_score AS "trustScore", ban_level AS "banLevel",
           created_at AS "createdAt", last_login_at AS "lastLoginAt", updated_at AS "updatedAt"
    FROM users ORDER BY created_at ASC
  `;

  console.log(`  fetching pookalam_submissions (${users.length} users)...`);
  const submissions = await db<any[]>`
    SELECT s.id, s.user_id AS "userId", u.name AS "authorName", u.email AS "authorEmail",
           u.college, u.branch, u.batch, u.div,
           s.title, s.source_url AS "sourceUrl", s.image_url AS "imageUrl",
           s.status, s.shortlisted, s.rating, s.adjustment, s.adjustment_note AS "adjustmentNote",
           s.matches, s.wins, s.review_note AS "reviewNote",
           s.created_at AS "createdAt", s.updated_at AS "updatedAt"
    FROM pookalam_submissions s JOIN users u ON u.id=s.user_id
    ORDER BY (s.rating + s.adjustment) DESC
  `;

  console.log("  fetching pookalam_votes...");
  const votes = await db<any[]>`
    SELECT v.id, v.voter_id AS "voterId", vu.name AS "voterName", vu.email AS "voterEmail",
           vu.college AS "voterCollege", vu.branch AS "voterBranch", vu.batch AS "voterBatch",
           v.winner_id AS "winnerId", wu.name AS "winnerName",
           v.loser_id AS "loserId", lu.name AS "loserName",
           v.pair_key AS "pairKey", v.created_at AS "createdAt"
    FROM pookalam_votes v
    JOIN users vu ON vu.id=v.voter_id
    JOIN pookalam_submissions ws ON ws.id=v.winner_id JOIN users wu ON wu.id=ws.user_id
    JOIN pookalam_submissions ls ON ls.id=v.loser_id  JOIN users lu ON lu.id=ls.user_id
    ORDER BY v.created_at ASC
  `;

  console.log("  fetching devices + user_devices...");
  const devices = await db<any[]>`
    SELECT id, device_hash AS "deviceHash", hardware_hash AS "hardwareHash",
           fp_visitor_id AS "fpVisitorId", canvas_hash AS "canvasHash",
           webgl_hash AS "webglHash", font_hash AS "fontHash", screen_hash AS "screenHash",
           audio_hash AS "audioHash", local_ip AS "localIp", last_ip AS "lastIp", first_ip AS "firstIp",
           platform, user_agent AS "userAgent", last_country AS "lastCountry", last_city AS "lastCity",
           is_flagged AS "isFlagged", trust_score AS "trustScore"
           -- note: devices table has no trust_score, keep for compat if exists else null
    FROM devices
  `.catch(async () => {
    // fallback without trust_score if column missing on some envs
    return db<any[]>`
      SELECT id, device_hash AS "deviceHash", hardware_hash AS "hardwareHash",
             fp_visitor_id AS "fpVisitorId", canvas_hash AS "canvasHash",
             webgl_hash AS "webglHash", font_hash AS "fontHash", screen_hash AS "screenHash",
             audio_hash AS "audioHash", local_ip AS "localIp", last_ip AS "lastIp", first_ip AS "firstIp",
             platform, user_agent AS "userAgent", last_country AS "lastCountry", last_city AS "lastCity",
             is_flagged AS "isFlagged"
      FROM devices
    `;
  });

  const userDevices = await db<any[]>`
    SELECT user_id AS "userId", device_id AS "deviceId", is_primary AS "isPrimary",
           first_used_at AS "firstUsedAt", last_used_at AS "lastUsedAt", usage_count AS "usageCount"
    FROM user_devices
  `;

  console.log("  fetching activity_logs (last 30 days)...");
  const activityLogs = await db<any[]>`
    SELECT id, user_id AS "userId", device_id AS "deviceId", ip, event_type AS "eventType",
           created_at AS "createdAt"
    FROM activity_logs
    WHERE created_at > now() - interval '60 days'
    ORDER BY created_at ASC
  `;

  console.log("  fetching suspicious_logs + standings...");
  const suspiciousLogs = await db<any[]>`
    SELECT id, user_id AS "userId", device_id AS "deviceId", ip, event_type AS "eventType",
           severity, action_taken AS "actionTaken", created_at AS "createdAt"
    FROM suspicious_logs ORDER BY created_at ASC
  `;
  const standings = await db<any[]>`
    SELECT key, payload, computed_at AS "computedAt" FROM pookalam_standings
  `;

  // Summary stats for quick verification
  const generatedAt = new Date().toISOString();
  const generatedAtIst = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // Per-voter vs Aaron spike helper (for this incident but useful generally)
  const spikeVoterNames = [
    "Shainy J",
    "Nazrin M N",
    "Hanaan",
    "Nourin Fathima",
    "Nihal Ahmed",
    "Afra Fathima",
  ];
  const fayaz = users.find((u: any) => u.name === "Fayaz Unas");
  const aaron = submissions.find((s: any) => s.authorName === "Aaron Kurian Abraham");

  const summary = {
    generatedAt,
    generatedAtIst,
    counts: {
      users: users.length,
      submissions: submissions.length,
      votes: votes.length,
      devices: devices.length,
      userDevices: userDevices.length,
      activityLogs: activityLogs.length,
      suspiciousLogs: suspiciousLogs.length,
      standings: standings.length,
    },
    pookalamLeaderboard: submissions.map((s: any) => ({
      rank: s.rating + s.adjustment,
      name: s.authorName,
      email: s.authorEmail,
      elo: Math.round(s.rating + s.adjustment),
      rating: s.rating,
      adjustment: s.adjustment,
      matches: s.matches,
      wins: s.wins,
      winRate: s.matches ? `${((s.wins / s.matches) * 100).toFixed(1)}%` : "0%",
      college: s.college,
      branch: s.branch,
      batch: s.batch,
      div: s.div,
    })),
    // Quick spike verification slice - not filtering, just highlighting
    spikeSlice: {
      spikeVoters: users
        .filter((u: any) => spikeVoterNames.includes(u.name))
        .map((u: any) => ({
          name: u.name,
          email: u.email,
          whatsappNumber: u.whatsappNumber,
          college: u.college,
          branch: u.branch,
          batch: u.batch,
          div: u.div,
          createdAt: u.createdAt,
          trustScore: u.trustScore,
        })),
      fayaz,
      aaron,
      votesInSpikeWindow: votes.filter((v: any) => {
        const t = new Date(v.createdAt).getTime();
        // 2026-08-30 09:45-10:00 UTC = 15:15-15:30 IST spike
        return (
          t >= Date.parse("2026-08-30T09:45:00.000Z") && t < Date.parse("2026-08-30T10:00:00.000Z")
        );
      }),
    },
  };

  const payload = {
    meta: {
      generatedAt,
      generatedAtIst,
      note: "READ-ONLY dump. No DELETE/UPDATE/INSERT was executed. Safe to run on prod.",
      source: "scripts/dump-pookalam-full-raw.ts - SELECT only",
    },
    summary,
    users,
    submissions,
    votes,
    devices,
    userDevices,
    activityLogs,
    suspiciousLogs,
    standings,
  };

  const outDir = resolve(process.cwd(), "dumps");
  mkdirSync(outDir, { recursive: true });
  const outPathPretty = join(outDir, `pookalam-full-raw-${generatedAt.slice(0, 10)}.json`);
  const outPathMin = join(outDir, `pookalam-full-raw-${generatedAt.slice(0, 10)}.min.json`);
  const outLatest = join(outDir, `pookalam-full-raw-latest.json`);

  console.log(`  writing ${outPathPretty} ...`);
  writeFileSync(outPathPretty, JSON.stringify(payload, null, 2), "utf-8");
  writeFileSync(outPathMin, JSON.stringify(payload), "utf-8");
  writeFileSync(outLatest, JSON.stringify(payload, null, 2), "utf-8");

  const sizeMb = (JSON.stringify(payload).length / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Dump complete - ${sizeMb} MB (minified)`);
  console.log(`   Pretty: ${outPathPretty}`);
  console.log(`   Latest: ${outLatest}`);
  console.log(
    `   Counts: ${users.length} users, ${submissions.length} subs, ${votes.length} votes`,
  );
  console.log(`   Spike window votes: ${summary.spikeSlice.votesInSpikeWindow.length}`);
  console.log(`   Leaderboard now:`);
  for (const row of summary.pookalamLeaderboard.slice(0, 5)) {
    console.log(`     ${row.name} - ${row.elo} (${row.wins}/${row.matches} ${row.winRate})`);
  }
  console.log("\nNo destructive action taken. Safe to share dumps/ for verification.");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Dump failed:", e);
  process.exit(1);
});
