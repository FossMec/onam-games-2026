import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { computeBradleyTerryRatings, type WeightedVote } from "../src/server/pookalam/elo";

// Auto-load .env or .dev.vars if present
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

const args = process.argv.slice(2);
const isApply = args.includes("--apply") && !args.includes("--dry-run");
const isExcludeNew = args.includes("--exclude-new");

// Helper to get CLI arguments
function getArg(name: string, fallback: string | null = null): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1].trim() : fallback;
}

const dumpFile = getArg("--dump", null);
const day7CutoffStr = getArg("--cutoff", "2026-08-30T00:00:00.000Z")!;
const day7Cutoff = new Date(day7CutoffStr).getTime();
const day7Weight = isExcludeNew ? 0.0 : Number(getArg("--day7-weight", "0.05") || "0.05");

async function main() {
  console.log("🌸 Code-a-Pookalam Bradley-Terry Maximum Likelihood Rating Engine");
  console.log(
    `🛡️  Mode: ${isApply ? "🚀 APPLY (Will update submissions & clear standings cache)" : "🔍 DRY RUN / PREVIEW (Simulation only, no DB writes)"}`,
  );
  console.log(`📅 Day 7 Cutoff: ${new Date(day7Cutoff).toISOString()}`);
  if (isExcludeNew) {
    console.log(
      `🚫 New Accounts: EXCLUDED (--exclude-new active, 0.0x weight for accounts created today)`,
    );
  } else {
    console.log(`⚖️  Day 7 Account Weight: ${day7Weight}x (Reduced influence for fresh accounts)`);
  }
  console.log(`🔒 Zero Raw Data Loss: All pookalam_votes rows remain 100% untouched\n`);

  let users: any[] = [];
  let submissions: any[] = [];
  let votes: any[] = [];

  let sql: any = null;

  if (dumpFile) {
    const fullDumpPath = resolve(process.cwd(), dumpFile);
    console.log(`📦 Loading data from dump file: ${fullDumpPath}`);
    if (!existsSync(fullDumpPath)) {
      console.error(`❌ Dump file not found: ${fullDumpPath}`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(fullDumpPath, "utf-8"));
    users = raw.users;
    submissions = raw.submissions.filter((s: any) => s.status === "approved" && s.shortlisted);
    votes = raw.votes;
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error(
        "❌ DATABASE_URL is not set. Please set it in .env or pass --dump dumps/pookalam-full-raw-latest.json",
      );
      process.exit(1);
    }
    sql = postgres(databaseUrl, { max: 1 });

    const [uRows, sRows, vRows] = await Promise.all([
      sql`
        SELECT id, email, name, role, ban_level AS "banLevel", trust_score AS "trustScore", created_at AS "createdAt"
        FROM users
      `,
      sql`
        SELECT s.id, s.user_id AS "userId", u.name AS "authorName", u.email AS "authorEmail",
               s.title, s.rating, s.adjustment, s.matches, s.wins, s.shortlisted, s.status
        FROM pookalam_submissions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'approved' AND s.shortlisted = true
      `,
      sql`
        SELECT id, voter_id AS "voterId", winner_id AS "winnerId", loser_id AS "loserId", created_at AS "createdAt"
        FROM pookalam_votes
        ORDER BY created_at ASC
      `,
    ]);

    users = uRows;
    submissions = sRows;
    votes = vRows;
  }

  const userById = new Map(users.map((u) => [u.id, u]));

  // Track banned voters (strictly driven by database ban_level > 0, set via Admin panel)
  const bannedVoterIds = new Set<string>();
  const bannedReasons = new Map<string, string>();

  for (const u of users) {
    if (u.banLevel > 0) {
      bannedVoterIds.add(u.id);
      bannedReasons.set(u.id, `ban_level = ${u.banLevel}`);
    }
  }

  if (bannedVoterIds.size > 0) {
    console.log(`🚫 Banned Voters from DB (${bannedVoterIds.size}):`);
    for (const id of bannedVoterIds) {
      const u = userById.get(id);
      console.log(`   • ${u?.name || id} (${u?.email}) — ${bannedReasons.get(id)}`);
    }
    console.log("");
  }

  // Original state snapshot
  const originalLeaderboard = [...submissions]
    .map((s) => ({
      id: s.id,
      name: s.authorName,
      title: s.title,
      effectiveRating: Math.round(Number(s.rating) + Number(s.adjustment ?? 0)),
      rawRating: Number(s.rating),
      adjustment: Number(s.adjustment ?? 0),
      matches: s.matches,
      wins: s.wins,
      winRate: s.matches ? `${((s.wins / s.matches) * 100).toFixed(1)}%` : "0%",
    }))
    .sort((a, b) => b.effectiveRating - a.effectiveRating);

  const subIds = submissions.map((s) => s.id);
  const subById = new Map(submissions.map((s) => [s.id, s]));

  // 1. Prepare Weighted Votes for Bradley-Terry Maximum Likelihood
  const weightedVotes: WeightedVote[] = [];
  const testerVotes: WeightedVote[] = [];

  let fullWeightVotes = 0;
  let discountedVotes = 0;
  let excludedNewVotes = 0;
  let ignoredBannedVotes = 0;

  for (const v of votes) {
    const voter = userById.get(v.voterId);
    if (!voter) continue;

    // Skip any banned accounts in DB
    if (bannedVoterIds.has(v.voterId)) {
      ignoredBannedVotes++;
      continue;
    }

    if (!subById.has(v.winnerId) || !subById.has(v.loserId)) continue;

    const isTester = voter.role === "tester" || voter.role === "admin";
    if (isTester) {
      testerVotes.push({ winnerId: v.winnerId, loserId: v.loserId, weight: 1.0 });
    }

    const voterCreatedAt = new Date(voter.createdAt).getTime();
    const isDay7 = voterCreatedAt >= day7Cutoff;

    if (isDay7 && isExcludeNew) {
      excludedNewVotes++;
      continue;
    }

    const weight = isDay7 ? day7Weight : 1.0;

    if (isDay7) {
      discountedVotes++;
    } else {
      fullWeightVotes++;
    }

    weightedVotes.push({
      winnerId: v.winnerId,
      loserId: v.loserId,
      weight,
    });
  }

  // 2. Compute Bradley-Terry Ratings (Global Maximum Likelihood)
  const btRatings = computeBradleyTerryRatings(subIds, weightedVotes);
  const testerBtRatings = computeBradleyTerryRatings(subIds, testerVotes);
  const testerLeaderboard = [...testerBtRatings.entries()]
    .map(([id, stats]) => ({ id, rating: stats.rating }))
    .sort((a, b) => b.rating - a.rating);
  const testerRankMap = new Map(testerLeaderboard.map((s, idx) => [s.id, idx + 1]));

  console.log("📊 Vote Processing Statistics:");
  console.log(`   • Total Raw Votes:                 ${votes.length}`);
  console.log(`   • Full Weight Votes (1.0x):        ${fullWeightVotes}`);
  if (isExcludeNew) {
    console.log(`   • Excluded New User Votes (0.0x):  ${excludedNewVotes} (--exclude-new active)`);
  } else {
    console.log(`   • Day 7 Discounted Votes (${day7Weight}x):  ${discountedVotes}`);
  }
  console.log(`   • Excluded/Banned Votes (from DB): ${ignoredBannedVotes}`);
  console.log(`   • Tester/Admin Votes Cast:         ${testerVotes.length}\n`);

  // Compute final standings
  const recomputedLeaderboard = subIds
    .map((id) => {
      const s = subById.get(id)!;
      const stats = btRatings.get(id)!;
      const adjustment = Number(s.adjustment ?? 0);
      return {
        id,
        name: s.authorName,
        title: s.title,
        rating: stats.rating,
        adjustment,
        effectiveRating: Math.round(stats.rating + adjustment),
        matches: stats.matches,
        wins: stats.wins,
        winRate: stats.matches ? `${((stats.wins / stats.matches) * 100).toFixed(1)}%` : "0%",
      };
    })
    .sort((a, b) => b.effectiveRating - a.effectiveRating);

  // Print comparison table
  console.log("🏆 LEADERBOARD COMPARISON (BRADLEY-TERRY MAXIMUM LIKELIHOOD):");
  console.log(
    "------------------------------------------------------------------------------------------------------------------------",
  );
  console.log(
    ` ${"Rank".padEnd(5)} | ${"Author".padEnd(23)} | ${"Old Rating".padEnd(11)} | ${"BT Rating".padEnd(11)} | ${"Diff".padEnd(6)} | ${"Tester Rank (Elo)".padEnd(20)} | ${"Wins/Matches"}`,
  );
  console.log(
    "------------------------------------------------------------------------------------------------------------------------",
  );

  for (let i = 0; i < recomputedLeaderboard.length; i++) {
    const entry = recomputedLeaderboard[i];
    const oldEntry = originalLeaderboard.find((o) => o.id === entry.id);
    const oldScore = oldEntry ? oldEntry.effectiveRating : 1200;
    const diff = entry.effectiveRating - oldScore;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const rankStr = `#${i + 1}`.padEnd(5);
    const nameStr = entry.name.slice(0, 23).padEnd(23);
    const oldStr = `${oldScore}`.padEnd(11);
    const newStr = `${entry.effectiveRating}`.padEnd(11);

    const tObj = testerBtRatings.get(entry.id);
    const tRank = testerRankMap.get(entry.id) ?? "-";
    const tStr = `Rank #${tRank} (${Math.round(tObj?.rating ?? 1200)})`.padEnd(20);

    console.log(
      ` ${rankStr} | ${nameStr} | ${oldStr} | ${newStr} | ${diffStr.padEnd(6)} | ${tStr} | ${entry.wins}/${entry.matches} (${entry.winRate})`,
    );
  }
  console.log(
    "------------------------------------------------------------------------------------------------------------------------\n",
  );

  if (!isApply) {
    console.log("💡 To apply these changes to the live database, run:");
    console.log("   vp run pookalam:recalc --apply\n");
    console.log("   Options:");
    console.log(
      "     --exclude-new        Completely exclude accounts created after Day 7 cutoff (0.0x weight)",
    );
    console.log("     --day7-weight <num>  Set custom weight for Day 7 accounts (default: 0.05)");
    console.log(
      "     --cutoff <iso-date>  Set registration cutoff timestamp (default: 2026-08-30T00:00:00.000Z)",
    );
    if (sql) await sql.end();
    return;
  }

  if (!sql) {
    console.error("❌ Cannot apply changes in --dump mode without a live database connection.");
    process.exit(1);
  }

  // 3. Apply changes atomically in a transaction
  console.log("⚡ Applying changes to the database in an atomic transaction...");
  await sql.begin(async (tx: any) => {
    // Update submissions with recomputed Bradley-Terry Elo ratings
    for (const [id, stats] of btRatings.entries()) {
      await tx`
        UPDATE pookalam_submissions
        SET
          rating = ${stats.rating},
          matches = ${stats.matches},
          wins = ${stats.wins},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Invalidate cached standings table so users immediately see updated standings
    await tx`DELETE FROM pookalam_standings`;
    console.log("   🧹 Invalidated pookalam_standings cache.");
  });

  console.log(
    "\n✅ Successfully updated pookalam ratings with Bradley-Terry Maximum Likelihood and zero data loss!",
  );
  await sql.end();
}

main().catch(async (err) => {
  console.error("❌ Recalculation failed:", err);
  process.exit(1);
});
